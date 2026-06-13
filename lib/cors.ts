export const DEVICE_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
} as const;

export function applyCorsHeaders(response: Response, headers: Record<string, string> = DEVICE_CORS_HEADERS) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export function corsPreflightResponse(headers: Record<string, string> = DEVICE_CORS_HEADERS) {
  return applyCorsHeaders(new Response(null, { status: 204 }), headers);
}
