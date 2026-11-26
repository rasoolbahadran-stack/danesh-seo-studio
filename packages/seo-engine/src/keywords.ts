/**
 * Keyword analysis: extraction, density, distribution, prominence,
 * stuffing detection, TF-IDF suggestions against competitor docs.
 */
import type { CompetitorDoc, KeywordReport, KeywordUsage, ParsedArticle } from './types.js';
import {
  containsKeyword, countKeywordOccurrences, countWords, normalized, normalizePersian,
  stopwordSet, tokenize, ZWNJ,
} from './persian.js';

export interface TermFreq { term: string; count: number }

const MIN_TERM_LEN = 3; // chars (Persian stem length)

/** Extract frequent single words + n-grams (content words only). */
export function extractTerms(text: string, lang: 'fa' | 'en' = 'fa', topN = 40, ngramMax = 3): TermFreq[] {
  const words = tokenize(normalizePersian(text));
  const stops = stopwordSet(lang);
  const content: string[] = [];
  for (const w of words) {
    const bare = w.split(ZWNJ).join('');
    if (stops.has(w) || stops.has(bare)) continue;
    if (w.length < MIN_TERM_LEN) continue;
    content.push(w);
  }
  const freq = new Map<string, number>();
  const bump = (t: string) => freq.set(t, (freq.get(t) ?? 0) + 1);
  for (const w of content) bump(w);
  for (let n = 2; n <= ngramMax; n++) {
    for (let i = 0; i + n <= content.length; i++) {
      bump(content.slice(i, i + n).join(' '));
    }
  }
  return [...freq.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || b.term.length - a.term.length)
    .slice(0, topN);
}

export interface KeywordStatsInput {
  article: ParsedArticle;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  titleOverride?: string;
  metaOverride?: string;
}

function usageFor(article: ParsedArticle, keyword: string, kind: KeywordUsage['kind'], title: string, meta: string): KeywordUsage {
  const occurrences = countKeywordOccurrences(normalized(article.text), keyword).count;
  const densityPct = article.wordCount > 0 ? (occurrences / article.wordCount) * 100 : 0;
  const inHeadings = article.headings.some((h) => containsKeyword(normalizePersian(h.text), keyword));
  const first = article.paragraphs[0] ?? '';
  const suggested: string[] = [];
  if (!containsKeyword(normalizePersian(title), keyword)) suggested.push('عنوان سئو (Title)');
  if (!containsKeyword(normalizePersian(meta), keyword)) suggested.push('توضیحات متا (Meta Description)');
  if (!containsKeyword(normalizePersian(first), keyword)) suggested.push('پاراگراف اول مقاله');
  if (!inHeadings && article.headings.length > 0) suggested.push('یکی از هدینگ‌ها (H2/H3)');
  return {
    keyword, kind, occurrences, densityPct,
    inTitle: containsKeyword(normalizePersian(title), keyword),
    inMeta: containsKeyword(normalizePersian(meta), keyword),
    inFirstParagraph: containsKeyword(normalizePersian(first), keyword),
    inHeadings,
    suggestedLocations: suggested,
  };
}

/**
 * Full keyword report for the primary + secondary keywords.
 * Density thresholds are calibrated for Persian (function-word-heavy language):
 * single-word sweet spot ≈ 0.5%–2.5%; > 3.5% is treated as stuffing.
 */
