export function getPrismaConnectivityMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message || '';

  if (error.name === 'PrismaClientInitializationError') {
    return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from the running server.';
  }

  if (error.name === 'PrismaClientKnownRequestError') {
    if (
      message.includes('does not exist in the current database') ||
      message.includes('relation') && message.includes('does not exist') ||
      message.includes('table') && message.includes('does not exist')
    ) {
      return 'Database schema is not ready. Run Prisma migrations against the target database before using this deployment.';
    }
  }

  if (message.includes("Can't reach database server")) {
    return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from the running server.';
  }

  if (message.includes('DATABASE_URL is not configured')) {
    return 'Database unavailable. DATABASE_URL is not configured on the server.';
  }

  if (
    message.includes('does not exist in the current database') ||
    (message.includes('relation') && message.includes('does not exist')) ||
    (message.includes('table') && message.includes('does not exist'))
  ) {
    return 'Database schema is not ready. Run Prisma migrations against the target database before using this deployment.';
  }

  return null;
}
