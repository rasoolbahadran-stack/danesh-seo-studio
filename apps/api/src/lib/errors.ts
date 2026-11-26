/** API error type + async wrapper. */
import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) { return new ApiError(400, 'BAD_REQUEST', message, details); }
  static unauthorized(message = 'احراز هویت لازم است') { return new ApiError(401, 'UNAUTHORIZED', message); }
  static forbidden(message = 'دسترسی مجاز نیست') { return new ApiError(403, 'FORBIDDEN', message); }
  static notFound(message = 'یافت نشد') { return new ApiError(404, 'NOT_FOUND', message); }
  static tooMany(message = 'تعداد درخواست‌ها بیش از حد مجاز است') { return new ApiError(429, 'RATE_LIMITED', message); }
  static aiNotConfigured(message: string) { return new ApiError(400, 'AI_NOT_CONFIGURED', message); }
  static externalError(code: string, message: string) { return new ApiError(502, code, message); }
}

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wrap async route handlers so rejections reach the error handler. */
export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
