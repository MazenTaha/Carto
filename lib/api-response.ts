import { NextResponse } from 'next/server';

export type ApiSuccess<T = any> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  } & Record<string, unknown>;
};

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

export class ApiErrorResponse extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, unknown>;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiErrorResponse';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Helper to return a successful standardized JSON response.
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
    } satisfies ApiSuccess<T>,
    { status }
  );
}

/**
 * Helper to return a standardized error JSON response.
 */
export function errorResponse(
  message: string,
  statusCode = 400,
  code = 'ERROR',
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details || {}),
      },
    } satisfies ApiError,
    { status: statusCode }
  );
}
