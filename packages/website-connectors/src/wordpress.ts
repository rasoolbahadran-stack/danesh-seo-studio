/**
 * WordPress connector over the official WP REST API (v2) with Application
 * Passwords. Supports listing, reading and pushing (create/update) posts.
 */
import type { Connector, PushPageInput, RemotePage } from './types.js';

export interface WordPressConfig {
  /** Site origin, e.g. https://example.com */
  siteUrl: string;
  /** WP application password: "user:xxxx xxxx xxxx xxxx xxxx xxxx" or username + password separately */
  username: string;
  applicationPassword: string;
  fetchImpl?: typeof fetch;
  postType?: 'posts' | 'pages';
}

export class WordPressConnector implements Connector {
  readonly kind = 'wordpress-rest';
  private cfg: WordPressConfig;

  constructor(cfg: WordPressConfig) {
    this.cfg = cfg;
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.cfg.username}:${this.cfg.applicationPassword}`).toString('base64')}`;
  }

  private base(): string {
    return `${this.cfg.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/${this.cfg.postType ?? 'posts'}`;
  }

  async verify(): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    try {
      const res = await fetchImpl(`${this.cfg.siteUrl.replace(/\/$/, '')}/wp-json/wp/v2/users/me`, {
        headers: { Authorization: this.authHeader() },
      });
      if (res.status === 401) return { ok: false, message: 'احراز هویت وردپرس ناموفق بود — نام کاربری یا Application Password اشتباه است.' };
      if (!res.ok) return { ok: false, message: `پاسخ وردپرس: ${res.status}` };
      const me = (await res.json()) as { id?: number; name?: string; capabilities?: Record<string, boolean> };
      return { ok: true, message: `اتصال به وردپرس با کاربر «${me.name}» موفق بود`, details: { userId: me.id } };
    } catch (err) {
      return { ok: false, message: `اتصال به وردپرس برقرار نشد: ${(err as Error).message}` };
    }
  }

  async listPages(opts: { limit?: number } = {}): Promise<RemotePage[]> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const perPage = Math.min(opts.limit ?? 20, 100);
    const res = await fetchImpl(`${this.base()}?per_page=${perPage}&orderby=modified&_fields=id,link,title,content,status,modified`);
    if (!res.ok) throw new Error(`WP list failed: ${res.status}`);
    const rows = (await res.json()) as {
      id: number; link: string; title: { rendered: string }; content: { rendered: string }; status: string; modified: string;
    }[];
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title?.rendered?.replace(/<[^>]*>/g, '') ?? '',
      url: r.link,
      contentHtml: r.content?.rendered ?? '',
      status: r.status,
      updatedAt: r.modified ?? null,
    }));
  }

  async getPage(id: string): Promise<RemotePage | null> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const res = await fetchImpl(`${this.base()}/${id}?_fields=id,link,title,content,status,modified`);
    if (!res.ok) return null;
    const r = (await res.json()) as { id: number; link: string; title: { rendered: string }; content: { rendered: string }; status: string; modified: string };
    return {
      id: String(r.id),
      title: r.title?.rendered?.replace(/<[^>]*>/g, '') ?? '',
      url: r.link,
      contentHtml: r.content?.rendered ?? '',
      status: r.status,
      updatedAt: r.modified ?? null,
    };
  }

  async pushPage(input: PushPageInput): Promise<{ ok: boolean; id?: string; url?: string; message: string }> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const body: Record<string, unknown> = {
      title: input.title,
      content: input.html,
      status: input.status ?? 'draft',
    };
    if (input.slug) body.slug = input.slug;
    if (input.metaDescription) {
      // Requires an SEO plugin exposing yoast_head/yoast meta; keep core-safe:
      body.excerpt = input.metaDescription;
    }
    const res = await fetchImpl(this.base(), {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = (await res.json()) as { message?: string };
        detail = j.message ?? detail;
      } catch { /* keep statusText */ }
      return { ok: false, message: `ارسال به وردپرس ناموفق بود (${res.status}): ${detail}` };
    }
    const j = (await res.json()) as { id: number; link: string };
    return { ok: true, id: String(j.id), url: j.link, message: 'صفحه در وردپرس ایجاد شد' };
  }
}
