/** Production entrypoint: loads .env, builds the app, starts listening. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildApp } from './app.js';

// Minimal .env loader (no dotenv dependency)
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const { app, ctx } = buildApp();
const server = app.listen(ctx.cfg.PORT, () => {
  ctx.logger.info(`Danesh SEO Studio API listening on :${ctx.cfg.PORT}`, {
    db: ctx.cfg.DATABASE_PATH,
    ai: ctx.cfg.hasEnvAi ? 'env-configured' : 'per-workspace',
    serp: ctx.cfg.hasEnvSerp ? 'env-configured' : 'per-workspace',
  });
});

const shutdown = (signal: string) => {
  ctx.logger.info(`${signal} received — shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
