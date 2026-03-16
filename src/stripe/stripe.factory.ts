import Stripe from 'stripe';

export const buildCheckoutPayload = (
  orderId: string,
  amount: number,
  frontendUrl: string,
): Stripe.Checkout.SessionCreateParams => {
  return {
    payment_method_types: ['card'],
    allow_promotion_codes: true,
    line_items: [
      {
        price_data: {
          currency: 'VND',
          product_data: { name: `Order #${orderId}` },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${frontendUrl}/stripe/success?orderId=${orderId}`,
    cancel_url: `${frontendUrl}/stripe/cancel`,
    metadata: { orderId: orderId },
  };
};

export const buildSubscriptionPayload = (
  userId: string,
  priceId: string,
  frontendUrl: string,
): Stripe.Checkout.SessionCreateParams => {
  return {
    payment_method_types: ['card'],
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${frontendUrl}/stripe/success?userId=${userId}`,
    cancel_url: `${frontendUrl}/stripe/cancel`,
    client_reference_id: userId,
  };
};
