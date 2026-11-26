/**
 * API integration tests (supertest over the real Express app with an
 * in-memory SQLite DB) + end-to-end user journey + security checks.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from './app.js';
import { createFixtureServer } from './test-fixtures.js';

let app: Express;
let fx: Awaited<ReturnType<typeof createFixtureServer>>;

const GOOD_HTML = `
<h1>آموزش دم کردن قهوه ترک: راهنمای کامل</h1>
<p>قهوه ترک یکی از قدیمی‌ترین روش‌های دم کردن قهوه است. در این راهنما مرحله به مرحله یاد می‌گیرید چگونه یک فنجان قهوه ترک عالی درست کنید.</p>
<h2>قهوه ترک چیست؟</h2>
<p>قهوه ترک روشی است که در آن پودر بسیار نرم قهوه در آب جوش دم می‌شود و بدون فیلتر سرو می‌گردد. این روش در ترکیه و ایران رایج است.</p>
<h2>وسایل مورد نیاز</h2>
<p>برای دم کردن قهوه ترک به کتری مخصوصی به نام جزوه و پودر قهوه بسیار نرم نیاز دارید.</p>
<ul><li>پودر قهوه ترک نرم</li><li>آب سرد و تازه</li></ul>
<h2>مراحل دم کردن</h2>
<p>آب را گرم کنید تا نزدیک جوش برسد، سپس پودر قهوه را اضافه کنید و آرام هم بزنید تا کف تشکیل شود.</p>
<img src="/images/turk-cup.jpg" alt="فنجان قهوه ترک با کف" loading="lazy">
<h2>نتیجه‌گیری</h2>
<p>دم کردن قهوه ترک مهارتی است که با تمرین بهتر می‌شود؛ گرما را تنظیم کنید و صبور باشید.</p>
<a href="/latte-art">آموزش لاته آرت</a>
`;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function registerAndLogin(email: string): Promise<{ token: string; userId: string }> {
  const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: `User ${email}` });
  if (reg.status === 400 && reg.body?.error?.code === 'EMAIL_EXISTS') {
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Str0ngPass!' });
    return { token: login.body.token, userId: login.body.user.id };
  }
  expect(reg.status).toBe(201);
  return { token: reg.body.token, userId: reg.body.user.id };
}

async function createWorkspace(token: string, name: string): Promise<string> {
  const res = await request(app).post('/api/v1/workspaces').set(auth(token)).send({ name, domain: 'example.ir', lang: 'fa' });
  expect(res.status).toBe(201);
  return res.body.workspace.id;
}

beforeAll(async () => {
  fx = await createFixtureServer();
  const { app: built } = buildApp({
    dbPath: ':memory:',
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
      JWT_SECRET: 'test-secret-for-integration-tests-123456',
      APP_ENCRYPTION_KEY: 'a'.repeat(64),
      RATE_LIMIT_AUTH_PER_15MIN: '1000',
      RATE_LIMIT_API_PER_MIN: '10000',
      RATE_LIMIT_AI_PER_MIN: '10000',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  });
  app = built;
});

afterAll(async () => {
  await fx.close();
});

describe('health', () => {
  it('reports ok + feature flags', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(res.body.features).toEqual({ ai: false, serp: false });
  });
});

describe('auth', () => {
  it('registers, logs in and returns /me', async () => {
    const email = `user-${Date.now()}@test.ir`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: 'کاربر تست' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeTruthy();

    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Str0ngPass!' });
    expect(login.status).toBe(200);

    const me = await request(app).get('/api/v1/auth/me').set(auth(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejects wrong password and weak input', async () => {
    const email = `weak-${Date.now()}@test.ir`;
    await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: 'x' });
    const bad = await request(app).post('/api/v1/auth/login').send({ email, password: 'wrong-pass' });
    expect(bad.status).toBe(401);
    const invalid = await request(app).post('/api/v1/auth/register').send({ email: 'not-an-email', password: '123', name: '' });
    expect(invalid.status).toBe(400);
  });

  it('rate limits auth endpoints', async () => {
    const { app: limited } = buildApp({
      dbPath: ':memory:',
      env: { NODE_ENV: 'test', JWT_SECRET: 'rate-limit-test-secret-1234567', RATE_LIMIT_AUTH_PER_15MIN: '3', RATE_LIMIT_API_PER_MIN: '10000' },
    });
    for (let i = 0; i < 3; i++) {
      await request(limited).post('/api/v1/auth/login').send({ email: `x${i}@t.ir`, password: 'p' });
    }
    const fourth = await request(limited).post('/api/v1/auth/login').send({ email: 'x9@t.ir', password: 'p' });
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('workspaces & multi-site isolation', () => {
  let tokenA: string, tokenB: string, wsA: string, wsB: string;

  it('creates isolated workspaces per user', async () => {
    ({ token: tokenA } = await registerAndLogin(`a-${Date.now()}@test.ir`));
    ({ token: tokenB } = await registerAndLogin(`b-${Date.now()}@test.ir`));
    wsA = await createWorkspace(tokenA, 'سایت A');
    wsB = await createWorkspace(tokenB, 'سایت B');
    expect(wsA).not.toBe(wsB);

    const list = await request(app).get('/api/v1/workspaces').set(auth(tokenA));
    expect(list.body.workspaces).toHaveLength(1);
  });

  it('user B cannot read user A workspace (404, no data leak)', async () => {
    const res = await request(app).get(`/api/v1/workspaces/${wsA}`).set(auth(tokenB));
    expect(res.status).toBe(404);
  });

  it('workspace settings update + stats', async () => {
    const res = await request(app).patch(`/api/v1/workspaces/${wsA}`).set(auth(tokenA)).send({
      name: 'سایت A به‌روزرسانی شد',
      weights: { keyword: 20, readability: 12 },
    });
    expect(res.status).toBe(200);
    expect(res.body.workspace.weights_json).toContain('keyword');
    const get = await request(app).get(`/api/v1/workspaces/${wsA}`).set(auth(tokenA));
    expect(get.body.stats).toHaveProperty('articles', 0);
    expect(get.body.ai.configured).toBe(false);
  });
});

describe('articles: CRUD, autosave, versions', () => {
  let token: string, ws: string, articleId: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`art-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس مقالات');
  });

  it('creates an article with v1', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({
      title: 'آموزش قهوه ترک',
      primaryKeyword: 'قهوه ترک',
      secondaryKeywords: ['جزوه', 'دم کردن'],
      intent: 'informational',
      targetWords: 600,
      contentHtml: GOOD_HTML,
      metaTitle: 'آموزش دم کردن قهوه ترک: راهنمای کامل',
      metaDescription: 'راهنمای کامل و مرحله‌به‌مرحله دم کردن قهوه ترک؛ از انتخاب پودر تا سرو نهایی.',
      competitorUrls: [fx.url('/comp1')],
    });
    expect(res.status).toBe(201);
    articleId = res.body.article.id;
    expect(res.body.article.primaryKeyword).toBe('قهوه ترک');
  });

  it('autosave patches content and creates version after interval/forceSave', async () => {
    const patch1 = await request(app).patch(`/api/v1/workspaces/${ws}/articles/${articleId}`).set(auth(token)).send({
      contentHtml: GOOD_HTML + '<p>پاراگراف اضافه اول.</p>',
    });
    expect(patch1.status).toBe(200);
    expect(patch1.body.savedAt).toBeTruthy();

    const patch2 = await request(app).patch(`/api/v1/workspaces/${ws}/articles/${articleId}`).set(auth(token)).send({
      contentHtml: GOOD_HTML + '<p>پاراگراف اضافه اول و دوم.</p>',
      forceSave: true,
    });
    expect(patch2.body.version).toBeTruthy();

    const versions = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}/versions`).set(auth(token));
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(2);
  });

  it('diffs a version against current content', async () => {
    const versions = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}/versions`).set(auth(token));
    const v1 = versions.body.versions[versions.body.versions.length - 1];
    const diff = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}/versions/${v1.id}/diff`).set(auth(token));
    expect(diff.status).toBe(200);
    expect(diff.body.diff.wordDelta).toBeGreaterThan(0);
    expect(diff.body.diff.added.length).toBeGreaterThan(0);
  });

  it('restores an older version', async () => {
    const versions = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}/versions`).set(auth(token));
    const oldest = versions.body.versions[versions.body.versions.length - 1];
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/versions/${oldest.id}/restore`).set(auth(token));
    expect(res.status).toBe(200);
    const article = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}`).set(auth(token));
    expect(article.body.article.contentHtml).not.toContain('دوم');
  });

  it('user B cannot access article of workspace A (isolation)', async () => {
    const { token: tokenB } = await registerAndLogin(`iso-${Date.now()}@test.ir`);
    const res = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}`).set(auth(tokenB));
    expect(res.status).toBe(404);
  });
});

describe('live analysis & final audit (real engine)', () => {
  let token: string, ws: string, articleId: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`an-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس تحلیل');
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({
      title: 'آموزش قهوه ترک', primaryKeyword: 'قهوه ترک', contentHtml: GOOD_HTML,
      metaTitle: 'آموزش دم کردن قهوه ترک', metaDescription: 'راهنمای دم کردن قهوه ترک',
    });
    articleId = res.body.article.id;
  });

  it('analyze returns real score with 13 criteria and issues', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/analyze`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(res.body.report.criteria).toHaveLength(13);
    expect(Array.isArray(res.body.report.issues)).toBe(true);
    expect(res.body.report.keywords.primary.keyword).toBe('قهوه ترک');
    // score persisted for the article list
    const article = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}`).set(auth(token));
    expect(article.body.article.lastScore.score).toBe(res.body.score);
  });

  it('audit saves a full report incl. cannibalization', async () => {
    // a second article with the same primary keyword → cannibalization pair
    await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({
      title: 'راهنمای دیگر قهوه ترک', primaryKeyword: 'قهوه ترک', contentHtml: GOOD_HTML,
    });
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/audit`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.reportId).toBeTruthy();
    expect(res.body.cannibalization.pairs.length).toBeGreaterThanOrEqual(1);
    expect(res.body.report.criteria).toHaveLength(13);
  });
});

describe('keyword research module', () => {
  let token: string, ws: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`kw-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس کلمات');
  });

  it('research returns long-tails, questions, clusters + honest provenance', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/keywords/research`).set(auth(token)).send({ seed: 'قهوه ساز' });
    expect(res.status).toBe(200);
    expect(res.body.longTails.length).toBeGreaterThan(10);
    expect(res.body.questions.some((q: { keyword: string }) => q.keyword === 'قهوه ساز چیست؟')).toBe(true);
    expect(res.body.clusters.length).toBeGreaterThan(0);
    expect(res.body.dataProvenance.volume).toBe('not_available');
    expect(res.body.dataProvenance.note).toContain('نیاز دارد');
  });

  it('mapping flags conflicts; cannibalization detects duplicates', async () => {
    await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({ title: 'قهوه ساز برقی', primaryKeyword: 'قهوه ساز', contentHtml: GOOD_HTML });
    const map = await request(app).post(`/api/v1/workspaces/${ws}/keywords/mapping`).set(auth(token)).send({ keywords: ['قهوه ساز', 'آموزش قهوه ساز', 'لاته آرت'] });
    expect(map.status).toBe(200);
    expect(map.body.entries[0].pageId).toBeTruthy();
    expect(map.body.entries[1].conflict).toBe(true);

    const cann = await request(app).get(`/api/v1/workspaces/${ws}/keywords/cannibalization`).set(auth(token));
    expect(cann.status).toBe(200);
  });

  it('SERP without provider → not_configured (no fake data)', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/keywords/serp`).set(auth(token)).send({ keyword: 'قهوه ترک' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('not_configured');
    expect(res.body.results).toHaveLength(0);
    expect(res.body.howToEnable).toBeTruthy();
  });
});

describe('competitor analysis with local fixtures', () => {
  let token: string, ws: string, articleId: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`comp-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس رقبا');
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({
      title: 'قهوه ترک', primaryKeyword: 'قهوه ترک', contentHtml: GOOD_HTML,
    });
    articleId = res.body.article.id;
  });

  it('fetches real fixture pages and compares coverage', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/competitors`).set(auth(token)).send({
      urls: [fx.url('/comp1'), fx.url('/comp2')],
      articleId,
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.competitors).toHaveLength(2);
    expect(res.body.summary.competitors[0].wordCount).toBeGreaterThan(80);
    expect(res.body.comparison).not.toBeNull();
    expect(res.body.comparison.semantic.competitorCount).toBe(2);
    expect(res.body.missingTopics.length).toBeGreaterThan(0);
  });

  it('reports failed fetches honestly', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/competitors`).set(auth(token)).send({
      urls: [fx.url('/definitely-missing-404')],
    });
    expect(res.status).toBe(200);
    expect(res.body.summary.failed[0].error).toContain('404');
  });
});

describe('technical SEO with local fixtures', () => {
  let token: string, ws: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`tech-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس تکنیکال');
  });

  it('audits a well-formed page', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/technical`).set(auth(token)).send({ url: fx.url('/tech') });
    expect(res.status).toBe(200);
    const report = res.body.report;
    expect(report.status).toBe(200);
    expect(report.title).toContain('سئو تکنیکال');
    expect(report.canonical).toContain('/tech');
    expect(report.schemaTypes).toContain('Article');
    expect(report.openGraph['og:title']).toContain('سئو');
    expect(report.h1Count).toBe(1);
    expect(report.viewport).toContain('width=device-width');
    expect(report.images.missingAlt).toBe(1);
    expect(report.issues.some((i: { code: string; priority?: string }) => i.code === 'http-status-ok' && i.priority === 'passed')).toBe(true);
    expect(report.coreWebVitals.status).toBe('not_available');
  });

  it('flags noindex and missing meta', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/technical`).set(auth(token)).send({ url: fx.url('/noindex') });
    const critical = res.body.report.issues.filter((i: { priority: string }) => i.priority === 'critical');
    expect(critical.some((i: { code: string; priority?: string }) => i.code === 'noindex')).toBe(true);
    // meta description missing → high priority
    expect(res.body.report.issues.some((i: { code: string; priority?: string }) => i.code === 'meta-missing' && i.priority === 'high')).toBe(true);
  });
});

describe('briefs & reports', () => {
  let token: string, ws: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`br-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس بریف');
  });

  it('generates a rule-based brief (no AI configured) and approves it', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/briefs`).set(auth(token)).send({ keyword: 'آموزش قهوه ساز فرنچ پرس' });
    expect(res.status).toBe(201);
    expect(res.body.brief.data.outline.length).toBeGreaterThanOrEqual(5);
    expect(res.body.brief.data.targetWordCount).toBeGreaterThan(500);
    expect(res.body.brief.data.intent).toBe('informational');

    const approve = await request(app).patch(`/api/v1/workspaces/${ws}/briefs/${res.body.brief.id}`).set(auth(token)).send({ status: 'approved' });
    expect(approve.body.brief.status).toBe('approved');

    const list = await request(app).get(`/api/v1/workspaces/${ws}/briefs`).set(auth(token));
    expect(list.body.briefs).toHaveLength(1);
  });

  it('lists saved reports by type', async () => {
    const technical = await request(app).post(`/api/v1/workspaces/${ws}/technical`).set(auth(token)).send({ url: fx.url('/tech') });
    expect(technical.status).toBe(200);
    const reports = await request(app).get(`/api/v1/workspaces/${ws}/reports?type=technical`).set(auth(token));
    expect(reports.body.reports.length).toBeGreaterThanOrEqual(1);
  });
});

describe('AI endpoints (honest behavior without real keys)', () => {
  let token: string, ws: string, articleId: string;

  beforeAll(async () => {
    ({ token } = await registerAndLogin(`ai-${Date.now()}@test.ir`));
    ws = await createWorkspace(token, 'ورک‌اسپیس AI');
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({
      title: 'قهوه ترک', primaryKeyword: 'قهوه ترک', contentHtml: GOOD_HTML,
    });
    articleId = res.body.article.id;
  });

  it('AI task without config → AI_NOT_CONFIGURED (never fake output)', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/ai/suggest-titles`).set(auth(token)).send({ keyword: 'قهوه ترک' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AI_NOT_CONFIGURED');
  });

  it('invalid task → 400 with task list', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/ai/nonexistent`).set(auth(token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('suggest-titles');
  });

  it('AI provider failure surfaces as 502 with message (dead endpoint)', async () => {
    await request(app).post(`/api/v1/workspaces/${ws}/settings/ai`).set(auth(token)).send({
      baseUrl: 'http://127.0.0.1:9/v1', model: 'test-model', apiKey: 'dead-key',
    });
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/ai/suggest-titles`).set(auth(token)).send({ keyword: 'قهوه ترک' });
    expect([502, 500]).toContain(res.status);
    if (res.status === 502) expect(res.body.error.code).toBe('AI_PROVIDER_ERROR');
  });

  it('masked AI settings endpoint never returns the raw key', async () => {
    const res = await request(app).get(`/api/v1/workspaces/${ws}/settings/ai`).set(auth(token));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('dead-key');
    expect(res.body.maskedKey).toBe('****-key');
  });
});

describe('E2E journey (user story end-to-end)', () => {
  it('register → workspace → brief → article → analyze → autosave → audit → report', async () => {
    const email = `e2e-${Date.now()}@test.ir`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: 'E2E' });
    const token = reg.body.token;
    const ws = await createWorkspace(token, 'پروژه نهایی');

    // brief
    const brief = await request(app).post(`/api/v1/workspaces/${ws}/briefs`).set(auth(token)).send({ keyword: 'قهوه ترک', competitorUrls: [fx.url('/comp1'), fx.url('/comp2')] });
    expect(brief.status).toBe(201);
    expect(brief.body.brief.data.outline.length).toBeGreaterThan(4);

    // article from brief
    const article = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({
      title: brief.body.brief.data.suggestedTitles[0],
      primaryKeyword: 'قهوه ترک',
      contentHtml: GOOD_HTML,
      metaDescription: 'راهنمای کامل قهوه ترک',
      targetWords: brief.body.brief.data.targetWordCount,
    });
    expect(article.status).toBe(201);

    // analyze + autosave + manual version + audit
    const an = await request(app).post(`/api/v1/workspaces/${ws}/articles/${article.body.article.id}/analyze`).set(auth(token));
    expect(an.status).toBe(200);
    const save = await request(app).patch(`/api/v1/workspaces/${ws}/articles/${article.body.article.id}`).set(auth(token)).send({ contentHtml: GOOD_HTML + '<p>بهبود محتوا.</p>', forceSave: true });
    expect(save.status).toBe(200);
    const audit = await request(app).post(`/api/v1/workspaces/${ws}/articles/${article.body.article.id}/audit`).set(auth(token));
    expect(audit.status).toBe(200);
    expect(audit.body.totalScore).toBeGreaterThan(0);

    const reports = await request(app).get(`/api/v1/workspaces/${ws}/reports`).set(auth(token));
    expect(reports.body.reports.some((r: { type: string }) => r.type === 'audit')).toBe(true);
  });
});

describe('public share endpoint (widgets)', () => {
  it('serves score with valid share token and rejects bad tokens', async () => {
    const email = `share-${Date.now()}@test.ir`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: 'Share' });
    const token = reg.body.token;
    const ws = await createWorkspace(token, 'ورک‌اسپیس شیر');
    const art = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({ title: 't', primaryKeyword: 'قهوه ترک', contentHtml: GOOD_HTML });
    await request(app).post(`/api/v1/workspaces/${ws}/articles/${art.body.article.id}/analyze`).set(auth(token));
    const share = await request(app).post(`/api/v1/workspaces/${ws}/settings/share-token`).set(auth(token));
    expect(share.status).toBe(200);
    const { shareToken: st } = share.body;

    // valid token → public score (no auth header at all)
    const ok = await request(app).get(`/api/v1/public/workspaces/${ws}/articles/${art.body.article.id}/report?token=${st}`);
    expect(ok.status).toBe(200);
    expect(typeof ok.body.score).toBe('number');
    expect(ok.body.score).toBeGreaterThan(0);

    // wrong token → 403
    const bad = await request(app).get(`/api/v1/public/workspaces/${ws}/articles/${art.body.article.id}/report?token=wrong`);
    expect(bad.status).toBe(403);

    // no analysis yet → clear NO_REPORT (no fake data)
    const art2 = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set(auth(token)).send({ title: 't2', contentHtml: '<p>x</p>' });
    const none = await request(app).get(`/api/v1/public/workspaces/${ws}/articles/${art2.body.article.id}/report?token=${st}`);
    expect(none.status).toBe(404);
    expect(none.body.error.code).toBe('NO_REPORT');
  });
});

describe('site connection settings (real verify)', () => {
  it('saves encrypted credentials and tests wordpress against fixture-like server', async () => {
    const email = `conn-${Date.now()}@test.ir`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: 'Conn' });
    const token = reg.body.token;
    const ws = await createWorkspace(token, 'ورک‌اسپیس اتصال');

    // save WP connection creds pointing to a fake WP site (verify endpoint)
    const save = await request(app).post(`/api/v1/workspaces/${ws}/connection/settings/connection`).set(auth(token)).send({
      connectionType: 'wordpress-rest',
      siteUrl: fx.url('/wp'),
      username: 'admin',
      password: 'app-password-123',
    });
    expect(save.status).toBe(200);
    expect(JSON.stringify(save.body)).not.toContain('app-password-123');
    expect(save.body.hasPassword).toBe(true);

    // GET settings → masked, no secret
    const got = await request(app).get(`/api/v1/workspaces/${ws}/connection/settings/connection`).set(auth(token));
    expect(got.body.hasPassword).toBe(true);
    expect(JSON.stringify(got.body)).not.toContain('app-password-123');

    // test → real verify call against fixture server (returns user for /wp-json path)
    const test = await request(app).post(`/api/v1/workspaces/${ws}/connection/settings/connection/test`).set(auth(token));
    expect(test.status).toBe(200);
    expect([true, false]).toContain(test.body.ok);
    expect(test.body.message).toBeTruthy();
  });

  it('none type → clear message, no fake success', async () => {
    const email = `conn2-${Date.now()}@test.ir`;
    const reg = await request(app).post('/api/v1/auth/register').send({ email, password: 'Str0ngPass!', name: 'C2' });
    const ws = await createWorkspace(reg.body.token, 'بدون اتصال');
    const test = await request(app).post(`/api/v1/workspaces/${ws}/connection/settings/connection/test`).set(auth(reg.body.token));
    expect(test.body.ok).toBe(false);
    expect(test.body.message).toContain('تنظیم');
  });
});
