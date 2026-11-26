/**
 * E2E — full user journey against the real app (in-memory DB).
 * Covers the primary product story from registration to final audit.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp } from '../../apps/api/src/app.js';
import { createFixtureServer } from '../../apps/api/src/test-fixtures.js';

let app: Express;
let fx: Awaited<ReturnType<typeof createFixtureServer>>;
let token = '';
let ws = '';
let articleId = '';

const ARTICLE = `
<h1>آموزش دم کردن قهوه ترک: راهنمای کامل</h1>
<p>قهوه ترک یکی از قدیمی‌ترین روش‌های دم کردن قهوه است. در این راهنما مرحله به مرحله یاد می‌گیرید چگونه یک فنجان قهوه ترک عالی درست کنید.</p>
<h2>قهوه ترک چیست؟</h2>
<p>قهوه ترک روشی است که پودر بسیار نرم قهوه در آب جوش دم می‌شود و بدون فیلتر سرو می‌گردد.</p>
<h2>وسایل مورد نیاز</h2>
<p>به کتری مخصوصی به نام جزوه و پودر قهوه بسیار نرم نیاز دارید.</p>
<h2>مراحل دم کردن</h2>
<p>آب را گرم کنید، پودر را اضافه کنید و آرام هم بزنید تا کف تشکیل شود.</p>
<img src="/c.jpg" alt="فنجان قهوه ترک" loading="lazy">
<h2>نتیجه‌گیری</h2>
<p>با تمرین و تنظیم گرما، هر بار فنجانی با کف کامل خواهید داشت.</p>
<a href="/latte">لاته آرت</a>
`;

beforeAll(async () => {
  fx = await createFixtureServer();
  const { app: built } = buildApp({
    dbPath: ':memory:',
    env: { NODE_ENV: 'test', JWT_SECRET: 'e2e-secret-key-1234567890123', RATE_LIMIT_AUTH_PER_15MIN: '1000', RATE_LIMIT_API_PER_MIN: '10000' },
  });
  app = built;
});

afterAll(async () => { await fx.close(); });

describe('E2E: full journey', () => {
  it('step 1 — register + login', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ email: `journey-${Date.now()}@test.ir`, password: 'Str0ngPass!', name: 'سفر کامل' });
    expect(reg.status).toBe(201);
    token = reg.body.token;
    const login = await request(app).post('/api/v1/auth/login').send({ email: reg.body.user.email, password: 'Str0ngPass!' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
  });

  it('step 2 — create workspace (site)', async () => {
    const res = await request(app).post('/api/v1/workspaces').set('Authorization', `Bearer ${token}`).send({ name: 'سایت قهوه', domain: 'coffee.ir', lang: 'fa', cms: 'wordpress' });
    expect(res.status).toBe(201);
    ws = res.body.workspace.id;
  });

  it('step 3 — keyword research gives real rule-based data + honest provenance', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/keywords/research`).set('Authorization', `Bearer ${token}`).send({ seed: 'قهوه ترک' });
    expect(res.status).toBe(200);
    expect(res.body.longTails.length).toBeGreaterThan(15);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(10);
    expect(res.body.dataProvenance.difficulty).toBe('heuristic_estimate');
  });

  it('step 4 — generate brief with real competitor fetch', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/briefs`).set('Authorization', `Bearer ${token}`).send({
      keyword: 'قهوه ترک',
      competitorUrls: [fx.url('/comp1'), fx.url('/comp2')],
    });
    expect(res.status).toBe(201);
    const brief = res.body.brief;
    expect(brief.data.sources.some((s: string) => s.includes('رقیب'))).toBe(true);
    const approve = await request(app).patch(`/api/v1/workspaces/${ws}/briefs/${brief.id}`).set('Authorization', `Bearer ${token}`).send({ status: 'approved' });
    expect(approve.body.brief.status).toBe('approved');
  });

  it('step 5 — create article from brief scope', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles`).set('Authorization', `Bearer ${token}`).send({
      title: 'آموزش دم کردن قهوه ترک: راهنمای کامل',
      primaryKeyword: 'قهوه ترک',
      secondaryKeywords: ['جزوه', 'دم کردن'],
      intent: 'informational',
      targetWords: 700,
      contentHtml: ARTICLE,
      metaTitle: 'آموزش دم کردن قهوه ترک: راهنمای کامل',
      metaDescription: 'راهنمای کامل و مرحله‌به‌مرحله دم کردن قهوه ترک؛ از انتخاب پودر تا سرو نهایی.',
      competitorUrls: [fx.url('/comp1')],
    });
    expect(res.status).toBe(201);
    articleId = res.body.article.id;
  });

  it('step 6 — live analysis produces real 13-criteria score', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/analyze`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.report.criteria).toHaveLength(13);
    expect(res.body.score).toBeGreaterThan(0);
    // real keyword stats
    expect(res.body.report.keywords.primary.occurrences).toBeGreaterThan(2);
  });

  it('step 7 — autosave + manual save + versions + diff + restore', async () => {
    // forceSave simulates Ctrl+S — an explicit version is created immediately
    const auto = await request(app).patch(`/api/v1/workspaces/${ws}/articles/${articleId}`).set('Authorization', `Bearer ${token}`).send({ contentHtml: ARTICLE + '<p>پاراگراف جدید.</p>', forceSave: true });
    expect(auto.status).toBe(200);
    expect(auto.body.version).toBeTruthy();
    const manual = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/versions`).set('Authorization', `Bearer ${token}`).send({ note: 'قبل از انتشار' });
    expect(manual.status).toBe(201);
    const versions = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}/versions`).set('Authorization', `Bearer ${token}`);
    expect(versions.body.versions.length).toBeGreaterThanOrEqual(3);
    const v = versions.body.versions[0];
    const diff = await request(app).get(`/api/v1/workspaces/${ws}/articles/${articleId}/versions/${v.id}/diff`).set('Authorization', `Bearer ${token}`);
    expect(diff.body.diff.wordDelta).toBeLessThanOrEqual(0); // current has one more para → negative from v to current
    const restore = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/versions/${v.id}/restore`).set('Authorization', `Bearer ${token}`);
    expect(restore.status).toBe(200);
  });

  it('step 8 — final audit saves report with everything', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/articles/${articleId}/audit`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalScore).toBeGreaterThan(0);
    expect(res.body.cannibalization.checked).toBeGreaterThanOrEqual(1);
    const reports = await request(app).get(`/api/v1/workspaces/${ws}/reports?type=audit`).set('Authorization', `Bearer ${token}`);
    expect(reports.body.reports.length).toBeGreaterThanOrEqual(1);
  });

  it('step 9 — technical audit of a fixture page', async () => {
    const res = await request(app).post(`/api/v1/workspaces/${ws}/technical`).set('Authorization', `Bearer ${token}`).send({ url: fx.url('/tech') });
    expect(res.status).toBe(200);
    expect(res.body.report.schemaTypes).toContain('Article');
  });

  it('step 10 — share token + public widget endpoint', async () => {
    const share = await request(app).post(`/api/v1/workspaces/${ws}/settings/share-token`).set('Authorization', `Bearer ${token}`);
    const pub = await request(app).get(`/api/v1/public/workspaces/${ws}/articles/${articleId}/report?token=${share.body.shareToken}`);
    expect(pub.status).toBe(200);
    expect(typeof pub.body.score).toBe('number');
  });
});
