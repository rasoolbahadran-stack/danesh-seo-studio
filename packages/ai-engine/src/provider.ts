/**
 * OpenAI-compatible chat provider. Works with OpenAI, Z.ai GLM, OpenRouter,
 * Groq, DeepSeek, Ollama and any compatible gateway. A fetchImpl can be
 * injected for testing. NO mock data — errors surface honestly.
 */
import { AiNotConfiguredError, AiProviderError, type AiProviderConfig } from './errors.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for strict JSON output when the provider supports it */
  json?: boolean;
}

export interface ChatProvider {
  readonly id: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<string>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

export class OpenAICompatibleProvider implements ChatProvider {
  readonly id: string;
  private cfg: AiProviderConfig;

  constructor(cfg: AiProviderConfig) {
    if (!cfg.apiKey || !cfg.baseUrl || !cfg.model) {
      throw new AiNotConfiguredError();
    }
    this.cfg = {
      timeoutMs: 60000,
      temperature: 0.7,
      maxTokens: 2048,
      ...cfg,
    };
    this.id = `openai-compatible:${cfg.model}`;
  }

  get config(): AiProviderConfig {
    return this.cfg;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
    const fetchImpl = this.cfg.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetchImpl(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
          ...this.cfg.headers,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages,
          temperature: opts.temperature ?? this.cfg.temperature,
          max_tokens: opts.maxTokens ?? this.cfg.maxTokens,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });

      if (!res.ok) {
        let detail = '';
        try {
          const body = (await res.json()) as { error?: { message?: string } | string; message?: string };
          detail = typeof body.error === 'string' ? body.error : body.error?.message ?? body.message ?? '';
        } catch {
          detail = res.statusText;
        }
        throw new AiProviderError(`خطا از سرویس AI (${res.status}): ${detail}`, res.status);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        error?: { message?: string };
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new AiProviderError('پاسخ نامعتبر از سرویس AI (بدون content)');
      }
      return content;
    } catch (err) {
      if (err instanceof AiProviderError || err instanceof AiNotConfiguredError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new AiProviderError('مهلت پاسخ سرویس AI تمام شد (timeout)');
      }
      throw new AiProviderError(`اتصال به سرویس AI برقرار نشد: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const reply = await this.chat(
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 8, temperature: 0 },
      );
      return { ok: true, message: `اتصال موفق بود (model: ${this.cfg.model})` + (reply ? '' : '') };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}

/** Parse a JSON object out of a model reply (handles ```json fences). */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const jsonStart = start >= 0 ? raw.slice(start) : raw;
  try {
    return JSON.parse(jsonStart.trim()) as T;
  } catch {
    throw new AiProviderError('پاسخ مدل قابل تبدیل به JSON نیست');
  }
}
