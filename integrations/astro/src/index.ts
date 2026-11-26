/**
 * Danesh SEO Studio — Astro integration.
 * Adds Danesh REST-contract endpoints (/danesh-seo/*) to any Astro site and
 * exposes real pages discovered from the content directory (markdown files).
 *
 * Usage in astro.config.mjs:
 *   import daneshSeo from '@danesh/astro-integration';
 *   export default defineConfig({
 *     integrations: [daneshSeo({ secret: process.env.DANESH_SECRET })],
 *   });
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

export interface DaneshAstroOptions {
  /** Shared secret; sent by the Danesh API as Bearer token */
  secret?: string;
  /** Content directory to scan (default: <project>/src/content) */
  contentDir?: string;
}

interface ContentPage {
  id: string;
  title: string;
  contentHtml: string;
  status: string;
  updatedAt: string | null;
}

/** Discover markdown content files and extract title/body with a small frontmatter parser. */
function discoverPages(contentDir: string): ContentPage[] {
  const pages: ContentPage[] = [];
  const walk = (dir: string) => {
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
        // Minimal md → html: headings and paragraphs (good enough for SEO review)
        const html = body
          .split(/\n{2,}/)
          .map((block) => {
            const h = block.match(/^(#{1,6})\s+(.*)$/);
            if (h) return `<h${h[1].length}>${h[2]}</h${h[1].length}>`;
            return `<p>${block.replace(/\n/g, ' ')}</p>`;
          })
          .join('\n');
        pages.push({
          id: full.replace(contentDir, '').replace(/\.(md|mdx)$/i, ''),
          title: meta.title ?? h1Of(body) ?? entry.name.replace(/\.(md|mdx)$/i, ''),
          contentHtml: html,
          status: meta.draft === 'true' ? 'draft' : 'publish',
          updatedAt: existsSync(full) ? null : null,
        });
      }
    }
  };
  if (existsSync(contentDir)) walk(contentDir);
  return pages;
}

function h1Of(body: string): string | null {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1] : null;
}

export default function daneshSeoIntegration(options: DaneshAstroOptions = {}): AstroIntegration {
  return {
    name: 'danesh-seo-studio',
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        const secret = options.secret ?? '';
        injectRoute({
          pattern: '/danesh-seo/[...route]',
          entrypoint: resolve(dirname(fileURLToPath(import.meta.url)), './endpoint.js'),
          prerender: false,
        });
        logger.info('Danesh SEO endpoints registered at /danesh-seo/*');
        // expose options via virtual module alternative: keep them on globalThis for the endpoint
        (globalThis as { __DANESH_ASTRO__?: unknown }).__DANESH_ASTRO__ = { secret, contentDir: options.contentDir };
      },
    },
  };
}

export { discoverPages };
