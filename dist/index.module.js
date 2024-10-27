import os from 'os';
import path from 'path';
import express from 'express';
import ws from 'ws';
import fileUpload from 'express-fileupload';
import bodyParser from 'body-parser';
import fs from 'fs';
import Log4js from 'log4js';
import minimist from 'minimist';
import schedule from 'node-schedule';

function init(env) {
    if (!fs.existsSync(env.paths.logs)) {
        fs.mkdirSync(env.paths.logs, { recursive: true });
    }
    Log4js.configure({
        appenders: {
            ruleConsole: { type: 'console' },
            ruleFile: {
                type: 'dateFile',
                filename: path.resolve(env.paths.logs, './e'),
                pattern: 'yyyy-MM-dd.log',
                maxLogSize: 10 * 1000 * 1000,
                numBackups: 10,
                alwaysIncludePattern: true,
            },
        },
        categories: {
            default: { appenders: ['ruleConsole', 'ruleFile'], level: 'info' },
        },
    });
}
const log4js = Log4js.getLogger();
const logger = {
    debug(message, ...args) {
        log4js.debug(message, ...args);
    },
    info(message, ...args) {
        log4js.info(message, ...args);
    },
    warn(message, ...args) {
        log4js.warn(message, ...args);
    },
    error(message, ...args) {
        log4js.error(message, ...args);
    },
};

/* eslint-disable @typescript-eslint/consistent-type-assertions */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/indent */
/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
function boolean(value) {
    return value === true || value === false;
}
function string(value) {
    return typeof value === 'string' || value instanceof String;
}
function number(value) {
    return typeof value === 'number' || value instanceof Number;
}
function error(value) {
    return value instanceof Error;
}
function func(value) {
    return typeof value === 'function';
}
function array(value) {
    return Array.isArray(value);
}
function stringArray(value) {
    return array(value) && value.every(elem => string(elem));
}

/* eslint-disable @typescript-eslint/no-empty-function */
/**
 * BinJson codec
 */
