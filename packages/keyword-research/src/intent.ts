/** Rule-based Search-Intent classification for Persian and English keywords. */
import { normalizePersian } from '@danesh/seo-engine';
import type { IntentLabel, KeywordIdea } from './types.js';

const TRANSACTIONAL_FA = ['خرید', 'قیمت', 'تخفیف', 'سفارش', 'اشتراک', 'پلن', 'تمبر', 'اجاره', 'درمان هزینه'];
const TRANSACTIONAL_EN = ['buy', 'price', 'cheap', 'discount', 'order', 'subscribe'];
const COMMERCIAL_FA = ['بهترین', 'مقایسه', 'بررسی', 'برتر', 'ریویو', 'ویژگی', 'معایب', 'مزایا', 'کدام', 'کدوم'];
const COMMERCIAL_EN = ['best', 'vs', 'review', 'comparison', 'top'];
const INFORMATIONAL_FA = ['چیست', 'چه است', 'چگونه', 'چطور', 'چرا', 'آموزش', 'راهنما', 'معنی', 'نحوه', 'مراحل', 'تفاوت'];
const INFORMATIONAL_EN = ['what is', 'how to', 'why', 'meaning', 'guide', 'tutorial'];

export function classifyIntent(keyword: string): IntentLabel {
  const n = normalizePersian(keyword);
  if (!n) return 'unknown';
  const has = (list: string[]) => list.some((w) => n.includes(normalizePersian(w)));
  if (has(TRANSACTIONAL_FA) || has(TRANSACTIONAL_EN)) return 'transactional';
  if (has(COMMERCIAL_FA) || has(COMMERCIAL_EN)) return 'commercial';
  if (has(INFORMATIONAL_FA) || has(INFORMATIONAL_EN)) return 'informational';
  return 'unknown';
}

const QUESTION_TEMPLATES_FA = [
  '{k} چیست؟', 'چگونه {k}', 'چرا {k} مهم است؟', 'کدام {k} بهتر است؟',
  'بهترین {k} کدام است؟', 'چه زمانی {k} لازم است؟', 'آیا {k} ارزش دارد؟',
  'هزینه {k} چقدر است؟', 'تفاوت {k} با جایگزین‌ها چیست؟', '{k} برای مبتدیان چگونه شروع شود؟',
];

const QUESTION_TEMPLATES_EN = [
  'what is {k}', 'how to {k}', 'why is {k} important', 'which {k} is best', 'is {k} worth it',
];

export function generateQuestions(seed: string, lang: 'fa' | 'en' = 'fa'): KeywordIdea[] {
  const k = seed.trim();
  if (!k) return [];
  const templates = lang === 'fa' ? QUESTION_TEMPLATES_FA : QUESTION_TEMPLATES_EN;
  return templates.map((t) => t.replace('{k}', k)).map((q) => ({
    keyword: q,
    source: 'question' as const,
    intent: 'informational' as IntentLabel,
    estimatedDifficulty: { score: 35, level: 'آسان', estimated: true as const },
    words: q.trim().split(/\s+/).length,
  }));
}
