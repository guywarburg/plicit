import type { Message } from '@plicit/db';
import { getAnthropic, DEFAULT_MODEL } from '@plicit/llm';
import { loadConfig } from '@plicit/config';
import type { ClosedConversation } from './findStale.js';
import { SYSTEM_PROMPT, TOOLS } from './prompts.js';

export interface ToolCall {
  name: 'flag_meeting' | 'flag_task' | 'enrich_knowledge' | 'no_action';
  input: Record<string, unknown>;
}

export interface Classification {
  summary: string;
  toolCalls: ToolCall[];
  rawJson: string;
}

function formatTime(ts: number, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(ts));
}

function senderLabel(msg: Message): string {
  if (msg.fromMe) return 'me';
  return msg.senderJid?.split('@')[0] ?? 'unknown';
}

function renderConversation(conv: ClosedConversation, tz: string): string {
  const header = [
    `Chat: ${conv.chatName ?? conv.chatJid}`,
    `Group: ${conv.isGroup ? 'yes' : 'no'}`,
    `Spans: ${new Date(conv.startedTs).toISOString()} → ${new Date(conv.endedTs).toISOString()}`,
    `Messages: ${conv.messages.length}`,
  ].join('\n');
  const lines = conv.messages
    .map((m) => {
      const t = formatTime(m.ts, tz);
      const text = m.text ?? `[${m.mediaType ?? 'no-text'}]`;
      return `[${t}] ${senderLabel(m)}: ${text}`;
    })
    .join('\n');
  return `${header}\n\n${lines}`;
}

export async function classifyConversation(conv: ClosedConversation): Promise<Classification> {
  const cfg = loadConfig();
  const anthropic = getAnthropic();

  const userBlock = [
    `Today is ${new Date().toISOString()} in ${cfg.TZ}.`,
    `Use that timezone when interpreting relative times.`,
    '',
    renderConversation(conv, cfg.TZ),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: TOOLS,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: userBlock }],
      },
    ],
  });

  const toolCalls: ToolCall[] = [];
  const textParts: string[] = [];
  for (const block of response.content) {
    if (block.type === 'tool_use') {
      toolCalls.push({
        name: block.name as ToolCall['name'],
        input: block.input as Record<string, unknown>,
      });
    } else if (block.type === 'text') {
      textParts.push(block.text);
    }
  }

  const toolSummary = toolCalls
    .map((c) => (typeof c.input.summary === 'string' ? c.input.summary.trim() : ''))
    .find((s) => s.length > 0);
  const summary = toolSummary ?? textParts.join('\n').trim() ?? '';

  return {
    summary: summary || '(no summary)',
    toolCalls,
    rawJson: JSON.stringify(response),
  };
}
