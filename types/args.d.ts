import { ArgTypes, Args } from '.';
export declare function parseArgs<T extends Record<string, ArgTypes>>(argsAnno: T): Args<T>;
export declare function printHelp(argsAnno: Record<string, ArgTypes>): void;
