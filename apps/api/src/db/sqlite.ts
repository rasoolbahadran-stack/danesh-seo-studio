/**
 * SQLite storage via the built-in node:sqlite (Node >= 22.13) — no native
 * compilation required. Schema is created idempotently at startup.
 *
 * NOTE: loaded via createRequire at runtime because bundlers (esbuild) may
 * rewrite the `node:sqlite` specifier to a bare package name.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite') as typeof import('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT 'fa',
  cms TEXT NOT NULL DEFAULT 'other',
  connection_type TEXT NOT NULL DEFAULT 'none',
  connection_json TEXT NOT NULL DEFAULT '{}',
  weights_json TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  primary_keyword TEXT NOT NULL DEFAULT '',
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  intent TEXT NOT NULL DEFAULT '',
  target_words INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  content_html TEXT NOT NULL DEFAULT '',
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  featured_image TEXT NOT NULL DEFAULT '',
  brief_id TEXT,
  competitor_urls_json TEXT NOT NULL DEFAULT '[]',
  last_score_json TEXT,
  published_url TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_html TEXT NOT NULL DEFAULT '',
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  score_total INTEGER,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  brief_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  article_id TEXT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE TABLE IF NOT EXISTS secrets (
  workspace_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value_enc TEXT NOT NULL,
  PRIMARY KEY (workspace_id, key)
);
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL DEFAULT '',
  entity_id TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_workspace ON articles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_versions_article ON article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_reports_workspace ON reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_workspace ON activity(workspace_id);
`;

export function openDatabase(dbPath: string): InstanceType<typeof DatabaseSync> {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}
