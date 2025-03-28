import { EventDispatcher } from './event';
export declare class Queue<T extends {}, E extends {} = {}> extends EventDispatcher<E> {
    protected isPending: boolean;
    protected queue: T[];
    constructor();
    push(task: T | T[]): void;
    protected taskMain(task: T): Promise<any>;
    private queueMain;
}
