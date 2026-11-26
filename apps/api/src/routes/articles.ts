/**
 * Article routes: CRUD, autosave, versions (create/restore/diff), live
 * analysis, final audit and AI tasks. All workspace-scoped.
 */
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { workspaceRequired } from '../middleware/auth.js';
import { blockDiff } from '../lib/diff.js';
import { aiTasks, AiNotConfiguredError } from '../services/aiService.js';
import { AiProviderError } from '@danesh/ai-engine';
import type { AppContext } from './context.js';

const AUTOSAVE_VERSION_INTERVAL_MS = 5 * 60 * 1000;

const ArticleCreateSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().max(200).optional(),
  primaryKeyword: z.string().max(200).optional(),
  secondaryKeywords: z.array(z.string().max(100)).max(30).optional(),
  intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']).optional(),
  targetWords: z.number().int().min(0).max(20000).optional(),
  contentHtml: z.string().max(500_000).optional(),
  metaTitle: z.string().max(300).optional(),
  metaDescription: z.string().max(400).optional(),
  competitorUrls: z.array(z.string().url()).max(5).optional(),
  briefId: z.string().optional(),
});

const ArticlePatchSchema = ArticleCreateSchema.partial();

function rowToJson(a: import('../db/repos.js').ArticleRow) {
  return {
    id: a.id, workspaceId: a.workspace_id, title: a.title, slug: a.slug,
    primaryKeyword: a.primary_keyword, secondaryKeywords: JSON.parse(a.secondary_keywords_json) as string[],
    intent: a.intent, targetWords: a.target_words, status: a.status,
    contentHtml: a.content_html, metaTitle: a.meta_title, metaDescription: a.meta_description,
    featuredImage: a.featured_image, briefId: a.brief_id,
    competitorUrls: JSON.parse(a.competitor_urls_json) as string[],
    lastScore: a.last_score_json ? JSON.parse(a.last_score_json) : null,
    publishedUrl: a.published_url,
    createdAt: a.created_at, updatedAt: a.updated_at,
  };
}

