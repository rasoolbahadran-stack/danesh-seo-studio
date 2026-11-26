/**
 * Keyword cannibalization detection across a site's articles:
 * two pages targeting the same/similar primary keyword compete with each other.
 */
import { normalizePersian, tokenize } from '@danesh/seo-engine';

export interface ArticleRef {
  id: string;
  title: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  wordCount?: number;
}

export interface CannibalizationPair {
  articles: [ArticleRef, ArticleRef];
  severity: 'high' | 'medium';
  reason: string;
  recommendations: string[];
}

export interface CannibalizationReport {
  pairs: CannibalizationPair[];
  checked: number;
  summary: string;
}

function keywordSimilarity(a: string, b: string): number {
  const na = normalizePersian(a).trim();
  const nb = normalizePersian(b).trim();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(tokenize(na));
  const tb = new Set(tokenize(nb));
  if (ta.size === 0 || tb.size === 0) return 0;
  const inter = [...ta].filter((w) => tb.has(w)).length;
  const union = new Set([...ta, ...tb]).size;
  return inter / union;
}

export function detectCannibalization(articles: ArticleRef[]): CannibalizationReport {
  const pairs: CannibalizationPair[] = [];
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const a = articles[i];
      const b = articles[j];
      const sim = keywordSimilarity(a.primaryKeyword, b.primaryKeyword);
      if (sim >= 0.6) {
        const identical = sim === 1;
        pairs.push({
          articles: [a, b],
          severity: identical ? 'high' : 'medium',
          reason: identical
            ? `هر دو مقاله دقیقاً یک کلمه کلیدی اصلی دارند: «${a.primaryKeyword}»`
            : `کلمات کلیدی اصلی شبیه هم هستند: «${a.primaryKeyword}» و «${b.primaryKeyword}» (اشتراک ${(sim * 100).toFixed(0)}٪)`,
          recommendations: identical
            ? [
                'یکی از مقالات را به صفحه اصلی این کلمه تبدیل و دیگری را ۳۰۱ ریدایرکت کنید، یا',
                'مقالات را ادغام کنید، یا',
                'کلمه کلیدی یکی را به شکل متفاوت (مثلاً «آموزش X» در برابر «خرید X») تغییر دهید',
              ]
            : [
                'فاصله معنایی دو مقاله را بیشتر کنید (اینتمت‌های متفاوت)',
                'از تکرار کلمه کلیدی مشترک در عنوان‌ها جلوگیری کنید',
              ],
        });
      }
    }
  }
  return {
    pairs,
    checked: articles.length,
    summary: pairs.length === 0
      ? `در ${articles.length} مقاله، کانیبالیزیشن کلمه کلیدی پیدا نشد.`
      : `${pairs.length} جفت مقاله با ریسک کانیبالیزیشن پیدا شد.`,
  };
}

/**
 * Keyword mapping: assign keywords to pages while preventing duplicate
 * assignments of the same primary keyword to two pages.
 */
export interface MappingEntry {
  keyword: string;
  pageId: string | null;
  pageTitle: string | null;
  intentHint?: string;
  conflict: boolean;
  note: string;
}

export function buildKeywordMapping(keywords: string[], pages: ArticleRef[]): { entries: MappingEntry[]; conflicts: string[] } {
  const used = new Map<string, string>(); // normalized keyword → pageId
  const entries: MappingEntry[] = [];
  const conflicts: string[] = [];

  for (const k of keywords) {
    const norm = normalizePersian(k).trim();
    let match: ArticleRef | null = null;
    let best = 0;
    for (const p of pages) {
      const sim = keywordSimilarity(norm, p.primaryKeyword);
      if (sim > best) {
        best = sim;
        match = p;
      }
    }
    const assigned = best >= 0.5 && match ? match : null;
    let conflict = false;
    let note = '';
    if (assigned) {
      const key = normalizePersian(assigned.primaryKeyword);
      if (used.has(key)) {
        conflict = true;
        note = 'این صفحه قبلاً برای یک کلمه کلیدی مشابه انتخاب شده — ریسک کانیبالیزیشن';
        conflicts.push(`«${k}» → «${assigned.title}» با نگاشت قبلی تداخل دارد`);
      } else {
        used.set(key, assigned.id);
        note = 'کلمه کلیدی اصلی این صفحه است';
      }
    } else {
      note = pages.length === 0 ? 'صفحه‌ای برای نگاشت وجود ندارد' : 'صفحه موجود مناسبی پیدا نشد — محتوای جدید لازم است';
    }
    entries.push({
      keyword: k,
      pageId: assigned ? assigned.id : null,
      pageTitle: assigned ? assigned.title : null,
      conflict,
      note,
    });
  }
  return { entries, conflicts };
}
