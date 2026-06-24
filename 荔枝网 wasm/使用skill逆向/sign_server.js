#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');
const readline = require('readline');

// Mute stdout completely - eval of 1.1MB WASM code would print everything
const noop = () => {};
process.stdout.write = () => true;
globalThis.console = { log: noop, error: noop, warn: noop, info: noop, debug: noop, trace: noop };

// Load signer
const fp = path.join(__dirname, '..', 'vendor_w_fallback_b4fcb8bf.js');
const code = fs.readFileSync(fp, 'utf-8');

globalThis.window = globalThis;
globalThis.self = globalThis;
try { globalThis.location = { host: 'gdtv-api.gdtv.cn' }; } catch(e) {}
try { globalThis.document = { location: { host: 'gdtv-api.gdtv.cn' } }; } catch(e) {}
try { Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true }); } catch(e) {}

let f = null;
const arr = [];
arr.push = function(c) { const [, m] = c; f = m[265]; return 0; };
globalThis.window.webpackJsonp = arr;

eval(code);

if (!f) { process.exit(1); }

const mod = { exports: {} };
f(mod, mod.exports, function(id) { if (id === 'util') return util; return null; });

const signer = mod.exports.a;

const testResult = signer('GET', '/test', 'WEB_test', 'WEB_PC', '', undefined);
if (!testResult || typeof testResult !== 'object') {
  process.exit(1);
}

// Return uuid helper
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Process requests from stdin
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  try {
    const req = JSON.parse(line.trim());
    const method = req.method || 'GET';
    const p = req.path || '/api/channel/v1/news';
    const q = req.query || '';
    const url = p + (q ? '?' + q : '');
    const hdrs = signer(method, url, 'WEB_' + uuid(), 'WEB_PC', '', undefined);
    process.stdout.write(JSON.stringify(hdrs) + '\n');
  } catch(e) {
    process.stdout.write(JSON.stringify({ error: e.message }) + '\n');
  }
});
