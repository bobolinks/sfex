/* eslint-disable @typescript-eslint/no-unused-vars */
import fs from 'fs';
import path from 'path';
import { FileArray, UploadedFile } from 'express-fileupload';
import type { DispContext, RpcModule } from '../types';
import { rawRpc } from './decorator';

function checkPath(p: string) {
  if (/\.\./.test(p) || /~/.test(p)) {
    return false;
  }
  return true;
}

function fileStats(p: string) {
  const st = fs.statSync(p);
  return { isd: st.isDirectory(), size: st.size };
}

export const config = {
  fsroot: '',
};

export default class implements RpcModule {
  [key: string]: import("../types").RpcMethod;

  async ls(cxt: DispContext) {
    if (!checkPath(cxt.path)) {
      throw 'not allowed';
    }
    const p = path.join(config.fsroot, cxt.path);
    const ar = fs.readdirSync(p);
    return Object.fromEntries(ar.map((e) => [e, fileStats(path.join(p, e))]));
  }

  async rename(cxt: DispContext, newPath: string) {
    if (!checkPath(cxt.path) || !checkPath(newPath)) {
      throw 'not allowed';
    }
    const po = path.join(config.fsroot, cxt.path);
    const pn = path.join(config.fsroot, newPath);
    fs.renameSync(po, pn);
    return true;
  }

  async mkdir(cxt: DispContext, subs: Array<string>) {
    if (!checkPath(cxt.path)) {
      throw 'not allowed';
    }
    const p = path.join(config.fsroot, cxt.path);
    fs.mkdirSync(p);
    if (subs?.length) {
      for (const sub of subs) {
        fs.mkdirSync(path.join(p, sub));
      }
    }
  }

  async rm(cxt: DispContext) {
    if (!checkPath(cxt.path) || !cxt.path) {
      throw 'not allowed';
    }
    const p = path.join(config.fsroot, cxt.path);
    if (fs.statSync(p).isDirectory()) {
      fs.rmdirSync(p, { recursive: true });
    } else {
      fs.unlinkSync(p);
    }
    return true;
  }

  @rawRpc()
  async read(cxt: DispContext, { encoding }: { encoding: 'utf8' | 'binary' }) {
    if (!checkPath(cxt.path)) {
      throw 'not allowed';
    }
    const p = path.join(config.fsroot, cxt.path);
    return fs.readFileSync(p, encoding || 'utf8');
  }

  @rawRpc()
  async write(cxt: DispContext, data: Buffer) {
    if (!checkPath(cxt.path)) {
      throw 'not allowed';
    }
    const p = path.join(config.fsroot, cxt.path);
    fs.writeFileSync(p, data, 'binary');
  }

  @rawRpc()
  async upload(cxt: DispContext, params: FileArray | { files: FileArray }) {
    if (!checkPath(cxt.path)) {
      throw 'not allowed';
    }

    const files: FileArray = (params as any).files || params;

    for (const file of Object.values(files) as UploadedFile[]) {
      const fn = file.name.replace(/@/mg, '/');
      if (!checkPath(fn)) {
        console.error('not allowed');
        continue;
      }

      const p = path.join(config.fsroot, cxt.path, fn);

      if (fs.existsSync(p)) {
        console.error(`file ${p} already exists`);
        continue;
      }

      await file.mv(p);
    }
  }
}
