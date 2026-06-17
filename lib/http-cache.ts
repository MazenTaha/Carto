import { errorResponse, successResponse } from '@/lib/api-response';

export const NO_STORE_CACHE_CONTROL = 'no-store, no-cache, must-revalidate, proxy-revalidate';

type ResponseLike = Response & { headers: Headers };

export function withNoStoreHeaders<T extends ResponseLike>(response: T) {
  response.headers.set('Cache-Control', NO_STORE_CACHE_CONTROL);
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export function buildPublicCacheControl(input: {
  sMaxAge: number;
  staleWhileRevalidate: number;
}) {
  return `public, s-maxage=${input.sMaxAge}, stale-while-revalidate=${input.staleWhileRevalidate}`;
}

export function withPublicCacheHeaders<T extends ResponseLike>(
  response: T,
  input: {
    sMaxAge: number;
    staleWhileRevalidate: number;
  }
) {
  response.headers.set('Cache-Control', buildPublicCacheControl(input));
  response.headers.delete('Pragma');
  response.headers.delete('Expires');
  return response;
}

export function noStoreSuccessResponse<T>(data: T, status = 200) {
  return withNoStoreHeaders(successResponse(data, status));
}

export function noStoreErrorResponse(
  message: string,
  statusCode = 400,
  code = 'ERROR',
  details?: Record<string, unknown>,
) {
  return withNoStoreHeaders(errorResponse(message, statusCode, code, details));
}
