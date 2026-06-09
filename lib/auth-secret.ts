const DEVELOPMENT_AUTH_SECRET = 'development-secret-change-in-production';
let hasWarnedAboutFallback = false;

function buildFallbackSecret() {
  const seedParts = [
    process.env.DATABASE_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_ID,
  ].filter((value): value is string => Boolean(value && value.trim()));

  if (seedParts.length === 0) {
    return DEVELOPMENT_AUTH_SECRET;
  }

  return `carto-production-fallback-secret:${seedParts.join('|')}`;
}

export function getAuthSecret() {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }

  if (process.env.NEXTAUTH_SECRET) {
    return process.env.NEXTAUTH_SECRET;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEVELOPMENT_AUTH_SECRET;
  }

  const fallbackSecret = buildFallbackSecret();

  if (!hasWarnedAboutFallback) {
    hasWarnedAboutFallback = true;
    console.warn('AUTH_SECRET/NEXTAUTH_SECRET is missing in production. Using a derived fallback secret. Set AUTH_SECRET in Vercel for stable auth sessions.');
  }

  return fallbackSecret;
}
