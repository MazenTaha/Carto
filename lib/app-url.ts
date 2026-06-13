function normalizeOrigin(raw: string) {
  return raw.trim().replace(/\/+$/, '');
}

export function getAppBaseUrl(requestUrl?: string) {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    requestUrl ? new URL(requestUrl).origin : null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    try {
      return normalizeOrigin(new URL(candidate).origin);
    } catch {}
  }

  return 'http://localhost:3000';
}