var TagCode;
(function (TagCode) {
    TagCode[TagCode["undefined"] = 'u'.charCodeAt(0)] = "undefined";
    TagCode[TagCode["null"] = 'n'.charCodeAt(0)] = "null";
    TagCode[TagCode["boolean"] = 'b'.charCodeAt(0)] = "boolean";
    TagCode[TagCode["uint8Array"] = 'B'.charCodeAt(0)] = "uint8Array";
    TagCode[TagCode["number"] = 'i'.charCodeAt(0)] = "number";
    TagCode[TagCode["bigint"] = 'I'.charCodeAt(0)] = "bigint";
    TagCode[TagCode["string"] = 's'.charCodeAt(0)] = "string";
    TagCode[TagCode["object"] = 'd'.charCodeAt(0)] = "object";
    TagCode[TagCode["array"] = 'a'.charCodeAt(0)] = "array";
    TagCode[TagCode["end"] = 'e'.charCodeAt(0)] = "end";
    TagCode[TagCode["colon"] = ':'.charCodeAt(0)] = "colon";
    TagCode[TagCode["one"] = '1'.charCodeAt(0)] = "one";
})(TagCode || (TagCode = {}));
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');
class ScalableArray {
    offset = 0;
    array = new Uint8Array(1024);
    append(b) {
        if (typeof b === 'string') {
            b = textEncoder.encode(b);
        }
        if ((this.offset + b.length) >= this.array.length) {
            const n = new Uint8Array(this.offset + b.length + 1024);
            n.set(this.array);
            this.array = n;
        }
        this.array.set(b, this.offset);
        this.offset += b.length;
    }
    appendStringWithTag(s) {
        const b = textEncoder.encode(s);
        this.append(`s${b.length}:`);
        this.append(b);
    }
    appendTag(b) {
        if ((this.offset + 1) >= this.array.length) {
            const n = new Uint8Array(this.offset + 1024);
            n.set(this.array);
            this.array = n;
        }
        this.array[this.offset] = b;
        this.offset += 1;
    }
    final() {
        return this.array.subarray(0, this.offset);
    }
}
var Codec = {
    encode(object, out) {
        const buffer = out || new ScalableArray();
        const type = typeof object;
        const func = ({
            string: (value) => buffer.appendStringWithTag(value),
            number: (value) => buffer.append(`i${value}e`),
            bigint: (value) => buffer.append(`I${value}e`),
            boolean: (value) => buffer.append(`b${value ? 1 : 0}`),
            undefined: () => buffer.appendTag(TagCode.undefined),
            symbol: () => { },
            object: (value) => {
                if (value === null) {
                    return buffer.appendTag(TagCode.null);
                }
                if (array(value)) {
                    buffer.append(`a${value.length}:`);
                    for (const item of value) {
                        this.encode(item, buffer);
                    }
                }
                else if (value instanceof Uint8Array) {
                    buffer.append(`B${value.length}:`);
                    buffer.append(value);
                }
                else {
                    const keys = Object.keys(value);
                    buffer.append(`d${keys.length}:`);
                    for (const key of keys) {
                        this.encode(key, buffer);
                        const item = value[key];
                        this.encode(item, buffer);
                    }
                }
            },
            function: () => { },
        })[type];
        if (func) {
            func(object);
        }
        return buffer;
    },
    decode(buffer, cxt = { pos: 0 }) {
        const t = buffer[cxt.pos++];
        const f = ({
            [TagCode.array]: () => {
                const pose = buffer.indexOf(TagCode.colon, cxt.pos);
                const size = parseInt(textDecoder.decode(buffer.subarray(cxt.pos, pose)), 10);
                /** skip `${size}:` */
                cxt.pos = pose + 1;
                const r = [];
                for (let i = 0; i < size; i++) {
                    r.push(this.decode(buffer, cxt));
                }
                return r;
            },
            [TagCode.boolean]: () => buffer[cxt.pos++] === TagCode.one,
            [TagCode.object]: () => {
                const pose = buffer.indexOf(TagCode.colon, cxt.pos);
                const size = parseInt(textDecoder.decode(buffer.subarray(cxt.pos, pose)), 10);
                /** skip `${size}:` */
                cxt.pos = pose + 1;
                const r = {};
                for (let i = 0; i < size; i++) {
                    r[this.decode(buffer, cxt)] = this.decode(buffer, cxt);
                }
                return r;
            },
            [TagCode.number]: () => {
                const pose = buffer.indexOf(TagCode.end, cxt.pos);
                const { pos } = cxt;
                cxt.pos = pose + 1;
                return parseFloat(textDecoder.decode(buffer.subarray(pos, pose)));
            },
            [TagCode.bigint]: () => {
                const pose = buffer.indexOf(TagCode.end, cxt.pos);
                const { pos } = cxt;
                cxt.pos = pose + 1;
                return BigInt(textDecoder.decode(buffer.subarray(pos, pose)));
            },
            [TagCode.null]: () => null,
            [TagCode.string]: () => {
                const pose = buffer.indexOf(TagCode.colon, cxt.pos);
                const size = parseInt(textDecoder.decode(buffer.subarray(cxt.pos, pose)), 10);
                const pos = pose + 1;
                /** skip `${length}:.[length]` */
                cxt.pos = pose + size + 1;
                return textDecoder.decode(buffer.subarray(pos, pos + size));
            },
            [TagCode.uint8Array]: () => {
                const pose = buffer.indexOf(TagCode.colon, cxt.pos);
                const size = parseInt(textDecoder.decode(buffer.subarray(cxt.pos, pose)), 10);
                const pos = pose + 1;
                /** skip `${length}:.[length]` */
                cxt.pos = pose + size + 1;
                return buffer.subarray(pos, pos + size);
            },
            [TagCode.undefined]: () => undefined,
        })[t];
        if (!f) {
            throw 'unkonwn encoding!';
        }
        return f();
    },
};

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise */


function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
function rawRpc() {
    return function (target, propertyKey) {
        const value = target[propertyKey];
        value.isRawRpc = true;
    };
}

