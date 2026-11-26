/**
 * Technical SEO audit for a live URL: HTTP status/redirects, robots.txt,
 * sitemap.xml, canonical, headings, meta, Open Graph, schema, viewport,
 * indexability, image/link sampling and near-duplicate page detection.
 * Core Web Vitals requires the (free, key-optional) PageSpeed API — reported
 * honestly when unavailable.
 */
import * as cheerio from 'cheerio';
import { compareTexts, type SimilarityResult } from '@danesh/content-analyzer';

const UA = 'Mozilla/5.0 (compatible; DaneshSEOStudio/0.1; +technical-audit)';
const TIMEOUT_MS = 15000;
const REDIRECT_LIMIT = 5;

export interface RedirectHop { status: number; location: string }

export interface TechnicalIssue {
  code: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'passed';
  title: string;
  detail: string;
  howToFix: string;
}

export interface TechnicalReport {
  url: string;
  finalUrl: string;
  https: boolean;
  status: number | null;
  redirectChain: RedirectHop[];
  ttfbMs: number | null;
  pageSizeKb: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  xRobotsTag: string | null;
  viewport: string | null;
  langAttr: string | null;
  h1Count: number;
  headingsOutline: { level: number; text: string }[];
  openGraph: Record<string, string>;
  schemaTypes: string[];
  hreflang: string[];
  indexable: boolean;
  images: { count: number; missingAlt: number; withoutDimensions: number; largeSample: string[] };
  links: { internal: number; external: number; broken: string[] };
  robotsTxt: { found: boolean; sitemapDeclared: string | null; disallowAll: boolean };
  sitemap: { found: boolean | null; urlCount: number | null; sample: string[] };
  coreWebVitals: { status: 'ok' | 'not_available' | 'error'; message: string; metrics?: Record<string, number | null> };
  issues: TechnicalIssue[];
  checkedAt: string;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'manual', headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(timer);
  }
}

