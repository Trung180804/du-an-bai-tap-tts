import { Controller, Post, Get, Body, Req, Put, Delete,
  Headers, BadRequestException, Param, Query,Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import type { Response } from 'express';
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('checkout')
  async checkout(@Body() body: { orderId: string; amount: number }) {
    return this.stripeService.createCheckoutSession(body.orderId, body.amount);
  }

  @Post('subscribe')
  async subscribe(@Body() body: { userId: string }) {
    return this.stripeService.createSubscriptionSession(body.userId);
  }

  @Get('success')
  success() {
    return 'Payment successful!!!!!!!!!!';
  }

  @Get('cancel')
  cancel() {
    return 'Payment canceled!!!!!!!!!';
  }

  // Create callback API (Webhook) to update the status
  @Post('webhook')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    const event = this.stripeService.constructEventFromPayload(signature, req.rawBody);

    await this.stripeService.handleWebhookEvent(event);

    return { received: true };
  }

  @Post('portal')
  async createCustomerPortalSession(@Body() body: { customerId: string }) {
    return this.stripeService.createCustomerPortalSession(body.customerId);
  }

  @Post('refund')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async refundPayment(@Body() body: { paymentIntentId: string }) {
    return this.stripeService.refundPayment(body.paymentIntentId);
  }

  // API automatically generate subscription plans with API Keys
  @Get('setup-subscription')
  async setupPrice() {
    const stripe = this.stripeService.getStripeInstance();

    const product = await stripe.products.create({
      name: 'TRUNG VIP PRO ',
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 100000,
      currency: 'VND',
      recurring: { interval: 'month' },
    });

    return {
      message: 'Successfully created product and price',
      priceId: price.id,
    };
  }

  @Get('history/:customerId')
  async listPaymentHistory(@Param('customerId') customerId: string) {
    return this.stripeService.listPaymentHistory(customerId);
  }

  @Get('dashboard')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async dashboardAnalytics(@Query('range') range: 'day' | 'week' | 'month' | 'year' = 'month') {
    return this.stripeService.dashboardAnalytics(range);
  }

  @Get('export')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async revenueExport(
    @Query('range') range: 'day' | 'week' | 'month' | 'year' = 'month',
    @Query('format') format: 'excel' | 'csv' | 'zip' = 'excel',
    @Res() res: Response,
  ) {
    const { buffer, contentType, extension } = await this.stripeService.exportRevenueReport(range, format);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename=Revenue_export_${range}.${extension}`,
      'Content-Length': (buffer as any).byteLength || (buffer as any).length,
    });

    res.end(buffer);
  }

  // ============ CRUD ADMIN PANEL =============

  @Post('admin/customers')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async createCustomer(@Body() body: { email: string; name?: string; phone?: string }) {
    return this.stripeService.createCustomer(body.email, body.name, body.phone);
  }

  @Get('admin/customers')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async listCustomers() {
    return this.stripeService.listCustomers();
  }

  @Get('admin/customers/:id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async getCustomerById(@Param('id') id: string) {
    return this.stripeService.getCustomerById(id);
  }

  @Put('admin/customers/:id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async updateCustomer(
    @Param('id') id: string,
    @Body() body: { email?: string; name?: string; phone?: string }
  ) {
    return this.stripeService.updateCustomer(id, body.email, body.name, body.phone);
  }

  @Delete('admin/customers/:id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteCustomer(@Param('id') id: string) {
    return this.stripeService.deleteCustomer(id);
  }
}
