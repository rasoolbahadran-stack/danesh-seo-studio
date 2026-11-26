/** Site connection settings: store credentials (encrypted) + real verify/test. */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { workspaceRequired } from '../middleware/auth.js';
import { WordPressConnector, RestContractConnector, sendSignedWebhook } from '@danesh/website-connectors';
import { decryptSecret, encryptSecret } from '../lib/crypto.js';
import type { AppContext } from './context.js';

const ConnectionSchema = z.object({
  connectionType: z.enum(['wordpress-rest', 'rest-contract', 'webhook', 'none']),
  siteUrl: z.string().url().or(z.literal('')).optional(),
  username: z.string().max(100).optional(),
  password: z.string().max(200).optional(),
  apiKey: z.string().max(200).optional(),
  webhookUrl: z.string().url().or(z.literal('')).optional(),
  webhookSecret: z.string().max(200).optional(),
});

export interface ConnectionSettings {
  connectionType: 'wordpress-rest' | 'rest-contract' | 'webhook' | 'none';
  siteUrl?: string;
  username?: string;
  passwordEnc?: string;
  apiKeyEnc?: string;
  webhookUrl?: string;
  webhookSecretEnc?: string;
}

export function connectionRoutes(ctx: AppContext) {
  const r = Router({ mergeParams: true });

  const load = (workspaceId: string): ConnectionSettings | null => {
    const enc = ctx.repos.getSecret(workspaceId, 'connection');
    if (!enc) return null;
    try {
      return JSON.parse(decryptSecret(enc, ctx.encryptionKey)) as ConnectionSettings;
    } catch {
      return null;
    }
  };

  const masked = (c: ConnectionSettings | null) => ({
    connectionType: c?.connectionType ?? 'none',
    siteUrl: c?.siteUrl ?? '',
    username: c?.username ?? '',
    hasPassword: Boolean(c?.passwordEnc),
    hasApiKey: Boolean(c?.apiKeyEnc),
    webhookUrl: c?.webhookUrl ?? '',
    hasWebhookSecret: Boolean(c?.webhookSecretEnc),
  });

  r.get('/settings/connection', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    res.json(masked(load(req.params.workspaceId)));
  }));

  r.post('/settings/connection', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    const body = ConnectionSchema.parse(req.body);
    const prev = load(req.params.workspaceId);
    const settings: ConnectionSettings = {
      connectionType: body.connectionType,
      siteUrl: body.siteUrl || prev?.siteUrl || '',
      username: body.username || prev?.username || '',
      passwordEnc: body.password ? encryptSecret(body.password, ctx.encryptionKey) : prev?.passwordEnc,
      apiKeyEnc: body.apiKey ? encryptSecret(body.apiKey, ctx.encryptionKey) : prev?.apiKeyEnc,
      webhookUrl: body.webhookUrl || prev?.webhookUrl || '',
      webhookSecretEnc: body.webhookSecret ? encryptSecret(body.webhookSecret, ctx.encryptionKey) : prev?.webhookSecretEnc,
    };
    ctx.repos.setSecret(req.params.workspaceId, 'connection', encryptSecret(JSON.stringify(settings), ctx.encryptionKey));
    ctx.repos.updateWorkspace(req.params.workspaceId, { connection_type: body.connectionType });
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'settings.connection.save', 'settings', null, { type: body.connectionType }, req.ip ?? '');
    res.json(masked(settings));
  }));

  r.post('/settings/connection/test', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    const c = load(req.params.workspaceId);
    if (!c || c.connectionType === 'none') {
      return res.json({ ok: false, message: 'اتصالی تنظیم نشده است' });
    }
    try {
      if (c.connectionType === 'wordpress-rest' && c.siteUrl) {
        if (!c.username || !c.passwordEnc) return res.json({ ok: false, message: 'نام کاربری/رمز اتصال وردپرس ناقص است' });
        const wp = new WordPressConnector({
          siteUrl: c.siteUrl,
          username: c.username,
          applicationPassword: decryptSecret(c.passwordEnc, ctx.encryptionKey),
        });
        return res.json(await wp.verify());
      }
      if (c.connectionType === 'rest-contract' && c.siteUrl) {
        const rest = new RestContractConnector({
          baseUrl: c.siteUrl,
          apiKey: c.apiKeyEnc ? decryptSecret(c.apiKeyEnc, ctx.encryptionKey) : undefined,
        });
        return res.json(await rest.verify());
      }
      if (c.connectionType === 'webhook' && c.webhookUrl) {
        if (!c.webhookSecretEnc) return res.json({ ok: false, message: 'Webhook Secret تنظیم نشده است' });
        const result = await sendSignedWebhook(
          { url: c.webhookUrl, secret: decryptSecret(c.webhookSecretEnc, ctx.encryptionKey) },
          { event: 'connection.test', sentAt: new Date().toISOString() },
        );
        return res.json({ ok: result.ok, message: result.message });
      }
      return res.json({ ok: false, message: 'تنظیمات اتصال ناقص است (آدرس سایت را وارد کنید)' });
    } catch (err) {
      return res.json({ ok: false, message: `تست اتصال ناموفق: ${(err as Error).message}` });
    }
  }));

  r.use('/', asyncHandler(async () => {
    throw ApiError.notFound('مسیر اتصال یافت نشد');
  }));

  return r;
}
