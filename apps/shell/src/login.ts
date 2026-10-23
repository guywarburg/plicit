import { mkdirSync } from 'node:fs';
import { resolveFromRoot } from '@plicit/config';
import {
  default as makeWASocket,
  Browsers,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
} from 'baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';

const AUTH_DIR = resolveFromRoot('data/auth');

export async function runLogin(): Promise<void> {
  mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.macOS('Plicit'),
    printQRInTerminal: false,
    logger: pino({ level: 'warn' }),
  });

  sock.ev.on('creds.update', saveCreds);

  await new Promise<void>((resolveLogin, rejectLogin) => {
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        // eslint-disable-next-line no-console
        console.log('Scan this QR with WhatsApp → Linked Devices:');
        qrcode.generate(qr, { small: true });
      }
      if (connection === 'open') {
        // eslint-disable-next-line no-console
        console.log('paired successfully. Closing.');
        sock.end(undefined);
        resolveLogin();
      }
      if (connection === 'close') {
        const status =
          (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
            ?.statusCode ?? 0;
        if (status === DisconnectReason.loggedOut) {
          rejectLogin(new Error('logged out'));
        }
      }
    });
  });
}
