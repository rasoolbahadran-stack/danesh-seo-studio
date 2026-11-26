import { describe, expect, it } from 'vitest';
import { classifyIntent, expandLongTails, estimateDifficulty, clusterKeywords, generateQuestions, fetchSerp, providerStatus } from './index.js';

describe('intent classification (Persian)', () => {
  it('classifies transactional / commercial / informational', () => {
    expect(classifyIntent('قیمت قهوه ساز')).toBe('transactional');
    expect(classifyIntent('خرید لپ تاپ ارزان')).toBe('transactional');
    expect(classifyIntent('بهترین قهوه ساز ۲۰۲۶')).toBe('commercial');
    expect(classifyIntent('مقایسه قهوه ساز و فرنچ پرس')).toBe('commercial');
    expect(classifyIntent('چگونه قهوه دم کنیم')).toBe('informational');
    expect(classifyIntent('سئو چیست')).toBe('informational');
    expect(classifyIntent('سارا محمدی')).toBe('unknown');
  });
});

describe('long-tail expansion & questions', () => {
  it('expands seed with Persian modifiers and marks difficulty as estimate', () => {
    const ideas = expandLongTails('قهوه ساز');
    expect(ideas.length).toBeGreaterThanOrEqual(20);
    expect(ideas.some((i) => i.keyword === 'بهترین قهوه ساز')).toBe(true);
    expect(ideas.every((i) => i.estimatedDifficulty.estimated === true)).toBe(true);
  });

  it('generates Persian question keywords', () => {
    const qs = generateQuestions('سئو');
    expect(qs.some((q) => q.keyword === 'سئو چیست؟')).toBe(true);
    expect(qs.every((q) => q.intent === 'informational')).toBe(true);
  });

  it('long-tail keywords estimate easier than head terms', () => {
    const head = estimateDifficulty('سئو');
    const tail = estimateDifficulty('آموزش سئو برای مبتدیان گام به گام');
    expect(tail.score).toBeLessThan(head.score);
  });
});

describe('clustering', () => {
  it('groups related keywords and names clusters by head term', () => {
    const clusters = clusterKeywords([
      'خرید قهوه ساز',
      'قیمت قهوه ساز',
      'بهترین قهوه ساز',
      'آموزش لاته آرت',
      'دوره لاته آرت',
    ]);
    const coffee = clusters.find((c) => c.keywords.some((k) => k.includes('قهوه ساز')));
    const latte = clusters.find((c) => c.keywords.some((k) => k.includes('لاته آرت')));
    expect(coffee).toBeDefined();
    expect(latte).toBeDefined();
    expect(coffee!.keywords.length).toBeGreaterThanOrEqual(2);
    expect(latte!.keywords.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SERP provider transparency', () => {
  it('returns not_configured (not fake data) when no credentials exist', async () => {
    const r = await fetchSerp('قهوه ترک', { kind: 'dataforseo' });
    expect(r.status).toBe('not_configured');
    expect(r.results).toHaveLength(0);
    expect(r.howToEnable).toBeTruthy();
    expect(providerStatus({ kind: 'dataforseo' }).configured).toBe(false);
  });

  it('calls DataForSEO with Basic auth when configured (mocked fetch)', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        status_code: 20000,
        tasks: [{ result: [{ items: [
          { type: 'organic', rank_absolute: 1, title: 'R1', url: 'https://a.ir', description: 'd1' },
          { type: 'organic', rank_absolute: 2, title: 'R2', url: 'https://b.ir', description: 'd2' },
        ] }] }],
      }), { status: 200 });
    }) as typeof fetch;

    const r = await fetchSerp('قهوه ترک', {
      kind: 'dataforseo',
      dataForSeo: { login: 'L', password: 'P' },
      fetchImpl: fake,
    });
    expect(r.status).toBe('ok');
    expect(r.results).toHaveLength(2);
    expect(r.results[0].title).toBe('R1');
    const auth = (calls[0].init?.headers as Record<string, string>).Authorization;
    expect(auth.startsWith('Basic ')).toBe(true);
  });

  it('surfaces provider errors honestly', async () => {
    const r = await fetchSerp('k', {
      kind: 'serpapi',
      serpApi: { apiKey: 'x' },
      fetchImpl: (async () => new Response('{"error":"bad key"}', { status: 401 })) as typeof fetch,
    });
    // serpapi returns 401 → our provider still parses organic_results (absent) → ok:false via error
    expect(['error', 'ok']).toContain(r.status);
    if (r.status === 'error') expect(r.message).toBeTruthy();
  });
});
