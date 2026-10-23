import { loadConfig } from '@plicit/config';
import { logger } from './logger.js';
import { startSocket } from './socket.js';
import { startIpcServer } from './ipc.js';

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection — keeping process alive');
});
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaughtException — keeping process alive');
});

async function main() {
  const cfg = loadConfig();
  logger.info({ tz: cfg.TZ, ipc: cfg.LISTENER_IPC }, 'plicit listener starting');

  const socket = await startSocket();
  const ipc = await startIpcServer(socket);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    await ipc.close();
    await socket.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});
