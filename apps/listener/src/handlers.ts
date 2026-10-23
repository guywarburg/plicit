import type { BaileysEventMap, Chat, WAMessage } from 'baileys';
import { getDb, chats as chatsTable, messages as messagesTable } from '@plicit/db';
import { sql } from 'drizzle-orm';
import { logger } from './logger.js';

function tsFromMessage(msg: WAMessage): number {
  // messageTimestamp is seconds since epoch
  const raw = msg.messageTimestamp;
  if (typeof raw === 'number') return raw * 1000;
  if (raw && typeof raw === 'object' && 'low' in raw) {
    // Long.js shape from protobuf
    return Number((raw as { low: number }).low) * 1000;
  }
  return Date.now();
}

function extractText(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    null
  );
}

function extractMediaType(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  if (m.imageMessage) return 'image';
  if (m.videoMessage) return 'video';
  if (m.audioMessage) return 'audio';
  if (m.documentMessage) return 'document';
  if (m.stickerMessage) return 'sticker';
  if (m.locationMessage) return 'location';
  return null;
}

export async function handleMessagesUpsert(
  ev: BaileysEventMap['messages.upsert'],
): Promise<number | null> {
  const db = getDb();
  let latestTs: number | null = null;

  for (const msg of ev.messages) {
    if (!msg.key.id || !msg.key.remoteJid) continue;
    const chatJid = msg.key.remoteJid;
    const ts = tsFromMessage(msg);
    latestTs = latestTs && latestTs > ts ? latestTs : ts;

    db.insert(chatsTable)
      .values({
        jid: chatJid,
        isGroup: chatJid.endsWith('@g.us'),
        lastMessageTs: ts,
      })
      .onConflictDoUpdate({
        target: chatsTable.jid,
        set: { lastMessageTs: sql`max(coalesce(${chatsTable.lastMessageTs}, 0), ${ts})` },
      })
      .run();

    db.insert(messagesTable)
      .values({
        id: msg.key.id,
        chatJid,
        senderJid: msg.key.participant ?? msg.key.remoteJid,
        fromMe: !!msg.key.fromMe,
        ts,
        text: extractText(msg),
        mediaType: extractMediaType(msg),
        mediaPath: null,
        rawJson: JSON.stringify(msg),
      })
      .onConflictDoNothing()
      .run();
  }
  return latestTs;
}

export async function handleChatsUpsert(chats: Chat[]): Promise<void> {
  const db = getDb();
  for (const chat of chats) {
    if (!chat.id) continue;
    db.insert(chatsTable)
      .values({
        jid: chat.id,
        name: chat.name ?? null,
        isGroup: chat.id.endsWith('@g.us'),
      })
      .onConflictDoUpdate({
        target: chatsTable.jid,
        set: { name: chat.name ?? null },
      })
      .run();
  }
}

export async function handleHistorySync(
  ev: BaileysEventMap['messaging-history.set'],
): Promise<void> {
  logger.info(
    { chats: ev.chats.length, messages: ev.messages.length, isLatest: ev.isLatest },
    'history sync',
  );
  await handleChatsUpsert(ev.chats);
  if (ev.messages.length) {
    await handleMessagesUpsert({ messages: ev.messages, type: 'append' });
  }
}
