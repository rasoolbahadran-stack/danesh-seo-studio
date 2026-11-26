/** Keyword research orchestration: rules + optional AI enrichment + SERP providers. */
import {
  clusterKeywords, expandLongTails, generateQuestions, classifyIntent,
  fetchSerp, fetchKeywordVolume, providerStatus,
  type SerpProviderConfig,
} from '@danesh/keyword-research';
import { extractJson, type OpenAICompatibleProvider } from '@danesh/ai-engine';
import { decryptSecret, encryptSecret } from '../lib/crypto.js';
import type { AppConfig } from '../config.js';
import type { Repos } from '../db/repos.js';

export class KeywordService {
  private encryptionKey = '';

  constructor(private cfg: AppConfig, private repos: Repos) {}

  /** Called once at startup with the app encryption key. */
  setEncryptionKey(key: string) { this.encryptionKey = key; }

  private serpConfig(workspaceId: string): SerpProviderConfig | null {
    const enc = this.repos.getSecret(workspaceId, 'serp_config');
    if (enc && this.encryptionKey) {
      try {
        return JSON.parse(decryptSecret(enc, this.encryptionKey)) as SerpProviderConfig;
      } catch { /* fall through to env */ }
    }
    if (this.cfg.DATAFORSEO_LOGIN && this.cfg.DATAFORSEO_PASSWORD) {
      return { kind: 'dataforseo', dataForSeo: { login: this.cfg.DATAFORSEO_LOGIN, password: this.cfg.DATAFORSEO_PASSWORD } };
    }
    if (this.cfg.SERPAPI_KEY) {
      return { kind: 'serpapi', serpApi: { apiKey: this.cfg.SERPAPI_KEY } };
    }
    return null;
  }

  serpStatus(workspaceId: string) {
    return providerStatus(this.serpConfig(workspaceId));
  }

  saveSerpConfig(workspaceId: string, input: SerpProviderConfig): void {
    this.repos.setSecret(workspaceId, 'serp_config', encryptSecret(JSON.stringify(input), this.encryptionKey));
  }

  async testSerp(workspaceId: string): Promise<{ ok: boolean; message: string }> {
    const cfg = this.serpConfig(workspaceId);
    if (!cfg) return { ok: false, message: 'سرویس SERP تنظیم نشده است' };
    const r = await fetchSerp('test', cfg);
    return { ok: r.status === 'ok', message: r.status === 'ok' ? `اتصال به ${r.provider} موفق بود` : r.message ?? 'پاسخ ناموفق بود' };
  }

  async research(workspaceId: string, seed: string, aiProvider: OpenAICompatibleProvider | null) {
    const longTails = expandLongTails(seed, 'fa');
    const questions = generateQuestions(seed, 'fa');

    let related: { keyword: string; intent: ReturnType<typeof classifyIntent> }[] = [];
    if (aiProvider) {
      try {
        const out = await aiProvider.chat(
          [
            { role: 'system', content: 'تو متخصص تحقیق کلمات کلیدی فارسی هستی.' },
            { role: 'user', content: `برای کلمه «${seed}»، ۱۵ کلمه کلیدی مرتبط و ۱۰ کلمه طولانی (long-tail) که کاربران فارسی‌زبان جست‌وجو می‌کنند بنویس. فقط JSON با شکل {"related": ["..."], "longTails": ["..."]}` },
          ],
          { json: true, maxTokens: 1200 },
        );
        const parsed = extractJson<{ related?: string[]; longTails?: string[] }>(out);
        related = (parsed.related ?? []).map((k) => ({ keyword: k, intent: classifyIntent(k) }));
        for (const lt of parsed.longTails ?? []) {
          longTails.unshift({
            keyword: lt, source: 'ai', intent: classifyIntent(lt),
            estimatedDifficulty: { score: 45, level: 'متوسط', estimated: true },
            words: lt.trim().split(/\s+/).length,
          });
        }
      } catch {
        // AI enrichment failed → rule-based results remain; no fake data added
      }
    }

    const all = [seed, ...longTails.map((i) => i.keyword), ...questions.map((i) => i.keyword)];
    return {
      seed,
      longTails,
      questions,
      related,
      clusters: clusterKeywords(all),
      dataProvenance: {
        volume: 'not_available' as const,
        difficulty: 'heuristic_estimate' as const,
        note: 'حجم جست‌وجو و رقابت واقعی به سرویس داده کلمات کلیدی نیاز دارد؛ بدون آن فقط گسترش قاعده‌محور و برآورد شفاف ارائه می‌شود.',
      },
    };
  }

  async serp(workspaceId: string, keyword: string, opts: { country?: string; language?: string } = {}) {
    const cfg = this.serpConfig(workspaceId);
    if (!cfg) {
      const st = providerStatus(null);
      return { status: 'not_configured' as const, provider: st.provider, keyword, results: [], message: 'سرویس SERP تنظیم نشده است.', howToEnable: st.howToEnable };
    }
    return fetchSerp(keyword, cfg, opts);
  }

  async volume(workspaceId: string, keywords: string[]) {
    const cfg = this.serpConfig(workspaceId);
    if (!cfg) {
      const st = providerStatus(null);
      return {
        status: 'not_configured' as const, provider: st.provider, keyword: keywords[0] ?? '',
        volumes: [], message: 'سرویس داده کلمات کلیدی تنظیم نشده است.', howToEnable: st.howToEnable,
      };
    }
    return fetchKeywordVolume(keywords, cfg);
  }
}
