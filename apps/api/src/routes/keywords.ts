/** Keyword research, cannibalization, mapping, SERP and volume routes. */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { workspaceRequired } from '../middleware/auth.js';
import { detectCannibalization, buildKeywordMapping } from '@danesh/content-analyzer';
import type { AppContext } from './context.js';

export function keywordRoutes(ctx: AppContext) {
  const r = Router({ mergeParams: true });

  r.post('/research', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({ seed: z.string().min(2).max(100) }).parse(req.body);
    const provider = ctx.ai.resolveProvider(req.params.workspaceId);
    const result = await ctx.keywords.research(req.params.workspaceId, body.seed, provider);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'keywords.research', 'keyword', null, { seed: body.seed }, req.ip ?? '');
    res.json(result);
  }));

  r.get('/cannibalization', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const ids = ctx.repos.workspaceArticleIds(req.params.workspaceId);
    const report = detectCannibalization(ids.map((a) => ({
      id: a.id, title: a.title, primaryKeyword: a.primary_keyword,
    })));
    res.json(report);
  }));

  r.post('/mapping', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({ keywords: z.array(z.string().min(2)).min(1).max(100) }).parse(req.body);
    const ids = ctx.repos.workspaceArticleIds(req.params.workspaceId);
    const mapping = buildKeywordMapping(body.keywords, ids.map((a) => ({
      id: a.id, title: a.title, primaryKeyword: a.primary_keyword,
    })));
    res.json(mapping);
  }));

  r.post('/serp', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({
      keyword: z.string().min(2).max(150),
      country: z.string().max(40).optional(),
      language: z.string().max(10).optional(),
    }).parse(req.body);
    const result = await ctx.keywords.serp(req.params.workspaceId, body.keyword, { country: body.country, language: body.language });
    res.json(result);
  }));

  r.post('/serp/volume', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({ keywords: z.array(z.string().min(2)).min(1).max(200) }).parse(req.body);
    res.json(await ctx.keywords.volume(req.params.workspaceId, body.keywords));
  }));

  r.get('/serp/status', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    res.json(ctx.keywords.serpStatus(req.params.workspaceId));
  }));

  // Unknown keyword sub-route guard
  r.use('/', asyncHandler(async () => {
    throw ApiError.notFound('مسیر کلمات کلیدی یافت نشد');
  }));

  return r;
}
