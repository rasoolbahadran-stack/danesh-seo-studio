/** Competitor analysis, technical SEO audit, briefs, reports routes. */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { workspaceRequired } from '../middleware/auth.js';
import { auditTechnical, detectDuplicatePages } from '../services/technicalService.js';
import type { AppContext } from './context.js';

export function moduleRoutes(ctx: AppContext) {
  const r = Router({ mergeParams: true });

  // ---- competitors ----
  r.post('/competitors', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({
      urls: z.array(z.string().url('آدرس رقیب معتبر نیست')).min(1).max(5),
      articleId: z.string().optional(),
    }).parse(req.body);
    let articleHtml: string | null = null;
    let articleKeyword: string | null = null;
    if (body.articleId) {
      const a = ctx.repos.findArticle(req.params.workspaceId, body.articleId);
      if (!a) throw ApiError.notFound('مقاله یافت نشد');
      articleHtml = a.content_html;
      articleKeyword = a.primary_keyword || null;
    }
    const result = await ctx.competitors.analyzeCompetitors(body.urls, articleHtml, articleKeyword);
    const report = ctx.repos.createReport(req.params.workspaceId, 'competitor', result, body.articleId, req.user!.id);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'competitors.analyze', 'report', report.id, { urls: body.urls.length }, req.ip ?? '');
    res.json({ reportId: report.id, ...result });
  }));

  // ---- technical SEO ----
  r.post('/technical', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({ url: z.string().url('آدرس معتبر نیست'), checkLinks: z.boolean().optional() }).parse(req.body);
    try {
      const report = await auditTechnical(body.url, { checkLinks: body.checkLinks });
      const saved = ctx.repos.createReport(req.params.workspaceId, 'technical', report, null, req.user!.id);
      ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'technical.audit', 'report', saved.id, { url: body.url }, req.ip ?? '');
      res.json({ reportId: saved.id, report });
    } catch (err) {
      throw ApiError.externalError('FETCH_FAILED', `بررسی تکنیکال ناموفق بود: ${(err as Error).message}`);
    }
  }));

  r.post('/technical/duplicates', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const body = z.object({ urls: z.array(z.string().url()).min(2).max(10) }).parse(req.body);
    try {
      res.json(await detectDuplicatePages(body.urls));
    } catch (err) {
      throw ApiError.externalError('FETCH_FAILED', `بررسی صفحات تکراری ناموفق بود: ${(err as Error).message}`);
    }
  }));

  // ---- briefs ----
  r.post('/briefs', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const body = z.object({
      keyword: z.string().min(2).max(150),
      competitorUrls: z.array(z.string().url()).max(3).optional(),
    }).parse(req.body);
    const provider = ctx.ai.resolveProvider(req.params.workspaceId);
    let competitors = [];
    if (body.competitorUrls?.length) {
      const fetched = await ctx.competitors.fetchDocs(body.competitorUrls);
      competitors = fetched.pages.filter((p): p is import('../services/competitorService.js').FetchedPage => 'title' in p);
    }
    const brief = await ctx.briefs.generate(body.keyword, provider, competitors);
    const saved = ctx.repos.createBrief(req.params.workspaceId, body.keyword, JSON.stringify(brief));
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'brief.create', 'brief', saved.id, { keyword: body.keyword }, req.ip ?? '');
    res.status(201).json({ brief: { id: saved.id, keyword: saved.keyword, status: saved.status, createdAt: saved.created_at, data: brief } });
  }));

  r.get('/briefs', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    res.json({
      briefs: ctx.repos.listBriefs(req.params.workspaceId).map((b) => ({
        id: b.id, keyword: b.keyword, status: b.status, createdAt: b.created_at, data: JSON.parse(b.brief_json),
      })),
    });
  }));

  r.patch('/briefs/:briefId', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const b = ctx.repos.findBrief(req.params.workspaceId, req.params.briefId);
    if (!b) throw ApiError.notFound('بریف یافت نشد');
    const body = z.object({
      data: z.record(z.string(), z.unknown()).optional(),
      status: z.enum(['draft', 'approved']).optional(),
    }).parse(req.body);
    ctx.repos.updateBrief(req.params.workspaceId, b.id, {
      brief_json: body.data ? JSON.stringify(body.data) : undefined,
      status: body.status,
    });
    const fresh = ctx.repos.findBrief(req.params.workspaceId, b.id)!;
    res.json({ brief: { id: fresh.id, keyword: fresh.keyword, status: fresh.status, createdAt: fresh.created_at, data: JSON.parse(fresh.brief_json) } });
  }));

  // ---- reports ----
  r.get('/reports', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const reports = ctx.repos.listReports(req.params.workspaceId, type);
    res.json({
      reports: reports.map((r) => ({
        id: r.id, type: r.type, articleId: r.article_id, createdAt: r.created_at,
        payload: JSON.parse(r.payload_json),
      })),
    });
  }));

  r.get('/reports/:reportId', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const rep = ctx.repos.findReport(req.params.workspaceId, req.params.reportId);
    if (!rep) throw ApiError.notFound('گزارش یافت نشد');
    res.json({
      report: { id: rep.id, type: rep.type, articleId: rep.article_id, createdAt: rep.created_at, payload: JSON.parse(rep.payload_json) },
    });
  }));

  return r;
}
