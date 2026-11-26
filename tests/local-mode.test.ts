/**
 * Local (no-server) mode tests — the dashboard's in-browser data layer.
 * Runs the SAME pure engine packages the server uses, against a localStorage shim.
 */
import { beforeEach, describe, expect, it } from 'vitest';

const store = new Map<string, string>();
const shim = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
(globalThis as { localStorage?: unknown }).localStorage = shim;

describe('local mode (بدون سرور)', () => {
  beforeEach(() => store.clear());

  it('seeds starter workspace «سایت من» + clearly-labeled sample article on first run', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const me = handleLocal('GET', '/auth/me') as { user: { name: string; role: string } };
    expect(me.user.name).toBe('رسول بهادران');
    expect(me.user.role).toBe('admin');

    const list = handleLocal('GET', '/workspaces') as { workspaces: { id: string; name: string }[] };
    expect(list.workspaces).toHaveLength(1);
    expect(list.workspaces[0].name).toBe('سایت من');

    const arts = handleLocal('GET', `/workspaces/${list.workspaces[0].id}/articles`) as { articles: { id: string; title: string }[] };
    expect(arts.articles).toHaveLength(1);
    expect(arts.articles[0].title).toContain('نمونه');
    expect(arts.articles[0].title).toContain('قابل حذف');
  });

  it('analyze runs the real engine in the browser and persists the score', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const ws = (handleLocal('GET', '/workspaces') as { workspaces: { id: string }[] }).workspaces[0].id;
    const arts = (handleLocal('GET', `/workspaces/${ws}/articles`) as { articles: { id: string }[] }).articles;
    const res = handleLocal('POST', `/workspaces/${ws}/articles/${arts[0].id}/analyze`) as {
      score: number; grade: string; report: { criteria: unknown[]; keywords: { primary: { keyword: string } } }; eeat: { indicators: unknown[] };
    };
    expect(res.score).toBeGreaterThan(0);
    expect(res.report.criteria).toHaveLength(13);
    expect(res.report.keywords.primary.keyword).toBe('قهوه ترک');
    expect(res.eeat.indicators.length).toBeGreaterThan(0);

    const after = handleLocal('GET', `/workspaces/${ws}/articles/${arts[0].id}`) as { article: { lastScore: { score: number } } };
    expect(after.article.lastScore.score).toBe(res.score);
  });

  it('briefs generate locally (rule-based) and can be approved', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const ws = (handleLocal('GET', '/workspaces') as { workspaces: { id: string }[] }).workspaces[0].id;
    const created = handleLocal('POST', `/workspaces/${ws}/briefs`, { keyword: 'آموزش سئو' }) as {
      brief: { id: string; status: string; data: { outline: unknown[]; targetWordCount: number; intent: string } };
    };
    expect(created.brief.status).toBe('draft');
    expect(created.brief.data.outline.length).toBeGreaterThanOrEqual(5);
    expect(created.brief.data.targetWordCount).toBeGreaterThan(500);
    const approved = handleLocal('PATCH', `/workspaces/${ws}/briefs/${created.brief.id}`, { status: 'approved' }) as { brief: { status: string } };
    expect(approved.brief.status).toBe('approved');
  });

  it('keyword research + mapping + cannibalization work locally', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const ws = (handleLocal('GET', '/workspaces') as { workspaces: { id: string }[] }).workspaces[0].id;
    const research = handleLocal('POST', `/workspaces/${ws}/keywords/research`, { seed: 'قهوه ساز' }) as {
      longTails: unknown[]; questions: unknown[]; clusters: unknown[]; dataProvenance: { note: string };
    };
    expect(research.longTails.length).toBeGreaterThan(15);
    expect(research.dataProvenance.note).toContain('محلی');
    const cann = handleLocal('GET', `/workspaces/${ws}/keywords/cannibalization`) as { checked: number };
    expect(cann.checked).toBeGreaterThanOrEqual(1);
    const mapping = handleLocal('POST', `/workspaces/${ws}/keywords/mapping`, { keywords: ['قهوه ترک'] }) as { entries: { pageId: string | null }[] };
    expect(mapping.entries[0].pageId).toBeTruthy();
  });

  it('autosave + forceSave versions + restore + diff work locally', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const ws = (handleLocal('GET', '/workspaces') as { workspaces: { id: string }[] }).workspaces[0].id;
    const arts = (handleLocal('GET', `/workspaces/${ws}/articles`) as { articles: { id: string }[] }).articles;
    const patch = handleLocal('PATCH', `/workspaces/${ws}/articles/${arts[0].id}`, { contentHtml: '<p>تغییر تستی.</p>', forceSave: true }) as { version: { no: number } | null };
    expect(patch.version).toBeTruthy();
    const versions = handleLocal('GET', `/workspaces/${ws}/articles/${arts[0].id}/versions`) as { versions: { id: string; version_no: number }[] };
    expect(versions.versions.length).toBeGreaterThanOrEqual(2);
    const v = versions.versions[versions.versions.length - 1];
    const diff = handleLocal('GET', `/workspaces/${ws}/articles/${arts[0].id}/versions/${v.id}/diff`) as { diff: { wordDelta: number } };
    expect(diff.diff.wordDelta).toBeLessThanOrEqual(0);
    const restored = handleLocal('POST', `/workspaces/${ws}/articles/${arts[0].id}/versions/${v.id}/restore`) as { article: { title: string } };
    expect(restored.article.title).toBeTruthy();
  });

  it('final audit saves a report locally (incl. cannibalization)', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const ws = (handleLocal('GET', '/workspaces') as { workspaces: { id: string }[] }).workspaces[0].id;
    const arts = (handleLocal('GET', `/workspaces/${ws}/articles`) as { articles: { id: string }[] }).articles;
    const audit = handleLocal('POST', `/workspaces/${ws}/articles/${arts[0].id}/audit`) as {
      reportId: string; totalScore: number; cannibalization: { checked: number };
    };
    expect(audit.totalScore).toBeGreaterThan(0);
    expect(audit.cannibalization.checked).toBeGreaterThanOrEqual(1);
    const reports = handleLocal('GET', `/workspaces/${ws}/reports?type=audit`) as { reports: { id: string }[] };
    expect(reports.reports.some((r) => r.id === audit.reportId)).toBe(true);
  });

  it('server-only capabilities fail honestly (no fake data)', async () => {
    const { handleLocal } = await import('../apps/dashboard/src/lib/localDb.js');
    const ws = (handleLocal('GET', '/workspaces') as { workspaces: { id: string }[] }).workspaces[0].id;
    expect(() => handleLocal('POST', `/workspaces/${ws}/competitors`, { urls: ['https://x.ir'] })).toThrowError(/حالت محلی/);
    expect(() => handleLocal('POST', `/workspaces/${ws}/technical`, { url: 'https://x.ir' })).toThrowError(/حالت محلی/);
    expect(() => handleLocal('POST', `/workspaces/${ws}/keywords/serp`, { keyword: 'قهوه' })).toThrowError(/حالت محلی/);
    expect(() => handleLocal('POST', `/workspaces/${ws}/settings/ai`, { baseUrl: 'https://x/v1' })).toThrowError(/حالت محلی/);
  });
});
