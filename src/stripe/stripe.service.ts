import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { RedisService } from '@/redis/redis.service';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  buildCheckoutPayload,
  buildSubscriptionPayload,
  calculateStartTimestamp,
  MEANINGFUL_EVENT_TYPES,
  formatRecentActivities,
  formatCustomerData,
  formatCustomerList,
} from './stripe.factory';
@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY in configuration');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: this.configService.get<string>('STRIPE_API_VERSION') as any || '2026-02-25.clover',
    });
  }

  async createCheckoutSession(orderId: string, amount: number) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
    const payload = buildCheckoutPayload(orderId, amount, frontendUrl);
    const session = await this.stripe.checkout.sessions.create(payload);
    return { checkoutUrl: session.url };
  }

  // ==================  SUBSCRIPTION  ===========================
  async createSubscriptionSession(userId: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL')!;
    const priceId = this.configService.get<string>('SUBSCRIPTION_PRICE_ID')?.trim() || '';

    if (!priceId) {
      throw new Error('Missing SUBSCRIPTION_PRICE_ID in configuration');
    }
    const payload = buildSubscriptionPayload(userId, priceId, frontendUrl);
    const session = await this.stripe.checkout.sessions.create(payload);
    return { checkoutUrl: session.url };
  }

  async createCustomerPortalSession(customerId: string) {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required to access the billing portal');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.configService.get('FRONTEND_URL')}/stripe/success`,
    });

    return { portalUrl: session.url };
  }

  constructEventFromPayload(signature: string, payload: Buffer): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException('Missing STRIPE_WEBHOOK_SECRET in configuration');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }
  }

  async handleWebhookEvent(event: Stripe.Event) {
    const redisKey = `stripe_event_${event.id}`;
    const isDuplicate = await this.redisService.getCache(redisKey);
    if (isDuplicate) {
      console.log(`[WEBHOOK] Duplicate event received: ${event.id}. Ignoring.`);
      return;
    }
    await this.redisService.setCache(redisKey, true, 3600); // Cache for 1 hour

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'payment') {
          const orderId = session.metadata?.orderId;
          console.log(`[SERVICE] Updating order status for Order #${orderId} to PAID...`);
        } else if (session.mode === 'subscription') {
          const userId = session.client_reference_id;
          console.log(`[SERVICE] Activating the VIP package for User: ${userId}...`);
        }
        break;

      case 'invoice.paid':
        const invoice = event.data.object as any;

        if (invoice.subscription) {
          const customerEmail = invoice.customer_email;
          console.log(`[SERVICE] Customer ${customerEmail} have just been successfully renewed. Plus VIP days!`);
        }
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as any;
        const customerEmail = failedInvoice.customer_email || 'trung@gmail.com';
        const customerId = failedInvoice.customer;

        if (customerEmail && customerId) {
          console.log(`[SERVICE] Payment failed for customer ${customerEmail} (ID: ${customerId}). Please check the payment method and retry.`);
          const portalSession = await this.createCustomerPortalSession(customerId);
          // Optionally, you can call the mail service to notify the customer
          await this.mailService.sendPaymentFailedEmail(
            customerEmail,
            portalSession.portalUrl,
            'vi',
          );
        }
        break;

      default:
        console.log(`[SERVICE] Ignore an unprocessed event: ${event.type}`);
    }
  }

  async refundPayment(paymentIntentId: string) {
    if (!paymentIntentId) {
      throw new BadRequestException('Payment Intent ID is required for refund');
    }
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
      });

      console.log(`[SERVICE] Refund initiated for Payment Intent ${paymentIntentId}. Refund ID: ${refund.id}, Status: ${refund.status}`);
      return {
        success: true,
        message: `Refund initiated successfully`,
        RefundID: refund.id,
        status: refund.status,
      };
    } catch (error) {
      console.error(`[SERVICE] Refund failed for Payment Intent ${paymentIntentId}:`, error);
      throw new BadRequestException(`Refund failed: ${error.message}`);
    }
  }

  // -------------------- HISTORY ----------------------
  async listPaymentHistory(customerId: string) {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required to list payment history');
    }
    try {
      const invoicesList = await this.stripe.invoices.list({
        customer: customerId,
        limit: 10,
      });

      const formattedPayments = invoicesList.data.map((invoice) => ({
        // id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        status: invoice.status,
        created: new Date(invoice.created * 1000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        hosted_invoice_url: invoice.hosted_invoice_url || null,
        invoice_pdf: invoice.invoice_pdf || null,
      }));
      return {
        success: true,
        payments: formattedPayments,
        total: invoicesList.data.length,
        // data: invoicesList.data,
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while fetching payment history for Customer ${customerId}:`, error);
      throw new BadRequestException(`Error occurred while fetching payment history: ${error.message}`);
    }
  }

  // ================== ANALYTICS ===========================
  async dashboardAnalytics(range: 'day' | 'week' | 'month' | 'year' = 'month') {
    try {
      const startTimestamp = calculateStartTimestamp(range);
      const [payments, refunds, invoices, events] = await Promise.all([
        this.stripe.paymentIntents.list({ created: { gte: startTimestamp }, limit: 100 }),
        this.stripe.refunds.list({ created: { gte: startTimestamp }, limit: 100 }),
        this.stripe.invoices.list({ created: { gte: startTimestamp }, limit: 100 }),
        this.stripe.events.list({
          types: MEANINGFUL_EVENT_TYPES,
          limit: 15,
        }),
      ]);

      const successfulPayments = payments.data.filter((payment) => payment.status === 'succeeded');
      const totalRevenue = payments.data.reduce((sum, payment) => sum + payment.amount, 0);

      const chartDataMap: Record<string, number> = {};
      successfulPayments.forEach((payment) => {
        const dateKey = new Date(payment.created * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        chartDataMap[dateKey] = (chartDataMap[dateKey] || 0) + payment.amount;
      });

      const chartData = Object.entries(chartDataMap).map(([date, amount]) => ({ date, revenue: chartDataMap[date] }));
      const recentActivities = formatRecentActivities(events.data);

      return {
        success: true,
        data: {
          total_revenue: totalRevenue,
          total_refunds: refunds.data.length,
          total_invoices: invoices.data.length,
          currency: 'VND',
        },
        chart_data: chartData,
        recent_activities: recentActivities,
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while fetching revenue analytics:`, error);
      throw new BadRequestException(`Error occurred while fetching revenue analytics: ${error.message}`);
    }
  }

  async exportRevenueReport(
    range: 'day' | 'week' | 'month' | 'year' = 'month',
    format: 'excel' | 'csv' | 'zip' = 'excel',
  ) {
    try {
      const startTimestamp = calculateStartTimestamp(range);
      const payments = await this.stripe.paymentIntents.list({ created: { gte: startTimestamp }, limit: 100 });
      const successfulPayments = payments.data.filter((payment) => payment.status === 'succeeded');
      // Create a new Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Revenue Report');

      // Add headers
      worksheet.columns = [
        { header: 'STT', key: 'stt', width: 5 },
        { header: 'ID', key: 'id', width: 35 },
        { header: 'Amount (VND)', key: 'amount', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Date', key: 'created_at', width: 25 },
      ];

      // Add data
      payments.data.forEach((payment, index) => {
        worksheet.addRow({
          stt: index + 1,
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          created_at: new Date(payment.created * 1000).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        });
      });

      if (format === 'excel') {
        const buffer = await workbook.xlsx.writeBuffer();
        return {
          buffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        };
      }

      if (format === 'csv') {
        const buffer = await workbook.csv.writeBuffer();
        return {
          buffer,
          contentType: 'text/csv',
          extension: 'csv',
        };
      }

      if (format === 'zip') {
        const excelBuffer = await workbook.xlsx.writeBuffer();
        const csvBuffer = await workbook.csv.writeBuffer();
        const zip = new JSZip();

        zip.file('revenue_report.xlsx', excelBuffer);
        zip.file('revenue_report.csv', csvBuffer);
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        return {
          buffer: zipBuffer,
          contentType: 'application/zip',
          extension: 'zip',
        };
      }
      throw new BadRequestException('Invalid format specified. Supported formats are: excel, csv, zip!!');
    } catch (error) {
      console.error(`[SERVICE] Error occurred while exporting revenue report:`, error);
      throw new BadRequestException(`Error occurred while exporting revenue report: ${error.message}`);
    }
  }

  // =================== CRUD =========================
  async createCustomer(email: string, name?: string, phone?: string) {
    if (!email) {
      throw new BadRequestException('Email is required to create a customer');
    }
    try {
      const customer = await this.stripe.customers.create({ email, name, phone });
      return {
        success: true,
        message: `Customer created successfully with ID: ${customer.id}`,
        customer: formatCustomerData(customer),
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while creating customer:`, error);
      throw new BadRequestException(`Error occurred while creating customer: ${error.message}`);
    }
  }

  async listCustomers() {
    try {
      const customers = await this.stripe.customers.list({
        limit: this.configService.get<number>('STRIPE_DEFAULT_LIMIT') || 20 });
      return {
        success: true,
        customers: formatCustomerList(customers.data as Stripe.Customer[]),
        total: customers.data.length,
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while listing customers:`, error);
      throw new BadRequestException(`Error occurred while listing customers: ${error.message}`);
    }
  }

  async getCustomerById(customerId: string) {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required to retrieve customer details');
    }
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (typeof customer === 'string') {
        throw new BadRequestException('Customer not found');
      }
      if (!customer || customer.deleted) {
        throw new BadRequestException('Customer not found or has been deleted');
      }
      return {
        success: true,
        customer: formatCustomerData(customer),
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while retrieving customer:`, error);
      throw new BadRequestException(`Error occurred while retrieving customer: ${error.message}`);
    }
  }

  async deleteCustomer(customerId: string) {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required to delete a customer');
    }
    try {
      await this.stripe.customers.del(customerId);
      return {
        success: true,
        message: `Customer deleted successfully with ID: ${customerId}`,
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while deleting customer:`, error);
      throw new BadRequestException(`Error occurred while deleting customer: ${error.message}`);
    }
  }

  async updateCustomer(customerId: string, email?: string, name?: string, phone?: string) {
    if (!customerId) {
      throw new BadRequestException('Customer ID is required to update a customer');
    }
    try {
      const updatedCustomer = await this.stripe.customers.update(customerId, { email, name, phone });
      return {
        success: true,
        message: `Customer updated successfully with ID: ${updatedCustomer.id}`,
        customer: formatCustomerData(updatedCustomer),
      };
    } catch (error) {
      console.error(`[SERVICE] Error occurred while updating customer:`, error);
      throw new BadRequestException(`Error occurred while updating customer: ${error.message}`);
    }
  }

  getStripeInstance() {
    return this.stripe;
  }
}
