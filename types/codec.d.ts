/**
 * BinJson codec
 */
declare enum TagCode {
    undefined,
    null,
    boolean,
    uint8Array,
    number,
    bigint,
    string,
    object,
    array,
    end,
    colon,
    one
}
export type ValPrimeType = undefined | null | boolean | Uint8Array | number | bigint | string;
export type ValDict = Record<string, ValPrimeType>;
export type ValType = ValPrimeType | Array<ValPrimeType | ValDict> | Record<string, ValPrimeType | ValDict>;
export declare const textEncoder: TextEncoder;
export declare const textDecoder: TextDecoder;
declare class ScalableArray {
    offset: number;
    array: Uint8Array;
    append(b: Uint8Array | string): void;
    appendStringWithTag(s: string): void;
    appendTag(b: TagCode): void;
    final(): Uint8Array;
}
declare const _default: {
    encode<T extends ValType>(object: T, out?: ScalableArray): ScalableArray;
    decode<T extends ValType>(buffer: Uint8Array, cxt?: {
        pos: number;
    }): T;
};
export default _default;
