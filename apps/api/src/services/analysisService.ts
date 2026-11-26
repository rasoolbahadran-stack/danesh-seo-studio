/**
 * Analysis service: runs the seo-engine + content-analyzer on an article,
 * enriches with live competitor docs, saves the score and optionally the
 * audit report.
 */
import { analyzeArticle, type CompetitorDoc, type Intent, type ScoreWeights } from '@danesh/seo-engine';
import { analyzeEEAT, detectCannibalization, type ArticleRef } from '@danesh/content-analyzer';
import type { Repos, ArticleRow, WorkspaceRow } from '../db/repos.js';
import type { CompetitorService } from './competitorService.js';

export interface AnalysisResultBundle {
  report: ReturnType<typeof analyzeArticle>;
  eeat: ReturnType<typeof analyzeEEAT>;
  cannibalization?: ReturnType<typeof detectCannibalization>;
  aiUsedForCompetitors: boolean;
}

export class AnalysisService {
  constructor(private repos: Repos, private competitors: CompetitorService) {}

  async analyzeArticle(article: ArticleRow, workspace: WorkspaceRow, opts: { skipFetch?: boolean } = {}): Promise<AnalysisResultBundle> {
    let competitors: CompetitorDoc[] = [];
    let aiUsedForCompetitors = false;
    if (!opts.skipFetch) {
      const urls = safeJsonArray(article.competitor_urls_json);
      if (urls.length > 0) {
        const fetched = await this.competitors.fetchDocs(urls.slice(0, 3));
        competitors = fetched.docs;
        aiUsedForCompetitors = fetched.docs.length > 0;
      }
    }

    const weights = workspace.weights_json ? (JSON.parse(workspace.weights_json) as ScoreWeights) : undefined;
    const secondary = safeJsonArray(article.secondary_keywords_json);

    const report = analyzeArticle({
      html: article.content_html,
      title: article.meta_title || undefined,
      metaDescription: article.meta_description || undefined,
      primaryKeyword: article.primary_keyword,
      secondaryKeywords: secondary,
      lang: (workspace.lang === 'en' ? 'en' : 'fa'),
      intent: (article.intent || undefined) as Intent | undefined,
      targetWordCount: article.target_words || undefined,
      competitors,
      weights,
      slug: article.slug || undefined,
    });

    const eeat = analyzeEEAT(article.content_html, { wordCountTarget: article.target_words || 900 });
    this.repos.saveLastScore(article.id, JSON.stringify({ score: report.score, grade: report.grade, at: new Date().toISOString() }));

    return { report, eeat, aiUsedForCompetitors };
  }

  auditWorkspaceArticles(workspaceId: string) {
    const ids = this.repos.workspaceArticleIds(workspaceId);
    const refs: ArticleRef[] = ids.map((a) => ({
      id: a.id,
      title: a.title,
      primaryKeyword: a.primary_keyword,
      wordCount: a.word_target,
    }));
    return detectCannibalization(refs);
  }
}

function safeJsonArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
