const DEFAULT_PAYMOB_API_BASE_URL = 'https://accept.paymob.com';
const DEFAULT_PAYMOB_HOSTED_BASE_URL = 'https://accept.paymob.com';

function readEnv(name: string) {
  return process.env[name]?.trim() || '';
}

function normalizeBaseUrl(value: string, fallback: string) {
  return (value || fallback).replace(/\/+$/, '');
}

function parsePositiveInt(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export type PaymobEnvStatus = {
  configured: boolean;
  missing: string[];
};

export type PaymobEnvDebugInfo = {
  configured: boolean;
  missing: string[];
  hasApiKey: boolean;
  hasSecretKey: boolean;
  hasPublicKey: boolean;
  hasHmacSecret: boolean;
  integrationIdParsed: boolean;
  hasApiBaseUrl: boolean;
  hasHostedBaseUrl: boolean;
  variableNames: {
    apiKey: 'PAYMOB_API_KEY';
    secretKey: 'PAYMOB_SECRET_KEY';
    publicKey: 'PAYMOB_PUBLIC_KEY';
    integrationId: 'PAYMOB_INTEGRATION_ID';
    hmacSecret: 'PAYMOB_HMAC_SECRET';
    apiBaseUrl: 'PAYMOB_API_BASE_URL';
    hostedBaseUrl: 'PAYMOB_HOSTED_BASE_URL';
  };
};

export function isPaymobPreviewModeEnabled() {
  return process.env.NODE_ENV !== 'production' && readEnv('PAYMENT_PREVIEW_MODE').toLowerCase() === 'true';
}

export function getHostedPaymobEnvStatus() {
  return getPaymobEnvStatus({
    requirePublicKey: true,
    requireHmac: true,
  });
}

export function getHostedPaymobEnvDebugInfo(): PaymobEnvDebugInfo {
  const apiKey = readEnv('PAYMOB_API_KEY');
  const secretKey = readEnv('PAYMOB_SECRET_KEY');
  const publicKey = readEnv('PAYMOB_PUBLIC_KEY');
  const integrationId = readEnv('PAYMOB_INTEGRATION_ID');
  const hmacSecret = readEnv('PAYMOB_HMAC_SECRET');
  const apiBaseUrl = readEnv('PAYMOB_API_BASE_URL');
  const hostedBaseUrl = readEnv('PAYMOB_HOSTED_BASE_URL');
  const status = getHostedPaymobEnvStatus();

  return {
    configured: status.configured,
    missing: status.missing,
    hasApiKey: Boolean(apiKey),
    hasSecretKey: Boolean(secretKey),
    hasPublicKey: Boolean(publicKey),
    hasHmacSecret: Boolean(hmacSecret),
    integrationIdParsed: Boolean(parsePositiveInt(integrationId)),
    hasApiBaseUrl: Boolean(apiBaseUrl),
    hasHostedBaseUrl: Boolean(hostedBaseUrl),
    variableNames: {
      apiKey: 'PAYMOB_API_KEY',
      secretKey: 'PAYMOB_SECRET_KEY',
      publicKey: 'PAYMOB_PUBLIC_KEY',
      integrationId: 'PAYMOB_INTEGRATION_ID',
      hmacSecret: 'PAYMOB_HMAC_SECRET',
      apiBaseUrl: 'PAYMOB_API_BASE_URL',
      hostedBaseUrl: 'PAYMOB_HOSTED_BASE_URL',
    },
  };
}

export function getPaymobEnvStatus(options?: {
  requireIframe?: boolean;
  requirePublicKey?: boolean;
  requireHmac?: boolean;
}): PaymobEnvStatus {
  const requireIframe = options?.requireIframe ?? false;
  const requirePublicKey = options?.requirePublicKey ?? true;
  const requireHmac = options?.requireHmac ?? false;

  const apiKey = readEnv('PAYMOB_API_KEY');
  const secretKey = readEnv('PAYMOB_SECRET_KEY');
  const publicKey = readEnv('PAYMOB_PUBLIC_KEY');
  const integrationId = readEnv('PAYMOB_INTEGRATION_ID');
  const iframeId = readEnv('PAYMOB_IFRAME_ID');
  const hmacSecret = readEnv('PAYMOB_HMAC_SECRET');

  const missing: string[] = [];

  if (!apiKey && !secretKey) {
    missing.push('PAYMOB_API_KEY', 'PAYMOB_SECRET_KEY');
  }

  if (!parsePositiveInt(integrationId)) {
    missing.push('PAYMOB_INTEGRATION_ID');
  }

  if (requireIframe && !parsePositiveInt(iframeId)) {
    missing.push('PAYMOB_IFRAME_ID');
  }

  if (requirePublicKey && !publicKey) {
    missing.push('PAYMOB_PUBLIC_KEY');
  }

  if (requireHmac && !hmacSecret) {
    missing.push('PAYMOB_HMAC_SECRET');
  }

  return {
    configured: missing.length === 0,
    missing,
  };
}

export function getPaymobServerEnv() {
  const apiKey = readEnv('PAYMOB_API_KEY');
  const secretKey = readEnv('PAYMOB_SECRET_KEY');
  const publicKey = readEnv('PAYMOB_PUBLIC_KEY');
  const integrationId = parsePositiveInt(readEnv('PAYMOB_INTEGRATION_ID'));
  const iframeId = parsePositiveInt(readEnv('PAYMOB_IFRAME_ID'));
  const hmacSecret = readEnv('PAYMOB_HMAC_SECRET');

  return {
    apiKey,
    publicKey,
    secretKey,
    authTokenKey: secretKey || apiKey,
    integrationId,
    iframeId,
    hmacSecret,
    apiBaseUrl: normalizeBaseUrl(readEnv('PAYMOB_API_BASE_URL'), DEFAULT_PAYMOB_API_BASE_URL),
    hostedBaseUrl: normalizeBaseUrl(readEnv('PAYMOB_HOSTED_BASE_URL'), DEFAULT_PAYMOB_HOSTED_BASE_URL),
  };
}
