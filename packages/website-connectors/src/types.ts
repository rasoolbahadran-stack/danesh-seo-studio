/** Site connector contracts — adding a new connector never touches the core engine. */

export interface SiteProfile {
  name: string;
  domain: string;
  lang: 'fa' | 'en';
  cms: 'wordpress' | 'custom-rest' | 'static-html' | 'astro' | 'nextjs' | 'other';
  connectionType: 'wordpress-rest' | 'rest-contract' | 'webhook' | 'none';
  credentials?: Record<string, string>;
}

export interface RemotePage {
  id: string;
  title: string;
  url: string;
  contentHtml: string;
  status: string;
  updatedAt: string | null;
}

export interface PushPageInput {
  title: string;
  html: string;
  slug?: string;
  status?: 'draft' | 'publish';
  metaDescription?: string;
}

export interface Connector {
  readonly kind: string;
  verify(): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }>;
  listPages(opts?: { limit?: number }): Promise<RemotePage[]>;
  getPage(id: string): Promise<RemotePage | null>;
  pushPage?(input: PushPageInput): Promise<{ ok: boolean; id?: string; url?: string; message: string }>;
}
