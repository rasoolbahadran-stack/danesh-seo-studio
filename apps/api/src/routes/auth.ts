/** Auth routes: register, login, me. Passwords are scrypt-hashed; JWT HS256. */
import { Router } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../lib/crypto.js';
import { signJwt } from '../lib/jwt.js';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { authRequired } from '../middleware/auth.js';
import type { AppContext } from './context.js';

const RegisterSchema = z.object({
  email: z.string().email('ایمیل معتبر نیست'),
  password: z.string().min(8, 'رمز عبور حداقل ۸ کاراکتر'),
  name: z.string().min(2, 'نام حداقل ۲ کاراکتر'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function authRoutes(ctx: AppContext) {
  const r = Router();

  r.post('/register', asyncHandler(async (req, res) => {
    const body = RegisterSchema.parse(req.body);
    if (ctx.repos.findUserByEmail(body.email)) {
      throw ApiError.badRequest('این ایمیل قبلاً ثبت شده است');
    }
    const user = ctx.repos.createUser(body.email, body.name, hashPassword(body.password));
    ctx.repos.logActivity(null, user.id, 'user.register', 'user', user.id, {}, req.ip ?? '');
    const token = signJwt({ sub: user.id, email: user.email, role: user.role }, ctx.cfg.JWT_SECRET);
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }));

  r.post('/login', asyncHandler(async (req, res) => {
    const body = LoginSchema.parse(req.body);
    const user = ctx.repos.findUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      throw ApiError.unauthorized('ایمیل یا رمز عبور نادرست است');
    }
    const token = signJwt({ sub: user.id, email: user.email, role: user.role }, ctx.cfg.JWT_SECRET);
    ctx.repos.logActivity(null, user.id, 'user.login', 'user', user.id, {}, req.ip ?? '');
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  }));

  r.get('/me', authRequired(ctx.cfg.JWT_SECRET), asyncHandler(async (req, res) => {
    const user = ctx.repos.findUserById(req.user!.id);
    if (!user) throw ApiError.notFound('کاربر یافت نشد');
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.created_at } });
  }));

  // Change own password (recommended right after first login with the default 1234)
  r.patch('/me/password', authRequired(ctx.cfg.JWT_SECRET), asyncHandler(async (req, res) => {
    const body = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(6, 'رمز جدید حداقل ۶ کاراکتر'),
    }).parse(req.body);
    const user = ctx.repos.findUserById(req.user!.id);
    if (!user) throw ApiError.notFound('کاربر یافت نشد');
    if (!verifyPassword(body.currentPassword, user.password_hash)) {
      throw ApiError.badRequest('رمز فعلی نادرست است');
    }
    ctx.repos.updateUserPassword(user.id, hashPassword(body.newPassword));
    ctx.repos.logActivity(null, user.id, 'user.password-change', 'user', user.id, {}, req.ip ?? '');
    res.json({ ok: true, message: 'رمز عبور با موفقیت تغییر کرد' });
  }));

  return r;
}