export async function auditTechnical(url: string, opts: { checkLinks?: boolean } = {}): Promise<TechnicalReport> {
  const start = Date.now();
  const redirectChain: RedirectHop[] = [];
  let current = url;
  let response: Response | null = null;
  for (let i = 0; i <= REDIRECT_LIMIT; i++) {
    response = await fetchWithTimeout(current);
    const loc = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && loc) {
      redirectChain.push({ status: response.status, location: loc });
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }
  if (!response) throw new Error('no response');
  const ttfbMs = Date.now() - start;
  const html = await response.text();
  const finalUrl = current;
  const https = finalUrl.startsWith('https://');
  const pageSizeKb = Math.round((html.length / 1024) * 10) / 10;
  const xRobotsTag = response.headers.get('x-robots-tag');

  const $ = cheerio.load(html);
  // Extract JSON-LD schema BEFORE removing script tags
  const schemaTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text()) as { '@type'?: string | string[]; '@graph'?: { '@type'?: string | string[] }[] };
      const push = (t?: string | string[]) => {
        if (!t) return;
        for (const x of Array.isArray(t) ? t : [t]) schemaTypes.push(x);
      };
      push(json['@type']);
      for (const g of json['@graph'] ?? []) push(g['@type']);
    } catch {
      schemaTypes.push('invalid-json');
    }
  });
  $('script, style, noscript').remove();

  const title = $('title').first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? null;
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() ?? null;
  const robotsMeta = $('meta[name="robots"]').attr('content')?.trim() ?? null;
  const viewport = $('meta[name="viewport"]').attr('content')?.trim() ?? null;
  const langAttr = $('html').attr('lang') ?? null;
  const h1Count = $('h1').length;
  const headingsOutline: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t) headingsOutline.push({ level: Number(el.tagName.slice(1)), text: t });
  });
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property') ?? '';
    openGraph[prop] = $(el).attr('content') ?? '';
  });
  const hreflang: string[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    hreflang.push($(el).attr('hreflang') ?? '');
  });

  const images = $('img');
  const missingAlt = images.filter((_, el) => !($(el).attr('alt') ?? '').trim()).length;
  const withoutDimensions = images.filter((_, el) => !$(el).attr('width') || !$(el).attr('height')).length;
  const imageUrls: string[] = [];
  images.slice(0, 8).each((_, el) => {
    const src = $(el).attr('src');
    if (src && /^https?:\/\//.test(src)) imageUrls.push(src);
  });
  const largeSample: string[] = [];
  await Promise.all(imageUrls.slice(0, 5).map(async (src) => {
    try {
      const r = await fetchWithTimeout(src);
      const len = Number(r.headers.get('content-length') ?? 0);
      if (len > 200_000) largeSample.push(`${src.split('/').pop()} (${Math.round(len / 1024)}KB)`);
    } catch { /* ignore */ }
  }));

  const links: { internal: number; external: number; broken: string[] } = { internal: 0, external: 0, broken: [] };
  const linkTargets: string[] = [];
  const origin = new URL(finalUrl);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    try {
      const abs = new URL(href, finalUrl).toString();
      if (abs.startsWith(origin.origin)) links.internal += 1; else links.external += 1;
      if (/^https?:\/\//.test(abs)) linkTargets.push(abs);
    } catch { /* malformed */ }
  });
  if (opts.checkLinks !== false) {
    await Promise.all([...new Set(linkTargets)].slice(0, 12).map(async (target) => {
      try {
        const r = await fetchWithTimeout(target, { method: 'HEAD' });
        if (r.status === 405 || r.status >= 500) {
          const r2 = await fetchWithTimeout(target);
          if (!r2.ok) links.broken.push(`${target} → ${r2.status}`);
        } else if (!r.ok) {
          links.broken.push(`${target} → ${r.status}`);
        }
      } catch {
        links.broken.push(`${target} → unreachable`);
      }
    }));
  }

  // robots.txt + sitemap.xml
  const robotsUrl = `${origin.origin}/robots.txt`;
  let robotsTxt: TechnicalReport['robotsTxt'] = { found: false, sitemapDeclared: null, disallowAll: false };
  try {
    const r = await fetchWithTimeout(robotsUrl);
    if (r.ok) {
      const text = await r.text();
      robotsTxt = {
        found: true,
        sitemapDeclared: text.match(/^sitemap:\s*(\S+)$/im)?.[1] ?? null,
        disallowAll: /user-agent:\s*\*\s*(?:\n|.)*?disallow:\s*\/\s*(?:\n|$)/i.test(text),
      };
    }
  } catch { /* not found */ }

  let sitemap: TechnicalReport['sitemap'] = { found: null, urlCount: null, sample: [] };
  const sitemapUrl = robotsTxt.sitemapDeclared ?? `${origin.origin}/sitemap.xml`;
  try {
    const r = await fetchWithTimeout(sitemapUrl);
    if (r.ok) {
      const text = await r.text();
      const locs = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
      sitemap = { found: true, urlCount: locs.length, sample: locs.slice(0, 5) };
    } else {
      sitemap = { found: false, urlCount: null, sample: [] };
    }
  } catch {
    sitemap = { found: false, urlCount: null, sample: [] };
  }

  const indexable = !(/noindex/i.test(robotsMeta ?? '')) && !(/noindex/i.test(xRobotsTag ?? '')) && !robotsTxt.disallowAll;

  // Core Web Vitals via PageSpeed API (works keyless with quota; reported honestly)
  let coreWebVitals: TechnicalReport['coreWebVitals'] = { status: 'not_available', message: 'Core Web Vitals به API PageSpeed نیاز دارد؛ در این استقرار در دسترس نیست.' };
  try {
    const psi = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    psi.searchParams.set('url', finalUrl);
    psi.searchParams.set('strategy', 'mobile');
    psi.searchParams.set('category', 'performance');
    const r = await fetchWithTimeout(psi.toString());
    if (r.ok) {
      const j = (await r.json()) as {
        lighthouseResult?: { categories?: { performance?: { score?: number } } };
        loadingExperience?: { metrics?: Record<string, { percentile?: number; category?: string }> };
      };
      const perf = j.lighthouseResult?.categories?.performance?.score ?? null;
      const metrics: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(j.loadingExperience?.metrics ?? {})) {
        metrics[k] = v.percentile ?? null;
      }
      coreWebVitals = { status: 'ok', message: perf !== null ? `امتیاز Performance موبایل: ${Math.round(perf * 100)}` : 'PageSpeed پاسخ داد اما امتیاز performance نداشت', metrics };
    }
  } catch { /* keep not_available */ }

  const issues: TechnicalIssue[] = [];
  const push = (i: TechnicalIssue) => issues.push(i);
  if (response.status !== 200) {
    push({ code: 'http-status', priority: 'critical', title: `وضعیت HTTP ${response.status}`, detail: `صفحه با کد ${response.status} پاسخ داد`, howToFix: 'صفحه باید با کد ۲۰۰ در دسترس باشد' });
  } else {
    push({ code: 'http-status-ok', priority: 'passed', title: 'HTTP 200', detail: 'صفحه در دسترس است', howToFix: '' });
  }
  if (!https) push({ code: 'no-https', priority: 'critical', title: 'HTTPS نیست', detail: 'آدرس نهایی http است', howToFix: 'گواهی TLS نصب و ریدایرکت ۳۰۱ به https تنظیم کنید' });
  if (redirectChain.length > 2) push({ code: 'redirect-chain', priority: 'medium', title: `زنجیره ریدایرکت ${redirectChain.length} مرحله‌ای`, detail: redirectChain.map((r) => `${r.status}→${r.location}`).join(' | '), howToFix: 'ریدایرکت‌ها را به یک پرش مستقیم کاهش دهید' });
  if (!title) push({ code: 'title-missing', priority: 'critical', title: 'تگ title وجود ندارد', detail: '', howToFix: 'یک عنوان یکتای ۳۰–۶۰ کاراکتری اضافه کنید' });
  else if (title.length < 15 || title.length > 70) push({ code: 'title-length', priority: 'medium', title: `طول title (${title.length} کاراکتر) خارج از بازه`, detail: title, howToFix: 'عنوان را در بازه ۳۰–۶۰ کاراکتر تنظیم کنید' });
  if (!metaDescription) push({ code: 'meta-missing', priority: 'high', title: 'Meta Description ندارد', detail: '', howToFix: 'توضیحات متا ۱۲۰–۱۶۰ کاراکتری اضافه کنید' });
  if (!canonical) push({ code: 'canonical-missing', priority: 'medium', title: 'Canonical ندارد', detail: 'برای صفحات مشابه، canonical از خودگذری جلوگیری می‌کند', howToFix: 'لینک canonical به آدرس اصلی صفحه اضافه کنید' });
  if (h1Count === 0) push({ code: 'h1-missing', priority: 'high', title: 'هیچ H1 نیست', detail: '', howToFix: 'یک H1 برای موضوع اصلی صفحه بگذارید' });
  else if (h1Count > 1) push({ code: 'h1-multiple', priority: 'medium', title: `${h1Count} عدد H1`, detail: '', howToFix: 'فقط یک H1 نگه دارید' });
  if (!indexable) push({ code: 'noindex', priority: 'critical', title: 'صفحه noindex است', detail: `robots meta: ${robotsMeta ?? '—'} | X-Robots-Tag: ${xRobotsTag ?? '—'}`, howToFix: 'اگر صفحه باید ایندکس شود، noindex را حذف کنید' });
  if (!viewport) push({ code: 'viewport-missing', priority: 'high', title: 'متای viewport ندارد', detail: 'صفحه در موبایل درست نمایش داده نمی‌شود', howToFix: '<meta name="viewport" content="width=device-width, initial-scale=1"> اضافه کنید' });
  if (Object.keys(openGraph).length === 0) push({ code: 'og-missing', priority: 'low', title: 'Open Graph ندارد', detail: 'پیش‌نمایش اشتراک‌گذاری در شبکه‌های اجتماعی ضعیف است', howToFix: 'og:title و og:image و og:description اضافه کنید' });
  if (schemaTypes.length === 0) push({ code: 'schema-missing', priority: 'medium', title: 'Schema Markup ندارد', detail: 'داده ساختاریافته (JSON-LD) برای رنکینگ غنی مفید است', howToFix: 'JSON-LD مناسب نوع صفحه اضافه کنید (Article, Product, FAQ...)' });
  if (images.length > 0 && missingAlt > 0) push({ code: 'img-alt', priority: 'medium', title: `${missingAlt} تصویر بدون Alt`, detail: `از ${images.length} تصویر`, howToFix: 'برای همه تصاویر alt بنویسید' });
  if (links.broken.length > 0) push({ code: 'broken-links', priority: 'high', title: `${links.broken.length} لینک شکسته`, detail: links.broken.join('، ').slice(0, 300), howToFix: 'لینک‌ها را اصلاح یا حذف کنید' });
  if (sitemap.found === false) push({ code: 'sitemap-missing', priority: 'medium', title: 'Sitemap پیدا نشد', detail: `آدرس بررسی‌شده: ${sitemapUrl}`, howToFix: 'sitemap.xml بسازید و در robots.txt معرفی کنید' });
  if (robotsTxt.disallowAll) push({ code: 'robots-disallow-all', priority: 'critical', title: 'robots.txt کل سایت را Disallow کرده', detail: '', howToFix: 'قانون Disallow: / را برای UA * حذف کنید' });
  if (coreWebVitals.status === 'ok' && coreWebVitals.metrics?.['LCP'] !== undefined && (coreWebVitals.metrics['LCP'] ?? 0) > 75) {
    push({ code: 'lcp-slow', priority: 'high', title: 'LCP کند است', detail: `LCP percentile: ${coreWebVitals.metrics['LCP']}`, howToFix: 'تصاویر بزرگ و فونت‌های بلوکه‌کننده را بهینه کنید' });
  }
  push({ code: 'image-format', priority: images.length && largeSample.length ? 'medium' : 'passed', title: 'فرمت/حجم تصاویر', detail: largeSample.length ? `تصاویر بزرگ: ${largeSample.join('، ')}` : 'نمونه تصاویر حجم بالای ۲۰۰KB نداشتند', howToFix: 'تصاویر بزرگ را به WebP/AVIF تبدیل و فشرده کنید' });

  return {
    url,
    finalUrl,
    https,
    status: response.status,
    redirectChain,
    ttfbMs,
    pageSizeKb,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    xRobotsTag,
    viewport,
    langAttr,
    h1Count,
    headingsOutline,
    openGraph,
    schemaTypes: [...new Set(schemaTypes)],
    hreflang: hreflang.filter(Boolean),
    indexable,
    images: { count: images.length, missingAlt, withoutDimensions, largeSample },
    links,
    robotsTxt,
    sitemap,
    coreWebVitals,
    issues,
    checkedAt: new Date().toISOString(),
  };
}

