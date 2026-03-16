import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { buildCheckoutPayload, buildSubscriptionPayload } from './stripe.factory';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY in configuration');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
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

  getStripeInstance() {
    return this.stripe;
  }
}
