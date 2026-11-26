/** Environment configuration, parsed and validated once at startup. */
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  DATABASE_PATH: z.string().default('./data/danesh-seo-studio.db'),
  JWT_SECRET: z.string().min(16).default('dev-only-secret-change-me-please!!'),
  APP_ENCRYPTION_KEY: z.string().default(''),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:4173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  AI_BASE_URL: z.string().default(''),
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default(''),
  DATAFORSEO_LOGIN: z.string().default(''),
  DATAFORSEO_PASSWORD: z.string().default(''),
  SERPAPI_KEY: z.string().default(''),
  RATE_LIMIT_API_PER_MIN: z.coerce.number().default(300),
  RATE_LIMIT_AUTH_PER_15MIN: z.coerce.number().default(10),
  RATE_LIMIT_AI_PER_MIN: z.coerce.number().default(20),
});

export interface AppConfig extends z.infer<typeof EnvSchema> {
  corsOrigins: string[];
  isProd: boolean;
  hasEnvAi: boolean;
  hasEnvSerp: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const isProd = env.NODE_ENV === 'production';
  const cfg: AppConfig = {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
    isProd,
    hasEnvAi: Boolean(parsed.AI_BASE_URL && parsed.AI_API_KEY && parsed.AI_MODEL),
    hasEnvSerp: Boolean((parsed.DATAFORSEO_LOGIN && parsed.DATAFORSEO_PASSWORD) || parsed.SERPAPI_KEY),
  };
  if (isProd && (!env.JWT_SECRET || parsed.JWT_SECRET.startsWith('dev-only'))) {
    throw new Error('در production باید JWT_SECRET واقعی در .env تنظیم شود');
  }
  if (isProd && !parsed.APP_ENCRYPTION_KEY) {
    throw new Error('در production باید APP_ENCRYPTION_KEY (openssl rand -hex 32) تنظیم شود');
  }
  return cfg;
}
