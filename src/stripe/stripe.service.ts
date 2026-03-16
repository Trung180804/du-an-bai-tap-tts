import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new Error('Missing STRIPE_SECRET_KEY in configuration');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    });
  }

  async createCheckoutSession(orderId: string, amount: number) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'VND',
            product_data: {
              name: `Order #${orderId}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:3000/stripe/success?orderId=${orderId}`,
      cancel_url: `http://localhost:3000/stripe/cancel`,
      metadata: {
        orderId: orderId,
      },
    });

    return { checkoutUrl: session.url };
  }

  // ==================  SUBSCRIPTION  ===========================
  async createSubscriptionSession(userId: string) {
    const priceId = this.configService.get<string>('SUBSCRIPTION_PRICE_ID')?.trim() || '';

    if (!priceId) {
      throw new Error('Missing SUBSCRIPTION_PRICE_ID in configuration');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `http://localhost:3000/stripe/success?userId=${userId}`,
      cancel_url: `http://localhost:3000/stripe/cancel`,
      client_reference_id: userId,
    });

    return { checkoutUrl: session.url };
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
        }
        else if (session.mode === 'subscription') {
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

      default:
        console.log(`[SERVICE] Ignore an unprocessed event: ${event.type}`);
    }
  }

  getStripeInstance() {
    return this.stripe;
  }
}
