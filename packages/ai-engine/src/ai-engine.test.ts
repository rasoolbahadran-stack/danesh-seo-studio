import { describe, expect, it } from 'vitest';
import { OpenAICompatibleProvider, extractJson, AiNotConfiguredError, AiProviderError, suggestTitles, fixGrammar } from './index.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const okFetch = (async (url: string, init?: RequestInit) => {
  void url; void init;
  return jsonResponse({ choices: [{ message: { content: '{"titles":["عنوان ۱","عنوان ۲"]}' } }] });
}) as typeof fetch;

describe('OpenAICompatibleProvider', () => {
  it('throws AiNotConfiguredError without key/model', () => {
    expect(() => new OpenAICompatibleProvider({ baseUrl: 'https://api.example.com/v1', apiKey: '', model: 'x' })).toThrow(AiNotConfiguredError);
  });

  it('posts to /chat/completions with Bearer auth and returns content', async () => {
    const calls: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push(url);
      return jsonResponse({ choices: [{ message: { content: 'سلام' } }] });
    }) as typeof fetch;
    const ai = new OpenAICompatibleProvider({
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4', apiKey: 'k', model: 'glm-4-flash', fetchImpl: fake,
    });
    const out = await ai.chat([{ role: 'user', content: 'سلام' }]);
    expect(out).toBe('سلام');
    expect(calls[0]).toContain('/chat/completions');
  });

  it('surfaces provider errors with status and message (no silent fake)', async () => {
    const fake = (async () => jsonResponse({ error: { message: 'invalid key' } }, 401)) as typeof fetch;
    const ai = new OpenAICompatibleProvider({ baseUrl: 'https://x/v1', apiKey: 'bad', model: 'm', fetchImpl: fake });
    await expect(ai.chat([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      name: 'AiProviderError', status: 401,
    });
    const t = await ai.testConnection();
    expect(t.ok).toBe(false);
    expect(t.message).toContain('invalid key');
  });

  it('reports network failure honestly', async () => {
    const fake = (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch;
    const ai = new OpenAICompatibleProvider({ baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'k', model: 'm', fetchImpl: fake });
    const t = await ai.testConnection();
    expect(t.ok).toBe(false);
    expect(t.message).toContain('اتصال');
  });

  it('extracts JSON from fenced replies', () => {
    expect(extractJson<{ a: number }>('```json\n{"a": 5}\n```')).toEqual({ a: 5 });
  });

  it('task helpers parse structured output', async () => {
    const ai = new OpenAICompatibleProvider({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', fetchImpl: okFetch });
    const titles = await suggestTitles(ai, 'قهوه ترک');
    expect(titles).toEqual(['عنوان ۱', 'عنوان ۲']);
  });

  it('fixGrammar passes through the model text', async () => {
    const fake = (async () => jsonResponse({ choices: [{ message: { content: '{"text":"متن اصلاح‌شده"}' } }] })) as typeof fetch;
    const ai = new OpenAICompatibleProvider({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', fetchImpl: fake });
    expect(await fixGrammar(ai, 'متن')).toBe('متن اصلاح‌شده');
  });

  it('AiProviderError carries status for rate limits', async () => {
    const fake = (async () => jsonResponse({ error: { message: 'rate limited' } }, 429)) as typeof fetch;
    const ai = new OpenAICompatibleProvider({ baseUrl: 'https://x/v1', apiKey: 'k', model: 'm', fetchImpl: fake });
    try {
      await ai.chat([{ role: 'user', content: 'x' }]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AiProviderError);
      expect((e as AiProviderError).status).toBe(429);
    }
  });
});
