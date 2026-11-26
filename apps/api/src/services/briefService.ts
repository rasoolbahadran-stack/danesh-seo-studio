/**
 * Content Brief generator: rule-based skeleton from keyword + intent,
 * enriched with real competitor data (if provided) and AI outline/titles/FAQ
 * (when AI is configured). The brief is always editable before approval.
 */
import { classifyIntent, generateQuestions, expandLongTails } from '@danesh/keyword-research';
import type { OpenAICompatibleProvider } from '@danesh/ai-engine';
import { generateOutline, generateFaq, suggestTitles } from '@danesh/ai-engine';
import type { FetchedPage } from './competitorService.js';

export interface BriefOutlineItem { h2: string; h3?: string[]; points: string[]; wordTarget: number }

export interface ContentBrief {
  keyword: string;
  intent: ReturnType<typeof classifyIntent>;
  suggestedTitles: string[];
  h1: string;
  outline: BriefOutlineItem[];
  faqs: { question: string; answer: string }[];
  relatedKeywords: string[];
  internalLinkSuggestions: string[];
  externalSources: string[];
  targetWordCount: number;
  contentType: string;
  sources: string[];
}

const INTENT_TYPE_FA: Record<string, string> = {
  informational: 'مقاله آموزشی راهنما',
  commercial: 'مقاله مقایسه/بررسی با جدول',
  transactional: 'صفحه محصول/خدمات با CTA',
  navigational: 'صفحه برند/دسته‌بندی',
};

function ruleOutline(keyword: string, intent: string, competitorH2s: string[]): BriefOutlineItem[] {
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
  // Real competitor headings (when available) inform the outline
  for (const h of competitorH2s.slice(0, 4)) {
    base.push({ h2: h, points: ['پوشش کامل موضوع این بخش'], wordTarget: 150 });
  }
  base.push({ h2: 'سوالات متداول', points: ['۴ تا ۶ پرسش پرتکرار'], wordTarget: 120 });
  base.push({ h2: 'نتیجه‌گیری', points: ['جمع‌بندی و اقدام بعدی'], wordTarget: 100 });
  return base;
}

export class BriefService {
  async generate(
    keyword: string,
    aiProvider: OpenAICompatibleProvider | null,
    competitors: FetchedPage[] = [],
    internalPages: { title: string; url: string }[] = [],
  ): Promise<ContentBrief> {
    const intent = classifyIntent(keyword);
    const competitorH2s = competitors
      .flatMap((c) => c.headings.filter((h) => h.level === 2).map((h) => h.text))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 6);
    const medianWords = competitors.length
      ? Math.round(competitors.reduce((a, c) => a + c.wordCount, 0) / competitors.length)
      : 900;

    let outline = ruleOutline(keyword, intent, competitorH2s);
    let titles = [
      `${keyword} چیست؟ راهنمای کامل`,
      `${keyword}: آموزش گام‌به‌گام`,
      `بهترین ${keyword} + بررسی تخصصی`,
    ];
    let faqs = generateQuestions(keyword).slice(0, 4).map((q) => ({ question: q.keyword, answer: 'پس از بررسی SERP و منابع معتبر تکمیل کنید.' }));

    if (aiProvider) {
      try {
        const [aiOutline, aiTitles, aiFaq] = await Promise.all([
          generateOutline(aiProvider, keyword, '', medianWords),
          suggestTitles(aiProvider, keyword, intent),
          generateFaq(aiProvider, keyword, 5),
        ]);
        if (aiOutline.length >= 3) outline = aiOutline.map((o) => ({ h2: o.h2, h3: o.h3, points: o.points, wordTarget: o.wordTarget }));
        if (aiTitles.length >= 3) titles = aiTitles;
        if (aiFaq.length >= 3) faqs = aiFaq;
      } catch {
        // fall back to rule-based outline; AI failure must not break briefs
      }
    }

    const targetWordCount = Math.max(600, Math.round(outline.reduce((a, o) => a + o.wordTarget, 0) * 1.1) || medianWords);

    return {
      keyword,
      intent,
      suggestedTitles: titles,
      h1: `${keyword}: راهنمای کامل و کاربردی`,
      outline,
      faqs,
      relatedKeywords: expandLongTails(keyword).slice(0, 10).map((i) => i.keyword),
      internalLinkSuggestions: internalPages.slice(0, 6).map((p) => `${p.title} (${p.url})`),
      externalSources: ['ویکی‌پدیای فارسی', 'نهادهای رسمی مرتبط با موضوع', 'مطالعات و آمار معتبر'],
      targetWordCount,
      contentType: INTENT_TYPE_FA[intent] ?? 'مقاله آموزشی',
      sources: [
        competitors.length ? `بر اساس ${competitors.length} صفحه رقیب واقعی` : 'بدون داده رقیب — ساختار قاعده‌محور',
        aiProvider ? 'Outline با AI تولید و قابل ویرایش است' : 'Outline قاعده‌محور (AI تنظیم نشده)',
      ],
    };
  }
}
