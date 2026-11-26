/**
 * Rule-based Content Brief generator (Persian).
 * Pure and dependency-free of network — used by the API service (with AI
 * enrichment) AND directly by the dashboard in local (no-server) mode.
 */
import { classifyIntent, expandLongTails, generateQuestions } from './index.js';

export interface BriefOutlineItem {
  h2: string;
  h3?: string[];
  points: string[];
  wordTarget: number;
}

export interface RuleBrief {
  keyword: string;
  intent: ReturnType<typeof classifyIntent>;
  suggestedTitles: string[];
  h1: string;
  outline: BriefOutlineItem[];
  faqs: { question: string; answer: string }[];
  relatedKeywords: string[];
  targetWordCount: number;
  contentType: string;
  sources: string[];
}

const INTENT_TYPE_FA: Record<string, string> = {
  informational: 'مقاله آموزشی راهنما',
  commercial: 'مقاله مقایسه/بررسی با جدول',
  transactional: 'صفحه محصول/خدمات با CTA',
  navigational: 'صفحه برند/دسته‌بندی',
  unknown: 'مقاله آموزشی راهنما',
};

export function generateRuleBrief(keyword: string, competitorH2s: string[] = [], hasAi = false): RuleBrief {
  const intent = classifyIntent(keyword);
  const base: BriefOutlineItem[] = [
    { h2: `${keyword} چیست؟`, points: ['تعریف کوتاه و دقیق', 'اهمیت موضوع برای مخاطب'], wordTarget: 120 },
    { h2: 'چرا اهمیت دارد؟', points: ['دلایل و مزایا', 'آمار یا نمونه واقعی'], wordTarget: 150 },
  ];
  if (intent === 'transactional' || intent === 'commercial') {
    base.push({ h2: 'مقایسه گزینه‌ها', points: ['جدول مقایسه ویژگی‌ها', 'مزایا و معایب هر گزینه'], wordTarget: 200 });
    base.push({ h2: 'قیمت و خرید', points: ['بازه قیمت‌ها', 'معیارهای انتخاب'], wordTarget: 150 });
  } else {
    base.push({ h2: `راهنمای گام‌به‌گام ${keyword}`, points: ['مراحل با جزئیات', 'نکات اجرایی و خطاهای رایج'], wordTarget: 250 });
  }
  for (const h of competitorH2s.slice(0, 4)) {
    base.push({ h2: h, points: ['پوشش کامل موضوع این بخش'], wordTarget: 150 });
  }
  base.push({ h2: 'سوالات متداول', points: ['۴ تا ۶ پرسش پرتکرار'], wordTarget: 120 });
  base.push({ h2: 'نتیجه‌گیری', points: ['جمع‌بندی و اقدام بعدی'], wordTarget: 100 });

  const titles = [
    `${keyword} چیست؟ راهنمای کامل`,
    `${keyword}: آموزش گام‌به‌گام`,
    `بهترین ${keyword} + بررسی تخصصی`,
  ];
  const faqs = generateQuestions(keyword).slice(0, 4).map((q) => ({
    question: q.keyword,
    answer: 'پس از بررسی SERP و منابع معتبر تکمیل کنید.',
  }));

  const outlineWords = base.reduce((a, o) => a + o.wordTarget, 0);
  const targetWordCount = Math.max(600, Math.round(outlineWords * 1.1));

  return {
    keyword,
    intent,
    suggestedTitles: titles,
    h1: `${keyword}: راهنمای کامل و کاربردی`,
    outline: base,
    faqs,
    relatedKeywords: expandLongTails(keyword).slice(0, 10).map((i) => i.keyword),
    targetWordCount,
    contentType: INTENT_TYPE_FA[intent] ?? 'مقاله آموزشی راهنما',
    sources: [
      competitorH2s.length ? `بر اساس ${competitorH2s.length} هدینگ از رقبا` : 'بدون داده رقیب — ساختار قاعده‌محور',
      hasAi ? 'Outline با AI تولید و قابل ویرایش است' : 'Outline قاعده‌محور (AI تنظیم نشده)',
    ],
  };
}
