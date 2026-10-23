import pino from 'pino';
import { loadConfig } from '@plicit/config';

export const logger = pino({
  level: loadConfig().LOG_LEVEL,
  transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
