/* eslint-disable @typescript-eslint/ban-types */
import schedule, { Job } from 'node-schedule';
import { logger } from './logger';
import { Configurable, type TEventMapConfigurable } from './configurable';

process.on('SIGINT', async function () {
  await schedule.gracefulShutdown();
  process.exit(0);
});

export type TaskableConfig = {
  /** period or minutes */
  period: string | number;
};

export type TEventMapTaskable = TEventMapConfigurable & {
  started: {};
};

export class Taskable<T extends TaskableConfig = TaskableConfig, E extends TEventMapTaskable = TEventMapTaskable> extends Configurable<T, E> {
  protected isPending = false;
  /** per 1 minutes */
  private job?: Job;
  constructor(def?: T, nameOrFile?: string) {
    /** per 1 minutes */
    super({ period: '*/1 * * * *', ...def } as T, nameOrFile);
  }
  async start(immediately?: boolean, period?: string) {
    if (typeof period === 'string' && this.cfg.period !== period) {
      this.cfg.period = period;
      this.saveConfig();
    }
    const main = async () => {
      if (this.isPending) {
        return;
      }
      this.isPending = true;
      try {
        await this.taskMain();
      } catch (e) {
        logger.error(e);
      } finally {
        this.isPending = false;
      }
    };
    this.job = schedule.scheduleJob(typeof this.cfg.period === 'string' ? this.cfg.period : `*/${this.cfg.period} * * * *`, main);
    this.dispatchEvent({ type: 'started' as any });
    if (immediately) {
      main();
    }
  }
  async restart(period?: string) {
    if (this.job) {
      schedule.cancelJob(this.job);
      this.isPending = false;
    }
    return this.start(false, period);
  }
  protected async taskMain() {
    // do nothing
    logger.debug('taskMain');
  }
}