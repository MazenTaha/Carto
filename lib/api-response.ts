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
  };
};

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

export class ApiErrorResponse extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'ApiErrorResponse';
    this.statusCode = statusCode;
    this.code = code;
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
export function errorResponse(message: string, statusCode = 400, code = 'ERROR') {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    } satisfies ApiError,
    { status: statusCode }
  );
}
