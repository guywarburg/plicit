import { requireConfig } from '@plicit/config';
import { ipcCall } from '../ipcClient.js';
import type { ItemSource } from '../source.js';

export async function sendTaskToPaBot(
  payload: {
    title: string;
    due_iso?: string;
    notes?: string;
  },
  source?: ItemSource,
): Promise<void> {
  const jid = requireConfig('PA_BOT_JID');
  const lines = [`new task: ${payload.title}`];
  if (payload.due_iso) lines.push(`due: ${payload.due_iso}`);
  if (payload.notes) lines.push('', payload.notes);
  if (source) {
    lines.push(
      '',
      `from: ${source.chatName ?? source.chatJid} · conv #${source.conversationId} · review #${source.reviewItemId}`,
    );
  }

  const res = await ipcCall({ type: 'sendMessage', jid, text: lines.join('\n') });
  if (!res.ok) throw new Error(`listener ipc error: ${res.error}`);
}
