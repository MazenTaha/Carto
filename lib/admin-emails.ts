// Simple admin check that can run in Middleware (Edge runtime)
// without pulling in heavy server-side dependencies like firebase-admin.

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
  const admins = getAdminEmails();
  // If no admin emails configured, allow any authenticated user (dev mode)
  if (admins.length === 0) return true;
  return admins.includes(email.toLowerCase());
}
