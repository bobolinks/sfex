/* eslint-disable @typescript-eslint/ban-types */
/**
 * The minimal basic Event that can be dispatched by a {@link EventDispatcher<>}.
 */
export interface BaseEvent<TEventType extends string = string> {
  readonly type: TEventType;
}

/**
* The minimal expected contract of a fired Event that was dispatched by a {@link EventDispatcher<>}.
*/
export interface Event<TEventType extends string = string, TTarget = unknown> {
  readonly type: TEventType;
  readonly target: TTarget;
}

export type EventListener<TEventData, TEventType extends string, TTarget> = (
  event: TEventData & Event<TEventType, TTarget>,
) => void;

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
export class EventDispatcher<TEventMap extends {} = {}> {
  private _listeners: Record<string, any> = {};

  /**
   * Adds a listener to an event type.
   * @param type The type of event to listen to.
   * @param listener The function that gets called when the event is fired.
   */
  addEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: EventListener<TEventMap[T], T, this>,
  ): void {
    if (this._listeners === undefined) this._listeners = {};

    const listeners = this._listeners;

    if (listeners[type] === undefined) {
      listeners[type] = [];
    }

    if (listeners[type].indexOf(listener) === - 1) {
      listeners[type].push(listener);
    }
  }
  on<T extends Extract<keyof TEventMap, string>>(type: T, listener: (event: TEventMap[T]) => void): void {
    return this.addEventListener(type, listener);
  }
  once<T extends Extract<keyof TEventMap, string>>(type: T, listener: (event: TEventMap[T]) => void): void {
    const lis = (event: TEventMap[T]) => {
      this.removeEventListener(type, lis);
      listener.call(this, event);
    };
    return this.addEventListener(type, lis);
  }

  /**
   * Checks if listener is added to an event type.
   * @param type The type of event to listen to.
   * @param listener The function that gets called when the event is fired.
   */
  hasEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: EventListener<TEventMap[T], T, this>,
  ): boolean {
    if (this._listeners === undefined) return false;

    const listeners = this._listeners;

    return listeners[type] !== undefined && listeners[type].indexOf(listener) !== - 1;
  }

  /**
   * Removes a listener from an event type.
   * @param type The type of the listener that gets removed.
   * @param listener The listener function that gets removed.
   */
  removeEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: EventListener<TEventMap[T], T, this>,
  ): void {
    if (this._listeners === undefined) return;

    const listeners = this._listeners;
    const listenerArray = listeners[type];

    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(listener);
      if (index !== - 1) {
        listenerArray.splice(index, 1);
      }
    }
  }

  /**
   * Removes all listeners
   */
  clearEventListeners(): void {
    if (Object.keys(this._listeners).length) {
      this._listeners = {};
    }
  }

  /**
   * Fire an event type.
   * @param event The event that gets fired.
   */
  dispatchEvent<T extends Extract<keyof TEventMap, string>>(event: BaseEvent<T> & TEventMap[T]): void {
    if (this._listeners === undefined) return;

    const listeners = this._listeners;
    const listenerArray = listeners[event.type];

    if (listenerArray !== undefined) {
      (event as any).target = this;

      // Make a copy, in case listeners are removed while iterating.
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event);
      }

      (event as any).target = null;
    }
  }

  /**
   * Fire an event type.
   * @param event The event that gets fired.
   */
  emit<T extends Extract<keyof TEventMap, string>>(type: T, event?: TEventMap[T]): void {
    if (this._listeners === undefined) return;

    const listeners = this._listeners;
    const listenerArray = listeners[type];

    if (listenerArray !== undefined) {
      // Make a copy, in case listeners are removed while iterating.
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event);
      }
    }
  }
}
