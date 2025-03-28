import { FileArray } from 'express-fileupload';
import type { DispContext, RpcModule } from '.';
export declare const config: {
    fsroot: string;
};
export default class implements RpcModule {
    [key: string]: import(".").RpcMethod;
    ls(cxt: DispContext): Promise<{
        [k: string]: any;
    }>;
    rename(cxt: DispContext, newPath: string): Promise<boolean>;
    mkdir(cxt: DispContext, subs: Array<string>): Promise<void>;
    rm(cxt: DispContext): Promise<boolean>;
    read(cxt: DispContext, { encoding }: {
        encoding: 'utf8' | 'binary';
    }): Promise<any>;
    write(cxt: DispContext, data: Buffer): Promise<void>;
    upload(cxt: DispContext, params: FileArray | {
        files: FileArray;
    }): Promise<void>;
}
