/**
 * AI service: resolves the provider per workspace (encrypted settings) with
 * env fallback, and exposes the task registry. Keys NEVER leave the server.
 */
import {
  OpenAICompatibleProvider, AiNotConfiguredError,
  suggestTitles, generateMetaDescription, generateIntro, generateConclusion, generateFaq,
  generateOutline, generateArticleSection, expandParagraph, rewriteParagraph, fixGrammar,
  improveReadability, suggestInternalLinks, generateFullArticle,
} from '@danesh/ai-engine';
import type { AppConfig } from '../config.js';
import type { Repos } from '../db/repos.js';
import { decryptSecret, encryptSecret, maskSecret } from '../lib/crypto.js';

export interface AiSettings {
  baseUrl: string;
  model: string;
  apiKeyEnc: string | null;
}

export interface AiConfigStatus {
  configured: boolean;
  provider: string;
  model: string | null;
  maskedKey: string | null;
  source: 'workspace' | 'env' | 'none';
}

export class AiService {
  constructor(private cfg: AppConfig, private repos: Repos) {}

  getSettings(workspaceId: string): AiSettings {
    const enc = this.repos.getSecret(workspaceId, 'ai_config');
    if (enc) {
      try {
        return JSON.parse(decryptSecret(enc, this.cfg.APP_ENCRYPTION_KEY)) as AiSettings;
      } catch {
        // corrupt payload → fall through to env
      }
    }
    return { baseUrl: '', model: '', apiKeyEnc: null };
  }

  async saveSettings(workspaceId: string, input: { baseUrl?: string; model?: string; apiKey?: string }): Promise<void> {
    const current = this.getSettings(workspaceId);
    const next: AiSettings = {
      baseUrl: input.baseUrl ?? current.baseUrl,
      model: input.model ?? current.model,
      apiKeyEnc: input.apiKey !== undefined ? encryptSecret(input.apiKey, this.cfg.APP_ENCRYPTION_KEY) : current.apiKeyEnc,
    };
    this.repos.setSecret(workspaceId, 'ai_config', encryptSecret(JSON.stringify(next), this.cfg.APP_ENCRYPTION_KEY));
  }

  resolveProvider(workspaceId: string): OpenAICompatibleProvider | null {
    const ws = this.getSettings(workspaceId);
    if (ws.baseUrl && ws.model && ws.apiKeyEnc) {
      try {
        return new OpenAICompatibleProvider({
          baseUrl: ws.baseUrl,
          model: ws.model,
          apiKey: decryptSecret(ws.apiKeyEnc, this.cfg.APP_ENCRYPTION_KEY),
        });
      } catch {
        return null;
      }
    }
    if (this.cfg.hasEnvAi) {
      return new OpenAICompatibleProvider({
        baseUrl: this.cfg.AI_BASE_URL,
        model: this.cfg.AI_MODEL,
        apiKey: this.cfg.AI_API_KEY,
      });
    }
    return null;
  }

  status(workspaceId: string): AiConfigStatus {
    const ws = this.getSettings(workspaceId);
    if (ws.baseUrl && ws.model && ws.apiKeyEnc) {
      let masked: string | null = null;
      try {
        masked = maskSecret(decryptSecret(ws.apiKeyEnc, this.cfg.APP_ENCRYPTION_KEY));
      } catch {
        masked = null;
      }
      return { configured: true, provider: 'openai-compatible', model: ws.model, maskedKey: masked, source: 'workspace' };
    }
    if (this.cfg.hasEnvAi) {
      return { configured: true, provider: 'openai-compatible', model: this.cfg.AI_MODEL, maskedKey: maskSecret(this.cfg.AI_API_KEY), source: 'env' };
    }
    return { configured: false, provider: 'none', model: null, maskedKey: null, source: 'none' };
  }

  async testConnection(workspaceId: string): Promise<{ ok: boolean; message: string }> {
    const provider = this.resolveProvider(workspaceId);
    if (!provider) return { ok: false, message: 'هیچ تنظیمات AI موجود نیست — baseUrl، model و apiKey را وارد کنید' };
    return provider.testConnection();
  }
}

export type AiTaskInput = Record<string, unknown>;

/** Task registry — the API route looks up the task by name. */
export function createAiTasks() {
  const str = (input: AiTaskInput, key: string, fallback = ''): string =>
    typeof input[key] === 'string' ? input[key] as string : fallback;

  const tasks: Record<string, (ai: OpenAICompatibleProvider, input: AiTaskInput) => Promise<unknown>> = {
    'suggest-titles': (ai, input) => suggestTitles(ai, str(input, 'keyword'), str(input, 'intent', 'informational')),
    'meta-description': (ai, input) => generateMetaDescription(ai, str(input, 'keyword'), str(input, 'summary')),
    'intro': (ai, input) => generateIntro(ai, str(input, 'keyword'), str(input, 'title')),
    'conclusion': (ai, input) => generateConclusion(ai, str(input, 'keyword'), str(input, 'outline')),
    'faq': (ai, input) => generateFaq(ai, str(input, 'keyword'), typeof input.count === 'number' ? input.count : 5),
    'outline': (ai, input) => generateOutline(ai, str(input, 'keyword'), str(input, 'audience'), typeof input.targetWords === 'number' ? input.targetWords : 1000),
    'section': (ai, input) => generateArticleSection(ai, str(input, 'h2'), str(input, 'keyword'), typeof input.wordTarget === 'number' ? input.wordTarget : 200),
    'expand': (ai, input) => expandParagraph(ai, str(input, 'text')),
    'rewrite': (ai, input) => rewriteParagraph(ai, str(input, 'text')),
    'fix-grammar': (ai, input) => fixGrammar(ai, str(input, 'text')),
    'readability': (ai, input) => improveReadability(ai, str(input, 'text')),
    'internal-links': (ai, input) => suggestInternalLinks(
      ai,
      str(input, 'contentSummary'),
      Array.isArray(input.pages) ? (input.pages as { url: string; title: string }[]) : [],
    ),
    'full-article': (ai, input) => generateFullArticle(ai, {
      primaryKeyword: str(input, 'keyword'),
      title: str(input, 'title'),
      outline: str(input, 'outline'),
      targetWords: typeof input.targetWords === 'number' ? input.targetWords : undefined,
      tone: str(input, 'tone'),
    }),
  };
  return tasks;
}

export const aiTasks = createAiTasks();
export { AiNotConfiguredError };
