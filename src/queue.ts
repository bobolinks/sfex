/* eslint-disable @typescript-eslint/ban-types */
import { EventDispatcher } from './event';
import { logger } from './logger';

export class Queue<T extends {}, E extends {} = {}> extends EventDispatcher<E> {
  protected isPending = false;
  protected queue: T[] = [];

  constructor() {
    super();
  }
  push(task: T | T[]) {
    if (Array.isArray(task)) {
      this.queue.push(...task);
    } else {
      this.queue.push(task);
    }
    this.queueMain();
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async taskMain(task: T): Promise<any> {
    // do nothings
  }
  private async queueMain() {
    if (this.isPending || !this.queue.length) {
      return;
    }
    this.isPending = true;
    let task: T;
    try {
      while ((task = this.queue.shift() as any)) {
        await this.taskMain(task);
      }
    } catch (e: any) {
      logger.error(e);
    } finally {
      this.isPending = false;
    }
  }
}