function checkPath(p) {
    if (/\.\./.test(p) || /~/.test(p)) {
        return false;
    }
    return true;
}
function fileStats(p) {
    const st = fs.statSync(p);
    return { isd: st.isDirectory(), size: st.size };
}
const config = {
    fsroot: '',
};
class default_1 {
    async ls(cxt) {
        if (!checkPath(cxt.path)) {
            throw 'not allowed';
        }
        const p = path.join(config.fsroot, cxt.path);
        const ar = fs.readdirSync(p);
        return Object.fromEntries(ar.map((e) => [e, fileStats(path.join(p, e))]));
    }
    async rename(cxt, newPath) {
        if (!checkPath(cxt.path) || !checkPath(newPath)) {
            throw 'not allowed';
        }
        const po = path.join(config.fsroot, cxt.path);
        const pn = path.join(config.fsroot, newPath);
        fs.renameSync(po, pn);
        return true;
    }
    async mkdir(cxt, subs) {
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
    async rm(cxt) {
        if (!checkPath(cxt.path) || !cxt.path) {
            throw 'not allowed';
        }
        const p = path.join(config.fsroot, cxt.path);
        if (fs.statSync(p).isDirectory()) {
            fs.rmdirSync(p, { recursive: true });
        }
        else {
            fs.unlinkSync(p);
        }
        return true;
    }
    async read(cxt, { encoding }) {
        if (!checkPath(cxt.path)) {
            throw 'not allowed';
        }
        const p = path.join(config.fsroot, cxt.path);
        return fs.readFileSync(p, encoding || 'utf8');
    }
    async write(cxt, data) {
        if (!checkPath(cxt.path)) {
            throw 'not allowed';
        }
        const p = path.join(config.fsroot, cxt.path);
        fs.writeFileSync(p, data, 'binary');
    }
    async upload(cxt, params) {
        if (!checkPath(cxt.path)) {
            throw 'not allowed';
        }
        const files = params.files || params;
        for (const file of Object.values(files)) {
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
__decorate([
    rawRpc()
], default_1.prototype, "read", null);
__decorate([
    rawRpc()
], default_1.prototype, "write", null);
__decorate([
    rawRpc()
], default_1.prototype, "upload", null);

/* eslint-disable @typescript-eslint/no-unused-vars */
process.on('uncaughtException', (err) => {
    console.log(err);
    logger.error('Uncaught Exception: ', err.toString());
    if (err.stack) {
        logger.error(err.stack);
    }
});
/** express */
const expr = express();
expr.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
expr.use(bodyParser.json({ limit: '100mb' }));
expr.use(bodyParser.raw({ type: 'application/octet-stream', limit: '100mb' }));
expr.use(bodyParser.raw({ type: 'text/plain', limit: '100mb' }));
expr.use(fileUpload());
/** config express */
expr.all('*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, Authorization, Accept,X-Requested-With');
    res.header('Access-Control-Allow-Methods', 'PUT,POST,GET,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') {
        res.end('OK');
    }
    else {
        next();
    }
});
function dispMain(base, app, env, methods) {
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
        const cxt = {
            path,
            req,
            rsp,
        };
        let params = [];
        const body = req.body;
        const json = body;
        const isRawRpc = mth.isRawRpc;
        if (!isRawRpc && json.jsonrpc !== JSONRPC) {
            rsp.status(500);
            return rsp.end();
        }
        if (!isRawRpc) {
            params = json.params;
        }
        else {
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
            }
            else if (cnt === 1) {
                params.push(files || query || body);
            }
        }
        let rs;
        let err;
        try {
            rs = await mth.call(methods, cxt, ...params);
        }
        catch (e) {
            err = e;
        }
        if (!isRawRpc) {
            rsp.json({
                jsonrpc: JSONRPC,
                id: json.id,
                result: err ? undefined : rs,
                error: err,
            });
        }
        else {
            if (typeof rs === 'object') {
                if (rs.buffer && rs.length !== undefined) {
                    rsp.write(rs);
                }
                else {
                    rsp.json(rs);
                }
            }
            else if (!err) {
                if (rs !== undefined) {
                    rsp.write(rs);
                }
            }
            else {
                rsp.status(500);
            }
        }
        rsp.end();
    });
}
async function dispWsMessage(socket, methods, msg) {
    try {
        const mth = methods[msg.method];
        if (!mth) {
            throw 'not found';
        }
        const rs = await mth.call(methods, null, ...msg.params);
        const rsp = {
            jsonrpc: JSONRPC,
            id: msg.id,
            result: rs ?? null,
        };
        const buffer = Codec.encode(rsp).final();
        socket.send(buffer);
    }
    catch (e) {
        const rsp = {
            jsonrpc: JSONRPC,
            id: msg.id,
            error: e.toString(),
        };
        const buffer = Codec.encode(rsp).final();
        socket.send(buffer);
    }
}
let adminWebSocket;
let msgid = 0;
function notify(method, ...params) {
    if (!adminWebSocket) {
        return false;
    }
    // logger.debug(`notify with method[${method}], params[${JSON.stringify(params || '')}]`);
    const req = { jsonrpc: JSONRPC, isn: true, id: msgid++, method, params };
    const buffer = Codec.encode(req).final();
    adminWebSocket.send(buffer);
    return true;
}
async function main$1(env, methods, options) {
    init(env);
    const { ws: isWsEnable, fsroot } = options || { ws: false };
    const { sites } = options || {};
    const wsMethods = (options || {}).wsMethods || methods;
    for (const [key, value] of Object.entries(sites || {})) {
        expr.use(`/${env.name}/${key}`, express.static(path.resolve(value)));
    }
    const app = expr.listen(env.args.port, () => {
        dispMain(`/${env.name}/*`, expr, env, methods);
        if (fsroot) {
            dispMain(`/fs/*`, expr, env, new default_1);
        }
        const { port } = app.address();
        process.stdout.write(`[port=${port}]\n`);
        app.setTimeout(120000);
        const interfaces = [];
        Object.values(os.networkInterfaces()).forEach((e) => {
            if (!e) {
                return;
            }
            e.filter(detail => detail.family === 'IPv4').forEach((detail) => {
                interfaces.push(detail);
            });
        });
        logger.info(`${env.name} started, open link to access : ${interfaces.map((e) => `http://${e.address}:${port}/`).join(', ')}`);
    });
    if (isWsEnable) {
        // create the web socket
        const wss = new ws.Server({
            noServer: true,
            perMessageDeflate: false,
        });
        app.on('upgrade', (req, socket, head) => {
            if (adminWebSocket) {
                socket.destroy();
                return;
            }
            wss.handleUpgrade(req, socket, head, (webSocket) => {
                adminWebSocket = webSocket;
                webSocket.on('close', () => {
                    console.log(`websocket closed`);
                    adminWebSocket = undefined;
                });
                webSocket.on('data', (data) => {
                    dispWsMessage(webSocket, wsMethods, JSON.parse(data.toString()));
                });
            });
        });
    }
    return app;
}
const JSONRPC = '2.0';

var name = "sfex";
var version = "0.0.1";
var description = "service framework base on express";
var author = "bobolinks";
var license = "MIT";
var type = "module";
var main = "dist/index.cjs";
var module = "dist/index.module.js";
var types = "types/index.d.ts";
var scripts = {
	build: "rollup -c ./rollup.config.js"
};
var dependencies = {
	"body-parser": "^1.19.0",
	express: "^4.17.1",
	"express-fileupload": "^1.4.0",
	"express-formidable": "^1.2.0",
	globby: "^11.0.4",
	"html-parser": "^0.11.0",
	log4js: "^6.4.0",
	minimist: "^1.2.5",
	"node-schedule": "^2.1.1",
	url: "^0.11.0",
	"utf-8-validate": "^5.0.5",
	ws: "^8.16.0"
};
var devDependencies = {
	"@babel/preset-env": "^7.14.8",
	"@babel/preset-stage-0": "^7.8.3",
	"@rollup/plugin-json": "^6.1.0",
	"@rollup/plugin-terser": "^0.4.4",
	"@rollup/plugin-typescript": "^12.1.1",
	"@types/body-parser": "^1.19.1",
	"@types/express": "^4.17.13",
	"@types/express-fileupload": "^1.4.1",
	"@types/minimist": "^1.2.2",
	"@types/node": "^20.12.7",
	"@types/node-schedule": "^2.1.6",
	"@types/ws": "^8.5.10",
	"@typescript-eslint/eslint-plugin": "^4.28.4",
	rollup: "^4.24.0",
	"ts-loader": "^9.5.1",
	typescript: "^4.9.5"
};
var pkg = {
	name: name,
	version: version,
	description: description,
	author: author,
	license: license,
	type: type,
	main: main,
	module: module,
	types: types,
	scripts: scripts,
	dependencies: dependencies,
	devDependencies: devDependencies
};

function parseArgs(argsAnno) {
    const entries = Object.entries(argsAnno);
    const args = minimist(process.argv.slice(2), {
        alias: Object.fromEntries(entries.map(([k, v]) => [k, v.alias])
            .filter(([, v]) => v)),
        string: entries.filter(([, v]) => v.type === 'string')
            .map(kv => kv[0]),
        boolean: entries.filter(([, v]) => v.type === 'boolean')
            .map(kv => kv[0]),
        default: Object.fromEntries(entries.map(([k, v]) => [k, v.default])
            .filter(([, v]) => v !== undefined)),
    });
    // alias hyphen args in camel case
    Object.keys(args).forEach((key) => {
        const camelKey = key.replace(/-([a-z])/g, ($0, $1) => $1.toUpperCase());
        if (camelKey !== key)
            args[camelKey] = args[key];
        if (camelKey === 'help') {
            printHelp(argsAnno);
        }
        else if (camelKey === 'version') {
            console.log(`${pkg.name} v${pkg.version}`);
        }
    });
    entries.forEach(([e, t]) => {
        if (args[e] === undefined) {
            if (t.default !== undefined) {
                args[e] = t.default;
            }
            else if (t.required) {
                printHelp(argsAnno);
                throw new Error(`${e} is required`);
            }
        }
    });
    return args;
}
const builtinArgs = {
    help: {
        alias: 'h',
        description: '显示帮助信息',
    },
    version: {
        alias: 'v',
        description: '显示版本信息',
    }
};
function printHelp(argsAnno) {
    const entries = Object.entries(builtinArgs).concat(Object.entries(argsAnno));
    const keys = entries.map(([k,]) => k);
    const maxLen = keys.reduce((a, b) => Math.max(a, b.length), 0);
    const lines = entries.map(([k, v]) => {
        const key = k.padEnd(maxLen);
        const desc = v.description;
        const def = v.default === undefined ? '' : `[default: ${v.default}]`;
        return ` --${key} ${desc} ${def}`;
    }).join('\n');
    console.log(`${pkg.name} v${pkg.version}`);
    console.log(lines);
}

// proxy
const getProxyRawObject = Symbol('getProxyRawObject');
function proxiable(object, cb) {
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
                let o = Reflect.get(target, names[0], receiver);
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
                let o = Reflect.get(target, names[0], receiver);
                const lastName = names.pop();
                for (let i = 1; i < names.length; i++) {
                    o = o[names[i]];
                }
                if (o[lastName] === newValue) {
                    return true;
                }
                o[lastName] = newValue;
            }
            else {
                rv = Reflect.set(target, p, newValue, target);
            }
            if (rv && cb) {
                cb(p, newValue);
            }
            return rv;
        },
    });
}

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
class EventDispatcher {
    _listeners = {};
    /**
     * Adds a listener to an event type.
     * @param type The type of event to listen to.
     * @param listener The function that gets called when the event is fired.
     */
    addEventListener(type, listener) {
        if (this._listeners === undefined)
            this._listeners = {};
        const listeners = this._listeners;
        if (listeners[type] === undefined) {
            listeners[type] = [];
        }
        if (listeners[type].indexOf(listener) === -1) {
            listeners[type].push(listener);
        }
    }
    /**
     * Checks if listener is added to an event type.
     * @param type The type of event to listen to.
     * @param listener The function that gets called when the event is fired.
     */
    hasEventListener(type, listener) {
        if (this._listeners === undefined)
            return false;
        const listeners = this._listeners;
        return listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1;
    }
    /**
     * Removes a listener from an event type.
     * @param type The type of the listener that gets removed.
     * @param listener The listener function that gets removed.
     */
    removeEventListener(type, listener) {
        if (this._listeners === undefined)
            return;
        const listeners = this._listeners;
        const listenerArray = listeners[type];
        if (listenerArray !== undefined) {
            const index = listenerArray.indexOf(listener);
            if (index !== -1) {
                listenerArray.splice(index, 1);
            }
        }
    }
    /**
     * Fire an event type.
     * @param event The event that gets fired.
     */
    dispatchEvent(event) {
        if (this._listeners === undefined)
            return;
        const listeners = this._listeners;
        const listenerArray = listeners[event.type];
        if (listenerArray !== undefined) {
            event.target = this;
            // Make a copy, in case listeners are removed while iterating.
            const array = listenerArray.slice(0);
            for (let i = 0, l = array.length; i < l; i++) {
                array[i].call(this, event);
            }
            event.target = null;
        }
    }
}

