import fs from 'fs';
import path from 'path';
import Log4js from 'log4js';
import { ArgsSfex, Environment } from '../types';

export function init<T extends ArgsSfex<any>>(env: Environment<T>) {
  if (!fs.existsSync(env.paths.logs)) {
    fs.mkdirSync(env.paths.logs, { recursive: true });
  }

  Log4js.configure({
    appenders: {
      ruleConsole: { type: 'console' },
      ruleFile: {
        type: 'dateFile',
        filename: path.resolve(env.paths.logs, './e'),
        pattern: 'yyyy-MM-dd.log',
        maxLogSize: 10 * 1000 * 1000,
        numBackups: 10,
        alwaysIncludePattern: true,
      },
    },
    categories: {
      default: { appenders: ['ruleConsole', 'ruleFile'], level: 'info' },
    },
  });
}

const log4js = Log4js.getLogger();

export const logger = {
  debug(message: any, ...args: any[]) {
    log4js.debug(message, ...args);
  },
  info(message: any, ...args: any[]) {
    log4js.info(message, ...args);
  },
  warn(message: any, ...args: any[]) {
    log4js.warn(message, ...args);
  },
  error(message: any, ...args: any[]) {
    log4js.error(message, ...args);
  },
};
