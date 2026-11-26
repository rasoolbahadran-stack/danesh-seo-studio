/**
 * Light dependency-free HTML parser that extracts everything the engine needs
 * from an article's HTML. Works on controlled content (the editor's output).
 */
import type { ImageNode, Lang, HeadingNode, LinkNode, ParsedArticle } from './types.js';
import { countWords, normalizePersian, tokenize } from './persian.js';

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—', '&ndash;': '–', '&laquo;': '«', '&raquo;': '»',
};

export function decodeEntities(s: string): string {
  let out = s;
  for (const [k, v] of Object.entries(ENTITIES)) out = out.split(k).join(v);
  out = out.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return out;
}

function stripTags(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

export function getAttr(tag: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const m = tag.match(re);
  if (!m) return '';
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
}

export function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

export function extractMetaDescription(html: string): string {
  const m = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]*>/i);
  return m ? getAttr(m[0], 'content') : '';
}

export function extractHeadings(html: string): HeadingNode[] {
  const out: HeadingNode[] = [];
  const re = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let idx = 0;
  for (const m of html.matchAll(re)) {
    const text = stripTags(m[3]);
    if (!text) continue;
    out.push({ level: Number(m[1]), text, index: idx++ });
  }
  return out;
}

export function extractParagraphs(html: string): string[] {
  const out: string[] = [];
  const re = /<(p|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
  for (const m of html.matchAll(re)) {
    const text = stripTags(m[3]);
    if (text) out.push(text);
  }
  // <li> items: count each list item as a paragraph-like block for readability
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(liRe)) {
    const text = stripTags(m[1]);
    if (text) out.push(text);
  }
  return out;
}

function fileExt(src: string): string {
  const clean = src.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase();
}

export function extractImages(html: string): ImageNode[] {
  const out: ImageNode[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = getAttr(tag, 'src') || getAttr(tag, 'data-src');
    if (!src) continue;
    const filename = src.split('?')[0].split('#')[0].split('/').pop() || '';
    out.push({
      src,
      alt: getAttr(tag, 'alt').trim(),
      filename,
      lazy: /loading\s*=\s*["']lazy["']/i.test(tag) || /data-src/i.test(tag),
      hasDimensions: Boolean(getAttr(tag, 'width')) && Boolean(getAttr(tag, 'height')),
      ext: fileExt(src),
    });
  }
  return out;
}

export function isMailtoOrJs(href: string): boolean {
  return /^(mailto:|tel:|javascript:|#)/i.test(href.trim());
}

export function classifyLink(href: string, hostHint?: string): boolean | null {
  const h = href.trim();
  if (!h || isMailtoOrJs(h)) return null;
  if (/^https?:\/\//i.test(h)) {
    try {
      const host = new URL(h).hostname.replace(/^www\./, '');
      if (hostHint) return host === hostHint.replace(/^www\./, '');
      return false; // absolute URL without a known site host → treat as external
    } catch {
      return false;
    }
  }
  if (h.startsWith('//')) return false;
  return true; // relative → internal
}

export function extractLinks(html: string, hostHint?: string): LinkNode[] {
  const out: LinkNode[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const attrs = m[1];
    const href = getAttr(`<x ${attrs}>`, 'href');
    if (!href) continue;
    const anchorText = stripTags(m[2]);
    out.push({
      href,
      anchorText,
      internal: classifyLink(href, hostHint),
      nofollow: /rel\s*=\s*["'][^"']*nofollow/i.test(attrs),
    });
  }
  return out;
}

export function extractTables(html: string): number {
  return (html.match(/<table[\s>]/gi) || []).length;
}

export function extractLists(html: string): number {
  return ((html.match(/<ul[\s>]/gi) || []).length + (html.match(/<ol[\s>]/gi) || []).length);
}

export interface ParseOptions {
  lang?: Lang;
  title?: string;
  metaDescription?: string;
  hostHint?: string;
}

/** Parse article HTML into the structured document the engine analyzes. */
export function parseArticle(html: string, opts: ParseOptions = {}): ParsedArticle {
  let body = html;
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const rawTitle = opts.title ?? extractTitle(head ? head[0] : html) ?? '';
  const rawMeta = opts.metaDescription ?? extractMetaDescription(head ? head[0] : html) ?? '';

  body = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|iframe|button|input|select|nav|footer|header|aside)[\s\S]*?<\/\1>/gi, '');

  const headings = extractHeadings(body);
  const paragraphs = extractParagraphs(body);
  const images = extractImages(body);
  const links = extractLinks(body, opts.hostHint);
  const text = paragraphs.join(' ').replace(/\s+/g, ' ').trim();
  const words = tokenize(normalizePersian(text));
  const charCount = text.replace(/\s+/g, ' ').trim().length;

  return {
    lang: opts.lang ?? 'fa',
    title: rawTitle,
    metaDescription: rawMeta,
    headings,
    paragraphs,
    images,
    links,
    text,
    wordCount: words.length || countWords(text),
    charCount,
    lists: extractLists(body),
    tables: extractTables(body),
  };
}
