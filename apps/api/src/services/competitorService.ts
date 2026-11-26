/**
 * Fetches competitor pages with a browser-like UA, extracts real content via
 * cheerio and compares with the user's article using the engine.
 */
import * as cheerio from 'cheerio';
import {
  tokenize, normalizePersian, extractTerms, parseArticle, analyzeArticle,
  countWords, type CompetitorDoc, type HeadingNode,
} from '@danesh/seo-engine';

export interface FetchedPage {
  url: string;
  title: string;
  metaDescription: string;
  headings: HeadingNode[];
  text: string;
  wordCount: number;
  topTerms: { term: string; count: number }[];
  images: number;
  externalLinks: number;
  internalLinks: number;
  fetchedAt: string;
}

export interface FetchOutcome {
  docs: CompetitorDoc[];
  pages: (FetchedPage | { url: string; error: string })[];
}

const UA = 'Mozilla/5.0 (compatible; DaneshSEOStudio/0.1; +https://github.com/rasoolbahadran-stack/danesh-seo-studio)';
const TIMEOUT_MS = 15000;
const MAX_HTML_BYTES = 1_500_000;

async function fetchPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) throw new Error('صفحه بسیار بزرگ است');
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const $ = cheerio.load(html);
    $('script, style, noscript, svg, iframe, nav, footer, aside, header').remove();

    const headings: HeadingNode[] = [];
    $('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) headings.push({ level: Number(el.tagName.slice(1)), text, index: headings.length });
    });
    const paragraphs: string[] = [];
    $('p, li, blockquote').each((_, el) => {
      const t = $(el).text().replace(/\s+/g, ' ').trim();
      if (t.length > 2) paragraphs.push(t);
    });
    const text = paragraphs.join(' ');
    const images = $('img').length;
    let externalLinks = 0;
    let internalLinks = 0;
    const origin = new URL(url).origin;
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
      if (/^https?:\/\//i.test(href) && !href.startsWith(origin)) externalLinks += 1;
      else internalLinks += 1;
    });

    return {
      url,
      title: $('title').text().trim() || '',
      metaDescription: $('meta[name="description"]').attr('content')?.trim() ?? '',
      headings,
      text,
      wordCount: countWords(text),
      topTerms: extractTerms(text, 'fa', 15),
      images,
      externalLinks,
      internalLinks,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export class CompetitorService {
  async fetchDocs(urls: string[]): Promise<{ docs: CompetitorDoc[]; pages: FetchOutcome['pages'] }> {
    const results = await Promise.allSettled(urls.map((u) => fetchPage(u)));
    const docs: CompetitorDoc[] = [];
    const pages: FetchOutcome['pages'] = [];
    for (let i = 0; i < urls.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        pages.push(r.value);
        docs.push({ url: r.value.url, title: r.value.title, headings: r.value.headings, text: r.value.text, wordCount: r.value.wordCount });
      } else {
        pages.push({ url: urls[i], error: (r.reason as Error)?.message ?? 'fetch failed' });
      }
    }
    return { docs, pages };
  }

  async analyzeCompetitors(urls: string[], articleHtml: string | null, articleKeyword: string | null) {
    const { docs, pages } = await this.fetchDocs(urls);
    const okPages = pages.filter((p): p is FetchedPage => 'title' in p);
    const summary = {
      competitors: okPages.map((p) => ({
        url: p.url,
        title: p.title,
        wordCount: p.wordCount,
        h2Count: p.headings.filter((h) => h.level === 2).length,
        images: p.images,
        topTerms: p.topTerms.slice(0, 10),
      })),
      failed: pages.filter((p) => 'error' in p),
      medianWordCount: median(okPages.map((p) => p.wordCount)),
    };

    let comparison: ReturnType<typeof analyzeArticle> | null = null;
    if (articleHtml && articleKeyword && docs.length > 0) {
      comparison = analyzeArticle({
        html: articleHtml,
        primaryKeyword: articleKeyword,
        lang: 'fa',
        competitors: docs,
      });
    }
    const aggregateTerms = aggregateTopTerms(okPages.map((p) => p.topTerms));
    const articleTerms = articleHtml ? new Set(tokenize(normalizePersian(stripHtml(articleHtml)))) : new Set<string>();
    const gaps = aggregateTerms
      .filter((t) => !t.term.includes(' ') && !articleTerms.has(t.term))
      .slice(0, 12)
      .map((t) => t.term);

    return { summary, comparison, missingTopics: gaps, competitorDocs: docs.length };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function aggregateTopTerms(lists: { term: string; count: number }[][]) {
  const acc = new Map<string, { total: number; docs: number }>();
  for (const list of lists) {
    for (const t of list) {
      const cur = acc.get(t.term) ?? { total: 0, docs: 0 };
      cur.total += t.count;
      cur.docs += 1;
      acc.set(t.term, cur);
    }
  }
  return [...acc.entries()]
    .map(([term, v]) => ({ term, docs: v.docs, total: v.total }))
    .sort((a, b) => b.docs - a.docs || b.total - a.total)
    .slice(0, 30);
}
