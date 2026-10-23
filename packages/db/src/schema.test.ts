import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '..', 'drizzle');

function freshDb() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder });
  return { db, raw };
}

describe('schema migrations + CRUD', () => {
  let dbHandle: ReturnType<typeof freshDb>;

  beforeEach(() => {
    dbHandle = freshDb();
  });

  it('inserts and reads a chat', () => {
    const { db } = dbHandle;
    db.insert(schema.chats)
      .values({ jid: 'a@s.whatsapp.net', name: 'Anna', isGroup: false, lastMessageTs: 1000 })
      .run();
    const got = db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.jid, 'a@s.whatsapp.net'))
      .get();
    expect(got?.name).toBe('Anna');
    expect(got?.lastMessageTs).toBe(1000);
  });

  it('cascades a full conversation → analysis → review_item', () => {
    const { db } = dbHandle;
    db.insert(schema.chats).values({ jid: 'a@s.whatsapp.net' }).run();
    const conv = db
      .insert(schema.conversations)
      .values({ chatJid: 'a@s.whatsapp.net', startedTs: 1, endedTs: 100, status: 'stale' })
      .returning()
      .get();
    const analysis = db
      .insert(schema.analyses)
      .values({
        conversationId: conv.id,
        summary: 'test',
        category: 'task',
        confidence: 80,
        rawJson: '{}',
        createdTs: 200,
      })
      .returning()
      .get();
    const item = db
      .insert(schema.reviewItems)
      .values({
        analysisId: analysis.id,
        kind: 'task',
        payloadJson: '{"title":"x"}',
        status: 'pending',
        createdTs: 200,
      })
      .returning()
      .get();
    expect(item.id).toBeGreaterThan(0);
    expect(item.status).toBe('pending');
  });

  it('rejects FK violation when conversation references unknown chat', () => {
    const { db } = dbHandle;
    expect(() =>
      db
        .insert(schema.conversations)
        .values({ chatJid: 'ghost@s.whatsapp.net', startedTs: 1 })
        .run(),
    ).toThrow();
  });
});
