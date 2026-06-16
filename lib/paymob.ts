import crypto from 'crypto';
import { getAppBaseUrl } from '@/lib/app-url';
import { PAYMOB_CURRENCY } from '@/lib/payment-money';
import { getPaymobEnvStatus, getPaymobServerEnv } from '@/lib/paymob/env';

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
  amount: number;
  description: string;
  quantity: number;
};

type PaymobRequestOptions = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
};

type PaymobTransactionLike = Record<string, any>;

function getPaymobApiBaseUrl() {
  return getPaymobServerEnv().apiBaseUrl;
}

function getPaymobHostedBaseUrl() {
  return getPaymobServerEnv().hostedBaseUrl;
}

export function isPaymobConfigured() {
  return getPaymobEnvStatus({ requirePublicKey: true }).configured;
}

export function getPaymobConfig() {
  const {
    authTokenKey,
    publicKey,
    integrationId,
    iframeId,
    hmacSecret,
    apiBaseUrl,
    hostedBaseUrl,
  } = getPaymobServerEnv();

  if (!authTokenKey) {
    throw new Error('Either PAYMOB_API_KEY or PAYMOB_SECRET_KEY must be configured.');
  }

  if (!integrationId) {
    throw new Error('PAYMOB_INTEGRATION_ID must be a positive integer.');
  }

  if (!publicKey) {
    throw new Error('PAYMOB_PUBLIC_KEY is missing.');
  }

  return {
    apiKey: authTokenKey,
    publicKey,
    integrationId,
    iframeId,
    hmacSecret,
    apiBaseUrl,
    hostedBaseUrl,
  };
}

function getPaymobHmacSecret() {
  return getPaymobServerEnv().hmacSecret;
}

async function paymobRequest<T>(path: string, options: PaymobRequestOptions) {
  const response = await fetch(`${getPaymobApiBaseUrl()}${path}`, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
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

export function buildPaymobCustomer(input: {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
}) {
  const billingData = buildPaymobBillingData(input);

  return {
    first_name: billingData.first_name,
    last_name: billingData.last_name,
    email: billingData.email,
    phone_number: billingData.phone_number,
  };
}

export async function createPaymobIntention(input: {
  amount: number;
  items: PaymobOrderItem[];
  billingData: PaymobBillingData;
  customer: ReturnType<typeof buildPaymobCustomer>;
  extras: Record<string, unknown>;
}) {
  const { apiKey, integrationId } = getPaymobConfig();
  const data = await paymobRequest<{
    id?: number | string;
    client_secret?: string;
    payment_keys?: Array<{ key?: string | null }>;
  }>('/v1/intention/', {
    headers: {
      Authorization: `Token ${apiKey}`,
    },
    body: {
      amount: input.amount,
      currency: PAYMOB_CURRENCY,
      payment_methods: [integrationId],
      items: input.items,
      billing_data: input.billingData,
      customer: input.customer,
      extras: input.extras,
    },
  });

  const clientSecret = typeof data?.client_secret === 'string'
    ? data.client_secret
    : typeof data?.payment_keys?.[0]?.key === 'string'
      ? data.payment_keys[0].key
      : null;

  if (!clientSecret) {
    throw new Error('Paymob intention response did not include a client_secret.');
  }

  return {
    id: data?.id ? String(data.id) : null,
    clientSecret,
    raw: data,
  };
}

export function buildPaymobUnifiedCheckoutUrl(clientSecret: string) {
  const { publicKey, hostedBaseUrl } = getPaymobConfig();
  const url = new URL('/unifiedcheckout/', hostedBaseUrl);
  url.searchParams.set('publicKey', publicKey || '');
  url.searchParams.set('clientSecret', clientSecret);
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

const PAYMOB_HMAC_FIELD_PATHS = [
  ['amount_cents', ['amount_cents']],
  ['created_at', ['created_at']],
  ['currency', ['currency']],
  ['error_occured', ['error_occured']],
  ['has_parent_transaction', ['has_parent_transaction']],
  ['id', ['id']],
  ['integration_id', ['integration_id']],
  ['is_3d_secure', ['is_3d_secure']],
  ['is_auth', ['is_auth']],
  ['is_capture', ['is_capture']],
  ['is_refunded', ['is_refunded']],
  ['is_standalone_payment', ['is_standalone_payment']],
  ['is_voided', ['is_voided']],
  ['order', ['order', 'id']],
  ['owner', ['owner']],
  ['pending', ['pending']],
  ['source_data.pan', ['source_data', 'pan']],
  ['source_data.sub_type', ['source_data', 'sub_type']],
  ['source_data.type', ['source_data', 'type']],
  ['success', ['success']],
] as const;

function getNestedValue(source: PaymobTransactionLike, path: readonly string[]) {
  let current: unknown = source;

  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function paymobHmacFields(transaction: PaymobTransactionLike) {
  return [...PAYMOB_HMAC_FIELD_PATHS]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, path]) => getNestedValue(transaction, path));
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
