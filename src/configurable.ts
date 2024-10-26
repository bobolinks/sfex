import fs from 'fs';
import { proxiable } from "./proxiable";
import { EventDispatcher, } from './event';

export type TEventMapConfigurable = {
  configChanged: { key: string; value: any; };
};

export class Configurable<T extends Record<string, any> = Record<string, any>, E extends TEventMapConfigurable = TEventMapConfigurable> extends EventDispatcher<E> {
  public readonly cfg: T;
  public readonly hasFile;
  constructor(def: T, protected file?: string) {
    super();

    this.cfg = proxiable({ ...def }, (key: string, value: any) => {
      this.dispatchEvent({ type: 'configChanged' as any, key, value });
    });
    this.hasFile = this.file && fs.existsSync(this.file);
    if (this.hasFile && this.file) {
      const d = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
      if (d) {
        Object.assign(this.cfg, d);
      }
    }
  }
  setValue(p: string, value: any) {
    if ((this.cfg as any)[p] === undefined) {
      return;
    }
    (this.cfg as any)[p] = value;
  }
  saveConfig() {
    if (this.hasFile && this.file) {
      fs.writeFileSync(this.file, JSON.stringify(this.cfg), 'utf-8');
    }
  }
}