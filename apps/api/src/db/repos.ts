/**
 * Data access layer. All workspace-scoped queries filter by workspace_id so
 * sites' data stay isolated from each other.
 */
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export const nowIso = () => new Date().toISOString();
export const newId = () => randomUUID();

export interface UserRow { id: string; email: string; name: string; password_hash: string; role: string; created_at: string }
export interface WorkspaceRow {
  id: string; owner_id: string; name: string; domain: string; lang: string; cms: string;
  connection_type: string; connection_json: string; weights_json: string | null;
  settings_json: string; created_at: string; archived: number;
}
export interface ArticleRow {
  id: string; workspace_id: string; title: string; slug: string; primary_keyword: string;
  secondary_keywords_json: string; intent: string; target_words: number; status: string;
  content_html: string; meta_title: string; meta_description: string; featured_image: string;
  brief_id: string | null; competitor_urls_json: string; last_score_json: string | null;
  published_url: string; created_by: string; created_at: string; updated_at: string;
}
export interface VersionRow {
  id: string; article_id: string; version_no: number; title: string; content_html: string;
  meta_title: string; meta_description: string; note: string; score_total: number | null;
  created_by: string; created_at: string;
}
export interface ReportRow { id: string; workspace_id: string; article_id: string | null; type: string; payload_json: string; created_at: string; created_by: string | null }
export interface BriefRow { id: string; workspace_id: string; keyword: string; status: string; brief_json: string; created_at: string; updated_at: string }

export class Repos {
  constructor(private db: DatabaseSync) {}

  // ---------- users ----------
  createUser(email: string, name: string, passwordHash: string, role = 'user'): UserRow {
    const row: UserRow = { id: newId(), email: email.toLowerCase(), name, password_hash: passwordHash, role, created_at: nowIso() };
    this.db.prepare('INSERT INTO users (id, email, name, password_hash, role, created_at) VALUES (?,?,?,?,?,?)')
      .run(row.id, row.email, row.name, row.password_hash, row.role, row.created_at);
    return row;
  }
  findUserByEmail(email: string): UserRow | null {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as UserRow | null ?? null;
  }
  findUserById(id: string): UserRow | null {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | null ?? null;
  }

