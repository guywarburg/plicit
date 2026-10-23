import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { and, gte, lt, eq } from 'drizzle-orm';
import pino from 'pino';
import { loadConfig, requireConfig } from '@plicit/config';
import {
  getDb,
  analyses as analysesTable,
  conversations as conversationsTable,
  chats as chatsTable,
  reviewItems as reviewItemsTable,
  dailySummaries as dailySummariesTable,
} from '@plicit/db';

const logger = pino({
  level: loadConfig().LOG_LEVEL,
  transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});

function dayBounds(date: Date, tz: string): { startMs: number; endMs: number; key: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const key = fmt.format(date); // YYYY-MM-DD in tz
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  // Compute the local midnight by formatting candidates back through the tz.
  // Simpler: assume tz offset is stable for the day and use Date with local components.
  const startMs = Date.parse(`${key}T00:00:00`);
  const endMs = startMs + 24 * 3600 * 1000;
  void y;
  void m;
  void d;
  return { startMs, endMs, key };
}

interface RowJoined {
  category: string;
  summary: string;
  chatName: string | null;
  chatJid: string;
  reviewKind: string | null;
  reviewPayload: string | null;
}

function loadDay(startMs: number, endMs: number): RowJoined[] {
  const db = getDb();
  const rows = db
    .select({
      category: analysesTable.category,
      summary: analysesTable.summary,
      chatName: chatsTable.name,
      chatJid: chatsTable.jid,
      reviewKind: reviewItemsTable.kind,
      reviewPayload: reviewItemsTable.payloadJson,
    })
    .from(analysesTable)
    .innerJoin(conversationsTable, eq(analysesTable.conversationId, conversationsTable.id))
    .innerJoin(chatsTable, eq(conversationsTable.chatJid, chatsTable.jid))
    .leftJoin(reviewItemsTable, eq(reviewItemsTable.analysisId, analysesTable.id))
    .where(and(gte(analysesTable.createdTs, startMs), lt(analysesTable.createdTs, endMs)))
    .all();
  return rows;
}

function renderMarkdown(date: string, rows: RowJoined[]): string {
  const meetings = rows.filter((r) => r.reviewKind === 'calendar');
  const tasks = rows.filter((r) => r.reviewKind === 'task');
  const knowledge = rows.filter((r) => r.reviewKind === 'knowledge');
  const summaries = dedupeBy(rows, (r) => `${r.chatJid}|${r.summary}`);

  const sec = (title: string, body: string) => `## ${title}\n\n${body || '_none_'}\n`;

  return [
    `---`,
    `date: ${date}`,
    `tags: [plicit, daily]`,
    `---`,
    ``,
    `# ${date} — Plicit daily summary`,
    ``,
    sec(
      'Highlights',
      summaries.map((r) => `- **${r.chatName ?? r.chatJid}**: ${r.summary}`).join('\n'),
    ),
    sec(
      'Meetings captured',
      meetings.map((r) => `- ${r.chatName ?? r.chatJid}: ${prettyPayload(r.reviewPayload)}`).join('\n'),
    ),
    sec(
      'Tasks captured',
      tasks.map((r) => `- ${r.chatName ?? r.chatJid}: ${prettyPayload(r.reviewPayload)}`).join('\n'),
    ),
    sec(
      'Knowledge added',
      knowledge.map((r) => `- ${r.chatName ?? r.chatJid}: ${prettyPayload(r.reviewPayload)}`).join('\n'),
    ),
  ].join('\n');
}

function dedupeBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function prettyPayload(json: string | null): string {
  if (!json) return '';
  try {
    const obj = JSON.parse(json);
    if (obj.title) return `${obj.title}${obj.start_iso ? ` @ ${obj.start_iso}` : ''}`;
    if (obj.topic) return `${obj.topic}`;
    return JSON.stringify(obj);
  } catch {
    return json;
  }
}

async function main() {
  const cfg = loadConfig();
  const repo = requireConfig('NOTES_REPO_PATH');
  const dailyDir = resolve(repo, 'plicit', 'daily');
  mkdirSync(dailyDir, { recursive: true });

  const target = new Date(); // today; cron wires this up
  const { startMs, endMs, key } = dayBounds(target, cfg.TZ);
  const rows = loadDay(startMs, endMs);
  if (rows.length === 0) {
    logger.info({ date: key }, 'no analyses for the day, skipping');
    return;
  }

  const md = renderMarkdown(key, rows);
  const path = join(dailyDir, `${key}.md`);
  writeFileSync(path, md, 'utf8');

  const db = getDb();
  db.insert(dailySummariesTable)
    .values({ date: key, markdownPath: path, generatedTs: Date.now() })
    .onConflictDoUpdate({
      target: dailySummariesTable.date,
      set: { markdownPath: path, generatedTs: Date.now() },
    })
    .run();

  logger.info({ path, rows: rows.length }, 'daily summary written');
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
