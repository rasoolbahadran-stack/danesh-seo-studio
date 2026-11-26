/** In-memory fixed-window rate limiter (per instance). */
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './errors.js';

interface Bucket { count: number; resetAt: number }

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
  message?: string;
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn ?? ((req: Request) => req.ip ?? 'unknown');

  // periodic cleanup to avoid unbounded growth
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }, Math.max(opts.windowMs, 60_000));
  cleaner.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${keyFn(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.max - bucket.count)));
    if (bucket.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(ApiError.tooMany(opts.message));
    }
    next();
  };
}
