import { describe, expect, it } from 'vitest';
import { WordPressConnector, RestContractConnector, sendSignedWebhook, verifyDomainOwnership } from './index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('WordPressConnector', () => {
  it('verifies with Basic auth and reports auth failures honestly', async () => {
    const fake = (async (url: string) => {
      if (String(url).includes('/users/me')) {
        return jsonResponse({ id: 1, name: 'admin' });
      }
      return jsonResponse([], 200);
    }) as typeof fetch;
    const wp = new WordPressConnector({ siteUrl: 'https://blog.example.com', username: 'u', applicationPassword: 'p', fetchImpl: fake });
    const v = await wp.verify();
    expect(v.ok).toBe(true);
    expect(v.message).toContain('admin');
  });

  it('bad credentials → clear failure message', async () => {
    const fake = (async () => jsonResponse({ message: 'Invalid credentials' }, 401)) as typeof fetch;
    const wp = new WordPressConnector({ siteUrl: 'https://x.com', username: 'u', applicationPassword: 'wrong', fetchImpl: fake });
    const v = await wp.verify();
    expect(v.ok).toBe(false);
    expect(v.message).toContain('Application Password');
  });

  it('lists and reads pages', async () => {
    const fake = (async (url: string) => {
      if (String(url).includes('/posts/')) {
        return jsonResponse({ id: 5, link: 'https://x.com/post', title: { rendered: 'پست' }, content: { rendered: '<p>متن</p>' }, status: 'publish', modified: '2026-01-01' });
      }
      return jsonResponse([{ id: 5, link: 'https://x.com/post', title: { rendered: 'پست' }, content: { rendered: '<p>متن</p>' }, status: 'publish', modified: '2026-01-01' }]);
    }) as typeof fetch;
    const wp = new WordPressConnector({ siteUrl: 'https://x.com', username: 'u', applicationPassword: 'p', fetchImpl: fake });
    const list = await wp.listPages();
    expect(list).toHaveLength(1);
    const page = await wp.getPage('5');
    expect(page?.title).toBe('پست');
  });

  it('pushes draft posts and surfaces WP errors', async () => {
    const fake = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.title === 'fail') return jsonResponse({ message: 'edit_forbidden' }, 403);
      return jsonResponse({ id: 9, link: 'https://x.com/new' }, 201);
    }) as typeof fetch;
    const wp = new WordPressConnector({ siteUrl: 'https://x.com', username: 'u', applicationPassword: 'p', fetchImpl: fake });
    const ok = await wp.pushPage({ title: 'مقاله جدید', html: '<p>سلام</p>' });
    expect(ok.ok).toBe(true);
    expect(ok.id).toBe('9');
    const bad = await wp.pushPage({ title: 'fail', html: '' });
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain('edit_forbidden');
  });
});

describe('RestContractConnector', () => {
  it('verifies via /danesh-seo/ping', async () => {
    const fake = (async (url: string) => {
      if (String(url).endsWith('/ping')) return jsonResponse({ ok: true });
      return jsonResponse([], 404);
    }) as typeof fetch;
    const c = new RestContractConnector({ baseUrl: 'https://svelte-site.com', fetchImpl: fake });
    expect((await c.verify()).ok).toBe(true);
  });
});

describe('signed webhook & domain verification', () => {
  it('delivers HMAC-signed payload', async () => {
    let seen: Record<string, string> = {};
    const fake = (async (_url: string, init?: RequestInit) => {
      seen = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse({ ok: true }, 200);
    }) as typeof fetch;
    const r = await sendSignedWebhook({ url: 'https://hook.example/x', secret: 's3cr3t', fetchImpl: fake }, { event: 'audit' });
    expect(r.ok).toBe(true);
    expect(seen['X-Danesh-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('verifies domain via meta tag', async () => {
    const fake = (async (url: string) => {
      const u = String(url);
      if (u === 'https://site.ir' || u === 'https://site.ir/') {
        return new Response('<html><head><meta name="danesh-seo-studio" content="tok-123"></head><body></body></html>', { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
    const v = await verifyDomainOwnership('https://site.ir', 'tok-123', fake);
    expect(v.verified).toBe(true);
    expect(v.method).toBe('meta-tag');
  });

  it('fails verification when token absent (no fake success)', async () => {
    const fake = (async () => new Response('<html></html>', { status: 200 })) as typeof fetch;
    const v = await verifyDomainOwnership('https://site.ir', 'tok', fake);
    expect(v.verified).toBe(false);
    expect(v.message).toContain('نشانه');
  });
});
