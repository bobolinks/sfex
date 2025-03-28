import { EventDispatcher } from './event';
export type TEventMapConfigurable = {
    configChanged: {
        key: string;
        value: any;
    };
};
export declare class Configurable<T extends Record<string, any> = Record<string, any>, E extends TEventMapConfigurable = TEventMapConfigurable> extends EventDispatcher<E> {
    protected file?: string;
    readonly cfg: T;
    readonly hasFile: any;
    constructor(def: T, file?: string);
    setValue(p: string, value: any): void;
    saveConfig(): void;
}
