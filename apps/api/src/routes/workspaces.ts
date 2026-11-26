/** Workspace routes: CRUD, members, settings (AI/SERP keys stored encrypted), stats, activity. */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { workspaceRequired } from '../middleware/auth.js';
import type { AppContext } from './context.js';

const WorkspaceSchema = z.object({
  name: z.string().min(2),
  domain: z.string().max(200).optional(),
  lang: z.enum(['fa', 'en']).optional(),
  cms: z.enum(['wordpress', 'custom-rest', 'static-html', 'astro', 'nextjs', 'other']).optional(),
});

const WeightsSchema = z.record(z.string(), z.number().min(0).max(100));

const AiSettingsSchema = z.object({
  baseUrl: z.string().url('آدرس base URL معتبر نیست').or(z.literal('')),
  model: z.string().max(100).optional(),
  apiKey: z.string().max(200).optional(),
});

export function workspaceRoutes(ctx: AppContext) {
  const r = Router();

  r.post('/', asyncHandler(async (req, res) => {
    const body = WorkspaceSchema.parse(req.body);
    const ws = ctx.repos.createWorkspace(req.user!.id, body);
    ctx.repos.logActivity(ws.id, req.user!.id, 'workspace.create', 'workspace', ws.id, { name: ws.name }, req.ip ?? '');
    res.status(201).json({ workspace: { ...ws, connection_json: undefined } });
  }));

  r.get('/', asyncHandler(async (req, res) => {
    const list = ctx.repos.listWorkspacesForUser(req.user!.id);
    res.json({
      workspaces: list.map((w) => ({ ...w, connection_json: undefined })),
      aiStatus: { envConfigured: ctx.cfg.hasEnvAi },
      serpStatus: { envConfigured: ctx.cfg.hasEnvSerp },
    });
  }));

  r.get('/:workspaceId', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const ws = ctx.repos.findWorkspace(req.params.workspaceId);
    if (!ws) throw ApiError.notFound();
    res.json({
      workspace: { ...ws, connection_json: undefined },
      stats: ctx.repos.workspaceStats(ws.id),
      ai: ctx.ai.status(ws.id),
      serp: ctx.keywords.serpStatus(ws.id),
    });
  }));

  r.patch('/:workspaceId', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    const body = WorkspaceSchema.partial().parse(req.body);
    const weights = req.body?.weights ? WeightsSchema.parse(req.body.weights) : undefined;
    ctx.repos.updateWorkspace(req.params.workspaceId, {
      ...body,
      ...(weights ? { weights_json: JSON.stringify(weights) } : {}),
    });
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'workspace.update', 'workspace', req.params.workspaceId, { fields: Object.keys(body) }, req.ip ?? '');
    res.json({ workspace: ctx.repos.findWorkspace(req.params.workspaceId) });
  }));

  r.delete('/:workspaceId', workspaceRequired(ctx.repos, 'owner'), asyncHandler(async (req, res) => {
    ctx.repos.updateWorkspace(req.params.workspaceId, { archived: 1 });
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'workspace.archive', 'workspace', req.params.workspaceId, {}, req.ip ?? '');
    res.json({ ok: true, message: 'ورک‌اسپیس آرشیو شد' });
  }));

  // ---- members ----
  r.get('/:workspaceId/members', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    res.json({ members: ctx.repos.listMembers(req.params.workspaceId) });
  }));

  r.post('/:workspaceId/members', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email(), role: z.enum(['viewer', 'editor', 'admin']) }).parse(req.body);
    const result = ctx.repos.addMember(req.params.workspaceId, body.email, body.role);
    if (!result.ok) throw ApiError.badRequest(result.message);
    res.status(201).json(result);
  }));

  r.delete('/:workspaceId/members/:userId', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    ctx.repos.removeMember(req.params.workspaceId, req.params.userId);
    res.json({ ok: true });
  }));

  // ---- AI settings ----
  r.get('/:workspaceId/settings/ai', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    res.json(ctx.ai.status(req.params.workspaceId));
  }));

  r.post('/:workspaceId/settings/ai', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    const body = AiSettingsSchema.parse(req.body);
    await ctx.ai.saveSettings(req.params.workspaceId, body);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'settings.ai.save', 'settings', null, { model: body.model ?? '' }, req.ip ?? '');
    res.json(ctx.ai.status(req.params.workspaceId));
  }));

  r.delete('/:workspaceId/settings/ai', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    ctx.repos.deleteSecret(req.params.workspaceId, 'ai_config');
    res.json(ctx.ai.status(req.params.workspaceId));
  }));

  r.post('/:workspaceId/settings/ai/test', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    res.json(await ctx.ai.testConnection(req.params.workspaceId));
  }));

  // ---- SERP settings ----
  r.post('/:workspaceId/settings/serp/test', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    res.json(await ctx.keywords.testSerp(req.params.workspaceId));
  }));

  r.post('/:workspaceId/settings/serp', workspaceRequired(ctx.repos, 'admin'), asyncHandler(async (req, res) => {
    const body = z.object({
      kind: z.enum(['dataforseo', 'serpapi']),
      login: z.string().optional(),
      password: z.string().optional(),
      apiKey: z.string().optional(),
    }).parse(req.body);
    const config = body.kind === 'dataforseo'
      ? { kind: 'dataforseo' as const, dataForSeo: { login: body.login ?? '', password: body.password ?? '' } }
      : { kind: 'serpapi' as const, serpApi: { apiKey: body.apiKey ?? '' } };
    ctx.keywords.saveSerpConfig(req.params.workspaceId, config);
    res.json(ctx.keywords.serpStatus(req.params.workspaceId));
  }));

  // ---- activity & stats ----
  r.get('/:workspaceId/activity', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    res.json({ activity: ctx.repos.listActivity(req.params.workspaceId) });
  }));

  return r;
}
