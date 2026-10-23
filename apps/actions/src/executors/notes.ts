import { mkdirSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { requireConfig } from '@plicit/config';
import { renderSourceMarkdown, sourceFrontmatter, type ItemSource } from '../source.js';

export type Domain = 'work' | 'peko' | 'personal';

export interface KnowledgeInput {
  topic: string;
  content_md: string;
  tags?: string[];
  domain?: Domain;
}

export interface MeetingInput {
  title: string;
  start_iso: string;
  end_iso: string;
  attendees?: string[];
  location?: string;
  notes?: string;
}

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return base || 'untitled';
}

function repoRoot(): string {
  return requireConfig('NOTES_REPO_PATH');
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function appendFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, content, 'utf8');
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function appendKnowledge(payload: KnowledgeInput, source?: ItemSource): string {
  const repo = repoRoot();
  const sourceMd = source ? `\n\n${renderSourceMarkdown(source)}\n` : '';
  const dated = `\n\n## ${today()}\n\n${payload.content_md.trim()}${sourceMd}\n`;

  if (payload.domain) {
    const path = join(repo, payload.domain, 'decisions', `${slugify(payload.topic)}.md`);
    if (!existsSync(path)) {
      const header = [
        '---',
        `topic: ${payload.topic}`,
        `tags: ${JSON.stringify(['plicit', ...(payload.tags ?? [])])}`,
        `domain: ${payload.domain}`,
        '---',
        '',
        `# ${payload.topic}`,
      ].join('\n');
      writeFile(path, header + dated);
    } else {
      appendFile(path, dated);
    }
    return path;
  }

  const inboxPath = join(repo, 'inbox.md');
  const tagSuffix = payload.tags?.length ? ` _(tags: ${payload.tags.join(', ')})_` : '';
  const block = `\n### ${today()} — ${payload.topic}${tagSuffix}\n\n${payload.content_md.trim()}${sourceMd}\n`;
  if (!existsSync(inboxPath)) {
    writeFile(inboxPath, `# Inbox\n${block}`);
  } else {
    appendFile(inboxPath, block);
  }
  return inboxPath;
}

export function appendMeetingNote(payload: MeetingInput, source?: ItemSource): string {
  const repo = repoRoot();
  const date = (payload.start_iso ?? '').slice(0, 10) || today();
  const path = join(repo, 'work', 'meetings', `${date}-${slugify(payload.title)}.md`);
  const frontmatter = [
    '---',
    `title: ${payload.title}`,
    `start: ${payload.start_iso}`,
    `end: ${payload.end_iso}`,
    `attendees: ${JSON.stringify(payload.attendees ?? [])}`,
    ...(payload.location ? [`location: ${payload.location}`] : []),
    ...(source ? sourceFrontmatter(source) : []),
    'tags: [plicit, meeting]',
    '---',
    '',
    `# ${payload.title}`,
    '',
    '## Notes',
    '',
    payload.notes?.trim() ?? '',
    '',
    ...(source ? ['## Source', '', renderSourceMarkdown(source), ''] : []),
  ].join('\n');
  writeFile(path, frontmatter);
  return path;
}

export function writeDailySummary(date: string, body: string): string {
  const repo = repoRoot();
  const path = join(repo, 'plicit', 'daily', `${date}.md`);
  writeFile(path, body);
  return path;
}
