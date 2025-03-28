import { ArgsSfex, Environment } from '../types';
export declare function init<T extends ArgsSfex<any>>(env: Environment<T>): void;
export declare const logger: {
    debug(message: any, ...args: any[]): void;
    info(message: any, ...args: any[]): void;
    warn(message: any, ...args: any[]): void;
    error(message: any, ...args: any[]): void;
};
