/* eslint-disable @typescript-eslint/no-unused-vars */

import express from 'express';

declare interface ArgType<T = 'string' | 'boolean' | 'number', V = string | boolean | number> {
  /** default is string  */
  type?: T;
  /** is required ? */
  required?: boolean;
  /** short key from arg */
  alias?: string;
  /** arg description */
  description: string;
  /** default value */
  default?: V;
}

declare interface ArgTypeWT<T = 'boolean' | 'number', V = boolean | number> extends ArgType<T, V> {
  type: T;
}

declare type ArgTypes = ArgType<'string', string> | ArgTypeWT<'boolean', boolean> | ArgTypeWT<'number', number>;

declare type Args<T extends Record<string, ArgTypes>> = {
  [P in keyof T]: T[P] extends ArgTypeWT<'boolean', boolean> ? boolean : (T[P] extends ArgTypeWT<'number', number> ? number : string);
}

declare type ArgsSfex<T extends Record<string, ArgTypes>> = Args<T> & {
  port: number;
}

declare function parseArgs<T extends Record<string, ArgTypes>>(argsAnno: T): Args<T>;

declare const JSONRPC = '2.0';

type JsonRpcMessage = {
  jsonrpc: typeof JSONRPC,
  id: number;
  method: string;
  params: Array<any>;
}

type JsonRpcNotify = JsonRpcMessage & {
  isn: true;
}

type JsonRpcResponse = {
  jsonrpc: typeof JSONRPC,
  id: number;
  result?: any;
  error?: { code: number; message: string };
};

declare function rawRpc(): any;

declare type DispContext = {
  path: string;
  req: express.Request;
  rsp: express.Response;
}

declare type RpcMethod = (cxt: DispContext, ...args: Array<any>) => void;

declare interface RpcModule {
  [key: string]: RpcMethod;
}

declare type Environment<T> = {
  /** in debug mode */
  debug: boolean,
  /** vide version */
  version: string,
  /** platform name */
  platform: 'windows' | 'darwin' | 'linux' | string,
  /** service name */
  name: string;
  /** paths */
  paths: {
    /** workspace root path */
    root: string;
    /** fs root path for service */
    fs: string;
    /** temp path */
    temp: string;
    /** for log */
    logs: string;
  },
  /** args passed from cmd line */
  args: T,
};

type Logger = {
  debug(message: any, ...args: any[]): void;
  info(message: any, ...args: any[]): void;
  warn(message: any, ...args: any[]): void;
  error(message: any, ...args: any[]): void;
};

declare const logger: Logger;

declare function main<T extends ArgsSfex<any>>(
  env: Environment<T>,
  methods: Record<string, RpcMethod>,
  sites?: Record<string, string>,
): Promise<any>;

declare const expr: express.Express;

