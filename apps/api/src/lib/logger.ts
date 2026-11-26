/** Minimal leveled logger (no dependencies). */
import type { AppConfig } from '../config.js';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export function createLogger(level: Level = 'info'): Logger {
  const threshold = ORDER[level];
  const emit = (lvl: Level, msg: string, meta?: Record<string, unknown>) => {
    if (ORDER[lvl] < threshold) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lvl, msg, ...(meta ?? {}) });
    if (lvl === 'error') console.error(line);
    else if (lvl === 'warn') console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
  };
}

export function loggerForConfig(cfg: AppConfig): Logger {
  return createLogger(cfg.LOG_LEVEL);
}
