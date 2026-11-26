/** Auth & workspace access middleware. */
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { verifyJwt } from '../lib/jwt.js';
import { ApiError } from '../lib/errors.js';
import type { Repos } from '../db/repos.js';

export interface AuthUser { id: string; email: string; role: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      workspaceRole?: string;
    }
  }
}

const RANK: Record<string, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };

export function authRequired(secret: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return next(ApiError.unauthorized());
    const payload = verifyJwt(token, secret);
    if (!payload) return next(ApiError.unauthorized('توکن نامعتبر یا منقضی است'));
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  };
}

/** Requires :workspaceId param + membership; sets req.workspaceRole. */
export function workspaceRequired(repos: Repos, minRole: 'viewer' | 'editor' | 'admin' | 'owner' = 'viewer') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const workspaceId = req.params.workspaceId;
    if (!workspaceId || !req.user) return next(ApiError.unauthorized());
    const role = repos.memberRole(workspaceId, req.user.id);
    if (!role) return next(ApiError.notFound('ورک‌اسپیس یافت نشد یا دسترسی ندارید'));
    if ((RANK[role] ?? 0) < RANK[minRole]) return next(ApiError.forbidden(`این عملیات نقش ${minRole} یا بالاتر می‌خواهد`));
    req.workspaceRole = role;
    next();
  };
}

export function errorHandler(logger: { error(msg: string, meta?: Record<string, unknown>): void }) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'داده ورودی معتبر نیست',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      });
      return;
    }
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    logger.error('Unhandled API error', {
      path: req.path,
      error: (err as Error)?.message,
      stack: (err as Error)?.stack?.split('\n').slice(0, 3).join(' | '),
    });
    res.status(500).json({ error: { code: 'INTERNAL', message: 'خطای داخلی سرور؛ در لاگ‌ها ثبت شد' } });
  };
}
