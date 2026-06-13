import { errorResponse } from '@/lib/api-response';

function readBearerToken(request: Request) {
  const authorization = request.headers.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token?.trim()) {
    return null;
  }

  return token.trim();
}

export function requireDemoSetupToken(request: Request) {
  const configuredToken = process.env.DEMO_SETUP_TOKEN?.trim();

  if (!configuredToken) {
    return {
      ok: false as const,
      response: errorResponse('DEMO_SETUP_TOKEN is not configured on the server.', 503, 'DEMO_SETUP_TOKEN_MISSING'),
    };
  }

  const providedToken = readBearerToken(request);

  if (!providedToken) {
    return {
      ok: false as const,
      response: errorResponse('Missing demo setup bearer token.', 401, 'UNAUTHORIZED'),
    };
  }

  if (providedToken !== configuredToken) {
    return {
      ok: false as const,
      response: errorResponse('Forbidden', 403, 'FORBIDDEN'),
    };
  }

  return {
    ok: true as const,
  };
}
