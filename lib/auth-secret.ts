const DEVELOPMENT_AUTH_SECRET = 'development-secret-change-in-production';

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

  return undefined;
}
