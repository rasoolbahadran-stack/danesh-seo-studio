/**
 * Danesh SEO Studio — Next.js integration (App Router).
 *
 * 1) Add the REST-contract route handler:
 *    app/danesh-seo/[...route]/route.ts  → re-exports from this package
 * 2) Optional React widget: <DaneshScoreBadge /> renders the live SEO score.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface DaneshNextOptions {
  /** Shared secret; sent by Danesh API as Bearer token (env DANESH_SECRET) */
  secret?: string;
  /** Content directory to scan (default: <project>/src/content) */
  contentDir?: string;
}

export const dynamic = 'force-dynamic';

interface ContentPage {
  id: string; title: string; contentHtml: string; status: string; updatedAt: string | null;
}

function discoverPages(contentDir: string): ContentPage[] {
  const pages: ContentPage[] = [];
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(md|mdx)$/i.test(entry.name)) {
        const raw = readFileSync(full, 'utf-8');
        const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
        const meta: Record<string, string> = {};
        if (fm) {
          for (const line of fm[1].split('\n')) {
            const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
            if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^["']|["']$/g, '');
          }
        }
        const body = (fm ? fm[2] : raw).trim();
        const html = body.split(/\n{2,}/).map((block) => {
          const h = block.match(/^(#{1,6})\s+(.*)$/);
          return h ? `<h${h[1].length}>${h[2]}</h${h[1].length}>` : `<p>${block.replace(/\n/g, ' ')}</p>`;
        }).join('\n');
        pages.push({
          id: full.replace(contentDir, '').replace(/\.(md|mdx)$/i, ''),
          title: meta.title ?? body.match(/^#\s+(.+)$/m)?.[1] ?? entry.name,
          contentHtml: html,
          status: meta.draft === 'true' ? 'draft' : 'publish',
          updatedAt: null,
        });
      }
    }
  };
  walk(contentDir);
  return pages;
}

/** Route handler factory — export GET/POST from your [...route]/route.ts */
export function createDaneshRouteHandler(options: DaneshNextOptions = {}) {
  const secret = options.secret ?? process.env.DANESH_SECRET ?? '';

  function denied(request: Request): Response | null {
    if (!secret) return null;
    return request.headers.get('Authorization') === `Bearer ${secret}`
      ? null
      : new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  return {
    async GET(request: Request, { params }: { params?: Promise<{ route?: string[] }> | { route?: string[] } } = {}): Promise<Response> {
      const d = denied(request);
      if (d) return d;
      const resolved = 'then' in (params ?? {}) ? await (params as Promise<{ route?: string[] }>) : (params ?? {});
      const route = (resolved.route ?? []).join('/');
      const json = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
      const pages = discoverPages(options.contentDir ?? join(process.cwd(), 'src', 'content'));

      if (route === 'ping') return json({ ok: true, contract: 'danesh-seo-v1', site: 'nextjs' });
      if (route === 'pages') {
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);
        return json(pages.slice(0, limit));
      }
      if (route.startsWith('pages/')) {
        const id = decodeURIComponent(route.slice('pages/'.length));
        const page = pages.find((p) => p.id === id || p.id === `/${id}`);
        return page ? json(page) : json({ error: 'not_found' }, 404);
      }
      return json({ error: 'not_found' }, 404);
    },
  };
}
