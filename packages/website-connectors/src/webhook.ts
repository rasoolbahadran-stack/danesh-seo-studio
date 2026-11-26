/**
 * Webhook connector: signed (HMAC-SHA256) delivery of analysis events to
 * any endpoint. Also verifies ownership via meta tag / verification file.
 */
import { createHmac } from 'node:crypto';

export interface WebhookConfig {
  url: string;
  secret: string;
  fetchImpl?: typeof fetch;
}

export interface WebhookDeliveryResult {
  ok: boolean;
  status: number | null;
  message: string;
}

export async function sendSignedWebhook(cfg: WebhookConfig, payload: Record<string, unknown>): Promise<WebhookDeliveryResult> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', cfg.secret).update(body).digest('hex');
  try {
    const res = await fetchImpl(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Danesh-Signature': `sha256=${signature}`,
      },
      body,
    });
    return {
      ok: res.ok,
      status: res.status,
      message: res.ok ? 'Webhook ارسال شد' : `Webhook دریافت‌کننده پاسخ ${res.status} داد`,
    };
  } catch (err) {
    return { ok: false, status: null, message: `ارسال webhook ناموفق بود: ${(err as Error).message}` };
  }
}

export interface VerificationResult {
  verified: boolean;
  method: 'meta-tag' | 'verification-file' | null;
  message: string;
}

/**
 * Verify that a site is controlled by the user: look for
 *   <meta name="danesh-seo-studio" content="TOKEN">
 * or https://site/danesh-verification.json containing {"token": "TOKEN"}.
 */
export async function verifyDomainOwnership(siteUrl: string, token: string, fetchImpl: typeof fetch = fetch): Promise<VerificationResult> {
  const origin = siteUrl.replace(/\/$/, '');
  try {
    const pageRes = await fetchImpl(origin, { headers: { 'User-Agent': 'DaneshSEOSTUDIO/0.1 (+verification)' } });
    const html = await pageRes.text();
    const metaMatch = html.match(/<meta[^>]+name\s*=\s*["']danesh-seo-studio["'][^>]*>/i);
    if (metaMatch) {
      const content = metaMatch[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
      if (content === token) {
        return { verified: true, method: 'meta-tag', message: 'مالکیت دامنه با متا تگ تأیید شد' };
      }
    }
    let fileToken: string | null = null;
    try {
      const fileRes = await fetchImpl(`${origin}/danesh-verification.json`);
      if (fileRes.ok) {
        const json = (await fileRes.json()) as { token?: string };
        fileToken = json.token ?? null;
      }
    } catch {
      // verification file missing or not JSON — fall through to meta-tag result
    }
    if (fileToken === token) {
      return { verified: true, method: 'verification-file', message: 'مالکیت دامنه با فایل تأییدیه تأیید شد' };
    }
    return { verified: false, method: null, message: 'هیچ نشانه تأیید روی سایت پیدا نشد. متا تگ یا فایل danesh-verification.json را اضافه کنید.' };
  } catch (err) {
    return { verified: false, method: null, message: `دسترسی به سایت ممکن نشد: ${(err as Error).message}` };
  }
}
