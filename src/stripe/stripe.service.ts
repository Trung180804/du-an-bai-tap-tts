import { Injectable } from '@nestjs/common';
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
    //const priceId = 'price_1TA48uHKvVTGLXs9Jys7Nreu';
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

  getStripeInstance() {
    return this.stripe;
  }
}
