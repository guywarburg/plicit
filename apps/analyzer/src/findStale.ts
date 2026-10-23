import { and, asc, gt, eq, isNull, or, sql } from 'drizzle-orm';
import {
  getDb,
  chats as chatsTable,
  messages as messagesTable,
  conversations as conversationsTable,
  type Message,
  type NewConversation,
} from '@plicit/db';
import { loadConfig } from '@plicit/config';
import { groupByGap } from './grouping.js';

export interface ClosedConversation {
  conversationId: number;
  chatJid: string;
  chatName: string | null;
  isGroup: boolean;
  startedTs: number;
  endedTs: number;
  messages: Message[];
}

/**
 * Walk every chat with new messages since its last analysis. Group those
 * messages into conversations split by gaps ≥ staleMs. The trailing group is
 * left "open" if its last message is more recent than now - staleMs.
 *
 * Idempotent: if a conversation row already exists for a (chat_jid, started_ts),
 * we reuse it instead of creating a duplicate.
 */
export function detectAndCloseStaleConversations(now = Date.now()): ClosedConversation[] {
  const cfg = loadConfig();
  const staleMs = cfg.STALE_MINUTES * 60 * 1000;
  const db = getDb();
  const result: ClosedConversation[] = [];

  const eligibleChats = db
    .select()
    .from(chatsTable)
    .where(
      and(
        eq(chatsTable.isGroup, false),
        sql`${chatsTable.jid} NOT LIKE '%@broadcast'`,
        sql`${chatsTable.lastMessageTs} IS NOT NULL`,
        or(
          isNull(chatsTable.lastAnalyzedTs),
          gt(chatsTable.lastMessageTs, chatsTable.lastAnalyzedTs),
        ),
      ),
    )
    .all();

  for (const chat of eligibleChats) {
    const since = chat.lastAnalyzedTs ?? 0;
    const msgs = db
      .select()
      .from(messagesTable)
      .where(and(eq(messagesTable.chatJid, chat.jid), gt(messagesTable.ts, since)))
      .orderBy(asc(messagesTable.ts))
      .all();
    if (msgs.length === 0) continue;

    const groups = groupByGap(msgs, staleMs);
    let highestAnalyzedTs = chat.lastAnalyzedTs ?? 0;
    for (const group of groups) {
      const last = group[group.length - 1]!;
      const groupClosed = now - last.ts >= staleMs;
      if (!groupClosed) continue;

      const first = group[0]!;
      const existing = db
        .select()
        .from(conversationsTable)
        .where(
          and(
            eq(conversationsTable.chatJid, chat.jid),
            eq(conversationsTable.startedTs, first.ts),
          ),
        )
        .get();

      let conversationId: number;
      if (existing) {
        conversationId = existing.id;
        if (existing.status !== 'analyzed') {
          db.update(conversationsTable)
            .set({ status: 'stale', endedTs: last.ts, messageCount: group.length })
            .where(eq(conversationsTable.id, existing.id))
            .run();
        }
      } else {
        const insert: NewConversation = {
          chatJid: chat.jid,
          startedTs: first.ts,
          endedTs: last.ts,
          messageCount: group.length,
          status: 'stale',
        };
        const inserted = db.insert(conversationsTable).values(insert).returning().get();
        conversationId = inserted.id;
      }

      result.push({
        conversationId,
        chatJid: chat.jid,
        chatName: chat.name,
        isGroup: chat.isGroup,
        startedTs: first.ts,
        endedTs: last.ts,
        messages: group,
      });
      if (last.ts > highestAnalyzedTs) highestAnalyzedTs = last.ts;
    }

    if (highestAnalyzedTs > (chat.lastAnalyzedTs ?? 0)) {
      db.update(chatsTable)
        .set({ lastAnalyzedTs: highestAnalyzedTs })
        .where(eq(chatsTable.jid, chat.jid))
        .run();
    }
  }
  return result;
}
