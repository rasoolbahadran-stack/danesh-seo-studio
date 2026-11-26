/**
 * Content quality / structure / search-intent / completeness analysis
 * (the four "editorial" criteria of the score).
 */
import type {
  CompletenessReport, Intent, IntentReport, ParsedArticle, QualityReport, StructureReport,
} from './types.js';
import { normalized, sentencesOf, tokenize, normalizePersian } from './persian.js';

const FILLERS_FA = ['در واقع', 'البته', 'باید بدانید', 'همانطور که می‌دانید', 'همان طور که می‌دانید', 'لازم به ذکر است', 'گفتنی است', 'بدون شک', 'مسلما'];

export function analyzeQuality(article: ParsedArticle): QualityReport & { score: number } {
  const sentences = sentencesOf(article.text);
  const words = tokenize(normalized(article.text));
  const unique = new Set(words.map((w) => w.split('\u200c').join(''))).size;
  const vocabRichness = words.length > 0 ? unique / words.length : 0;

  const lens = sentences.map((s) => tokenize(normalized(s)).length);
  const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const variance = lens.length > 1 ? lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length : 0;
  const sentenceVariety = Math.sqrt(variance); // stdev of sentence lengths

  const sentenceSet = new Map<string, number>();
  for (const s of sentences) {
    const n = normalized(s);
    if (tokenize(n).length < 5) continue;
    sentenceSet.set(n, (sentenceSet.get(n) ?? 0) + 1);
  }
  const repeatedSentences = [...sentenceSet.entries()].filter(([, c]) => c > 1).map(([s]) => s.slice(0, 60));

  const fillerCount = article.paragraphs.reduce((acc, p) => {
    const n = normalized(p);
    return acc + FILLERS_FA.filter((f) => n.includes(normalized(f))).length;
  }, 0);
  const fillerRatio = sentences.length > 0 ? fillerCount / sentences.length : 0;

  const paragraphWords = article.paragraphs.map((p) => tokenize(normalized(p)).length);
  const avgParagraphWords = paragraphWords.length ? paragraphWords.reduce((a, b) => a + b, 0) / paragraphWords.length : 0;

  let score = 100;
  if (words.length > 150) {
    if (vocabRichness < 0.3) score -= 25;
    else if (vocabRichness < 0.4) score -= 10;
    if (sentenceVariety < 4) score -= 15; // monotonous rhythm
    if (repeatedSentences.length > 0) score -= Math.min(20, repeatedSentences.length * 10);
    if (fillerRatio > 0.15) score -= 10;
    if (avgParagraphWords > 120) score -= 10;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    vocabRichness: Number(vocabRichness.toFixed(2)),
    sentenceVariety: Number(sentenceVariety.toFixed(1)),
    repeatedSentences,
    fillerRatio: Number(fillerRatio.toFixed(2)),
    avgParagraphWords: Number(avgParagraphWords.toFixed(0)),
    score,
  };
}

export function analyzeStructure(article: ParsedArticle): StructureReport & { score: number } {
  return structureFromHtml(article);
}

