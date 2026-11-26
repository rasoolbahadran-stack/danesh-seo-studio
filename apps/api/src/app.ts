/**
 * Express app factory — also used by tests with an in-memory database.
 */
import express, { type Express, type Request } from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadConfig, type AppConfig } from './config.js';
import { createLogger } from './lib/logger.js';
import { openDatabase } from './db/sqlite.js';
import { Repos } from './db/repos.js';
import { authRequired, errorHandler, workspaceRequired } from './middleware/auth.js';
import { rateLimit } from './lib/rateLimit.js';
import { AiService } from './services/aiService.js';
import { AnalysisService } from './services/analysisService.js';
import { CompetitorService } from './services/competitorService.js';
import { KeywordService } from './services/keywordService.js';
import { BriefService } from './services/briefService.js';
import { authRoutes } from './routes/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { articleRoutes } from './routes/articles.js';
import { keywordRoutes } from './routes/keywords.js';
import { moduleRoutes } from './routes/modules.js';
import { publicRoutes } from './routes/public.js';
import type { AppContext } from './routes/context.js';

export interface BuildAppOptions {
  dbPath?: string;
  env?: NodeJS.ProcessEnv;
}

export function buildApp(opts: BuildAppOptions = {}): { app: Express; ctx: AppContext; cfg: AppConfig } {
  const cfg = loadConfig(opts.env);
  const logger = createLogger(cfg.LOG_LEVEL);
  const db = openDatabase(opts.dbPath ?? cfg.DATABASE_PATH);
  const repos = new Repos(db);

  const ctx: AppContext = {
    cfg,
    repos,
    logger,
    encryptionKey: cfg.APP_ENCRYPTION_KEY || cfg.JWT_SECRET,
    ai: new AiService(cfg, repos),
    analysis: new AnalysisService(repos, new CompetitorService()),
    competitors: new CompetitorService(),
    keywords: new KeywordService(cfg, repos),
    briefs: new BriefService(),
  };
  ctx.keywords.setEncryptionKey(ctx.encryptionKey);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // security headers (lightweight, no helmet dependency)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || cfg.corsOrigins.length === 0 || cfg.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: false,
  }));
  app.use(express.json({ limit: '2mb' }));

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: cfg.RATE_LIMIT_AUTH_PER_15MIN });
  const apiLimiter = rateLimit({ windowMs: 60_000, max: cfg.RATE_LIMIT_API_PER_MIN });

  const api = express.Router();
  api.get('/health', (_req, res) => {
    let dbOk = true;
    try {
      repos.findUserByEmail('health-check@invalid');
    } catch {
      dbOk = false;
    }
    res.json({
      status: 'ok', db: dbOk ? 'ok' : 'error',
      version: '0.1.0',
      features: { ai: ctx.cfg.hasEnvAi, serp: ctx.cfg.hasEnvSerp },
    });
  });

  api.use('/auth', authLimiter, authRoutes(ctx));
  // public widget endpoints: any origin (embeddable), rate-limited, token-scoped
  api.use('/public', cors({ origin: true }), rateLimit({ windowMs: 60_000, max: 120 }), publicRoutes(ctx));
  api.use('/workspaces', apiLimiter, authRequired(cfg.JWT_SECRET), workspaceRoutes(ctx));
  api.use('/workspaces/:workspaceId/articles', authRequired(cfg.JWT_SECRET), articleRoutes(ctx));
  api.use('/workspaces/:workspaceId/keywords', authRequired(cfg.JWT_SECRET), keywordRoutes(ctx));
  api.use('/workspaces/:workspaceId', authRequired(cfg.JWT_SECRET), moduleRoutes(ctx));

  app.use('/api/v1', api);
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'مسیر API یافت نشد (از /api/v1 استفاده کنید)' } }));

  // Optional: serve the built dashboard for single-server deployments
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '../../dashboard/dist'),
    join(here, '../../../dashboard/dist'),
  ];
  const dashboardDist = candidates.find((p) => existsSync(join(p, 'index.html')));
  if (dashboardDist) {
    app.use(express.static(dashboardDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(dashboardDist, 'index.html'));
    });
  }

  // serve the embeddable HTML widget for connector deployments
  const widgetDir = join(here, '../../../integrations/html');
  if (existsSync(join(widgetDir, 'danesh-widget.js'))) {
    app.use('/widget', express.static(widgetDir));
  }

  app.use(errorHandler(logger));

  // keep the workspaceRequired import referenced for future nested routers
  void workspaceRequired;
  return { app, ctx, cfg };
}

declare module 'express-serve-static-core' {
  interface Request {
    workspaceRole?: string;
  }
}