  // ---------- workspaces & members ----------
  createWorkspace(ownerId: string, data: { name: string; domain?: string; lang?: string; cms?: string }): WorkspaceRow {
    const row: WorkspaceRow = {
      id: newId(), owner_id: ownerId, name: data.name, domain: data.domain ?? '',
      lang: data.lang ?? 'fa', cms: data.cms ?? 'other', connection_type: 'none',
      connection_json: '{}', weights_json: null, settings_json: '{}',
      created_at: nowIso(), archived: 0,
    };
    this.db.prepare(`INSERT INTO workspaces (id, owner_id, name, domain, lang, cms, connection_type, connection_json, weights_json, settings_json, created_at, archived)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id, row.owner_id, row.name, row.domain, row.lang, row.cms, row.connection_type, row.connection_json, row.weights_json, row.settings_json, row.created_at, row.archived);
    this.db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?,?,?)')
      .run(row.id, ownerId, 'owner');
    return row;
  }
  listWorkspacesForUser(userId: string): WorkspaceRow[] {
    return this.db.prepare(`SELECT w.* FROM workspaces w
      JOIN workspace_members m ON m.workspace_id = w.id
      WHERE m.user_id = ? AND w.archived = 0 ORDER BY w.created_at DESC`).all(userId) as WorkspaceRow[];
  }
  findWorkspace(id: string): WorkspaceRow | null {
    return this.db.prepare('SELECT * FROM workspaces WHERE id = ? AND archived = 0').get(id) as WorkspaceRow | null ?? null;
  }
  updateWorkspace(id: string, fields: Partial<Pick<WorkspaceRow, 'name' | 'domain' | 'lang' | 'cms' | 'connection_type' | 'connection_json' | 'weights_json' | 'settings_json' | 'archived'>>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(typeof v === 'boolean' ? (v ? 1 : 0) : v);
    }
    if (sets.length === 0) return;
    vals.push(id);
    this.db.prepare(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  memberRole(workspaceId: string, userId: string): string | null {
    const r = this.db.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?')
      .get(workspaceId, userId) as { role: string } | undefined;
    return r?.role ?? null;
  }
  addMember(workspaceId: string, email: string, role: string): { ok: boolean; message: string } {
    const user = this.findUserByEmail(email);
    if (!user) return { ok: false, message: 'کاربری با این ایمیل ثبت‌نام نکرده است' };
    this.db.prepare('INSERT OR REPLACE INTO workspace_members (workspace_id, user_id, role) VALUES (?,?,?)')
      .run(workspaceId, user.id, role);
    return { ok: true, message: `«${user.name}» با نقش ${role} اضافه شد` };
  }
  removeMember(workspaceId: string, userId: string) {
    this.db.prepare('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role != ?')
      .run(workspaceId, userId, 'owner');
  }
  listMembers(workspaceId: string) {
    return this.db.prepare(`SELECT u.id, u.email, u.name, m.role FROM workspace_members m
      JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ?`).all(workspaceId);
  }

  // ---------- articles ----------
  createArticle(workspaceId: string, userId: string, data: Partial<ArticleRow> & { title: string }): ArticleRow {
    const row: ArticleRow = {
      id: newId(), workspace_id: workspaceId, title: data.title, slug: data.slug ?? '',
      primary_keyword: data.primary_keyword ?? '', secondary_keywords_json: data.secondary_keywords_json ?? '[]',
      intent: data.intent ?? '', target_words: data.target_words ?? 0, status: data.status ?? 'draft',
      content_html: data.content_html ?? '', meta_title: data.meta_title ?? '',
      meta_description: data.meta_description ?? '', featured_image: data.featured_image ?? '',
      brief_id: data.brief_id ?? null, competitor_urls_json: data.competitor_urls_json ?? '[]',
      last_score_json: null, published_url: data.published_url ?? '',
      created_by: userId, created_at: nowIso(), updated_at: nowIso(),
    };
    this.db.prepare(`INSERT INTO articles (id, workspace_id, title, slug, primary_keyword, secondary_keywords_json, intent, target_words, status, content_html, meta_title, meta_description, featured_image, brief_id, competitor_urls_json, last_score_json, published_url, created_by, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id, row.workspace_id, row.title, row.slug, row.primary_keyword, row.secondary_keywords_json, row.intent, row.target_words, row.status, row.content_html, row.meta_title, row.meta_description, row.featured_image, row.brief_id, row.competitor_urls_json, row.last_score_json, row.published_url, row.created_by, row.created_at, row.updated_at);
    return row;
  }
  findArticle(workspaceId: string, id: string): ArticleRow | null {
    return this.db.prepare('SELECT * FROM articles WHERE id = ? AND workspace_id = ?')
      .get(id, workspaceId) as ArticleRow | null ?? null;
  }
  listArticles(workspaceId: string, opts: { status?: string; limit?: number; offset?: number } = {}) {
    const { status, limit = 100, offset = 0 } = opts;
    const rows = status
      ? this.db.prepare(`SELECT * FROM articles WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(workspaceId, status, limit, offset)
      : this.db.prepare(`SELECT * FROM articles WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`).all(workspaceId, limit, offset);
    const countRow = status
      ? this.db.prepare('SELECT COUNT(*) as c FROM articles WHERE workspace_id = ? AND status = ?').get(workspaceId, status) as { c: number }
      : this.db.prepare('SELECT COUNT(*) as c FROM articles WHERE workspace_id = ?').get(workspaceId) as { c: number };
    return { rows: rows as ArticleRow[], total: countRow.c };
  }
  updateArticle(workspaceId: string, id: string, fields: Partial<ArticleRow>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    sets.push('updated_at = ?');
    vals.push(nowIso());
    vals.push(workspaceId, id);
    this.db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE workspace_id = ? AND id = ?`).run(...vals);
  }
  deleteArticle(workspaceId: string, id: string) {
    this.db.prepare('DELETE FROM articles WHERE workspace_id = ? AND id = ?').run(workspaceId, id);
    this.db.prepare('DELETE FROM article_versions WHERE article_id = ?').run(id);
  }
  workspaceArticleIds(workspaceId: string): { id: string; title: string; primary_keyword: string; word_target: number }[] {
    return this.db.prepare('SELECT id, title, primary_keyword, target_words FROM articles WHERE workspace_id = ? AND primary_keyword != \'\'')
      .all(workspaceId) as { id: string; title: string; primary_keyword: string; word_target: number }[];
  }
  saveLastScore(articleId: string, scoreJson: string) {
    this.db.prepare('UPDATE articles SET last_score_json = ?, updated_at = ? WHERE id = ?').run(scoreJson, nowIso(), articleId);
  }

  // ---------- versions ----------
  createVersion(article: ArticleRow, userId: string, note: string, scoreTotal: number | null): VersionRow {
    const maxRow = this.db.prepare('SELECT COALESCE(MAX(version_no), 0) as m FROM article_versions WHERE article_id = ?')
      .get(article.id) as { m: number };
    const row: VersionRow = {
      id: newId(), article_id: article.id, version_no: maxRow.m + 1,
      title: article.title, content_html: article.content_html,
      meta_title: article.meta_title, meta_description: article.meta_description,
      note, score_total: scoreTotal, created_by: userId, created_at: nowIso(),
    };
    this.db.prepare(`INSERT INTO article_versions (id, article_id, version_no, title, content_html, meta_title, meta_description, note, score_total, created_by, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(row.id, row.article_id, row.version_no, row.title, row.content_html, row.meta_title, row.meta_description, row.note, row.score_total, row.created_by, row.created_at);
    return row;
  }
  listVersions(articleId: string): VersionRow[] {
    return this.db.prepare('SELECT * FROM article_versions WHERE article_id = ? ORDER BY version_no DESC').all(articleId) as VersionRow[];
  }
  findVersion(versionId: string): VersionRow | null {
    return this.db.prepare('SELECT * FROM article_versions WHERE id = ?').get(versionId) as VersionRow | null ?? null;
  }
  lastVersionTime(articleId: string): string | null {
    const r = this.db.prepare('SELECT created_at FROM article_versions WHERE article_id = ? ORDER BY version_no DESC LIMIT 1')
      .get(articleId) as { created_at: string } | undefined;
    return r?.created_at ?? null;
  }

  // ---------- reports ----------
  createReport(workspaceId: string, type: string, payload: unknown, articleId?: string, userId?: string): ReportRow {
    const row: ReportRow = {
      id: newId(), workspace_id: workspaceId, article_id: articleId ?? null, type,
      payload_json: JSON.stringify(payload), created_at: nowIso(), created_by: userId ?? null,
    };
    this.db.prepare('INSERT INTO reports (id, workspace_id, article_id, type, payload_json, created_at, created_by) VALUES (?,?,?,?,?,?,?)')
      .run(row.id, row.workspace_id, row.article_id, row.type, row.payload_json, row.created_at, row.created_by);
    return row;
  }
  listReports(workspaceId: string, type?: string, limit = 50): ReportRow[] {
    return (type
      ? this.db.prepare('SELECT * FROM reports WHERE workspace_id = ? AND type = ? ORDER BY created_at DESC LIMIT ?').all(workspaceId, type, limit)
      : this.db.prepare('SELECT * FROM reports WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?').all(workspaceId, limit)) as ReportRow[];
  }
  findReport(workspaceId: string, id: string): ReportRow | null {
    return this.db.prepare('SELECT * FROM reports WHERE id = ? AND workspace_id = ?').get(id, workspaceId) as ReportRow | null ?? null;
  }

  // ---------- briefs ----------
  createBrief(workspaceId: string, keyword: string, briefJson: string): BriefRow {
    const row: BriefRow = { id: newId(), workspace_id: workspaceId, keyword, status: 'draft', brief_json: briefJson, created_at: nowIso(), updated_at: nowIso() };
    this.db.prepare('INSERT INTO briefs (id, workspace_id, keyword, status, brief_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(row.id, row.workspace_id, row.keyword, row.status, row.brief_json, row.created_at, row.updated_at);
    return row;
  }
  updateBrief(workspaceId: string, id: string, fields: { brief_json?: string; status?: string }) {
    const sets: string[] = ['updated_at = ?'];
    const vals: unknown[] = [nowIso()];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    vals.push(workspaceId, id);
    this.db.prepare(`UPDATE briefs SET ${sets.join(', ')} WHERE workspace_id = ? AND id = ?`).run(...vals);
  }
  findBrief(workspaceId: string, id: string): BriefRow | null {
    return this.db.prepare('SELECT * FROM briefs WHERE id = ? AND workspace_id = ?').get(id, workspaceId) as BriefRow | null ?? null;
  }
  listBriefs(workspaceId: string): BriefRow[] {
    return this.db.prepare('SELECT * FROM briefs WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId) as BriefRow[];
  }

  // ---------- secrets ----------
  setSecret(workspaceId: string, key: string, valueEnc: string) {
    this.db.prepare('INSERT INTO secrets (workspace_id, key, value_enc) VALUES (?,?,?) ON CONFLICT(workspace_id, key) DO UPDATE SET value_enc = excluded.value_enc')
      .run(workspaceId, key, valueEnc);
  }
  getSecret(workspaceId: string, key: string): string | null {
    const r = this.db.prepare('SELECT value_enc FROM secrets WHERE workspace_id = ? AND key = ?').get(workspaceId, key) as { value_enc: string } | undefined;
    return r?.value_enc ?? null;
  }
  deleteSecret(workspaceId: string, key: string) {
    this.db.prepare('DELETE FROM secrets WHERE workspace_id = ? AND key = ?').run(workspaceId, key);
  }

  // ---------- activity ----------
  logActivity(workspaceId: string | null, userId: string | null, action: string, entity: string, entityId: string | null, meta: Record<string, unknown> | null, ip: string) {
    this.db.prepare(`INSERT INTO activity (workspace_id, user_id, action, entity, entity_id, meta_json, ip, created_at)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(workspaceId, userId, action, entity, entityId, JSON.stringify(meta ?? {}), ip, nowIso());
  }
  listActivity(workspaceId: string, limit = 100) {
    return this.db.prepare('SELECT * FROM activity WHERE workspace_id = ? ORDER BY id DESC LIMIT ?').all(workspaceId, limit);
  }

  // ---------- stats ----------
  workspaceStats(workspaceId: string) {
    const articles = this.db.prepare('SELECT COUNT(*) as c FROM articles WHERE workspace_id = ?').get(workspaceId) as { c: number };
    const briefs = this.db.prepare('SELECT COUNT(*) as c FROM briefs WHERE workspace_id = ?').get(workspaceId) as { c: number };
    const reports = this.db.prepare('SELECT COUNT(*) as c FROM reports WHERE workspace_id = ?').get(workspaceId) as { c: number };
    const scored = this.db.prepare(`SELECT last_score_json FROM articles WHERE workspace_id = ? AND last_score_json IS NOT NULL`).all(workspaceId) as { last_score_json: string }[];
    const scores = scored.map((r) => (JSON.parse(r.last_score_json) as { score: number }).score).filter((n) => Number.isFinite(n));
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const published = this.db.prepare(`SELECT COUNT(*) as c FROM articles WHERE workspace_id = ? AND status = 'published'`).get(workspaceId) as { c: number };
    return { articles: articles.c, published: published.c, briefs: briefs.c, reports: reports.c, avgScore };
  }
}
