import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Custom application error with status code support.
 * Use this for operational errors that should return specific HTTP status codes.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Type for async request handlers that return Promises.
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Wraps async route handlers to properly catch and forward errors.
 * Use this for all async route handlers to avoid try/catch boilerplate.
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global error handler middleware.
 * Logs errors and returns appropriate JSON responses.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  console.error('Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Send response
  res.status(statusCode).json({
    success: false,
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

/**
 * 404 Not Found handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
}
