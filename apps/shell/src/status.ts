import { connect, type Socket } from 'node:net';
import { isAbsolute } from 'node:path';
import { loadConfig, resolveFromRoot } from '@plicit/config';
import type { IpcResponse, ListenerStatus } from '@plicit/wa';

function resolveSocketPath(spec: string): string {
  if (!spec.startsWith('unix:')) throw new Error(`unsupported IPC: ${spec}`);
  const raw = spec.replace(/^unix:/, '');
  return isAbsolute(raw) ? raw : resolveFromRoot(raw);
}

export async function runStatus(): Promise<void> {
  const path = resolveSocketPath(loadConfig().LISTENER_IPC);
  const status = await new Promise<IpcResponse<ListenerStatus>>((res, rej) => {
    const sock: Socket = connect(path);
    let buffer = '';
    sock.once('error', rej);
    sock.once('connect', () => sock.write(JSON.stringify({ type: 'status' }) + '\n'));
    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const nl = buffer.indexOf('\n');
      if (nl !== -1) {
        try {
          res(JSON.parse(buffer.slice(0, nl)));
          sock.end();
        } catch (err) {
          rej(err);
        }
      }
    });
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(status, null, 2));
}