export function analyzeKeywords(input: KeywordStatsInput): KeywordReport {
  const { article, primaryKeyword } = input;
  const title = input.titleOverride ?? article.title;
  const meta = input.metaOverride ?? article.metaDescription;

  const normText = normalized(article.text);
  const { count: occurrences, firstIndex } = countKeywordOccurrences(normText, primaryKeyword);
  const densityPct = article.wordCount > 0 ? (occurrences / article.wordCount) * 100 : 0;

  // word-index of first occurrence (approximate by token position)
  let firstOccurrenceWordIndex: number | null = null;
  if (firstIndex >= 0) {
    const before = normText.slice(0, firstIndex);
    firstOccurrenceWordIndex = tokenize(before).length;
  }

  const headingsWithKw = article.headings.filter((h) => containsKeyword(normalizePersian(h.text), primaryKeyword));
  const paragraphs = article.paragraphs;
  const paragraphsWitKw = paragraphs.filter((p) => containsKeyword(normalized(p), primaryKeyword));
  const paragraphCoveragePct = paragraphs.length > 0 ? (paragraphsWitKw.length / paragraphs.length) * 100 : 0;

  const inTitle = containsKeyword(normalizePersian(title), primaryKeyword);
  const inMeta = containsKeyword(normalizePersian(meta), primaryKeyword);
  const inFirst100Words = firstOccurrenceWordIndex !== null && firstOccurrenceWordIndex <= 100;

  const stuffingReasons: string[] = [];
  if (densityPct > 3.5) stuffingReasons.push(`تراکم کلمه کلیدی ${densityPct.toFixed(1)}٪ است (بیشتر از حد ۳٫۵٪)`);
  if (paragraphCoveragePct > 75 && densityPct > 2) stuffingReasons.push('کلمه کلیدی در بیش از ۷۵٪ پاراگراف‌ها تکرار شده است');
  if (article.headings.length >= 3 && headingsWithKw.length / article.headings.length > 0.6) stuffingReasons.push('بیش از ۶۰٪ هدینگ‌ها شامل کلمه کلیدی اصلی هستند');

  const primary: KeywordReport['primary'] = {
    keyword: primaryKeyword,
    occurrences,
    densityPct: Number(densityPct.toFixed(2)),
    firstOccurrenceWordIndex,
    inTitle,
    inMeta,
    inFirst100Words,
    inHeadings: headingsWithKw.length,
    paragraphCoveragePct: Number(paragraphCoveragePct.toFixed(1)),
    stuffed: stuffingReasons.length > 0,
    stuffingReasons,
  };

  const secondary = (input.secondaryKeywords ?? []).map((k) => usageFor(article, k, 'secondary', title, meta));
  return {
    primary,
    secondary,
    suggestedPlacements: usageFor(article, primaryKeyword, 'primary', title, meta).suggestedLocations,
  };
}

/**
 * TF-IDF style suggestions: terms that appear in ≥2 competitor documents but are
 * missing from the article — i.e. semantic/topical gaps worth covering.
 */
export function suggestSemanticTerms(
  articleText: string,
  competitors: CompetitorDoc[],
  topN = 30,
): { term: string; docs: number; avgTf: number }[] {
  const compDocs = competitors
    .map((c) => c.text ?? '')
    .filter((t) => countWords(t) > 50);
  if (compDocs.length === 0) return [];
  const perDoc = compDocs.map((t) => {
    const terms = extractTerms(t, 'fa', 100);
    return new Map(terms.map((t2) => [t2.term, t2.count]));
  });
  const candidates = new Map<string, { docs: number; tfSum: number }>();
  for (const map of perDoc) {
    for (const [term, tf] of map) {
      const c = candidates.get(term) ?? { docs: 0, tfSum: 0 };
      c.docs += 1;
      c.tfSum += tf;
      candidates.set(term, c);
    }
  }
  const articleTerms = new Set(extractTerms(articleText, 'fa', 200).map((t) => t.term));
  const kwVariants = new Set(tokenize(normalizePersian(articleText)));
  const out: { term: string; docs: number; avgTf: number }[] = [];
  for (const [term, c] of candidates) {
    if (c.docs < 2) continue; // only terms common across competitors
    if (articleTerms.has(term)) continue;
    if (term.includes(' ') && term.split(' ').every((w) => kwVariants.has(w))) continue;
    out.push({ term, docs: c.docs, avgTf: Number((c.tfSum / c.docs).toFixed(1)) });
  }
  out.sort((a, b) => b.docs - a.docs || b.avgTf - a.avgTf);
  return out.slice(0, topN);
}

/** Headings/topics used by ≥2 competitors but missing from the article. */
export function findMissingTopics(articleHeadingsText: string[], competitors: CompetitorDoc[], topN = 12): string[] {
  const compHeadings: string[] = [];
  for (const c of competitors) {
    for (const h of c.headings ?? []) {
      const n = normalizePersian(h.text);
      if (n.length >= 4) compHeadings.push(n);
    }
  }
  const counts = new Map<string, number>();
  for (const h of compHeadings) counts.set(h, (counts.get(h) ?? 0) + 1);
  const own = new Set(articleHeadingsText.map((h) => normalizePersian(h)));
  const missing: string[] = [];
  for (const [h, c] of counts) {
    if (c < 2) continue;
    const words = new Set(tokenize(h));
    const covered = [...own].some((o) => {
      const ow = new Set(tokenize(o));
      const inter = [...words].filter((w) => ow.has(w)).length;
      return words.size > 0 && inter / words.size >= 0.6;
    });
    if (!covered) missing.push(h);
  }
  return missing.slice(0, topN);
}
