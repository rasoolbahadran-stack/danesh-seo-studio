/**
 * Rule-based keyword expansion for Persian (and English): modifier templates
 * produce long-tail ideas. Deterministic and transparent — clearly separated
 * from real SERP/volume data which requires an external paid provider.
 */
import { normalizePersian } from '@danesh/seo-engine';
import { classifyIntent } from './intent.js';
import type { IntentLabel, KeywordIdea } from './types.js';

const MODIFIER_PREFIXES_FA = [
  'بهترین', 'آموزش', 'قیمت', 'خرید', 'راهنمای', 'چگونه', 'نحوه', 'بررسی', 'مقایسه',
  'دانلود', 'رایگان', 'حرفه‌ای', 'اشتباهات رایج', 'نکات مهم', 'معرفی', 'مراحل',
];
const MODIFIER_SUFFIXES_FA = ['برای مبتدیان', 'در خانه', 'با تصویر', 'به زبان ساده', 'گام به گام', 'در ۱۰ دقیقه', '۲۰۲۶', 'بدون هزینه'];

const MODIFIER_PREFIXES_EN = ['best', 'how to', 'top', 'free', 'guide to', 'cheap'];
const MODIFIER_SUFFIXES_EN = ['for beginners', '2026', 'step by step', 'near me'];

/** Heuristic difficulty estimate from keyword shape only (flagged as estimate). */
export function estimateDifficulty(keyword: string): { score: number; level: string; estimated: true } {
  const words = normalizePersian(keyword).trim().split(/\s+/).filter(Boolean).length;
  let score = 65;
  if (words >= 4) score -= 20;
  else if (words === 3) score -= 12;
  else if (words === 1) score += 15;
  if (/(خرید|قیمت|بهترین)/.test(normalizePersian(keyword))) score += 10; // commercial terms are competitive
  score = Math.max(1, Math.min(100, score));
  const level = score >= 70 ? 'سخت' : score >= 45 ? 'متوسط' : 'آسان';
  return { score, level, estimated: true };
}

function idea(keyword: string, source: KeywordIdea['source']): KeywordIdea {
  return {
    keyword,
    source,
    intent: classifyIntent(keyword),
    estimatedDifficulty: estimateDifficulty(keyword),
    words: keyword.trim().split(/\s+/).length,
  };
}

export function expandLongTails(seed: string, lang: 'fa' | 'en' = 'fa'): KeywordIdea[] {
  const k = seed.trim();
  if (!k) return [];
  const prefixes = lang === 'fa' ? MODIFIER_PREFIXES_FA : MODIFIER_PREFIXES_EN;
  const suffixes = lang === 'fa' ? MODIFIER_SUFFIXES_FA : MODIFIER_SUFFIXES_EN;
  const out: KeywordIdea[] = [];
  for (const p of prefixes) out.push(idea(`${p} ${k}`, 'modifier'));
  for (const s of suffixes) out.push(idea(`${k} ${s}`, 'modifier'));
  return out;
}

export function intentLabelOf(keyword: string): IntentLabel {
  return classifyIntent(keyword);
}
