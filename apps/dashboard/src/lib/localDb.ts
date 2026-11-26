/**
 * حالت محلی (بدون سرور) — Local mode storage layer.
 *
 * Everything runs in the browser: workspaces/articles/versions/briefs/reports
 * live in localStorage, and analysis/research run through the SAME pure engine
 * packages the server uses (@danesh/seo-engine, @danesh/content-analyzer,
 * @danesh/keyword-research). Server-only capabilities (fetching competitor
 * pages, technical audits, AI providers, SERP data) return a clear
 * LOCAL_UNSUPPORTED error — nothing is faked.
 */
import {
  analyzeArticle, type Intent,
} from '@danesh/seo-engine';
import { analyzeEEAT, detectCannibalization, buildKeywordMapping } from '@danesh/content-analyzer';
import {
  expandLongTails, generateQuestions, clusterKeywords, classifyIntent, generateRuleBrief,
} from '@danesh/keyword-research';
import { ApiError } from '../api.js';
import { blockDiff } from './diff.js';

const DB_KEY = 'danesh_local_db_v1';
const AUTOSAVE_VERSION_INTERVAL_MS = 5 * 60 * 1000;

export const LOCAL_USER = { id: 'local-owner', email: 'local@danesh.local', name: 'رسول بهادران', role: 'admin' };

interface LVersion {
  id: string; version_no: number; title: string; content_html: string;
  meta_title: string; meta_description: string; note: string;
  score_total: number | null; created_by: string; created_at: string;
}

interface LArticle {
  id: string; workspaceId: string; title: string; slug: string;
  primaryKeyword: string; secondaryKeywords: string[]; intent: string;
  targetWords: number; status: string; contentHtml: string;
  metaTitle: string; metaDescription: string; competitorUrls: string[];
  publishedUrl: string; briefId: string | null;
  lastScore: { score: number; grade: string; at: string } | null;
  createdAt: string; updatedAt: string;
  versions: LVersion[];
}

interface LWorkspace {
  id: string; name: string; domain: string; lang: string; cms: string;
  connection_type: string; weights_json: string | null; settings_json: string;
  created_at: string;
}

interface LBrief {
  id: string; workspaceId: string; keyword: string; status: string;
  createdAt: string; data: Record<string, unknown>;
}

interface LReport {
  id: string; workspaceId: string; articleId: string | null; type: string;
  createdAt: string; payload: Record<string, unknown>;
}

interface LocalDBShape {
  workspaces: LWorkspace[];
  articles: LArticle[];
  briefs: LBrief[];
  reports: LReport[];
}

function load(): LocalDBShape {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as LocalDBShape;
  } catch { /* corrupt → reseed */ }
  return seed();
}

function save(db: LocalDBShape) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (err) {
    throw new ApiError(500, 'LOCAL_STORAGE', 'ذخیره در مرورگر ناموفق بود (فضای localStorage پر است؟)');
  }
}

