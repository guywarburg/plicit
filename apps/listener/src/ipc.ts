import { createServer, type Server } from 'node:net';
import { unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { loadConfig, resolveFromRoot } from '@plicit/config';
import type { IpcRequest, IpcResponse, ListenerStatus } from '@plicit/wa';
import { logger } from './logger.js';
import type { SocketHandle } from './socket.js';

function resolveSocketPath(spec: string): string {
  if (!spec.startsWith('unix:')) {
    throw new Error(`Only unix:... IPC is supported in this build. Got: ${spec}`);
  }
  const raw = spec.replace(/^unix:/, '');
  return isAbsolute(raw) ? raw : resolveFromRoot(raw);
}

export interface IpcServer {
  close: () => Promise<void>;
}

export async function startIpcServer(handle: SocketHandle): Promise<IpcServer> {
  const cfg = loadConfig();
  const path = resolveSocketPath(cfg.LISTENER_IPC);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) unlinkSync(path);

  const server: Server = createServer((conn) => {
    let buffer = '';
    conn.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const reply = await handleRequest(line, handle);
        conn.write(JSON.stringify(reply) + '\n');
      }
    });
    conn.on('error', (err) => logger.warn({ err }, 'ipc client error'));
  });

  await new Promise<void>((res, rej) => {
    server.once('error', rej);
    server.listen(path, () => res());
  });
  logger.info({ path }, 'ipc listening');

  return {
    close: () =>
      new Promise<void>((res) => {
        server.close(() => {
          if (existsSync(path)) {
            try {
              unlinkSync(path);
            } catch {
              // socket file already gone, nothing to clean up
            }
          }
          res();
        });
      }),
  };
}

async function handleRequest(line: string, handle: SocketHandle): Promise<IpcResponse> {
  let req: IpcRequest;
  try {
    req = JSON.parse(line);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  try {
    switch (req.type) {
      case 'sendMessage': {
        await handle.socket.sendMessage(req.jid, { text: req.text });
        return { ok: true, data: null };
      }
      case 'status': {
        const status: ListenerStatus = {
          connected: !!handle.socket?.user,
          uptimeSeconds: Math.round((Date.now() - handle.startedAt) / 1000),
          lastMessageTs: handle.lastMessageTs,
        };
        return { ok: true, data: status };
      }
      default:
        return { ok: false, error: `unknown type: ${(req as { type: string }).type}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
