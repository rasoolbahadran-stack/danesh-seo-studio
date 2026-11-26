/**
 * Heading structure analysis: single H1, no level skips, keyword in headings,
 * duplicates, overly long headings.
 */
import type { HeadingsReport, ParsedArticle } from './types.js';
import { containsKeyword, normalizePersian } from './persian.js';

export function analyzeHeadings(article: ParsedArticle, primaryKeyword: string): HeadingsReport & { score: number } {
  const hs = article.headings;
  const h1Count = hs.filter((h) => h.level === 1).length;
  const h2Count = hs.filter((h) => h.level === 2).length;
  const h3Count = hs.filter((h) => h.level === 3).length;

  // level-skip detection (e.g. H2 → H4)
  let noLevelSkip = true;
  let prev = 0;
  for (const h of hs) {
    if (h.level > prev + 1) noLevelSkip = false;
    prev = h.level;
  }

  const kwNorm = normalizePersian(primaryKeyword);
  const keywordInHeadings = hs.some((h) => containsKeyword(normalizePersian(h.text), primaryKeyword));
  const duplicates: string[] = [];
  const seen = new Map<string, number>();
  for (const h of hs) {
    const n = normalizePersian(h.text);
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  for (const [t, c] of seen) if (c > 1) duplicates.push(t);

  const tooLong = hs.filter((h) => h.text.length > 90).map((h) => h.text.slice(0, 60) + '…');

  let score = 100;
  const reasons: string[] = [];
  if (h1Count === 0) {
    score -= 35;
    reasons.push('هیچ H1 وجود ندارد');
  } else if (h1Count > 1) {
    score -= 25;
    reasons.push(`${h1Count} عدد H1 پیدا شد (فقط یک H1 مجاز است)`);
  }
  if (!noLevelSkip) {
    score -= 10;
    reasons.push('ساختار هدینگ‌ها پرشی است (مثلاً از H2 به H4)');
  }
  if (h2Count === 0 && article.wordCount > 300) {
    score -= 20;
    reasons.push('برای این حجم محتوا هیچ H2 وجود ندارد');
  }
  if (!keywordInHeadings && article.wordCount > 300) {
    score -= 20;
    reasons.push('کلمه کلیدی اصلی در هیچ هدینگی استفاده نشده است');
  }
  if (duplicates.length > 0) {
    score -= 10;
    reasons.push(`${duplicates.length} هدینگ تکراری`);
  }
  if (tooLong.length > 0) score -= 5;
  score = Math.max(0, Math.min(100, score));

  return {
    outline: hs.map((h) => ({ level: h.level, text: h.text })),
    h1Count, h2Count, h3Count,
    singleH1: h1Count === 1,
    noLevelSkip,
    keywordInHeadings,
    duplicates,
    tooLong,
    score,
  };
}
