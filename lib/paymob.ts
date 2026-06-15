import crypto from 'crypto';
import { getAppBaseUrl } from '@/lib/app-url';
import { PAYMOB_CURRENCY } from '@/lib/payment-money';

const DEFAULT_PAYMOB_API_BASE_URL = 'https://accept.paymob.com/api';
const DEFAULT_PAYMOB_HOSTED_BASE_URL = 'https://accept.paymob.com';

type PaymobBillingData = {
  apartment: string;
  email: string;
  floor: string;
  first_name: string;
  street: string;
  building: string;
  phone_number: string;
  shipping_method: string;
  postal_code: string;
  city: string;
  country: string;
  last_name: string;
  state: string;
};

type PaymobOrderItem = {
  name: string;
  amount_cents: number;
  description: string;
  quantity: number;
};

type PaymobRequestOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
};

type PaymobTransactionLike = Record<string, any>;

function getPaymobApiBaseUrl() {
  return (process.env.PAYMOB_API_BASE_URL || DEFAULT_PAYMOB_API_BASE_URL).replace(/\/+$/, '');
}

function getPaymobHostedBaseUrl() {
  return (process.env.PAYMOB_HOSTED_BASE_URL || DEFAULT_PAYMOB_HOSTED_BASE_URL).replace(/\/+$/, '');
}

export function isPaymobConfigured() {
  const apiKey = process.env.PAYMOB_API_KEY?.trim();
  const integrationId = Number(process.env.PAYMOB_INTEGRATION_ID);
  const iframeId = Number(process.env.PAYMOB_IFRAME_ID);

  return Boolean(
    apiKey &&
    Number.isInteger(integrationId) &&
    integrationId > 0 &&
    Number.isInteger(iframeId) &&
    iframeId > 0
  );
}

export function getPaymobConfig() {
  const apiKey = process.env.PAYMOB_API_KEY?.trim();
  const integrationId = Number(process.env.PAYMOB_INTEGRATION_ID);
  const iframeId = Number(process.env.PAYMOB_IFRAME_ID);
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET?.trim() || '';

  if (!apiKey) {
    throw new Error('PAYMOB_API_KEY is missing.');
  }

  if (!Number.isInteger(integrationId) || integrationId <= 0) {
    throw new Error('PAYMOB_INTEGRATION_ID must be a positive integer.');
  }

  if (!Number.isInteger(iframeId) || iframeId <= 0) {
    throw new Error('PAYMOB_IFRAME_ID must be a positive integer.');
  }

  return {
    apiKey,
    integrationId,
    iframeId,
    hmacSecret,
    apiBaseUrl: getPaymobApiBaseUrl(),
    hostedBaseUrl: getPaymobHostedBaseUrl(),
  };
}

function getPaymobHmacSecret() {
  return process.env.PAYMOB_HMAC_SECRET?.trim() || '';
}

async function paymobRequest<T>(path: string, options: PaymobRequestOptions) {
  const response = await fetch(`${getPaymobApiBaseUrl()}${path}`, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      })()
    : null;

  if (!response.ok) {
    throw new Error(
      `Paymob request failed (${response.status}): ${typeof data === 'object' ? JSON.stringify(data) : text || 'Unknown error'}`
    );
  }

  return data as T;
}

export async function createPaymobAuthToken() {
  const { apiKey } = getPaymobConfig();
  const data = await paymobRequest<{ token: string }>('/auth/tokens', {
    body: { api_key: apiKey },
  });

  if (!data?.token) {
    throw new Error('Paymob auth token response did not include a token.');
  }

  return data.token;
}

