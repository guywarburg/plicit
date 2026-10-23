import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { z } from 'zod';

/**
 * Walk up from a starting directory until we find a marker file. Used to
 * locate the repo root regardless of which workspace process.cwd() reports.
 */
function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  while (true) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(start);
    dir = parent;
  }
}

export const REPO_ROOT = findRepoRoot();
loadDotenv({ path: resolve(REPO_ROOT, '.env') });

/** Resolve a possibly-relative path against the repo root. */
export function resolveFromRoot(p: string): string {
  return resolve(REPO_ROOT, p);
}

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).default('sqlite:./data/plicit.db'),
  NOTES_REPO_PATH: z.string().min(1).optional(),
  PA_BOT_JID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REFRESH_TOKEN: z.string().min(1).optional(),
  STALE_MINUTES: z.coerce.number().int().positive().default(60),
  TZ: z.string().min(1).default('Asia/Jerusalem'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LISTENER_IPC: z.string().min(1).default('unix:./data/listener.sock'),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function loadConfig(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function requireConfig<K extends keyof Config>(key: K): NonNullable<Config[K]> {
  const cfg = loadConfig();
  const value = cfg[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required env var: ${String(key)}`);
  }
  return value as NonNullable<Config[K]>;
}