class Configurable extends EventDispatcher {
    file;
    cfg;
    hasFile;
    constructor(def, file) {
        super();
        this.file = file;
        this.cfg = proxiable({ ...def }, (key, value) => {
            this.dispatchEvent({ type: 'configChanged', key, value });
        });
        this.hasFile = this.file && fs.existsSync(this.file);
        if (this.hasFile && this.file) {
            const d = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
            if (d) {
                Object.assign(this.cfg, d);
            }
        }
    }
    setValue(p, value) {
        if (this.cfg[p] === undefined) {
            return;
        }
        this.cfg[p] = value;
    }
    saveConfig() {
        if (this.hasFile && this.file) {
            fs.writeFileSync(this.file, JSON.stringify(this.cfg), 'utf-8');
        }
    }
}

/* eslint-disable @typescript-eslint/ban-types */
class Queue extends EventDispatcher {
    isPending = false;
    queue = [];
    constructor() {
        super();
    }
    push(task) {
        if (Array.isArray(task)) {
            this.queue.push(...task);
        }
        else {
            this.queue.push(task);
        }
        this.queueMain();
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async taskMain(task) {
        // do nothings
    }
    async queueMain() {
        if (this.isPending || !this.queue.length) {
            return;
        }
        this.isPending = true;
        let task;
        try {
            while ((task = this.queue.shift())) {
                await this.taskMain(task);
            }
        }
        catch (e) {
            logger.error(e);
        }
        finally {
            this.isPending = false;
        }
    }
}

/* eslint-disable @typescript-eslint/ban-types */
process.on('SIGINT', async function () {
    await schedule.gracefulShutdown();
    process.exit(0);
});
class Taskable extends Configurable {
    isPending = false;
    /** per 1 minutes */
    job;
    constructor(def, nameOrFile) {
        /** per 1 minutes */
        super({ period: '*/1 * * * *', ...def }, nameOrFile);
    }
    async start(immediately, period) {
        if (typeof period === 'string' && this.cfg.period !== period) {
            this.cfg.period = period;
            this.saveConfig();
        }
        const main = async () => {
            if (this.isPending) {
                return;
            }
            this.isPending = true;
            try {
                await this.taskMain();
            }
            catch (e) {
                logger.error(e);
            }
            finally {
                this.isPending = false;
            }
        };
        this.job = schedule.scheduleJob(typeof this.cfg.period === 'string' ? this.cfg.period : `*/${this.cfg.period} * * * *`, main);
        this.dispatchEvent({ type: 'started' });
        if (immediately) {
            main();
        }
    }
    async restart(period) {
        if (this.job) {
            schedule.cancelJob(this.job);
            this.isPending = false;
        }
        return this.start(false, period);
    }
    async taskMain() {
        // do nothing
        logger.debug('taskMain');
    }
}

class Sys extends Taskable {
    listener = {};
    queue = [];
    constructor(def) {
        super({
            period: '* * * * * *',
            task: {
                waiting: 0,
                pending: '',
                progress: 0,
                last: {
                    state: 'success',
                    message: ''
                }
            },
            ...def,
        }, 'task');
    }
    init() {
        this.start(true);
    }
    register(name, cb, target) {
        if (this.listener[name]) {
            throw `Listener[${name}] aready exists`;
        }
        this.listener[name] = { cb, target };
    }
    onStateChanged() {
        // do nothing
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onError(e) {
        // do nothing
    }
    async fire(name, params) {
        const listener = this.listener[name];
        if (!listener) {
            throw `Listener[${name}] not found`;
        }
        return new Promise((resolve, reject) => {
            const task = { name, listener, params, resolve, reject, tmFired: new Date(), tmStart: new Date(), };
            this.queue.push(task);
            this.cfg.task.waiting = this.queue.length;
            this.onStateChanged();
        });
    }
    async taskMain() {
        while (this.queue.length) {
            const task = this.queue.shift();
            if (!task) {
                break;
            }
            task.tmStart.setTime(new Date().getTime());
            this.cfg.task.waiting = this.queue.length;
            this.cfg.task.pending = `Task[${task.name}] begins`;
            try {
                this.onStateChanged();
                const rs = await task.listener.cb.call(task.listener.target, task.params);
                const now = new Date();
                const tmDiff = now.getTime() - task.tmStart.getTime();
                this.cfg.task.pending = '';
                this.cfg.task.last.state = 'success';
                this.cfg.task.last.message = `Task[${task.name}] completed, eslapsed[${tmDiff / 1000}s]`;
                this.onStateChanged();
                task.resolve(rs);
            }
            catch (e) {
                this.cfg.task.pending = '';
                this.cfg.task.last.state = 'error';
                this.cfg.task.last.message = e.toString();
                this.onError(e);
                this.onStateChanged();
                task.reject(e);
            }
        }
    }
}

export { Configurable, EventDispatcher, JSONRPC, Queue, Sys, Taskable, array, boolean, error, expr, func, getProxyRawObject, init, logger, main$1 as main, notify, number, parseArgs, printHelp, proxiable, rawRpc, string, stringArray, textDecoder, textEncoder };
//# sourceMappingURL=index.module.js.map