function structureFromHtml(article: ParsedArticle): StructureReport & { score: number } {
  // paragraphs + headings → sections (between H2s)
  const counts = sectionWordCounts(article);
  const maxSectionWords = counts.length ? Math.max(...counts) : 0;
  const avgSectionWords = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const sectionImbalanceRatio = counts.length > 1 && avgSectionWords > 0 ? maxSectionWords / avgSectionWords : null;

  const lists = article.lists ?? 0;
  const tables = article.tables ?? 0;
  const paragraphCount = article.paragraphs.length;

  let score = 100;
  if (article.wordCount > 400 && lists === 0 && tables === 0) {
    score -= 15; // long text without scannable blocks
  }
  if (sectionImbalanceRatio !== null && sectionImbalanceRatio > 4 && counts.length >= 3) {
    score -= 15;
  }
  if (article.wordCount > 200 && paragraphCount < 2) {
    score -= 20;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { lists, tables, maxSectionWords, avgSectionWords: Math.round(avgSectionWords), sectionImbalanceRatio: sectionImbalanceRatio === null ? null : Number(sectionImbalanceRatio.toFixed(1)), paragraphCount, score };
}

function sectionWordCounts(article: ParsedArticle): number[] {
  // Approximate: distribute paragraph words between H2 boundaries by order.
  const h2Indexes = article.headings.filter((h) => h.level <= 2).length;
  if (h2Indexes === 0) return [article.wordCount];
  const total = article.wordCount;
  const per = Math.max(1, Math.round(total / h2Indexes));
  return Array.from({ length: h2Indexes }, () => per);
}

const BUY_WORDS_FA = ['خرید', 'قیمت', 'تخفیف', 'سفارش', 'اشتراک', 'پلن', 'تومان', 'هزینه ثبت'];
const COMMERCIAL_WORDS_FA = ['بهترین', 'مقایسه', 'بررسی', 'برتر', 'ریویو', 'ویژگی‌ها', 'معایب', 'مزایا'];
const INFO_WORDS_FA = ['چیست', 'چگونه', 'چرا', 'آموزش', 'راهنما', 'معنی', 'مراحل', 'نحوه'];

export function analyzeIntent(article: ParsedArticle, declared: Intent | null): IntentReport & { score: number } {
  const text = normalized(article.text);
  const title = normalized(article.title);
  const headingsText = article.headings.map((h) => normalizePersian(h.text)).join(' ');

  const has = (list: string[], source: string) => list.some((w) => source.includes(normalized(w)));
  const signals: string[] = [];
  if (has(INFO_WORDS_FA, headingsText)) signals.push('هدینگ‌های آموزشی/پرسشی (informational)');
  if (has(COMMERCIAL_WORDS_FA, title) || has(COMMERCIAL_WORDS_FA, headingsText)) signals.push('نشانه‌های مقایسه/بررسی (commercial)');
  if (has(BUY_WORDS_FA, text) || has(BUY_WORDS_FA, title)) signals.push('نشانه‌های تراکنشی: قیمت/خرید');
  if (article.tables > 0) signals.push('جدول مقایسه');

  let detected: Intent = 'informational';
  if (has(BUY_WORDS_FA, text) || has(BUY_WORDS_FA, title)) detected = 'transactional';
  else if (has(COMMERCIAL_WORDS_FA, title) || article.tables > 0) detected = 'commercial';
  else if (has(INFO_WORDS_FA, headingsText)) detected = 'informational';

  let aligned: boolean | null = null;
  if (declared) aligned = detected === declared;

  let score = 100;
  if (declared) {
    if (!aligned) score -= 35;
    if (declared === 'commercial' && article.tables === 0) score -= 10;
    if (declared === 'informational' && !has(INFO_WORDS_FA, headingsText)) score -= 10;
  } else {
    score = has(INFO_WORDS_FA, headingsText) || signals.length > 0 ? 85 : 70;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { declared, detected, signals, aligned, score };
}

const CONCLUSION_RE = /(نتیجه|جمع‌بندی|جمع بندی|خلاصه|سخن پایانی|کلام آخر|conclusion)/i;
const FAQ_RE = /(سوال|سؤال|پرسش|faq|پرسش‌های متداول|سوالات متداول)/i;
const SOURCES_RE = /(منابع|منبع|reference|sources|آثار|کتاب‌شناسی)/i;

export function analyzeCompleteness(
  article: ParsedArticle,
  targetWordCount: number,
): CompletenessReport & { score: number } {
  const coveragePct = targetWordCount > 0 ? (article.wordCount / targetWordCount) * 100 : 100;

  const introWords = article.paragraphs.length
    ? tokenize(normalized(article.paragraphs[0])).length
    : 0;
  const hasIntro = introWords >= 25 || (article.paragraphs.length > 0 && article.headings.length > 0);

  const lastHeadings = article.headings.slice(-3).map((h) => h.text).join(' ');
  const hasConclusion = CONCLUSION_RE.test(normalizePersian(lastHeadings)) || CONCLUSION_RE.test(normalized(article.paragraphs.slice(-1)[0] ?? ''));
  const hasFaq = FAQ_RE.test(normalizePersian(article.headings.map((h) => h.text).join(' ')));
  const hasSources = SOURCES_RE.test(normalized(article.text.slice(-1500)));

  let score = 100;
  if (coveragePct < 50) score -= 35;
  else if (coveragePct < 75) score -= 20;
  else if (coveragePct < 90) score -= 8;
  if (!hasIntro) score -= 15;
  if (!hasConclusion) score -= 15;
  if (!hasFaq && targetWordCount >= 800) score -= 8;
  if (!hasSources && targetWordCount >= 800) score -= 5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    wordCount: article.wordCount,
    targetWordCount,
    coveragePct: Number(coveragePct.toFixed(0)),
    hasIntro,
    hasConclusion,
    hasFaq,
    hasSources,
    score,
  };
}
