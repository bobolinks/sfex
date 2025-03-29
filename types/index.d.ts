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

declare type Options = {
  /** fs root */
  fsroot?: string;
  sites: Record<string, string>;
  /** websocket for admin */
  ws: boolean;
  wsMethods: RpcModule;
};

declare function notify(method: string, ...params: any[]): boolean;

declare function main<T extends ArgsSfex<any>>(
  env: Environment<T>,
  methods: Record<string, RpcMethod>,
  options?: Partial<Options>,
): Promise<any>;

declare const expr: express.Express;

//-------------------------------------------------------------
declare function proxiable<T>(object: T, cb?: (p: string, value: any) => void): T;

//-------------------------------------------------------------
/**
 * The minimal basic Event that can be dispatched by a {@link EventDispatcher<>}.
 */
declare interface BaseEvent<TEventType extends string = string> {
  readonly type: TEventType;
}
/**
* The minimal expected contract of a fired Event that was dispatched by a {@link EventDispatcher<>}.
*/
declare interface Event<TEventType extends string = string, TTarget = unknown> {
  readonly type: TEventType;
  readonly target: TTarget;
}
declare type EventListener<TEventData, TEventType extends string, TTarget> = (event: TEventData & Event<TEventType, TTarget>) => void;
/**
* JavaScript events for custom objects
* @example
* ```typescript
* // Adding events to a custom object
* class Car extends EventDispatcher {
*   start() {
*     this.dispatchEvent( { type: 'start', message: 'vroom vroom!' } );
*   }
* };
* // Using events with the custom object
* const car = new Car();
* car.addEventListener( 'start', ( event ) => {
*   alert( event.message );
* } );
* car.start();
* ```
* @see {@link https://github.com/mrdoob/eventdispatcher.js | mrdoob EventDispatcher on GitHub}
* @see {@link https://threejs.org/docs/index.html#api/en/core/EventDispatcher | Official Documentation}
* @see {@link https://github.com/mrdoob/three.js/blob/master/src/core/EventDispatcher.js | Source}
*/
 declare class EventDispatcher<TEventMap extends {} = {}> {
  private _listeners;
  /**
   * Adds a listener to an event type.
   * @param type The type of event to listen to.
   * @param listener The function that gets called when the event is fired.
   */
  addEventListener<T extends Extract<keyof TEventMap, string>>(type: T, listener: EventListener<TEventMap[T], T, this>): void;
  /**
   * Checks if listener is added to an event type.
   * @param type The type of event to listen to.
   * @param listener The function that gets called when the event is fired.
   */
  hasEventListener<T extends Extract<keyof TEventMap, string>>(type: T, listener: EventListener<TEventMap[T], T, this>): boolean;
  /**
   * Removes a listener from an event type.
   * @param type The type of the listener that gets removed.
   * @param listener The listener function that gets removed.
   */
  removeEventListener<T extends Extract<keyof TEventMap, string>>(type: T, listener: EventListener<TEventMap[T], T, this>): void;
  /**
   * Fire an event type.
   * @param event The event that gets fired.
   */
  dispatchEvent<T extends Extract<keyof TEventMap, string>>(event: BaseEvent<T> & TEventMap[T]): void;
}

//-------------------------------------------------------------
declare type TEventMapConfigurable = {
  configChanged: {
      key: string;
      value: any;
  };
};
declare  class Configurable<T extends Record<string, any> = Record<string, any>, E extends TEventMapConfigurable = TEventMapConfigurable> extends EventDispatcher<E> {
  protected file?: string | undefined;
  readonly cfg: T;
  readonly hasFile: boolean | "" | undefined;
  constructor(def: T, file?: string | undefined);
  setValue(p: string, value: any): void;
  saveConfig(): void;
}


//-------------------------------------------------------------
declare function boolean(value: any): value is boolean;
declare function string(value: any): value is string;
declare function number(value: any): value is number;
declare function error(value: any): value is Error;
declare function func(value: any): value is Function;
declare function array<T>(value: any): value is T[];
declare function stringArray(value: any): value is string[];

//-------------------------------------------------------------
declare class Queue<T extends {}, E extends {} = {}> extends EventDispatcher<E> {
  protected isPending: boolean;
  protected queue: T[];
  constructor();
  push(task: T | T[]): void;
  protected taskMain(task: T): Promise<any>;
  private queueMain;
}


//-------------------------------------------------------------
declare type TaskableConfig = {
  /** period or minutes */
  period: string | number;
};
declare type TEventMapTaskable = TEventMapConfigurable & {
  started: {};
};
declare class Taskable<T extends TaskableConfig = TaskableConfig, E extends TEventMapTaskable = TEventMapTaskable> extends Configurable<T, E> {
  protected isPending: boolean;
  /** per 1 minutes */
  private job?;
  constructor(def?: T, nameOrFile?: string);
  start(immediately?: boolean, period?: string): Promise<void>;
  restart(period?: string): Promise<void>;
  protected taskMain(): Promise<void>;
}


//-------------------------------------------------------------
declare type SysStats = TaskableConfig & {
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
declare class Sys<T extends SysStats = SysStats> extends Taskable<T> {
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
