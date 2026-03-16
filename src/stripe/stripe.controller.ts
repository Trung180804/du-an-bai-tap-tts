import { Controller, Post, Get, Body, Req, Headers, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';

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
}
