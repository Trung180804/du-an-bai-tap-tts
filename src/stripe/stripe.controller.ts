import { Controller, Post, Get, Body, Req, Headers, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

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
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    if (!signature) throw new BadRequestException('Missing stripe signature');
    if (!req.rawBody) throw new BadRequestException('Missing raw body for webhook');
    if (!webhookSecret) throw new BadRequestException('Missing STRIPE_WEBHOOK_SECRET in configuration');

    let event;

    try {
      event = this.stripeService.getStripeInstance().webhooks.constructEvent(
        req.rawBody, 
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // Handling payment events
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        const orderId = session.metadata.orderId;
        console.log(`[CONFIRM] order ${orderId} has been paid successfully!`);
        break;

      case 'invoice.paid':
        const invoice = event.data.object;
        console.log(`[SUBSCRIPTION] Order ${invoice.id} has been renewed successfully!`);
        break;

      case 'payment_intent.payment_failed':
        console.log('[FAILED] Transaction failed due to card error/insufficient funds.');
        break;

      default:
        console.log(`Skipping event: ${event.type}`);
    }
    return { received: true };
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