export function articleRoutes(ctx: AppContext) {
  const r = Router({ mergeParams: true });

  r.post('/', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const body = ArticleCreateSchema.parse(req.body);
    let article = ctx.repos.createArticle(req.params.workspaceId, req.user!.id, {
      title: body.title,
      slug: body.slug,
      primary_keyword: body.primaryKeyword ?? '',
      secondary_keywords_json: JSON.stringify(body.secondaryKeywords ?? []),
      intent: body.intent ?? '',
      target_words: body.targetWords ?? 0,
      content_html: body.contentHtml ?? '',
      meta_title: body.metaTitle ?? '',
      meta_description: body.metaDescription ?? '',
      brief_id: body.briefId ?? null,
      competitor_urls_json: JSON.stringify(body.competitorUrls ?? []),
    });
    ctx.repos.createVersion(article, req.user!.id, 'نسخه اولیه', null);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'article.create', 'article', article.id, { title: article.title }, req.ip ?? '');
    res.status(201).json({ article: rowToJson(article) });
  }));

  r.get('/', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const { rows, total } = ctx.repos.listArticles(req.params.workspaceId, { status, limit, offset });
    res.json({
      articles: rows.map((a) => ({ ...rowToJson(a), contentHtml: undefined })),
      total,
    });
  }));

  r.get('/:articleId', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    res.json({ article: rowToJson(a), versions: ctx.repos.listVersions(a.id).slice(0, 50) });
  }));

  r.patch('/:articleId', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const body = ArticlePatchSchema.parse(req.body);
    const forceSave = req.body?.forceSave === true;
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.slug !== undefined) updates.slug = body.slug;
    if (body.primaryKeyword !== undefined) updates.primary_keyword = body.primaryKeyword;
    if (body.secondaryKeywords !== undefined) updates.secondary_keywords_json = JSON.stringify(body.secondaryKeywords);
    if (body.intent !== undefined) updates.intent = body.intent;
    if (body.targetWords !== undefined) updates.target_words = body.targetWords;
    if (body.contentHtml !== undefined) updates.content_html = body.contentHtml;
    if (body.metaTitle !== undefined) updates.meta_title = body.metaTitle;
    if (body.metaDescription !== undefined) updates.meta_description = body.metaDescription;
    if (body.competitorUrls !== undefined) updates.competitor_urls_json = JSON.stringify(body.competitorUrls);
    ctx.repos.updateArticle(req.params.workspaceId, a.id, updates);

    // Autosave versioning: auto version when the last one is older than the interval
    const last = ctx.repos.lastVersionTime(a.id);
    const shouldVersion = forceSave || !last || (Date.now() - new Date(last).getTime()) > AUTOSAVE_VERSION_INTERVAL_MS;
    let version = null;
    if (shouldVersion) {
      const fresh = ctx.repos.findArticle(req.params.workspaceId, a.id)!;
      version = ctx.repos.createVersion(fresh, req.user!.id, forceSave ? 'ذخیره دستی' : 'ذخیره خودکار', null);
    }
    res.json({
      savedAt: new Date().toISOString(),
      version: version ? { id: version.id, no: version.version_no, note: version.note } : null,
    });
  }));

  r.delete('/:articleId', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    ctx.repos.deleteArticle(req.params.workspaceId, a.id);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'article.delete', 'article', a.id, { title: a.title }, req.ip ?? '');
    res.json({ ok: true });
  }));

  // ---- versions ----
  r.get('/:articleId/versions', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    res.json({ versions: ctx.repos.listVersions(a.id) });
  }));

  r.post('/:articleId/versions', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 200) : 'ذخیره دستی';
    const v = ctx.repos.createVersion(a, req.user!.id, note, a.last_score_json ? (JSON.parse(a.last_score_json) as { score: number }).score : null);
    res.status(201).json({ version: v });
  }));

  r.post('/:articleId/versions/:versionId/restore', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const v = ctx.repos.findVersion(req.params.versionId);
    if (!v || v.article_id !== a.id) throw ApiError.notFound('نسخه یافت نشد');
    ctx.repos.createVersion(a, req.user!.id, `بازیابی نسخه ${v.version_no}`, null);
    ctx.repos.updateArticle(req.params.workspaceId, a.id, {
      title: v.title, content_html: v.content_html, meta_title: v.meta_title, meta_description: v.meta_description,
    });
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'article.restore-version', 'article', a.id, { version: v.version_no }, req.ip ?? '');
    const fresh = ctx.repos.findArticle(req.params.workspaceId, a.id)!;
    res.json({ article: rowToJson(fresh) });
  }));

  r.get('/:articleId/versions/:versionId/diff', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const v = ctx.repos.findVersion(req.params.versionId);
    if (!v || v.article_id !== a.id) throw ApiError.notFound('نسخه یافت نشد');
    const diff = blockDiff(v.content_html, a.content_html);
    res.json({ diff, baseVersion: v.version_no });
  }));

  // ---- analysis & audit ----
  r.post('/:articleId/analyze', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const ws = ctx.repos.findWorkspace(req.params.workspaceId)!;
    const bundle = await ctx.analysis.analyzeArticle(a, ws);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'article.analyze', 'article', a.id, { score: bundle.report.score }, req.ip ?? '');
    res.json({
      score: bundle.report.score,
      grade: bundle.report.grade,
      report: bundle.report,
      eeat: bundle.eeat,
      competitorsFetched: bundle.aiUsedForCompetitors,
    });
  }));

  r.post('/:articleId/audit', workspaceRequired(ctx.repos), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const ws = ctx.repos.findWorkspace(req.params.workspaceId)!;
    const bundle = await ctx.analysis.analyzeArticle(a, ws);
    const cannibalization = ctx.analysis.auditWorkspaceArticles(req.params.workspaceId);
    let technical = null;
    if (a.published_url) {
      const { auditTechnical } = await import('../services/technicalService.js');
      technical = await auditTechnical(a.published_url);
    }
    const payload = {
      totalScore: bundle.report.score,
      grade: bundle.report.grade,
      report: bundle.report,
      eeat: bundle.eeat,
      cannibalization,
      technical: technical ? { url: technical.finalUrl, issues: technical.issues, coreWebVitals: technical.coreWebVitals } : null,
      passed: bundle.report.criteria.filter((c) => c.status === 'green').length,
      criticalCount: bundle.report.issues.filter((i) => i.priority === 'critical').length,
      highCount: bundle.report.issues.filter((i) => i.priority === 'high').length,
      auditedAt: new Date().toISOString(),
    };
    const report = ctx.repos.createReport(req.params.workspaceId, 'audit', payload, a.id, req.user!.id);
    ctx.repos.logActivity(req.params.workspaceId, req.user!.id, 'article.audit', 'article', a.id, { score: payload.totalScore }, req.ip ?? '');
    res.json({ reportId: report.id, ...payload });
  }));

  // ---- AI tasks ----
  r.post('/:articleId/ai/:task', workspaceRequired(ctx.repos, 'editor'), asyncHandler(async (req, res) => {
    const a = ctx.repos.findArticle(req.params.workspaceId, req.params.articleId);
    if (!a) throw ApiError.notFound('مقاله یافت نشد');
    const task = req.params.task;
    const fn = aiTasks[task];
    if (!fn) throw ApiError.badRequest(`تسک نامعتبر: ${task}. تسک‌های معتبر: ${Object.keys(aiTasks).join(', ')}`);
    const provider = ctx.ai.resolveProvider(req.params.workspaceId);
    try {
      if (!provider) throw new AiNotConfiguredError();
      const input = { ...req.body, keyword: req.body?.keyword ?? a.primary_keyword };
      const result = await fn(provider, input);
      ctx.repos.logActivity(req.params.workspaceId, req.user!.id, `ai.${task}`, 'article', a.id, {}, req.ip ?? '');
      res.json({ task, result });
    } catch (err) {
      if (err instanceof AiNotConfiguredError) throw ApiError.aiNotConfigured(err.message);
      if (err instanceof AiProviderError) throw ApiError.externalError('AI_PROVIDER_ERROR', err.message);
      throw err;
    }
  }));

  return r;
}
