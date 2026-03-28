/* eslint-disable @typescript-eslint/no-unused-vars */
import os from 'os';
import path from 'path';
import express from 'express';
import http from 'http';
import ws from 'ws';
import fileUpload from 'express-fileupload';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import { StringValue } from 'ms';
import { init, logger } from './logger';
import Codec from './codec';
import Fs from './fs';
import { ArgsSfex, DispContext, Environment, JsonRpcMessage, JsonRpcNotify, JsonRpcResponse, RpcModule } from '../types';

process.on('uncaughtException', (err) => {
  console.log(err);
  logger.error('Uncaught Exception: ', err.toString());
  if (err.stack) {
    logger.error(err.stack);
  }
});

/** express */
export const expr = express();

expr.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
expr.use(bodyParser.json({ limit: '100mb' }));
expr.use(bodyParser.raw({ type: 'application/octet-stream', limit: '100mb' }));
expr.use(bodyParser.raw({ type: 'text/plain', limit: '100mb' }));
expr.use(fileUpload());

/** config express */
expr.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.end('OK');
  } else {
    next();
  }
});

function dispMain<T extends ArgsSfex<any>>(base: string, app: express.Express, env: Environment<T>, methods: RpcModule) {
  app.post(base, async (req, rsp) => {
    const [, , method, path] = req.path.match(/^\/([^/]+)\/([^/]+)(.*)$/) || [];
    if (!method) {
      return;
    }
    const mth = methods[method];
    if (!mth) {
      rsp.status(404);
      return rsp.end();
    }
    const cxt: DispContext = {
      path,
      req,
      rsp,
    };
    let params: Array<any> = [];
    const body = req.body;
    const json: JsonRpcMessage = body as any;
    const isRawRpc = (mth as any).isRawRpc;
    if (!isRawRpc && json.jsonrpc !== JSONRPC) {
      rsp.status(500);
      return rsp.end();
    }
    if (!isRawRpc) {
      params = json.params;
    } else {
      const hasBody = (typeof body !== 'object' && body !== undefined) || Object.keys(body).length !== 0;
      const hasQuery = Object.keys(req.query).length !== 0;
      const query = hasQuery ? req.query : undefined;
      const files = req.files;
      const hasFiles = files !== undefined;
      const cnt = (hasBody ? 1 : 0) + (hasQuery ? 1 : 0) + (hasFiles ? 1 : 0);
      if (cnt > 1) {
        params.push({
          ...req.query,
          ...body,
          files,
        });
      } else if (cnt === 1) {
        params.push(files || query || body);
      }
    }
    let rs: any;
    let err: any;
    try {
      rs = await (mth as any).call(methods, cxt, ...params);
    } catch (e) {
      err = e;
    }
    if (!isRawRpc) {
      rsp.json({
        jsonrpc: JSONRPC,
        id: json.id,
        result: err ? undefined : rs,
        error: err,
      } as JsonRpcResponse);
    } else {
      if (typeof rs === 'object') {
        if (rs.buffer && rs.length !== undefined) {
          rsp.write(rs);
        } else {
          rsp.json(rs);
        }
      } else if (!err) {
        if (rs !== undefined) {
          rsp.write(rs);
        }
      } else {
        rsp.status(500);
      }
    }
    rsp.end();
  });
}

async function dispWsMessage(socket: ws.WebSocket, methods: RpcModule, msg: JsonRpcMessage) {
  try {
    const mth = methods[msg.method];
    if (!mth) {
      throw 'not found';
    }
    const rs = await (mth as any).call(methods, null, ...msg.params);
    const rsp: JsonRpcResponse = {
      jsonrpc: JSONRPC,
      id: msg.id,
      result: rs ?? null,
    };
    const buffer = Codec.encode(rsp as any).final();
    socket.send(buffer);
  } catch (e: any) {
    const rsp: JsonRpcResponse = {
      jsonrpc: JSONRPC,
      id: msg.id,
      error: e.toString(),
    };
    const buffer = Codec.encode(rsp as any).final();
    socket.send(buffer);
  }
}

type Options = {
  /** fs root */
  fsroot?: string;
  sites: Record<string, string>;
  /** websocket for admin */
  ws: boolean;
  wsMethods: RpcModule;
  /** authorization */
  auth?: {
    key: string;
    excludes: Array<string>;
  }
};

const opts: Options = { sites: {}, ws: false, wsMethods: {} };

let adminWebSockets: Array<ws.WebSocket> = [];
let msgid = 0;

export function notify(method: string, ...params: any[]) {
  if (!adminWebSockets.length) {
    return false;
  }
  // logger.debug(`notify with method[${method}], params[${JSON.stringify(params || '')}]`);
  const req: JsonRpcNotify = { jsonrpc: JSONRPC, isn: true, id: msgid++, method, params };
  const buffer = Codec.encode(req as any).final();
  adminWebSockets.forEach(e => e.send(buffer));
  return true;
}

expr.use((req, res, next) => {
  if (!opts.auth) {
    return next();
  }
  for (const rule of opts.auth.excludes) {
    if (req.path.startsWith(rule)) {
      return next();
    }
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  if (!token) {
    return res.sendStatus(401); // token not found
  }
  jwt.verify(token, opts.auth.key, (err, user) => {
    if (err) {
      return res.sendStatus(403); // token invalid
    }
    (req as any).user = user;
    next();
  });
});

export function sign(id: string, username: string, expiresIn?: StringValue): string {
  if (!opts.auth) {
    return '';
  }
  const token = jwt.sign(
    { id, username },
    opts.auth.key,
    { expiresIn: expiresIn || '1W' }
  );
  return token;
}

export async function main<T extends ArgsSfex<any>>(env: Environment<T>, methods: RpcModule, options?: Partial<Options>): Promise<http.Server> {
  init(env);

  if (options) Object.assign(opts, options);

  const { ws: isWsEnable, fsroot } = opts;
  const { sites } = options || {} as any;
  const wsMethods = (options || {}).wsMethods || methods;

  for (const [key, value] of Object.entries(sites || {})) {
    expr.use(`/${env.name}/${key}`, express.static(path.resolve(value as any)));
  }

  const app = expr.listen(env.args.port, () => {

    dispMain(`/${env.name}/:cmd`, expr, env, methods);

    if (fsroot) {
      dispMain(`/fs/:cmd`, expr, env, new Fs);
    }

    const { port } = env.args;

    process.stdout.write(`[port=${port}]\n`);

    app.setTimeout(120000);
    const interfaces: any = [];
    Object.values(os.networkInterfaces()).forEach((e) => {
      if (!e) {
        return;
      }
      e.filter(detail => detail.family === 'IPv4').forEach((detail) => {
        interfaces.push(detail);
      });
    });

    logger.info(`${env.name} started, open link to access : ${interfaces.map((e: { address: any; }) => `http://${e.address}:${port}/`).join(', ')}`);
  });

  if (isWsEnable) {
    // create the web socket
    const wss = new ws.Server({
      noServer: true,
      perMessageDeflate: false,
    });
    app.on('upgrade', (req, socket, head: Buffer) => {
      wss.handleUpgrade(req, socket, head, (webSocket) => {
        adminWebSockets.push(webSocket);
        webSocket.on('close', () => {
          console.log(`websocket closed`);
          const index = adminWebSockets.indexOf(webSocket);
          if (index !== -1) {
            adminWebSockets.splice(index, 1);
          }
        });
        webSocket.on('message', (data) => {
          dispWsMessage(webSocket, wsMethods, JSON.parse(data.toString()) as any);
        });
      });
    });
  }

  return app;
}

export const JSONRPC = '2.0';