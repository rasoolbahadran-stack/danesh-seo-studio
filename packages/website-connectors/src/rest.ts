/**
 * Generic REST connector for sites implementing the Danesh SEO Studio
 * contract (documented in docs/CONNECTORS.md):
 *   GET  {base}/danesh-seo/pages         → [{id,title,url,contentHtml,status,updatedAt}]
 *   GET  {base}/danesh-seo/pages/:id     → single page
 *   POST {base}/danesh-seo/pages         → create/update (contract-dependent)
 */
import type { Connector, PushPageInput, RemotePage } from './types.js';

export interface RestContractConfig {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class RestContractConnector implements Connector {
  readonly kind = 'rest-contract';
  private cfg: RestContractConfig;

  constructor(cfg: RestContractConfig) {
    this.cfg = cfg;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}),
    };
  }

  private base(): string {
    return `${this.cfg.baseUrl.replace(/\/$/, '')}/danesh-seo`;
  }

  async verify(): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    try {
      const res = await fetchImpl(`${this.base()}/ping`, { headers: this.headers() });
      if (res.ok) return { ok: true, message: 'سایت قرارداد REST را پشتیبانی می‌کند' };
      return { ok: false, message: `پاسخ /danesh-seo/ping ناموفق بود (${res.status})` };
    } catch (err) {
      return { ok: false, message: `اتصال برقرار نشد: ${(err as Error).message}` };
    }
  }

  async listPages(opts: { limit?: number } = {}): Promise<RemotePage[]> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const res = await fetchImpl(`${this.base()}/pages?limit=${opts.limit ?? 50}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`REST list failed: ${res.status}`);
    return (await res.json()) as RemotePage[];
  }

  async getPage(id: string): Promise<RemotePage | null> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const res = await fetchImpl(`${this.base()}/pages/${encodeURIComponent(id)}`, { headers: this.headers() });
    if (!res.ok) return null;
    return (await res.json()) as RemotePage;
  }

  async pushPage(input: PushPageInput): Promise<{ ok: boolean; id?: string; url?: string; message: string }> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const res = await fetchImpl(`${this.base()}/pages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, message: `push failed: ${res.status}` };
    const j = (await res.json()) as { id?: string; url?: string };
    return { ok: true, id: j.id, url: j.url, message: 'صفحه ذخیره شد' };
  }
}
