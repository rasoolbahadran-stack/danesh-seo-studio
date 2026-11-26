/** API client — base URL configurable (needed for GitHub Pages demo mode). */

const BASE_KEY = 'danesh_api_base';
const TOKEN_KEY = 'danesh_token';

export function getApiBase(): string {
  return localStorage.getItem(BASE_KEY) ?? (import.meta.env.VITE_API_BASE ?? '');
}

export function setApiBase(base: string) {
  if (base) localStorage.setItem(BASE_KEY, base.replace(/\/$/, ''));
  else localStorage.removeItem(BASE_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = getApiBase();
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'اتصال به سرور برقرار نشد. آدرس API را در تنظیمات بررسی کنید.');
  }
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('danesh:unauthorized'));
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string; details?: unknown } }).error;
    throw new ApiError(res.status, err?.code ?? 'ERROR', err?.message ?? 'خطای ناشناخته', err?.details);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => req<T>('GET', path),
  post: <T>(path: string, body?: unknown) => req<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => req<T>('PATCH', path, body),
  delete: <T>(path: string) => req<T>('DELETE', path),
};

// ---------- typed endpoints ----------
export interface User { id: string; email: string; name: string; role: string }

export interface Workspace {
  id: string; name: string; domain: string; lang: string; cms: string;
  connection_type: string; weights_json: string | null; settings_json: string;
  created_at: string;
}

export interface ArticleListItem {
  id: string; title: string; slug: string; primaryKeyword: string; intent: string;
  status: string; lastScore: { score: number; grade: string; at: string } | null;
  updatedAt: string; wordCount?: number;
}

export interface Article extends ArticleListItem {
  workspaceId: string; secondaryKeywords: string[]; targetWords: number;
  contentHtml: string; metaTitle: string; metaDescription: string;
  competitorUrls: string[]; createdAt: string; briefId?: string | null;
}

export interface Version {
  id: string; version_no: number; title: string; note: string; score_total: number | null;
  created_at: string; created_by: string;
}

export interface AiStatus { configured: boolean; provider: string; model: string | null; maskedKey: string | null; source: string }
