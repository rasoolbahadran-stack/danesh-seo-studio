/**
 * SEO Title & Meta Description analysis + Google SERP preview + suggestions.
 */
import type { MetaReport, ParsedArticle } from './types.js';
import { containsKeyword, countKeywordOccurrences, normalizePersian, POWER_WORDS_FA } from './persian.js';

export const TITLE_MIN = 30;
export const TITLE_MAX = 60;
export const META_MIN = 120;
export const META_MAX = 160;

export interface MetaAnalysisInput {
  article: ParsedArticle;
  primaryKeyword: string;
  title?: string;
  metaDescription?: string;
  slug?: string;
}

export function analyzeMeta(input: MetaAnalysisInput): MetaReport & { score: number } {
  const { article, primaryKeyword, slug } = input;
  const title = (input.title ?? article.title ?? '').trim();
  const meta = (input.metaDescription ?? article.metaDescription ?? '').trim();
  const kwNorm = normalizePersian(primaryKeyword);

  const titleLength = title.length;
  const kwInTitle = containsKeyword(normalizePersian(title), primaryKeyword);
  let kwInFirstHalf = false;
  if (kwInTitle) {
    const idx = countKeywordOccurrences(normalizePersian(title), primaryKeyword).firstIndex;
    kwInFirstHalf = idx !== -1 ? idx < title.length / 2 : false;
  }

  const metaLength = meta.length;
  const kwInMeta = containsKeyword(normalizePersian(meta), primaryKeyword);

  const signals: string[] = [];
  const titleNorm = normalizePersian(title);
  if (/\d/.test(titleNorm) || /[۰-۹]/.test(titleNorm)) signals.push('عدد در عنوان');
  for (const p of POWER_WORDS_FA) {
    if (titleNorm.includes(normalizePersian(p))) {
      signals.push(`کلمه قدرتمند: «${p}»`);
      break;
    }
  }
  if (titleNorm.includes('؟') || titleNorm.includes('چگونه') || titleNorm.includes('چیست')) signals.push('عنوان پرسشی/آموزشی');

  const displayUrl = slug
    ? `example.com/${slug.replace(/^\//, '')}`
    : 'example.com/your-article';

  const suggestedTitles = buildSuggestedTitles(primaryKeyword);
  const suggestedMetaDescription = meta.length === 0 ? buildSuggestedMeta(article, primaryKeyword) : null;

  let score = 100;
  const reasons: string[] = [];
  if (!title) {
    score = 0;
    reasons.push('عنوان سئو وجود ندارد');
  } else {
    if (titleLength < 15) { score -= 30; reasons.push(`عنوان خیلی کوتاه است (${titleLength} کاراکتر)`); }
    else if (titleLength < TITLE_MIN) { score -= 12; reasons.push(`عنوان کوتاه‌تر از حد بهینه است (${titleLength}/${TITLE_MIN}–${TITLE_MAX} کاراکتر)`); }
    else if (titleLength > 70) { score -= 20; reasons.push(`عنوان خیلی بلند است (${titleLength} کاراکتر) و در نتایج جست‌وجو بریده می‌شود`); }
    else if (titleLength > TITLE_MAX) { score -= 8; reasons.push(`عنوان کمی بلند است (${titleLength} کاراکتر)`); }
    if (!kwInTitle) { score -= 25; reasons.push('کلمه کلیدی اصلی در عنوان نیست'); }
    else if (!kwInFirstHalf) { score -= 5; reasons.push('کلمه کلیدی در نیمه دوم عنوان است'); }
    if (signals.length === 0) { score -= 5; reasons.push('عنوان سیگنال جذابیت (عدد/کلمه قدرتمند) ندارد'); }
  }
  if (!meta) {
    score -= 25;
    reasons.push('توضیحات متا وجود ندارد');
  } else {
    if (metaLength < 70) { score -= 10; reasons.push(`توضیحات متا خیلی کوتاه است (${metaLength} کاراکتر)`); }
    else if (metaLength > 165) { score -= 10; reasons.push(`توضیحات متا خیلی بلند است (${metaLength} کاراکتر)`); }
    if (!kwInMeta) { score -= 8; reasons.push('کلمه کلیدی در توضیحات متا نیست'); }
  }
  score = Math.max(0, Math.min(100, score));

  return {
    title,
    titleLengthChars: titleLength,
    keywordInTitle: kwInTitle,
    keywordInFirstHalf: kwInFirstHalf,
    metaDescription: meta,
    metaLengthChars: metaLength,
    keywordInMeta: kwInMeta,
    attractivenessSignals: signals,
    googlePreview: {
      title: title || 'بدون عنوان سئو',
      url: displayUrl,
      description: meta || 'توضیحات متا تنظیم نشده است؛ گوگل ممکن است متنی دلخواه از صفحه نمایش دهد.',
    },
    suggestedTitles,
    suggestedMetaDescription,
    score,
  };
}

export function buildSuggestedTitles(keyword: string): string[] {
  const k = keyword.trim();
  return [
    `${k} چیست؟ راهنمای کامل و جامع`,
    `${k}: آموزش گام‌به‌گام از صفر`,
    `بهترین ${k} + بررسی تخصصی و مقایسه`,
    `${k} در ۱۰ دقیقه | راهنمای سریع`,
    `۷ نکته کلیدی درباره ${k} که باید بدانید`,
  ];
}

export function buildSuggestedMeta(article: ParsedArticle, keyword: string): string | null {
  const first = article.paragraphs.find((p) => p.length > 60);
  if (!first) return null;
  let text = first.replace(/\s+/g, ' ').trim();
  if (text.length > 155) text = text.slice(0, 152).trimEnd() + '…';
  if (!containsKeyword(normalizePersian(text), keyword) && text.length < 120) {
    text = `${text} هر آنچه باید درباره ${keyword} بدانید.`;
  }
  return text.slice(0, 160);
}
