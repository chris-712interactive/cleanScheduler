import { handleStripeWebhook } from '@/lib/stripe/handleStripeWebhook';

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
