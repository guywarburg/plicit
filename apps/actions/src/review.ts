import prompts from 'prompts';
import { eq, asc } from 'drizzle-orm';
import {
  getDb,
  reviewItems as reviewItemsTable,
  type ReviewItem,
} from '@plicit/db';
import { logger } from './logger.js';
import { createCalendarEvent } from './executors/calendar.js';
import { appendKnowledge } from './executors/notes.js';
import { sendTaskToPaBot } from './executors/paBot.js';
import { loadSource, renderSourceHeader, type ItemSource } from './source.js';

function loadPendingIds(): number[] {
  const db = getDb();
  return db
    .select({ id: reviewItemsTable.id })
    .from(reviewItemsTable)
    .where(eq(reviewItemsTable.status, 'pending'))
    .orderBy(asc(reviewItemsTable.createdTs))
    .all()
    .map((r) => r.id);
}

async function execute(item: ReviewItem, source?: ItemSource): Promise<string> {
  const payload = JSON.parse(item.payloadJson);
  switch (item.kind) {
    case 'calendar':
      return createCalendarEvent(payload, source);
    case 'knowledge':
      return appendKnowledge(payload, source);
    case 'task':
      await sendTaskToPaBot(payload, source);
      return 'sent-to-pa-bot';
  }
}

function setStatus(itemId: number, status: 'approved' | 'rejected' | 'executed', ref?: string) {
  const db = getDb();
  db.update(reviewItemsTable)
    .set({ status, decidedTs: Date.now(), executedRef: ref ?? null })
    .where(eq(reviewItemsTable.id, itemId))
    .run();
}

async function reviewLoop() {
  const pendingIds = loadPendingIds();
  if (pendingIds.length === 0) {
    logger.info('no pending review items');
    return;
  }
  logger.info({ pending: pendingIds.length }, 'starting review');

  for (const id of pendingIds) {
    const source = loadSource(id);
    if (!source) {
      logger.warn({ id }, 'source not found, skipping');
      continue;
    }
    const db = getDb();
    const item = db.select().from(reviewItemsTable).where(eq(reviewItemsTable.id, id)).get();
    if (!item) continue;
    const payload = JSON.parse(item.payloadJson);
    // eslint-disable-next-line no-console
    console.log(
      `\n--- ${item.kind.toUpperCase()} (review #${item.id}) ---\n${renderSourceHeader(source)}\n\npayload:\n${JSON.stringify(payload, null, 2)}\n`,
    );
    const { decision } = await prompts({
      type: 'select',
      name: 'decision',
      message: 'Decision?',
      choices: [
        { title: 'Approve', value: 'approve' },
        { title: 'Reject', value: 'reject' },
        { title: 'Skip for now', value: 'skip' },
        { title: 'Quit', value: 'quit' },
      ],
    });
    if (decision === 'quit' || !decision) break;
    if (decision === 'skip') continue;
    if (decision === 'reject') {
      setStatus(item.id, 'rejected');
      continue;
    }
    try {
      const ref = await execute(item, source);
      setStatus(item.id, 'executed', ref);
      logger.info({ id: item.id, ref }, 'executed');
    } catch (err) {
      setStatus(item.id, 'approved');
      logger.error({ err, id: item.id }, 'execution failed; left as approved');
    }
  }
}

reviewLoop().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
