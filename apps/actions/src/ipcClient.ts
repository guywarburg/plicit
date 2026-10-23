import { connect, type Socket } from 'node:net';
import { isAbsolute } from 'node:path';
import { loadConfig, resolveFromRoot } from '@plicit/config';
import type { IpcRequest, IpcResponse } from '@plicit/wa';

function resolveSocketPath(spec: string): string {
  if (!spec.startsWith('unix:')) {
    throw new Error(`Only unix:... IPC is supported in this build. Got: ${spec}`);
  }
  const raw = spec.replace(/^unix:/, '');
  return isAbsolute(raw) ? raw : resolveFromRoot(raw);
}

export async function ipcCall<T = unknown>(req: IpcRequest): Promise<IpcResponse<T>> {
  const path = resolveSocketPath(loadConfig().LISTENER_IPC);
  return new Promise((resolve, reject) => {
    const sock: Socket = connect(path);
    let buffer = '';
    sock.once('error', reject);
    sock.once('connect', () => sock.write(JSON.stringify(req) + '\n'));
    sock.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline !== -1) {
        const line = buffer.slice(0, newline);
        try {
          const parsed = JSON.parse(line) as IpcResponse<T>;
          sock.end();
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}
