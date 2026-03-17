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
    subscription_data: {
      trial_period_days: 7,
    },
    success_url: `${frontendUrl}/stripe/success?userId=${userId}`,
    cancel_url: `${frontendUrl}/stripe/cancel`,
    client_reference_id: userId,
  };
};

export const calculateStartTimestamp = (range: 'day' | 'week' | 'month' | 'year'): number => {
  const startDate = new Date();
  switch (range) {
    case 'day':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    case 'month':
    default:
      startDate.setMonth(startDate.getMonth() - 1);
      break;
  }
  return Math.floor(startDate.getTime() / 1000);
};

export const MEANINGFUL_EVENT_TYPES: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'charge.refunded',
  'product.created',
  'price.created',
  'coupon.created',
  'promotion_code.created',
];

export const formatRecentActivities = (eventsData: Stripe.Event[]) => {
  return eventsData.map(event => {
    const time = new Date(event.created * 1000).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const obj = event.data.object as any;
    let message = ``;

    switch (event.type) {
      case 'checkout.session.completed':
        const email = obj.customer_details?.email || obj.customer_email || 'a customer';
        const amount = obj.amount_total ? (obj.amount_total).toLocaleString('vi-VN') : '0';
        const currency = obj.currency ? obj.currency.toUpperCase() : 'VND';
        message = ` Customer ${email} successful pay for an order of ${amount} ${currency}`;
        break;
      case 'invoice.paid':
        message = ` Invoice paid for ${obj.amount_paid / 100} ${obj.currency?.toUpperCase() || ''}`;
        break;
      case 'invoice.payment_failed':
        message = ` Invoice payment failed for ${obj.amount_due / 100} ${obj.currency?.toUpperCase() || ''}`;
        break;
      case 'customer.subscription.deleted':
        message = ` Subscription deleted for customer ID: ${obj.customer}`;
        break;
      case 'charge.refunded':
        message = ` Charge refunded for amount ${obj.amount / 100} ${obj.currency?.toUpperCase() || ''}`;
        break;
      case 'product.created':
        message = ` Product created with ID: ${obj.id}`;
        break;
      case 'price.created':
        message = ` Price created with ID: ${obj.id} for product ID: ${obj.product}`;
        break;
      case 'coupon.created':
        message = ` Coupon created with ID: ${obj.id}`;
        break;
      case 'promotion_code.created':
        message = ` Promotion code created with ID: ${obj.id}`;
        break;
      default:
        message = ` Event of type ${event.type} occurred`;
    }
    return { time, type: event.type, message };
  });
};
