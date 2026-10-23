import { eq } from 'drizzle-orm';
import {
  getDb,
  analyses as analysesTable,
  reviewItems as reviewItemsTable,
  conversations as conversationsTable,
  type NewAnalysis,
  type NewReviewItem,
} from '@plicit/db';
import type { Classification, ToolCall } from './classify.js';

const TOOL_TO_KIND: Record<ToolCall['name'], 'calendar' | 'task' | 'knowledge' | null> = {
  flag_meeting: 'calendar',
  flag_task: 'task',
  enrich_knowledge: 'knowledge',
  no_action: null,
};

const TOOL_TO_CATEGORY: Record<ToolCall['name'], NewAnalysis['category']> = {
  flag_meeting: 'meeting',
  flag_task: 'task',
  enrich_knowledge: 'knowledge',
  no_action: 'none',
};

function pickCategory(calls: ToolCall[]): NewAnalysis['category'] {
  const priority: NewAnalysis['category'][] = ['meeting', 'task', 'knowledge', 'none'];
  const seen = new Set(calls.map((c) => TOOL_TO_CATEGORY[c.name]));
  for (const p of priority) if (seen.has(p)) return p;
  return 'none';
}

export function persistClassification(
  conversationId: number,
  classification: Classification,
): { analysisId: number; reviewItemIds: number[] } {
  const db = getDb();
  const now = Date.now();
  const category = pickCategory(classification.toolCalls);
  const confidence = inferConfidence(classification.toolCalls);

  const newAnalysis: NewAnalysis = {
    conversationId,
    summary: classification.summary,
    category,
    confidence,
    rawJson: classification.rawJson,
    createdTs: now,
  };
  const analysis = db.insert(analysesTable).values(newAnalysis).returning().get();

  const reviewItemIds: number[] = [];
  for (const call of classification.toolCalls) {
    const kind = TOOL_TO_KIND[call.name];
    if (!kind) continue;
    const item: NewReviewItem = {
      analysisId: analysis.id,
      kind,
      payloadJson: JSON.stringify(call.input),
      status: 'pending',
      createdTs: now,
    };
    const inserted = db.insert(reviewItemsTable).values(item).returning().get();
    reviewItemIds.push(inserted.id);
  }

  db.update(conversationsTable)
    .set({ status: 'analyzed' })
    .where(eq(conversationsTable.id, conversationId))
    .run();

  return { analysisId: analysis.id, reviewItemIds };
}

function inferConfidence(calls: ToolCall[]): number {
  if (calls.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const c of calls) {
    const v = c.input.confidence;
    if (typeof v === 'number') {
      total += v;
      count += 1;
    }
  }
  return count === 0 ? 50 : Math.round(total / count);
}
