import { Configurable, type TEventMapConfigurable } from './configurable';
export type TaskableConfig = {
    /** period or minutes */
    period: string | number;
};
export type TEventMapTaskable = TEventMapConfigurable & {
    started: {};
};
export declare class Taskable<T extends TaskableConfig = TaskableConfig, E extends TEventMapTaskable = TEventMapTaskable> extends Configurable<T, E> {
    protected isPending: boolean;
    /** per 1 minutes */
    private job?;
    constructor(def?: T, nameOrFile?: string);
    start(immediately?: boolean, period?: string): Promise<void>;
    restart(period?: string): Promise<void>;
    protected taskMain(): Promise<void>;
}
