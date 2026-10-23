import pino from 'pino';
import { loadConfig } from '@plicit/config';

const cfg = loadConfig();

export const logger = pino({
  level: cfg.LOG_LEVEL,
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
