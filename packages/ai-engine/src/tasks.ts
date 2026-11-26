/**
 * High-level content tasks (Persian prompts) built on top of the chat provider.
 * Every task receives a provider explicitly — callers get AiNotConfiguredError
 * when none is configured, and the AI output is always marked as AI-generated
 * by the calling app for review.
 */
import type { ChatProvider, ChatMessage } from './provider.js';
import { extractJson } from './provider.js';

function messages(system: string, user: string): ChatMessage[] {
  return [
    { role: 'system', content: 'تو یک متخصص سئو و تولید محتوای فارسی هستی. پاسخ‌ها را به فارسی روان، دقیق و بدون ادعای نادرست تولید کن.' },
    { role: 'user', content: user },
  ];
}

const TASK_SYSTEM = 'تو دستیار تولید محتوای سئوی فارسی هستی.';

export async function suggestTitles(ai: ChatProvider, keyword: string, intent = 'informational'): Promise<string[]> {
  const out = await ai.chat(messages(TASK_SYSTEM, `برای کلمه کلیدی «${keyword}» با نیت جست‌وجوی ${intent}، ۶ عنوان سئوی جذاب بین ۳۰ تا ۶۰ کاراکتر پیشنهاد بده. خروجی را فقط به‌صورت JSON با شکل {"titles": ["...", "..."]} بده.`), { json: true });
  return extractJson<{ titles: string[] }>(out).titles;
}

export async function generateMetaDescription(ai: ChatProvider, keyword: string, summary: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `برای مقاله‌ای با کلمه کلیدی «${keyword}» و خلاصه زیر، یک توضیحات متا ۱۲۰ تا ۱۶۰ کاراکتری جذاب بنویس. فقط JSON با شکل {"description": "..."} خروجی بده.\nخلاصه:\n${summary}`), { json: true });
  return extractJson<{ description: string }>(out).description;
}

export async function generateIntro(ai: ChatProvider, keyword: string, title: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `برای مقاله با عنوان «${title}» و کلمه کلیدی «${keyword}» یک مقدمه ۳ تا ۵ جمله‌ای بنویس که خواننده را درگیر کند و کلمه کلیدی را طبیعی بیاورد. فقط JSON با شکل {"intro": "..."} بده.`), { json: true });
  return extractJson<{ intro: string }>(out).intro;
}

export async function generateConclusion(ai: ChatProvider, keyword: string, outline: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `برای مقاله‌ای با کلمه کلیدی «${keyword}» و ساختار زیر، یک نتیجه‌گیری ۳ تا ۵ جمله‌ای بنویس.\nساختار:\n${outline}\nفقط JSON با شکل {"conclusion": "..."} بده.`), { json: true });
  return extractJson<{ conclusion: string }>(out).conclusion;
}

export async function generateFaq(ai: ChatProvider, keyword: string, count = 5): Promise<{ question: string; answer: string }[]> {
  const out = await ai.chat(messages(TASK_SYSTEM, `${count} پرسش متداول کاربران درباره «${keyword}» را با پاسخ کوتاه (حداکثر ۴۰ کلمه هر پاسخ) بنویس. فقط JSON با شکل {"faq": [{"question": "...", "answer": "..."}]} بده.`), { json: true });
  return extractJson<{ faq: { question: string; answer: string }[] }>(out).faq;
}

export interface OutlineItem { h2: string; h3: string[]; points: string[]; wordTarget: number }

export async function generateOutline(ai: ChatProvider, keyword: string, audience = '', targetWords = 1000): Promise<OutlineItem[]> {
  const out = await ai.chat(messages(TASK_SYSTEM, `برای مقاله‌ای با کلمه کلیدی «${keyword}» (مخاطب: ${audience || 'عمومی'}، حجم هدف: ${targetWords} کلمه) یک نقشه محتوایی با ۴ تا ۷ سرفصل H2 و زیرمجموعه H3 بنویس. فقط JSON با شکل {"outline": [{"h2": "...", "h3": ["..."], "points": ["..."], "wordTarget": 200}]} بده.`), { json: true });
  return extractJson<{ outline: OutlineItem[] }>(out).outline;
}

