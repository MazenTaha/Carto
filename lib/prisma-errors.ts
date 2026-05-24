export function getPrismaConnectivityMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message || '';

  if (error.name === 'PrismaClientInitializationError') {
    return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from this machine.';
  }

  if (message.includes("Can't reach database server")) {
    return 'Database unavailable. Check DATABASE_URL and make sure your Postgres host is reachable from this machine.';
  }

  if (message.includes('DATABASE_URL is not configured')) {
    return 'DATABASE_URL is missing. Add it to your local .env before starting the simulator.';
  }

  return null;
}
