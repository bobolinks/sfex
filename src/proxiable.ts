// proxy
export const getProxyRawObject = Symbol('getProxyRawObject');

export function proxiable(object: any, cb?: (p: string, value: any) => void) {
  return new Proxy(object, {
    get(target, p, receiver) {
      if (p === getProxyRawObject) {
        return target;
      }
      if (typeof p !== 'string') {
        return Reflect.get(target, p, receiver);
      }
      const names = p.split('.');
      if (names.length > 1) {
        let o: any = Reflect.get(target, names[0], receiver);
        for (let i = 1; i < names.length; i++) {
          o = o[names[i]];
        }
        return o;
      }
      return Reflect.get(target, p, receiver);
    },
    set: (target, p, newValue, receiver) => {
      if (typeof p !== 'string') {
        return Reflect.set(target, p, newValue, receiver);
      }
      const ov = Reflect.get(target, p, receiver);
      if (ov === newValue) {
        return true;
      }
      let rv = true;
      const names = p.split('.');
      if (names.length > 1) {
        let o: any = Reflect.get(target, names[0], receiver);
        const lastName = names.pop() as string;
        for (let i = 1; i < names.length; i++) {
          o = o[names[i]];
        }
        if (o[lastName] === newValue) {
          return true;
        }
        o[lastName] = newValue;
      } else {
        rv = Reflect.set(target, p, newValue, target);
      }
      if (rv && cb) {
        cb(p, newValue);
      }
      return rv;
    },
  });
}