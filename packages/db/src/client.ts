import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { dirname, isAbsolute } from 'node:path';
import { mkdirSync } from 'node:fs';
import { loadConfig, resolveFromRoot } from '@plicit/config';
import * as schema from './schema.js';

let cached: ReturnType<typeof drizzle<typeof schema>> | undefined;
let cachedRaw: Database.Database | undefined;

function resolveSqlitePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith('sqlite:')) {
    throw new Error(
      `Only sqlite:// URLs are supported in this build. Got: ${databaseUrl.split('://')[0] ?? databaseUrl}`,
    );
  }
  const raw = databaseUrl.replace(/^sqlite:/, '');
  if (raw === ':memory:' || raw.startsWith(':')) return raw;
  return isAbsolute(raw) ? raw : resolveFromRoot(raw);
}

export function getDb() {
  if (cached) return cached;
  const cfg = loadConfig();
  const path = resolveSqlitePath(cfg.DATABASE_URL);
  mkdirSync(dirname(path), { recursive: true });
  cachedRaw = new Database(path);
  cachedRaw.pragma('journal_mode = WAL');
  cachedRaw.pragma('foreign_keys = ON');
  cached = drizzle(cachedRaw, { schema });
  return cached;
}

export function getRawDb(): Database.Database {
  if (!cachedRaw) getDb();
  return cachedRaw!;
}

export function closeDb(): void {
  cachedRaw?.close();
  cached = undefined;
  cachedRaw = undefined;
}