const uid = () => `local-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const now = () => new Date().toISOString();

const SAMPLE_HTML = `
<h1>آموزش دم کردن قهوه ترک: راهنمای کامل</h1>
<p>قهوه ترک یکی از قدیمی‌ترین روش‌های دم کردن قهوه در جهان است. در این راهنما مرحله به مرحله یاد می‌گیرید که چگونه یک فنجان قهوه ترک عالی درست کنید.</p>
<h2>قهوه ترک چیست؟</h2>
<p>قهوه ترک روشی است که در آن پودر بسیار نرم قهوه مستقیماً در آب جوش دم می‌شود و بدون فیلتر سرو می‌گردد. این روش در ترکیه، ایران و کشورهای بالکان رایج است.</p>
<h2>وسایل مورد نیاز</h2>
<p>برای دم کردن قهوه ترک به کتری مخصوصی به نام جزوه و پودر قهوه بسیار نرم نیاز دارید.</p>
<ul><li>پودر قهوه ترک بسیار نرم</li><li>آب سرد و تازه</li><li>شکر در صورت تمایل</li></ul>
<h2>مراحل دم کردن</h2>
<p>آب را در جزوه گرم کنید تا نزدیک جوش برسد، سپس پودر قهوه و شکر را اضافه کنید و آرام هم بزنید. کف تشکیل‌شده را با قاشق بردارید و در فنجان بریزید.</p>
<img src="/images/turk-coffee.jpg" alt="فنجان قهوه ترک با کف" loading="lazy" width="800" height="600">
<h2>نتیجه‌گیری</h2>
<p>دم کردن قهوه ترک مهارتی است که با تمرین بهتر می‌شود؛ با تنظیم گرما و صبر، هر بار فنجانی با کف کامل خواهید داشت.</p>
<h2>سوالات متداول</h2>
<p>آیا می‌توان از قهوه آسیاب‌شده معمولی استفاده کرد؟ خیر، پودر بسیار نرم لازم است.</p>
<a href="/latte-art">آموزش لاته آرت</a>
`;

/** First-run seeding: starter workspace + one clearly-labeled sample article. */
function seed(): LocalDBShape {
  const db: LocalDBShape = { workspaces: [], articles: [], briefs: [], reports: [] };
  const ws: LWorkspace = {
    id: uid(), name: 'سایت من', domain: '', lang: 'fa', cms: 'other',
    connection_type: 'none', weights_json: null, settings_json: '{}', created_at: now(),
  };
  db.workspaces.push(ws);
  const article = makeArticle(ws.id, {
    title: '[نمونه — قابل حذف] آموزش دم کردن قهوه ترک',
    primaryKeyword: 'قهوه ترک',
    secondaryKeywords: ['جزوه', 'دم کردن قهوه'],
    intent: 'informational',
    targetWords: 700,
    contentHtml: SAMPLE_HTML,
    metaTitle: 'آموزش دم کردن قهوه ترک: راهنمای کامل',
    metaDescription: 'راهنمای کامل و مرحله‌به‌مرحله دم کردن قهوه ترک؛ از انتخاب پودر تا سرو نهایی.',
  });
  db.articles.push(article);
  save(db);
  return db;
}

function makeArticle(workspaceId: string, input: Record<string, unknown>): LArticle {
  const ts = now();
  const article: LArticle = {
    id: uid(),
    workspaceId,
    title: String(input.title ?? 'بدون عنوان'),
    slug: String(input.slug ?? ''),
    primaryKeyword: String(input.primaryKeyword ?? ''),
    secondaryKeywords: Array.isArray(input.secondaryKeywords) ? (input.secondaryKeywords as string[]) : [],
    intent: String(input.intent ?? ''),
    targetWords: Number(input.targetWords ?? 0) || 0,
    status: String(input.status ?? 'draft'),
    contentHtml: String(input.contentHtml ?? ''),
    metaTitle: String(input.metaTitle ?? ''),
    metaDescription: String(input.metaDescription ?? ''),
    competitorUrls: Array.isArray(input.competitorUrls) ? (input.competitorUrls as string[]) : [],
    publishedUrl: String(input.publishedUrl ?? ''),
    briefId: (input.briefId as string | null) ?? null,
    lastScore: null,
    createdAt: ts,
    updatedAt: ts,
    versions: [],
  };
  article.versions.push({
    id: uid(), version_no: 1, title: article.title, content_html: article.contentHtml,
    meta_title: article.metaTitle, meta_description: article.metaDescription,
    note: 'نسخه اولیه', score_total: null, created_by: LOCAL_USER.id, created_at: ts,
  });
  return article;
}

function articleJson(a: LArticle) {
  const { versions, ...rest } = a;
  return rest;
}

function listArticleJson(a: LArticle) {
  return { ...articleJson(a), contentHtml: undefined };
}

function unsupported(): never {
  throw new ApiError(
    400,
    'LOCAL_UNSUPPORTED',
    'این قابلیت در حالت محلی (بدون سرور) در دسترس نیست. برای فعال‌سازی، Backend را اجرا کنید و آدرس آن را در صفحه ورود وارد کنید.',
  );
}

function notFound(msg = 'یافت نشد'): never {
  throw new ApiError(404, 'NOT_FOUND', msg);
}

function findWs(db: LocalDBShape, id: string): LWorkspace {
  const ws = db.workspaces.find((w) => w.id === id);
  if (!ws) notFound('وب‌سایت یافت نشد');
  return ws;
}

function findArticle(db: LocalDBShape, wsId: string, id: string): LArticle {
  const a = db.articles.find((x) => x.id === id && x.workspaceId === wsId);
  if (!a) notFound('مقاله یافت نشد');
  return a;
}

function wsStats(db: LocalDBShape, wsId: string) {
  const articles = db.articles.filter((a) => a.workspaceId === wsId);
  const scores = articles.map((a) => a.lastScore?.score).filter((n): n is number => typeof n === 'number');
  return {
    articles: articles.length,
    published: articles.filter((a) => a.status === 'published').length,
    briefs: db.briefs.filter((b) => b.workspaceId === wsId).length,
    reports: db.reports.filter((r) => r.workspaceId === wsId).length,
    avgScore: scores.length ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length) : null,
  };
}

function runAnalyze(db: LocalDBShape, a: LArticle, weights_json: string | null) {
  const report = analyzeArticle({
    html: a.contentHtml,
    title: a.metaTitle || undefined,
    metaDescription: a.metaDescription || undefined,
    primaryKeyword: a.primaryKeyword,
    secondaryKeywords: a.secondaryKeywords,
    lang: 'fa',
    intent: (a.intent || undefined) as Intent | undefined,
    targetWordCount: a.targetWords || undefined,
    slug: a.slug || undefined,
    weights: weights_json ? JSON.parse(weights_json) : undefined,
  });
  const eeat = analyzeEEAT(a.contentHtml, { wordCountTarget: a.targetWords || 900 });
  a.lastScore = { score: report.score, grade: report.grade, at: now() };
  a.updatedAt = now();
  return { score: report.score, grade: report.grade, report, eeat, competitorsFetched: false };
}

/** Main dispatcher — mirrors the REST API surface used by the dashboard. */
export function handleLocal(method: string, path: string, body?: unknown): unknown {
  const db = load();
  const cleanPath = path.split('?')[0];
  const parts = cleanPath.split('/').filter(Boolean); // e.g. ['workspaces', ':id', 'articles', ':id']
  const seg = (i: number) => parts[i] ?? '';

  // ---------- auth ----------
  if (cleanPath === '/auth/me' && method === 'GET') {
    return { user: { ...LOCAL_USER, createdAt: now() } };
  }
  if (cleanPath === '/auth/me/password' && method === 'PATCH') {
    return { ok: true, message: 'در حالت محلی رمز عبوری وجود ندارد — داده‌ها فقط در مرورگر شما هستند.' };
  }
  if (cleanPath.startsWith('/auth')) {
    return { token: 'local-mode', user: LOCAL_USER };
  }
  if (cleanPath === '/health') {
    return { status: 'ok', db: 'ok', mode: 'local', version: '0.1.0', features: { ai: false, serp: false } };
  }

  // ---------- workspaces ----------
  if (seg(0) === 'workspaces') {
    const wsId = seg(1);

    if (!wsId && method === 'GET') return { workspaces: db.workspaces };
    if (!wsId && method === 'POST') {
      const b = body as Record<string, unknown>;
      const ws: LWorkspace = {
        id: uid(), name: String(b.name ?? 'وب‌سایت جدید'), domain: String(b.domain ?? ''),
        lang: String(b.lang ?? 'fa'), cms: String(b.cms ?? 'other'),
        connection_type: 'none', weights_json: null, settings_json: '{}', created_at: now(),
      };
      db.workspaces.push(ws);
      save(db);
      return { workspace: ws };
    }

    findWs(db, wsId);
    const sub = seg(2);
    if (!sub) {
      if (method === 'GET') {
        const ws = findWs(db, wsId);
        return {
          workspace: ws,
          stats: wsStats(db, wsId),
          ai: { configured: false, provider: 'none', model: null, maskedKey: null, source: 'local' },
          serp: { configured: false, provider: 'none', howToEnable: 'در حالت محلی، داده SERP/حجم جست‌وجو در دسترس نیست — برای آن Backend با کلید سرویس لازم است.' },
        };
      }
      if (method === 'PATCH') {
        const ws = findWs(db, wsId);
        const b = (body ?? {}) as Record<string, unknown>;
        if (typeof b.name === 'string') ws.name = b.name;
        if (typeof b.domain === 'string') ws.domain = b.domain;
        if (b.weights && typeof b.weights === 'object') ws.weights_json = JSON.stringify(b.weights);
        save(db);
        return { workspace: ws };
      }
      if (method === 'DELETE') {
        db.workspaces = db.workspaces.filter((w) => w.id !== wsId);
        db.articles = db.articles.filter((a) => a.workspaceId !== wsId);
        save(db);
        return { ok: true };
      }
    }

    if (sub === 'articles') {
      const articleId = seg(3);
      if (!articleId) {
        if (method === 'GET') {
          const rows = db.articles.filter((a) => a.workspaceId === wsId).map(listArticleJson);
          return { articles: rows, total: rows.length };
        }
        if (method === 'POST') {
          const a = makeArticle(wsId, (body ?? {}) as Record<string, unknown>);
          db.articles.push(a);
          save(db);
          return { article: articleJson(a) };
        }
      }
      const a = findArticle(db, wsId, articleId);
      const vsub = seg(4);

      if (!vsub) {
        if (method === 'GET') return { article: articleJson(a), versions: a.versions };
        if (method === 'PATCH') {
          const b = (body ?? {}) as Record<string, unknown>;
          const forceSave = b.forceSave === true;
          if (typeof b.title === 'string') a.title = b.title;
          if (typeof b.slug === 'string') a.slug = b.slug;
          if (typeof b.primaryKeyword === 'string') a.primaryKeyword = b.primaryKeyword;
          if (Array.isArray(b.secondaryKeywords)) a.secondaryKeywords = b.secondaryKeywords as string[];
          if (typeof b.intent === 'string') a.intent = b.intent;
          if (typeof b.targetWords === 'number') a.targetWords = b.targetWords;
          if (typeof b.contentHtml === 'string') a.contentHtml = b.contentHtml;
          if (typeof b.metaTitle === 'string') a.metaTitle = b.metaTitle;
          if (typeof b.metaDescription === 'string') a.metaDescription = b.metaDescription;
          if (Array.isArray(b.competitorUrls)) a.competitorUrls = b.competitorUrls as string[];
          if (typeof b.status === 'string') a.status = b.status;
          a.updatedAt = now();

          const last = a.versions[a.versions.length - 1];
          let version: LVersion | null = null;
          if (forceSave || !last || Date.now() - new Date(last.created_at).getTime() > AUTOSAVE_VERSION_INTERVAL_MS) {
            version = {
              id: uid(), version_no: a.versions.length + 1, title: a.title,
              content_html: a.contentHtml, meta_title: a.metaTitle, meta_description: a.metaDescription,
              note: forceSave ? 'ذخیره دستی' : 'ذخیره خودکار', score_total: a.lastScore?.score ?? null,
              created_by: LOCAL_USER.id, created_at: now(),
            };
            a.versions.push(version);
            if (a.versions.length > 30) a.versions = a.versions.slice(-30);
          }
          save(db);
          return {
            savedAt: a.updatedAt,
            version: version ? { id: version.id, no: version.version_no, note: version.note } : null,
          };
        }
        if (method === 'DELETE') {
          db.articles = db.articles.filter((x) => x.id !== a.id);
          save(db);
          return { ok: true };
        }
      }

      if (vsub === 'versions') {
        const vid = seg(5);
        if (!vid && method === 'GET') return { versions: a.versions };
        if (!vid && method === 'POST') {
          const v: LVersion = {
            id: uid(), version_no: a.versions.length + 1, title: a.title,
            content_html: a.contentHtml, meta_title: a.metaTitle, meta_description: a.metaDescription,
            note: typeof (body as Record<string, unknown>)?.note === 'string' ? String((body as Record<string, unknown>).note).slice(0, 200) : 'ذخیره دستی',
            score_total: a.lastScore?.score ?? null, created_by: LOCAL_USER.id, created_at: now(),
          };
          a.versions.push(v);
          save(db);
          return { version: v };
        }
        const v = a.versions.find((x) => x.id === vid);
        if (!v) notFound('نسخه یافت نشد');
        if (seg(6) === 'restore' && method === 'POST') {
          a.versions.push({
            id: uid(), version_no: a.versions.length + 1, title: a.title,
            content_html: a.contentHtml, meta_title: a.metaTitle, meta_description: a.metaDescription,
            note: `بازیابی نسخه ${v.version_no}`, score_total: null, created_by: LOCAL_USER.id, created_at: now(),
          });
          a.title = v.title;
          a.contentHtml = v.content_html;
          a.metaTitle = v.meta_title;
          a.metaDescription = v.meta_description;
          a.updatedAt = now();
          save(db);
          return { article: articleJson(a) };
        }
        if (seg(6) === 'diff' && method === 'GET') {
          return { diff: blockDiff(v.content_html, a.contentHtml), baseVersion: v.version_no };
        }
      }

      if (vsub === 'analyze' && method === 'POST') {
        const ws = findWs(db, wsId);
        const result = runAnalyze(db, a, ws.weights_json);
        save(db);
        return result;
      }
      if (vsub === 'audit' && method === 'POST') {
        const ws = findWs(db, wsId);
        const analysis = runAnalyze(db, a, ws.weights_json);
        const siblings = db.articles.filter((x) => x.workspaceId === wsId && x.primaryKeyword);
        const cannibalization = detectCannibalization(siblings.map((x) => ({
          id: x.id, title: x.title, primaryKeyword: x.primaryKeyword,
        })));
        const payload = {
          totalScore: analysis.score,
          grade: analysis.grade,
          report: analysis.report,
          eeat: analysis.eeat,
          cannibalization,
          technical: null,
          passed: analysis.report.criteria.filter((c) => c.status === 'green').length,
          criticalCount: analysis.report.issues.filter((i) => i.priority === 'critical').length,
          highCount: analysis.report.issues.filter((i) => i.priority === 'high').length,
          auditedAt: now(),
        };
        const rep: LReport = { id: uid(), workspaceId: wsId, articleId: a.id, type: 'audit', createdAt: now(), payload };
        db.reports.unshift(rep);
        save(db);
        return { reportId: rep.id, ...payload };
      }
      if (vsub === 'ai' && method === 'POST') unsupported();
    }

    if (sub === 'keywords') {
      const ksub = seg(3);
      if (ksub === 'research' && method === 'POST') {
        const seedKw = String((body as Record<string, unknown>)?.seed ?? '').trim();
        const longTails = expandLongTails(seedKw, 'fa');
        const questions = generateQuestions(seedKw, 'fa');
        const all = [seedKw, ...longTails.map((i) => i.keyword), ...questions.map((i) => i.keyword)];
        return {
          seed: seedKw,
          longTails,
          questions,
          related: [],
          clusters: clusterKeywords(all),
          dataProvenance: {
            volume: 'not_available',
            difficulty: 'heuristic_estimate',
            note: 'حالت محلی: گسترش قاعده‌محور فارسی. حجم جست‌وجو و SERP واقعی به Backend با کلید سرویس داده نیاز دارد.',
          },
        };
      }
      if (ksub === 'cannibalization' && method === 'GET') {
        const siblings = db.articles.filter((x) => x.workspaceId === wsId && x.primaryKeyword);
        return detectCannibalization(siblings.map((x) => ({ id: x.id, title: x.title, primaryKeyword: x.primaryKeyword })));
      }
      if (ksub === 'mapping' && method === 'POST') {
        const keywords = ((body as Record<string, unknown>)?.keywords ?? []) as string[];
        const siblings = db.articles.filter((x) => x.workspaceId === wsId && x.primaryKeyword);
        return buildKeywordMapping(keywords, siblings.map((x) => ({ id: x.id, title: x.title, primaryKeyword: x.primaryKeyword })));
      }
      if (ksub === 'serp') {
        if (method === 'GET') return { configured: false, provider: 'none', howToEnable: 'در حالت محلی در دسترس نیست — Backend + کلید سرویس لازم است.' };
        unsupported();
      }
    }

    if (sub === 'competitors' && method === 'POST') unsupported();
    if (sub === 'technical' && method === 'POST') unsupported();

    if (sub === 'briefs') {
      const briefId = seg(3);
      if (!briefId && method === 'GET') {
        return { briefs: db.briefs.filter((b) => b.workspaceId === wsId).map(({ workspaceId, ...b }) => b) };
      }
      if (!briefId && method === 'POST') {
        const keyword = String((body as Record<string, unknown>)?.keyword ?? '').trim();
        const brief = generateRuleBrief(keyword, [], false);
        brief.sources.push('حالت محلی — بدون داده رقیب');
        const row: LBrief = { id: uid(), workspaceId: wsId, keyword, status: 'draft', createdAt: now(), data: brief as unknown as Record<string, unknown> };
        db.briefs.unshift(row);
        save(db);
        return { brief: { id: row.id, keyword: row.keyword, status: row.status, createdAt: row.createdAt, data: row.data } };
      }
      const b = db.briefs.find((x) => x.id === briefId && x.workspaceId === wsId);
      if (!b) notFound('بریف یافت نشد');
      if (method === 'PATCH') {
        const patch = (body ?? {}) as Record<string, unknown>;
        if (patch.data && typeof patch.data === 'object') b.data = patch.data as Record<string, unknown>;
        if (patch.status === 'draft' || patch.status === 'approved') b.status = patch.status;
        save(db);
        return { brief: { id: b.id, keyword: b.keyword, status: b.status, createdAt: b.createdAt, data: b.data } };
      }
    }

    if (sub === 'reports' && method === 'GET') {
      const type = new URLSearchParams(path.split('?')[1] ?? '').get('type');
      let rows = db.reports.filter((r) => r.workspaceId === wsId);
      if (type) rows = rows.filter((r) => r.type === type);
      return { reports: rows.map(({ workspaceId, ...r }) => r) };
    }

    if (sub === 'activity' && method === 'GET') {
      return { activity: [], note: 'حالت محلی: ثبت فعالیت غیرفعال است.' };
    }

    if (sub === 'settings') {
      const ssub = seg(3);
      if (method === 'GET') {
        if (ssub === 'ai') return { configured: false, provider: 'none', model: null, maskedKey: null, source: 'local' };
        return { connectionType: 'none', siteUrl: '', username: '', webhookUrl: '', hasPassword: false, hasApiKey: false, hasWebhookSecret: false };
      }
      unsupported();
    }

    if (sub === 'members' && method === 'GET') {
      return { members: [{ id: LOCAL_USER.id, email: LOCAL_USER.email, name: LOCAL_USER.name, role: 'owner' }] };
    }
  }

  return notFound(`مسیر «${method} ${path}» در حالت محلی پشتیبانی نمی‌شود`);
}

/** Reset all local data (danger zone). */
export function resetLocalDb() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem('danesh_ws');
}
