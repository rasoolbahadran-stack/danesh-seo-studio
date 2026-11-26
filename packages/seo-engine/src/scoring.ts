/**
 * Scoring: criterion weights, total score computation, status thresholds,
 * issue factory. The total is a weighted average — weights are relative and
 * configurable per workspace; nothing is random or decorative.
 */
import type { CriterionKey, CriterionResult, IssueDraft, SeoIssue } from './types.js';

export const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  keyword: 16,
  contentQuality: 12,
  contentStructure: 8,
  searchIntent: 8,
  readability: 10,
  semantic: 12,
  headings: 8,
  internalLinks: 5,
  externalLinks: 3,
  images: 6,
  title: 8,
  metaDescription: 6,
  completeness: 8,
};

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  keyword: 'بهینه‌سازی کلمات کلیدی',
  contentQuality: 'کیفیت محتوا',
  contentStructure: 'ساختار محتوا',
  searchIntent: 'تناسب با نیت جست‌وجو',
  readability: 'خوانایی',
  semantic: 'پوشش معنایی',
  headings: 'بهینه‌سازی هدینگ‌ها',
  internalLinks: 'لینک‌سازی داخلی',
  externalLinks: 'لینک‌سازی خارجی',
  images: 'بهینه‌سازی تصاویر',
  title: 'عنوان سئو',
  metaDescription: 'توضیحات متا',
  completeness: 'جامعیت محتوا',
};

export function statusOf(score: number): 'green' | 'orange' | 'red' {
  if (score >= 75) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

export function computeTotalScore(criteria: CriterionResult[]): { score: number; grade: string } {
  const totalWeight = criteria.reduce((a, c) => a + c.weight, 0);
  if (totalWeight <= 0) return { score: 0, grade: 'F' };
  const weighted = criteria.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight;
  const score = Math.round(weighted);
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';
  return { score, grade };
}

const ISSUE_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, passed: 4 };

export function sortIssues(issues: SeoIssue[]): SeoIssue[] {
  return [...issues].sort((a, b) => ISSUE_RANK[a.priority] - ISSUE_RANK[b.priority]);
}

/** Build a stable SeoIssue with deterministic id (`criterion:code`). */
export function makeIssue(
  criterion: CriterionKey,
  draft: IssueDraft,
): SeoIssue {
  return {
    id: `${criterion}:${draft.code}`,
    criterion,
    code: draft.code,
    priority: draft.priority,
    title: draft.title,
    description: draft.description,
    location: draft.location,
    whyItMatters: draft.whyItMatters,
    howToFix: draft.howToFix,
    autoFix: draft.autoFix,
    status: 'open',
  };
}
