/**
 * First-start seeding: creates the owner's easy-access admin account
 * (name/email/password configurable via SEED_* env, defaults to
 * «رسول بهادران» / admin@danesh.local / 1234) plus a starter workspace,
 * so the owner can log in with one click without any setup.
 */
import { hashPassword } from '../lib/crypto.js';
import type { AppContext } from '../routes/context.js';

export interface SeedResult {
  created: boolean;
  email: string;
  workspaceName: string;
}

export function seedDefaultAdmin(ctx: AppContext): SeedResult {
  const { cfg, repos } = ctx;
  const email = cfg.SEED_ADMIN_EMAIL.toLowerCase();
  const result: SeedResult = { created: false, email, workspaceName: cfg.SEED_WORKSPACE_NAME };

  if (cfg.SEED_DEFAULT_ADMIN !== 'true') return result;

  let user = repos.findUserByEmail(email);
  if (!user) {
    user = repos.createUser(email, cfg.SEED_ADMIN_NAME, hashPassword(cfg.SEED_ADMIN_PASSWORD), 'admin');
    result.created = true;
    repos.logActivity(null, user.id, 'user.seed-admin', 'user', user.id, { name: cfg.SEED_ADMIN_NAME }, '');
  }

  // ensure the owner has at least one starter workspace
  const existing = repos.listWorkspacesForUser(user.id);
  if (existing.length === 0) {
    const ws = repos.createWorkspace(user.id, { name: cfg.SEED_WORKSPACE_NAME });
    repos.logActivity(ws.id, user.id, 'workspace.seed', 'workspace', ws.id, { name: ws.name }, '');
    result.created = true;
  }

  return result;
}
