// Simple admin check that can run in Middleware (Edge runtime)
// without pulling in heavy server-side dependencies like firebase-admin.

const SEEDED_DEV_ADMIN_EMAIL = 'admin@gmail.com';

/**
 * Returns the list of admin emails from the ADMIN_EMAILS environment variable.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the given email is in the ADMIN_EMAILS list.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalizedEmail = email.toLowerCase();
  const admins = getAdminEmails();

  if (admins.length > 0) {
    return admins.includes(normalizedEmail);
  }

  return process.env.NODE_ENV !== 'production' && normalizedEmail === SEEDED_DEV_ADMIN_EMAIL;
}
