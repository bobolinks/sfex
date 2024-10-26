import { Taskable, TaskableConfig } from "./taskable";

type FuncCallback = (params: any) => any;
type TaskListener = {
  cb: FuncCallback;
  target: any;
};

type Task = {
  name: string;
  listener: TaskListener;
  params: any;
  tmFired: Date;
  tmStart: Date;
  resolve: any;
  reject: any;
};

export type SysStats = TaskableConfig & {
  task: {
    waiting: number;
    pending: string;
    progress: number;
    last: {
      state: 'success' | 'error';
      message: string;
    };
  };
};

export class Sys<T extends SysStats = SysStats> extends Taskable<T> {
  private readonly listener: Record<string, TaskListener> = {};
  private readonly queue: Array<Task> = [];

  constructor(def?: T) {
    super({
      period: '* * * * * *',
      task: {
        waiting: 0,
        pending: '',
        progress: 0,
        last: {
          state: 'success',
          message: ''
        }
      },
      ...def,
    } as T, 'task');
  }
  init() {
    this.start(true);
  }
  register<T extends any>(name: string, cb: (params: T) => any, target?: any) {
    if (this.listener[name]) {
      throw `Listener[${name}] aready exists`;
    }
    this.listener[name] = { cb, target };
  }
  protected onStateChanged() {
    // do nothing
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onError(e: Error) {
    // do nothing
  }
  async fire<T extends any, R extends any = any>(name: string, params?: T): Promise<R> {
    const listener = this.listener[name];
    if (!listener) {
      throw `Listener[${name}] not found`;
    }
    return new Promise((resolve, reject) => {
      const task = { name, listener, params, resolve, reject, tmFired: new Date(), tmStart: new Date(), };
      this.queue.push(task);
      this.cfg.task.waiting = this.queue.length;
      this.onStateChanged();
    });
  }
  async taskMain() {
    while (this.queue.length) {
      const task = this.queue.shift();
      if (!task) {
        break;
      }
      task.tmStart.setTime(new Date().getTime());
      this.cfg.task.waiting = this.queue.length;
      this.cfg.task.pending = `Task[${task.name}] begins`;
      try {
        this.onStateChanged();
        const rs = await task.listener.cb.call(task.listener.target, task.params);
        const now = new Date();
        const tmDiff = now.getTime() - task.tmStart.getTime();
        this.cfg.task.pending = '';
        this.cfg.task.last.state = 'success';
        this.cfg.task.last.message = `Task[${task.name}] completed, eslapsed[${tmDiff / 1000}s]`;
        this.onStateChanged();
        task.resolve(rs);
      } catch (e: any) {
        this.cfg.task.pending = '';
        this.cfg.task.last.state = 'error';
        this.cfg.task.last.message = e.toString();
        this.onError(e);
        this.onStateChanged();
        task.reject(e);
      }
    }
  }
}