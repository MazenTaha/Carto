import { POST as LegacyValidatePost } from '@/app/api/payment/scan/validate/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = LegacyValidatePost;
