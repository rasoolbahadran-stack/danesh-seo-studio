/**
 * Astro APIRoute implementing the Danesh REST contract:
 *   GET  /danesh-seo/ping
 *   GET  /danesh-seo/pages?limit=N
 *   GET  /danesh-seo/pages/:id
 * Auth: `Authorization: Bearer <secret>` when a secret is configured.
 */
import type { APIRoute } from 'astro';

const opts = ((globalThis as { __DANESH_ASTRO__?: { secret?: string; contentDir?: string } }).__DANESH_ASTRO__) ?? {};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function checkAuth(request: Request): Response | null {
  if (!opts.secret) return null; // no secret configured → endpoints open (dev)
  const header = request.headers.get('Authorization') ?? '';
  if (header === `Bearer ${opts.secret}`) return null;
  return json({ error: 'unauthorized' }, 401);
}

async function getPages() {
  // dynamic import keeps content-dir discovery lazy
  const { discoverPages } = await import('./index.js');
  const { join, dirname } = await import('node:path');
  const root = process.cwd();
  const contentDir = opts.contentDir ?? join(root, 'src', 'content');
  return discoverPages(contentDir);
}

export const GET: APIRoute = async ({ request, params }) => {
  const denied = checkAuth(request);
  if (denied) return denied;
  const route = (params.route as string[] | undefined)?.join('/') ?? '';
  const pages = await getPages();

  if (route === 'ping') return json({ ok: true, contract: 'danesh-seo-v1', site: 'astro' });
  if (route === 'pages') {
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
    return json(pages.slice(0, limit));
  }
  if (route.startsWith('pages/')) {
    const id = decodeURIComponent(route.slice('pages/'.length));
    const page = pages.find((p) => p.id === id || p.id === `/${id}`);
    if (!page) return json({ error: 'not_found' }, 404);
    return json(page);
  }
  return json({ error: 'not_found' }, 404);
};

export const POST: APIRoute = async ({ request, params }) => {
  const denied = checkAuth(request);
  if (denied) return denied;
  const route = (params.route as string[] | undefined)?.join('/') ?? '';
  if (route !== 'pages') return json({ error: 'not_found' }, 404);
  // Astro sites are typically static; pushing content is out of scope.
  // The Danesh API uses GET contract for audits; content delivery stays with your deploy pipeline.
  return json({ ok: false, message: 'این سایت استاتیک است؛ push فقط در CMSهای پویا (مثل وردپرس) پشتیبانی می‌شود' }, 501);
};
