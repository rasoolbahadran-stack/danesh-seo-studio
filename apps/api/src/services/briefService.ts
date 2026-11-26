/**
 * Content Brief generator: rule-based skeleton from keyword + intent,
 * enriched with real competitor data (if provided) and AI outline/titles/FAQ
 * (when AI is configured). The brief is always editable before approval.
 *
 * The rule-based skeleton lives in @danesh/keyword-research (generateRuleBrief)
 * so the dashboard can generate the same briefs locally without a server.
 */
import { generateRuleBrief, type RuleBrief } from '@danesh/keyword-research';
import type { OpenAICompatibleProvider } from '@danesh/ai-engine';
import { generateOutline, generateFaq, suggestTitles } from '@danesh/ai-engine';
import type { FetchedPage } from './competitorService.js';

export interface ContentBrief extends RuleBrief {
  internalLinkSuggestions: string[];
  externalSources: string[];
}

export class BriefService {
  async generate(
    keyword: string,
    aiProvider: OpenAICompatibleProvider | null,
    competitors: FetchedPage[] = [],
    internalPages: { title: string; url: string }[] = [],
  ): Promise<ContentBrief> {
    const competitorH2s = competitors
      .flatMap((c) => c.headings.filter((h) => h.level === 2).map((h) => h.text))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .slice(0, 6);
    const medianWords = competitors.length
      ? Math.round(competitors.reduce((a, c) => a + c.wordCount, 0) / competitors.length)
      : 900;

    const brief = generateRuleBrief(keyword, competitorH2s, Boolean(aiProvider));
    let outline = brief.outline;
    let titles = brief.suggestedTitles;
    let faqs = brief.faqs;
    let targetWordCount = brief.targetWordCount;

    if (aiProvider) {
      try {
        const [aiOutline, aiTitles, aiFaq] = await Promise.all([
          generateOutline(aiProvider, keyword, '', medianWords),
          suggestTitles(aiProvider, keyword, brief.intent),
          generateFaq(aiProvider, keyword, 5),
        ]);
        if (aiOutline.length >= 3) {
          outline = aiOutline.map((o) => ({ h2: o.h2, h3: o.h3, points: o.points, wordTarget: o.wordTarget }));
          targetWordCount = Math.max(600, Math.round(outline.reduce((a, o) => a + o.wordTarget, 0) * 1.1) || medianWords);
        }
        if (aiTitles.length >= 3) titles = aiTitles;
        if (aiFaq.length >= 3) faqs = aiFaq;
      } catch {
        // fall back to rule-based outline; AI failure must not break briefs
      }
    }

    return {
      ...brief,
      outline,
      suggestedTitles: titles,
      faqs,
      targetWordCount,
      internalLinkSuggestions: internalPages.slice(0, 6).map((p) => `${p.title} (${p.url})`),
      externalSources: ['ویکی‌پدیای فارسی', 'نهادهای رسمی مرتبط با موضوع', 'مطالعات و آمار معتبر'],
      sources: [
        competitors.length ? `بر اساس ${competitors.length} صفحه رقیب واقعی` : 'بدون داده رقیب — ساختار قاعده‌محور',
        aiProvider ? 'Outline با AI تولید و قابل ویرایش است' : 'Outline قاعده‌محور (AI تنظیم نشده)',
      ],
    };
  }
}
