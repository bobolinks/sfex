/* eslint-disable @typescript-eslint/no-unused-vars */
export function rawRpc() {
  return function (target: any, propertyKey: string) {
    const value = target[propertyKey];
    value.isRawRpc = true;
  };
}