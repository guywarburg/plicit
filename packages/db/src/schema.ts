import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const chats = sqliteTable('chats', {
  jid: text('jid').primaryKey(),
  name: text('name'),
  isGroup: integer('is_group', { mode: 'boolean' }).notNull().default(false),
  lastMessageTs: integer('last_message_ts'),
  lastAnalyzedTs: integer('last_analyzed_ts'),
});

export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    chatJid: text('chat_jid')
      .notNull()
      .references(() => chats.jid),
    senderJid: text('sender_jid'),
    fromMe: integer('from_me', { mode: 'boolean' }).notNull().default(false),
    ts: integer('ts').notNull(),
    text: text('text'),
    mediaType: text('media_type'),
    mediaPath: text('media_path'),
    rawJson: text('raw_json').notNull(),
  },
  (t) => ({
    chatTsIdx: index('messages_chat_ts_idx').on(t.chatJid, t.ts),
  }),
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    chatJid: text('chat_jid')
      .notNull()
      .references(() => chats.jid),
    startedTs: integer('started_ts').notNull(),
    endedTs: integer('ended_ts'),
    messageCount: integer('message_count').notNull().default(0),
    status: text('status', { enum: ['open', 'stale', 'analyzed'] })
      .notNull()
      .default('open'),
  },
  (t) => ({
    chatStatusIdx: index('conversations_chat_status_idx').on(t.chatJid, t.status),
  }),
);

export const analyses = sqliteTable('analyses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversationId: integer('conversation_id')
    .notNull()
    .references(() => conversations.id),
  summary: text('summary').notNull(),
  category: text('category', { enum: ['meeting', 'task', 'knowledge', 'none'] }).notNull(),
  confidence: integer('confidence').notNull().default(0), // 0-100
  rawJson: text('raw_json').notNull(),
  createdTs: integer('created_ts').notNull(),
});

export const reviewItems = sqliteTable(
  'review_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    analysisId: integer('analysis_id')
      .notNull()
      .references(() => analyses.id),
    kind: text('kind', { enum: ['calendar', 'task', 'knowledge'] }).notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'executed'] })
      .notNull()
      .default('pending'),
    createdTs: integer('created_ts').notNull(),
    decidedTs: integer('decided_ts'),
    executedRef: text('executed_ref'),
  },
  (t) => ({
    statusIdx: index('review_items_status_idx').on(t.status),
  }),
);

export const dailySummaries = sqliteTable('daily_summaries', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  markdownPath: text('markdown_path').notNull(),
  generatedTs: integer('generated_ts').notNull(),
});

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type ReviewItem = typeof reviewItems.$inferSelect;
export type NewReviewItem = typeof reviewItems.$inferInsert;
export type DailySummary = typeof dailySummaries.$inferSelect;
