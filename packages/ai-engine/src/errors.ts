/** Typed errors so callers can distinguish "not configured" from provider failures. */

export class AiNotConfiguredError extends Error {
  readonly code = 'AI_NOT_CONFIGURED';
  constructor(message = 'هیچ سرویس هوش مصنوعی برای این ورک‌اسپیس تنظیم نشده است. از تنظیمات، Provider و API Key را وارد کنید.') {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}

export class AiProviderError extends Error {
  readonly code = 'AI_PROVIDER_ERROR';
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
  }
}

export interface AiProviderConfig {
  /** OpenAI-compatible base URL (e.g. https://api.openai.com/v1, https://open.bigmodel.cn/api/paas/v4) */
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}
