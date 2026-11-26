/**
 * SERP & search-volume providers. Real data only comes from paid, authorized
 * APIs (DataForSEO, SerpApi). Without credentials these return a transparent
 * `not_configured` status — nothing is faked.
 */
import type { SerpReport, SerpResult, VolumeReport } from './types.js';

export interface SerpProviderConfig {
  kind: 'dataforseo' | 'serpapi';
  dataForSeo?: { login: string; password: string };
  serpApi?: { apiKey: string };
  fetchImpl?: typeof fetch;
}

export function providerStatus(cfg: SerpProviderConfig | null | undefined): { configured: boolean; provider: string; howToEnable: string } {
  const configured = Boolean(
    cfg && ((cfg.kind === 'dataforseo' && cfg.dataForSeo?.login && cfg.dataForSeo?.password)
      || (cfg.kind === 'serpapi' && cfg.serpApi?.apiKey)),
  );
  return {
    configured,
    provider: cfg?.kind ?? 'none',
    howToEnable: 'کلید DataForSEO یا SerpApi را در تنظیمات ورک‌اسپیس یا فایل .env وارد کنید. بدون آن، داده SERP/حجم جست‌وجوی واقعی در دسترس نیست و هیچ داده ساختگی نمایش داده نمی‌شود.',
  };
}

export async function fetchSerp(keyword: string, cfg: SerpProviderConfig, opts: { country?: string; language?: string } = {}): Promise<SerpReport> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const { country = 'iran', language = 'fa' } = opts;
  if (cfg.kind === 'dataforseo' && cfg.dataForSeo?.login) {
    try {
      const auth = Buffer.from(`${cfg.dataForSeo.login}:${cfg.dataForSeo.password}`).toString('base64');
      const res = await fetchImpl('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keyword, location_code: 1028, language_code: language }]),
      });
      const json = (await res.json()) as {
        status_code: number;
        tasks?: { result?: { items?: { type: string; rank_absolute?: number; title?: string; url?: string; description?: string }[] }[] }[];
      };
      const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
      const results: SerpResult[] = items
        .filter((i) => i.type === 'organic')
        .slice(0, 10)
        .map((i, idx) => ({
          position: i.rank_absolute ?? idx + 1,
          title: i.title ?? '',
          url: i.url ?? '',
          description: i.description ?? '',
        }));
      return { status: 'ok', provider: 'dataforseo', keyword, results };
    } catch (err) {
      return { status: 'error', provider: 'dataforseo', keyword, results: [], message: String((err as Error).message) };
    }
  }

  if (cfg.kind === 'serpapi' && cfg.serpApi?.apiKey) {
    try {
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('engine', 'google');
      url.searchParams.set('q', keyword);
      url.searchParams.set('gl', country === 'iran' ? 'ir' : country);
      url.searchParams.set('hl', language);
      url.searchParams.set('api_key', cfg.serpApi.apiKey);
      const res = await fetchImpl(url.toString());
      const json = (await res.json()) as { organic_results?: { position?: number; title?: string; link?: string; snippet?: string }[] };
      const results: SerpResult[] = (json.organic_results ?? []).slice(0, 10).map((r, idx) => ({
        position: r.position ?? idx + 1,
        title: r.title ?? '',
        url: r.link ?? '',
        description: r.snippet ?? '',
      }));
      return { status: 'ok', provider: 'serpapi', keyword, results };
    } catch (err) {
      return { status: 'error', provider: 'serpapi', keyword, results: [], message: String((err as Error).message) };
    }
  }

  const st = providerStatus(cfg);
  return { status: 'not_configured', provider: st.provider, keyword, results: [], message: 'سرویس SERP تنظیم نشده است.', howToEnable: st.howToEnable };
}

export async function fetchKeywordVolume(
  keywords: string[],
  cfg: SerpProviderConfig,
): Promise<VolumeReport> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  if (cfg.kind === 'dataforseo' && cfg.dataForSeo?.login && keywords.length > 0) {
    try {
      const auth = Buffer.from(`${cfg.dataForSeo.login}:${cfg.dataForSeo.password}`).toString('base64');
      const res = await fetchImpl('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ keywords: keywords.slice(0, 700), location_code: 1028, language_code: 'fa' }]),
      });
      const json = (await res.json()) as {
        tasks?: { result?: { items?: { keyword?: string; search_volume?: number; competition?: string }[] }[] }[];
      };
      const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
      return {
        status: 'ok',
        provider: 'dataforseo',
        keyword: keywords[0],
        volumes: items.map((i) => ({ keyword: i.keyword ?? '', monthlySearches: i.search_volume ?? null, competition: i.competition })),
      };
    } catch (err) {
      return { status: 'error', provider: 'dataforseo', keyword: keywords[0], volumes: [], message: String((err as Error).message) };
    }
  }
  const st = providerStatus(cfg);
  return {
    status: 'not_configured',
    provider: st.provider,
    keyword: keywords[0] ?? '',
    volumes: [],
    message: 'حجم جست‌وجوی واقعی به یک سرویس داده کلمات کلیدی (مثل DataForSEO) نیاز دارد؛ بدون آن ارائه داده حجم ساختگی ممنوع است.',
    howToEnable: st.howToEnable,
  };
}
