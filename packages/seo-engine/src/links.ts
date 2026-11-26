/**
 * Link analysis: internal/external counts, generic anchor detection,
 * link density. Broken-link checking happens server-side (technical module).
 */
import type { LinksReport, ParsedArticle } from './types.js';
import { GENERIC_ANCHORS, normalizePersian } from './persian.js';

export function analyzeLinks(article: ParsedArticle): LinksReport & { score: number } {
  const links = article.links;
  const internalCount = links.filter((l) => l.internal === true).length;
  const externalCount = links.filter((l) => l.internal === false).length;
  const nonNavigational = links.filter((l) => l.internal === null).length;
  const genericAnchors = links
    .filter((l) => l.anchorText && GENERIC_ANCHORS.some((g) => normalizePersian(l.anchorText) === normalizePersian(g)))
    .map((l) => ({ text: l.anchorText, href: l.href }));
  const linksPer100Words = article.wordCount > 0 ? (links.length / article.wordCount) * 100 : 0;

  let score = 100;
  const reasons: string[] = [];
  if (internalCount === 0) {
    score -= 40;
    reasons.push('هیچ لینک داخلی وجود ندارد');
  } else if (internalCount < 2) {
    score -= 15;
    reasons.push('فقط یک لینک داخلی وجود دارد');
  }
  if (externalCount === 0 && article.wordCount > 600) {
    score -= 20;
    reasons.push('برای مقالات بلند، حداقل یک لینک خارجی معتبر توصیه می‌شود');
  }
  if (genericAnchors.length > 0) {
    score -= Math.min(20, genericAnchors.length * 10);
    reasons.push(`انکرتکست‌های کلی (مثل «اینجا») استفاده شده: ${genericAnchors.length}`);
  }
  if (linksPer100Words > 4) {
    score -= 15;
    reasons.push(`تراکم لینک بسیار بالاست (${linksPer100Words.toFixed(1)} لینک به ازای ۱۰۰ کلمه)`);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    internalCount,
    externalCount,
    nonNavigational,
    genericAnchors,
    linksPer100Words: Number(linksPer100Words.toFixed(2)),
    score,
  };
}