export async function createPaymobOrder(input: {
  authToken: string;
  merchantOrderId: string;
  amountCents: number;
  items: PaymobOrderItem[];
}) {
  const data = await paymobRequest<{
    id: number;
    merchant_order_id?: string;
    amount_cents?: number;
    currency?: string;
  }>('/ecommerce/orders', {
    body: {
      auth_token: input.authToken,
      delivery_needed: false,
      amount_cents: input.amountCents,
      currency: PAYMOB_CURRENCY,
      merchant_order_id: input.merchantOrderId,
      items: input.items,
    },
  });

  if (!data?.id) {
    throw new Error('Paymob order response did not include an order id.');
  }

  return data;
}

export async function createPaymobPaymentKey(input: {
  authToken: string;
  orderId: number;
  amountCents: number;
  billingData: PaymobBillingData;
}) {
  const { integrationId } = getPaymobConfig();
  const data = await paymobRequest<{ token: string }>('/acceptance/payment_keys', {
    body: {
      auth_token: input.authToken,
      amount_cents: input.amountCents,
      expiration: 60 * 60,
      order_id: input.orderId,
      billing_data: input.billingData,
      currency: PAYMOB_CURRENCY,
      integration_id: integrationId,
      lock_order_when_paid: true,
    },
  });

  if (!data?.token) {
    throw new Error('Paymob payment key response did not include a token.');
  }

  return data.token;
}

export function buildPaymobHostedCheckoutUrl(paymentToken: string) {
  const { iframeId, hostedBaseUrl } = getPaymobConfig();
  const url = new URL(`/api/acceptance/iframes/${iframeId}`, hostedBaseUrl);
  url.searchParams.set('payment_token', paymentToken);
  return url.toString();
}

function splitDisplayName(name: string | null | undefined) {
  const fallback = ['Guest', 'Shopper'];
  const trimmed = name?.trim();

  if (!trimmed) {
    return fallback;
  }

  const parts = trimmed.split(/\s+/);
  return [parts[0] || fallback[0], parts.slice(1).join(' ') || fallback[1]];
}

export function buildPaymobBillingData(input: {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}) {
  const [firstName, lastName] = splitDisplayName(input.name);
  const email = input.email?.trim() || `guest-${crypto.randomUUID().slice(0, 8)}@carto.local`;
  const phoneNumber = input.phoneNumber?.trim() || '+201000000000';

  return {
    apartment: 'NA',
    email,
    floor: 'NA',
    first_name: firstName,
    street: 'NA',
    building: 'NA',
    phone_number: phoneNumber,
    shipping_method: 'PKG',
    postal_code: '00000',
    city: 'Cairo',
    country: 'EG',
    last_name: lastName,
    state: 'Cairo',
  } satisfies PaymobBillingData;
}

function paymobHmacFields(transaction: PaymobTransactionLike) {
  return [
    transaction.amount_cents,
    transaction.created_at,
    transaction.currency,
    transaction.error_occured,
    transaction.has_parent_transaction,
    transaction.id,
    transaction.integration_id,
    transaction.is_3d_secure,
    transaction.is_auth,
    transaction.is_capture,
    transaction.is_refunded,
    transaction.is_standalone_payment,
    transaction.is_voided,
    transaction.order?.id,
    transaction.owner,
    transaction.pending,
    transaction.source_data?.pan,
    transaction.source_data?.sub_type,
    transaction.source_data?.type,
    transaction.success,
  ];
}

export function verifyPaymobHmac(transaction: PaymobTransactionLike, hmac: string | null | undefined) {
  const hmacSecret = getPaymobHmacSecret();

  if (!hmacSecret || !hmac) {
    return false;
  }

  const payload = paymobHmacFields(transaction)
    .map((value) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'true' : 'false';
      return String(value);
    })
    .join('');

  const digest = crypto.createHmac('sha512', hmacSecret).update(payload).digest('hex');
  const normalizedHmac = hmac.toLowerCase();

  if (normalizedHmac.length !== digest.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(normalizedHmac));
}

export function getPaymobPendingReturnUrl(requestUrl?: string) {
  return `${getAppBaseUrl(requestUrl)}/payment/return`;
}
