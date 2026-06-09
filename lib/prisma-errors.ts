export function getPrismaConnectivityMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message || '';

  if (error.name === 'PrismaClientInitializationError') {
    return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from the running server.';
  }

  if (message.includes("Can't reach database server")) {
    return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from the running server.';
  }

  if (message.includes('DATABASE_URL is not configured')) {
    return 'Database unavailable. DATABASE_URL is not configured on the server.';
  }

  return null;
}
