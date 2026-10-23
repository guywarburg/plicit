import { eq, and, gte, lte, asc } from 'drizzle-orm';
import {
  getDb,
  reviewItems as reviewItemsTable,
  analyses as analysesTable,
  conversations as conversationsTable,
  chats as chatsTable,
  messages as messagesTable,
  type Message,
} from '@plicit/db';

export interface SourceExcerpt {
  ts: number;
  sender: string;
  text: string;
}

export interface ItemSource {
  reviewItemId: number;
  conversationId: number;
  analysisId: number;
  chatJid: string;
  chatName: string | null;
  isGroup: boolean;
  startedTs: number;
  endedTs: number | null;
  messageCount: number;
  summary: string;
  firstMessage: SourceExcerpt | null;
  lastMessage: SourceExcerpt | null;
}

const EXCERPT_MAX = 240;

function senderLabel(msg: Message): string {
  if (msg.fromMe) return 'me';
  return msg.senderJid?.split('@')[0] ?? 'unknown';
}

function toExcerpt(msg: Message | undefined): SourceExcerpt | null {
  if (!msg) return null;
  const raw = msg.text ?? `[${msg.mediaType ?? 'no-text'}]`;
  const text = raw.length > EXCERPT_MAX ? `${raw.slice(0, EXCERPT_MAX)}…` : raw;
  return { ts: msg.ts, sender: senderLabel(msg), text };
}

export function loadSource(reviewItemId: number): ItemSource | null {
  const db = getDb();
  const row = db
    .select({
      item: reviewItemsTable,
      analysis: analysesTable,
      conv: conversationsTable,
      chat: chatsTable,
    })
    .from(reviewItemsTable)
    .innerJoin(analysesTable, eq(reviewItemsTable.analysisId, analysesTable.id))
    .innerJoin(conversationsTable, eq(analysesTable.conversationId, conversationsTable.id))
    .innerJoin(chatsTable, eq(conversationsTable.chatJid, chatsTable.jid))
    .where(eq(reviewItemsTable.id, reviewItemId))
    .get();
  if (!row) return null;

  const range = and(
    eq(messagesTable.chatJid, row.conv.chatJid),
    gte(messagesTable.ts, row.conv.startedTs),
    row.conv.endedTs !== null ? lte(messagesTable.ts, row.conv.endedTs) : undefined,
  );
  const first = db
    .select()
    .from(messagesTable)
    .where(range)
    .orderBy(asc(messagesTable.ts))
    .limit(1)
    .get();
  const last = db
    .select()
    .from(messagesTable)
    .where(range)
    .orderBy(asc(messagesTable.ts))
    .limit(1)
    .offset(Math.max(row.conv.messageCount - 1, 0))
    .get();

  return {
    reviewItemId,
    conversationId: row.conv.id,
    analysisId: row.analysis.id,
    chatJid: row.chat.jid,
    chatName: row.chat.name,
    isGroup: row.chat.isGroup,
    startedTs: row.conv.startedTs,
    endedTs: row.conv.endedTs,
    messageCount: row.conv.messageCount,
    summary: row.analysis.summary,
    firstMessage: toExcerpt(first),
    lastMessage: toExcerpt(last),
  };
}

function fmtRange(start: number, end: number | null): string {
  const startIso = new Date(start).toISOString();
  if (end === null || end === start) return startIso;
  return `${startIso} → ${new Date(end).toISOString()}`;
}

/**
 * Compact human-readable header for review CLI.
 */
export function renderSourceHeader(src: ItemSource): string {
  const lines = [
    `chat:    ${src.chatName ?? '(no name)'}  [${src.chatJid}]`,
    `range:   ${fmtRange(src.startedTs, src.endedTs)}  (${src.messageCount} msgs)`,
    `summary: ${src.summary}`,
  ];
  if (src.firstMessage) {
    lines.push(`first:   ${src.firstMessage.sender}: ${src.firstMessage.text}`);
  }
  if (src.lastMessage && src.messageCount > 1) {
    lines.push(`last:    ${src.lastMessage.sender}: ${src.lastMessage.text}`);
  }
  return lines.join('\n');
}

/**
 * Markdown block embedded into persisted notes so the artifact is self-describing.
 */
export function renderSourceMarkdown(src: ItemSource): string {
  const lines = [
    '> _Captured by Plicit_',
    `> - chat: ${src.chatName ?? '(no name)'} (\`${src.chatJid}\`)`,
    `> - conversation: #${src.conversationId} — ${fmtRange(src.startedTs, src.endedTs)}`,
    `> - messages: ${src.messageCount}`,
    `> - review item: #${src.reviewItemId}`,
  ];
  if (src.summary && src.summary !== '(no summary)') {
    lines.push(`> - summary: ${src.summary}`);
  }
  return lines.join('\n');
}

/**
 * Frontmatter fields (key/value pairs) for files that already use frontmatter.
 */
export function sourceFrontmatter(src: ItemSource): string[] {
  return [
    `source_chat: ${JSON.stringify(src.chatName ?? src.chatJid)}`,
    `source_jid: ${src.chatJid}`,
    `source_conversation_id: ${src.conversationId}`,
    `source_review_item_id: ${src.reviewItemId}`,
    `source_started: ${new Date(src.startedTs).toISOString()}`,
    ...(src.endedTs !== null ? [`source_ended: ${new Date(src.endedTs).toISOString()}`] : []),
    `source_message_count: ${src.messageCount}`,
  ];
}
