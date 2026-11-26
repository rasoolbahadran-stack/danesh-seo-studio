/**
 * E-E-A-T indicator analysis.
 * IMPORTANT: this is an indicator-based self-assessment for editors — NOT a
 * Google score. Google has never published an E-E-A-T metric; we surface
 * observable signals a reviewer can act on.
 */
import { normalizePersian, parseArticle, tokenize, countWords } from '@danesh/seo-engine';

export interface EEATIndicator {
  key: string;
  label: string;
  present: boolean;
  evidence: string | null;
  /** How the editor can strengthen this signal */
  advice: string;
}

export interface EEATReport {
  /** 0–100 transparent share of positive indicators (not a Google score) */
  eeatIndex: number;
  indicators: EEATIndicator[];
  note: string;
}

const CREDIBLE_DOMAINS = [/\.gov(\.|$)/i, /\.edu(\.|$)/i, /wikipedia\.org/i, /who\.int/i, /nih\.gov/i, /\.org$/i];

export function analyzeEEAT(html: string, opts: { wordCountTarget?: number } = {}): EEATReport {
  const doc = parseArticle(html, { lang: 'fa' });
  const text = normalizePersian(doc.text);
  const externalHrefs = doc.links.filter((l) => l.internal === false).map((l) => l.href);

  const indicators: EEATIndicator[] = [];

  const authorRe = /(نویسنده|نوشته از|توسط\s+\S{3,}|about the author|نوشته شده توسط)/;
  const authorMatch = text.match(authorRe);
  indicators.push({
    key: 'author',
    label: 'نشان‌دادن نویسنده',
    present: Boolean(authorMatch),
    evidence: authorMatch ? authorMatch[0] : null,
    advice: 'نام نویسنده و صفحه بیوگرافی را در انتهای مقاله ذکر کنید',
  });

  const expRe = /(تجربه|آزمایش کردیم|بررسی کردیم|تست کردیم|امتحان کردیم|پروژه‌ای که)/;
  const expMatch = text.match(expRe);
  indicators.push({
    key: 'experience',
    label: 'نشانه تجربه مستقیم',
    present: Boolean(expMatch),
    evidence: expMatch ? expMatch[0] : null,
    advice: 'تجربه عملی، نتایج پروژه‌ها یا اسکرین‌شات واقعی اضافه کنید',
  });

  const credible = externalHrefs.filter((h) => CREDIBLE_DOMAINS.some((re) => re.test(h)));
  indicators.push({
    key: 'credible-sources',
    label: 'ارجاع به منابع معتبر',
    present: credible.length > 0 || /(منابع|منبع)$/m.test(text.trim()),
    evidence: credible.length > 0 ? credible.slice(0, 3).join('، ') : null,
    advice: 'به حداقل یک منبع معتبر (دانشگاه، نهاد رسمی، ویکی‌پدیا) لینک دهید',
  });

  const statRe = /(\d+٪|\d+\s*درصد|\b\d{2,}\b)/;
  const statMatch = text.match(statRe);
  indicators.push({
    key: 'statistics',
    label: 'داده و آمار',
    present: Boolean(statMatch),
    evidence: statMatch ? statMatch[0] : null,
    advice: 'آمار و داده‌های مشخص (با ذکر منبع) به اعتبار محتوا اضافه می‌کند',
  });

  const freshRe = /(به\u200cروزرسانی|بروزرسانی|به روز رسانی|آخرین به\u200cروزرسانی|۲۰۲۶|2026|۲۰۲۵|2025)/;
  const freshMatch = text.match(freshRe);
  indicators.push({
    key: 'freshness',
    label: 'تازگی محتوا',
    present: Boolean(freshMatch),
    evidence: freshMatch ? freshMatch[0] : null,
    advice: 'تاریخ آخرین به‌روزرسانی را نمایش دهید و محتوای قدیمی را بازبینی کنید',
  });

  const depthTarget = opts.wordCountTarget ?? 900;
  const depth = countWords(doc.text);
  indicators.push({
    key: 'depth',
    label: 'عمق محتوا',
    present: depth >= depthTarget * 0.8,
    evidence: `${depth} کلمه (هدف: ${depthTarget})`,
    advice: 'موضوع را با زیرموضوعات کامل‌تر پوشش دهید',
  });

  const contactRe = /(درباره ما|تماس با ما|about us|contact)/;
  indicators.push({
    key: 'transparency',
    label: 'شفافیت (درباره ما / تماس)',
    present: contactRe.test(text),
    evidence: contactRe.test(text) ? 'متن حاوی اشاره به درباره ما/تماس است' : null,
    advice: 'لینک صفحه درباره ما و راه‌های تماس را در سایت داشته باشید',
  });

  const positive = indicators.filter((i) => i.present).length;
  const eeatIndex = Math.round((positive / indicators.length) * 100);

  return {
    eeatIndex,
    indicators,
    note: 'این شاخص‌ها ارزیابی خودی برای نویسنده هستند، نه امتیاز رسمی گوگل؛ گوگل E-E-A-T را به‌صورت عددی منتشر نمی‌کند.',
  };
}
