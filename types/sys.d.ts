import { Taskable, TaskableConfig } from "./taskable";
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
export declare class Sys<T extends SysStats = SysStats> extends Taskable<T> {
    private readonly listener;
    private readonly queue;
    constructor(def?: T);
    init(): void;
    register<T extends any>(name: string, cb: (params: T) => any, target?: any): void;
    protected onStateChanged(): void;
    protected onError(e: Error): void;
    fire<T extends any, R extends any = any>(name: string, params?: T): Promise<R>;
    taskMain(): Promise<void>;
}
