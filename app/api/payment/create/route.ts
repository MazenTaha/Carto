import { POST as CreateCheckoutPost } from '@/app/api/payments/paymob/create-checkout/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = CreateCheckoutPost;
