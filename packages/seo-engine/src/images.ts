/**
 * Image SEO analysis: alt coverage, generic filenames, lazy loading,
 * modern formats, dimensions.
 */
import type { ImagesReport, ParsedArticle } from './types.js';

const GENERIC_FILE_RE = /^(img_|dsc|image[0-9]*|photo|untitled|screen\s?shot|screenshot|tmp|untitled-[0-9]+)/i;
const MODERN_FORMATS = new Set(['webp', 'avif', 'svg']);

export function analyzeImages(article: ParsedArticle): ImagesReport & { score: number } {
  const imgs = article.images;
  const count = imgs.length;
  const missingAlt = imgs.filter((i) => !i.alt).length;
  const altCoveragePct = count > 0 ? ((count - missingAlt) / count) * 100 : 0;
  const genericFilenames = imgs.filter((i) => GENERIC_FILE_RE.test(i.filename)).map((i) => i.filename);
  const notLazy = imgs.filter((i) => !i.lazy).length;
  const modernFormatCount = imgs.filter((i) => MODERN_FORMATS.has(i.ext)).length;

  const suggestions: string[] = [];
  if (count === 0) suggestions.push('حداقل یک تصویر مرتبط (ترجیحاً تصویر شاخص) به مقاله اضافه کنید');
  if (missingAlt > 0) suggestions.push('برای همه تصاویر Alt Text توصیفی بنویسید');
  if (genericFilenames.length > 0) suggestions.push('نام فایل تصاویر را توصیفی کنید (مثلاً quhve-tork-webp.jpg)');
  if (notLazy > 1) suggestions.push('برای تصاویر خارج از نمای اول، loading="lazy" قرار دهید');
  if (count > 0 && modernFormatCount < count) suggestions.push('فرمت تصاویر را به WebP یا AVIF تبدیل کنید تا حجم کمتر شود');

  let score = 100;
  if (count === 0) {
    score -= 40;
  } else {
    if (altCoveragePct < 100) score -= altCoveragePct < 50 ? 30 : Math.min(25, (100 - altCoveragePct) * 0.5);
    if (genericFilenames.length > 0) score -= Math.min(15, genericFilenames.length * 5);
    if (notLazy > 1) score -= Math.min(10, (notLazy - 1) * 3);
    if (imgs.some((i) => !i.hasDimensions)) score -= 5;
    if (modernFormatCount === 0) score -= 10;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    count,
    missingAlt,
    altCoveragePct: Number(altCoveragePct.toFixed(0)),
    genericFilenames,
    notLazy,
    modernFormatCount,
    suggestions,
    score,
  };
}
