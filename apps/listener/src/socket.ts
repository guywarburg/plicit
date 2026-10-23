import { mkdirSync } from 'node:fs';
import { resolveFromRoot } from '@plicit/config';
import {
  default as makeWASocket,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from 'baileys';
import qrcode from 'qrcode-terminal';
import { logger } from './logger.js';
import { handleMessagesUpsert, handleChatsUpsert, handleHistorySync } from './handlers.js';

const AUTH_DIR = resolveFromRoot('data/auth');

export interface SocketHandle {
  socket: WASocket;
  startedAt: number;
  lastMessageTs: number | null;
  close: () => Promise<void>;
}

export async function startSocket(): Promise<SocketHandle> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const handle: SocketHandle = {
    socket: undefined as unknown as WASocket,
    startedAt: Date.now(),
    lastMessageTs: null,
    close: async () => {
      try {
        handle.socket?.end(undefined);
      } catch {
        // ignore: closing an already-closed socket throws
      }
    },
  };

  let consecutiveFailures = 0;
  const nextBackoffMs = (): number => {
    const base = Math.min(60_000, 2_000 * 2 ** Math.min(consecutiveFailures, 5));
    return Math.round(base * (0.5 + Math.random()));
  };

  const connect = (): WASocket => {
    const sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.macOS('Plicit'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      logger: logger.child({ mod: 'baileys' }),
    });
    handle.socket = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        logger.warn('Pair WhatsApp by scanning the QR below (or run `pnpm shell login`):');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        logger.info('connected to WhatsApp');
        consecutiveFailures = 0;
      }
      if (connection === 'close') {
        const status =
          (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
            ?.statusCode ?? 0;
        const loggedOut = status === DisconnectReason.loggedOut;
        consecutiveFailures += 1;
        const delayMs = nextBackoffMs();
        logger.warn(
          { status, loggedOut, consecutiveFailures, delayMs },
          'connection closed; will reconnect',
        );
        if (loggedOut) {
          logger.error('Session invalidated. Re-pair with `pnpm shell login`. Exiting.');
          process.exit(2);
        }
        setTimeout(() => {
          logger.info({ consecutiveFailures }, 'reconnecting');
          try {
            connect();
          } catch (err) {
            logger.error({ err }, 'reconnect failed; will retry on next close');
          }
        }, delayMs);
      }
    });

    sock.ev.on('messages.upsert', async (ev) => {
      try {
        const ts = await handleMessagesUpsert(ev);
        if (ts && (handle.lastMessageTs === null || ts > handle.lastMessageTs)) {
          handle.lastMessageTs = ts;
        }
      } catch (err) {
        logger.error({ err }, 'messages.upsert handler failed');
      }
    });

    sock.ev.on('chats.upsert', (chats) => {
      handleChatsUpsert(chats).catch((err) => logger.error({ err }, 'chats.upsert failed'));
    });

    sock.ev.on('messaging-history.set', (ev) => {
      handleHistorySync(ev).catch((err) => logger.error({ err }, 'history sync failed'));
    });

    return sock;
  };

  connect();
  return handle;
}