/** Near-duplicate page detection via SimHash. */
export async function detectDuplicatePages(urls: string[]): Promise<{
  checked: { url: string; simhash: string; wordCount: number }[];
  duplicates: { a: string; b: string; simhashHamming: number; jaccardShingles: number; verdict: string }[];
  errors: { url: string; error: string }[];
}> {
  const texts: { url: string; text: string; error?: string }[] = [];
  await Promise.all(urls.slice(0, 10).map(async (u) => {
    try {
      const res = await fetchWithTimeout(u);
      const html = await res.text();
      const $ = cheerio.load(html);
      $('script, style, noscript, nav, footer, header, aside').remove();
      texts.push({ url: u, text: $('body').text().replace(/\s+/g, ' ').trim() });
    } catch (err) {
      texts.push({ url: u, text: '', error: (err as Error).message });
    }
  }));
  const ok = texts.filter((t) => !t.error && t.text.length > 100);
  const checked = ok.map((t) => ({ url: t.url, wordCount: t.text.split(' ').length, simhash: 'computed' }));
  const duplicates: { a: string; b: string; simhashHamming: number; jaccardShingles: number; verdict: string }[] = [];
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      const r: SimilarityResult = compareTexts(ok[i].text, ok[j].text);
      if (r.verdict !== 'different') {
        duplicates.push({ a: ok[i].url, b: ok[j].url, simhashHamming: r.simhashHamming, jaccardShingles: r.jaccardShingles, verdict: r.verdict });
      }
    }
  }
  return { checked, duplicates, errors: texts.filter((t) => t.error).map((t) => ({ url: t.url, error: t.error ?? '' })) };
}