export async function generateArticleSection(ai: ChatProvider, h2: string, keyword: string, wordTarget = 200): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `بخش H2 با عنوان «${h2}» از مقاله‌ای درباره «${keyword}» را در حدود ${wordTarget} کلمه بنویس. از HTML فقط پاراگراف <p> استفاده کن. فقط JSON با شکل {"html": "..."} بده.`), { json: true });
  return extractJson<{ html: string }>(out).html;
}

export async function expandParagraph(ai: ChatProvider, paragraph: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `پاراگراف زیر را دو برابر مفصل‌تر و دقیق‌تر کن بدون حشو. فقط JSON با شکل {"html": "<p>...</p>"} بده.\nپاراگراف:\n${paragraph}`), { json: true });
  return extractJson<{ html: string }>(out).html;
}

export async function rewriteParagraph(ai: ChatProvider, paragraph: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `پاراگراف زیر را بازنویسی کن؛ همان معنا، لحن طبیعی‌تر و واژگان متنوع‌تر. فقط JSON با شکل {"html": "<p>...</p>"} بده.\nپاراگراف:\n${paragraph}`), { json: true });
  return extractJson<{ html: string }>(out).html;
}

export async function fixGrammar(ai: ChatProvider, text: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `غلط‌های نگارشی، نیم‌فاصله و علائم متن فارسی زیر را اصلاح کن و فقط متن اصلاح‌شده را در JSON با شکل {"text": "..."} برگردان.\nمتن:\n${text}`), { json: true });
  return extractJson<{ text: string }>(out).text;
}

export async function improveReadability(ai: ChatProvider, text: string): Promise<string> {
  const out = await ai.chat(messages(TASK_SYSTEM, `متن زیر را خواناتر کن: جملات طولانی را بشکن، پاراگراف‌ها را کوتاه کن و از کلمات ربط استفاده کن. معنا را تغییر نده. فقط JSON با شکل {"html": "..."} بده.\nمتن:\n${text}`), { json: true });
  return extractJson<{ html: string }>(out).html;
}

export interface InternalLinkSuggestion { url: string; title: string; anchor: string }

export async function suggestInternalLinks(ai: ChatProvider, contentSummary: string, pages: { url: string; title: string }[]): Promise<InternalLinkSuggestion[]> {
  const out = await ai.chat(messages(TASK_SYSTEM, `از فهرست صفحات زیر، بهترین گزینه‌ها برای لینک داخلی به محتوای معرفی‌شده را انتخاب کن و انکرتکست پیشنهادی بده (حداکثر ۵ مورد). فقط JSON با شکل {"links": [{"url": "...", "title": "...", "anchor": "..."}]} بده.\nمحتوا:\n${contentSummary}\nصفحات:\n${pages.map((p) => `- ${p.title} (${p.url})`).join('\n')}`), { json: true });
  return extractJson<{ links: InternalLinkSuggestion[] }>(out).links;
}

export async function generateFullArticle(ai: ChatProvider, brief: {
  primaryKeyword: string; title?: string; outline?: string; targetWords?: number; tone?: string;
}): Promise<{ title: string; html: string }> {
  const b = brief;
  const out = await ai.chat(messages(TASK_SYSTEM, `یک مقاله سئو شده به فارسی درباره «${b.primaryKeyword}» بنویس.${b.title ? ` عنوان: ${b.title}.` : ''}${b.outline ? ` ساختار:\n${b.outline}` : ''} حجم هدف: حدود ${b.targetWords ?? 900} کلمه. لحن: ${b.tone ?? 'حرفه‌ای و ساده'}. ساختار شامل H2 و در صورت نیاز H3، یک پاراگراف مقدمه، نتیجه‌گیری و بخش سوالات متداول باشد. خروجی فقط JSON با شکل {"title": "...", "html": "..."} که html شامل h1, h2, p, ul است.`), { json: true, maxTokens: 4096 });
  return extractJson<{ title: string; html: string }>(out);
}
