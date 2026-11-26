/**
 * Semantic coverage analysis vs competitors (TF-IDF style suggestions,
 * topic-gap detection, coverage percentage).
 */
import type { CompetitorDoc, ParsedArticle, SemanticReport } from './types.js';
import { countWords, tokenize, normalizePersian } from './persian.js';
import { extractTerms, findMissingTopics, suggestSemanticTerms } from './keywords.js';

export function analyzeSemantic(
  article: ParsedArticle,
  competitors: CompetitorDoc[],
): SemanticReport & { score: number } {
  const valid = competitors.filter((c) => countWords(c.text ?? '') > 50);
  if (valid.length === 0) {
    return {
      competitorCount: 0,
      suggestedTerms: [],
      coveragePct: null,
      competitorTopTerms: [],
      missingTopics: [],
      score: 70, // neutral: cannot evaluate semantic coverage without competitors
    };
  }

  const suggested = suggestSemanticTerms(article.text, valid);
  const topTerms: { term: string; count: number }[] = [];
  for (const c of valid) {
    topTerms.push(...extractTerms(c.text ?? '', 'fa', 12).map((t) => ({ term: t.term, count: t.count })));
  }
  const articleTerms = new Set(extractTerms(article.text, 'fa', 200).map((t) => t.term));
  const competitorTop = new Map<string, number>();
  for (const t of topTerms) competitorTop.set(t.term, Math.max(competitorTop.get(t.term) ?? 0, t.count));
  const topSorted = [...competitorTop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  const present = topSorted.filter(([term]) => articleTerms.has(term)).length;
  const coveragePct = topSorted.length > 0 ? (present / topSorted.length) * 100 : null;
  const missingTopics = findMissingTopics(
    article.headings.map((h) => h.text),
    valid,
  );

  let score = 100;
  if (coveragePct !== null) {
    if (coveragePct < 40) score -= 40;
    else if (coveragePct < 60) score -= 25;
    else if (coveragePct < 75) score -= 10;
  }
  if (suggested.length > 15) score -= 10;
  else if (suggested.length > 8) score -= 5;
  if (missingTopics.length >= 4) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    competitorCount: valid.length,
    suggestedTerms: suggested,
    coveragePct: coveragePct === null ? null : Number(coveragePct.toFixed(0)),
    competitorTopTerms: topSorted.map(([term, count]) => ({ term, count })),
    missingTopics,
    score,
  };
}
