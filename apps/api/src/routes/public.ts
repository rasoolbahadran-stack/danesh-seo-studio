/** Public (token-scoped) endpoints for embeddable widgets. No user auth — the
 * workspace share token acts as the credential; data is score-summary only. */
import { Router } from 'express';
import { ApiError, asyncHandler } from '../lib/errors.js';
import type { AppContext } from './context.js';

export function publicRoutes(ctx: AppContext) {
  const r = Router();

  r.get('/workspaces/:workspaceId/articles/:articleId/report', asyncHandler(async (req, res) => {
    const { workspaceId, articleId } = req.params;
    const token = String(req.query.token ?? '');
    if (!token) throw ApiError.forbidden('توکن اشتراک‌گذاری لازم است');

    const ws = ctx.repos.findWorkspace(workspaceId);
    if (!ws) throw ApiError.notFound();
    let shareToken = '';
    try {
      shareToken = (JSON.parse(ws.settings_json) as { shareToken?: string }).shareToken ?? '';
    } catch { /* empty */ }
    if (!shareToken || token !== shareToken) throw ApiError.forbidden('توکن اشتراک‌گذاری نامعتبر است');

    const article = ctx.repos.findArticle(workspaceId, articleId);
    if (!article) throw ApiError.notFound('مقاله یافت نشد');

    let score: number | null = null;
    let grade: string | null = null;
    let updatedAt: string | null = null;
    if (article.last_score_json) {
      try {
        const parsed = JSON.parse(article.last_score_json) as { score: number; grade: string; at: string };
        score = parsed.score; grade = parsed.grade; updatedAt = parsed.at;
      } catch { /* no cached score */ }
    }
    const audits = ctx.repos.listReports(workspaceId, 'audit', 20)
      .filter((x) => x.article_id === articleId);
    let criticalCount: number | null = null;
    if (audits[0]) {
      try {
        criticalCount = (JSON.parse(audits[0].payload_json) as { criticalCount?: number }).criticalCount ?? null;
      } catch { /* ignore */ }
    }

    if (score === null) {
      res.status(404).json({ error: { code: 'NO_REPORT', message: 'هنوز تحلیلی برای این مقاله ثبت نشده است' } });
      return;
    }
    res.json({ score, grade, updatedAt, criticalCount });
  }));

  return r;
}
