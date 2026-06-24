#!/usr/bin/env node
/**
 * Test: Extract and run signV2Init to get the mnsv2 function
 *
 * This loads the extracted webpack module 68274 from vendor-dynamic.js
 * and runs signV2Init() to create the VMP signing function.
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.join(__dirname, 'data');

// ── Build minimal browser-like sandbox ──
const sandbox = {
  // Browser globals the VMP code expects
  window: {},
  self: {},
  global: {},
  globalThis: {},
  document: {
    cookie: '',
    createElement: () => ({}),
    querySelector: () => null,
    getElementsByTagName: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    documentElement: { style: {} },
    location: { href: 'https://www.xiaohongshu.com/explore' },
  },
  location: {
    href: 'https://www.xiaohongshu.com/explore',
    host: 'www.xiaohongshu.com',
    hostname: 'www.xiaohongshu.com',
    protocol: 'https:',
    origin: 'https://www.xiaohongshu.com',
    pathname: '/explore',
  },
  navigator: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    platform: 'Win32',
    webdriver: false,
    plugins: [],
    languages: ['zh-CN'],
    language: 'zh-CN',
  },
  screen: { width: 1920, height: 1080 },
  history: { length: 1, state: null, pushState: () => {}, replaceState: () => {} },
  console: {
    log: (...a) => console.log('[VM]', ...a),
    error: (...a) => console.error('[VM]', ...a),
    warn: (...a) => console.warn('[VM]', ...a),
    info: () => {},
    debug: () => {}
  },
  performance: { now: () => Date.now(), timing: { navigationStart: Date.now() - 1000 } },
  setTimeout: (fn, ms, ...args) => { fn(...args); return 0; },
  setInterval: () => 0,
  clearTimeout: () => {},
  clearInterval: () => {},

  // JS builtins
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  atob: x => Buffer.from(x, 'base64').toString('binary'),
  btoa: x => Buffer.from(x, 'binary').toString('base64'),
  encodeURIComponent,
  decodeURIComponent,
  Blob: class { constructor(p) { this.parts = p; } },
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
  Headers: class { constructor(h) { this._h = h || {}; } set(k, v) { this._h[k] = v; } get(k) { return this._h[k]; } },
  XMLHttpRequest: (() => {
    function XHR() { this.readyState = 0; this.status = 0; this.responseText = ''; }
    XHR.prototype.open = function(m, u) { this._method = m; this._url = u; this.readyState = 1; };
    XHR.prototype.setRequestHeader = function() {};
    XHR.prototype.send = function() { this.readyState = 4; this.status = 200; this.responseText = '{}'; if (this.onreadystatechange) this.onreadystatechange(); };
    return XHR;
  })(),
  crypto: require('crypto').webcrypto,
  Math, Date, Object, Array, String, Number, Boolean,
  RegExp, Map, Set, WeakMap, WeakSet,
  Uint8Array, Uint16Array, Uint32Array,
  Int8Array, Int16Array, Int32Array,
  Float32Array, Float64Array,
  ArrayBuffer, DataView,
  Promise, Proxy, Reflect, Symbol,
  parseInt, parseFloat, isNaN, isFinite,
  JSON, eval,
  Error, TypeError, RangeError, SyntaxError, ReferenceError,
  Function,
  BigInt, BigInt64Array, BigUint64Array,
  MutationObserver: class { constructor() {} observe() {} disconnect() {} },
  IntersectionObserver: class { constructor() {} observe() {} unobserve() {} },
  ResizeObserver: class { constructor() {} observe() {} unobserve() {} },
  PerformanceObserver: class { constructor() {} observe() {} },
  MessageChannel: class { constructor() { this.port1 = { postMessage: () => {} }; this.port2 = { postMessage: () => {} }; } },
  Worker: class { constructor() {} postMessage() {} },
  WebSocket: class { constructor() {} close() {} send() {} },
  Image: class { constructor() { this.src = ''; this.onload = null; this.onerror = null; } },
  FormData: class { append() {} },
  FileReader: class { readAsDataURL() {} readAsArrayBuffer() {} },
  AudioContext: class { constructor() {} createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {} }; } createDynamicsCompressor() { return { connect: () => {} }; } createAnalyser() { return { connect: () => {}, getByteFrequencyData: () => new Uint8Array(128) }; } },
  CanvasRenderingContext2D: class { constructor() {} fillRect() {} fillText() {} measureText() { return { width: 100 }; } getImageData() { return { data: new Uint8Array(100) }; } },
  HTMLCanvasElement: class { constructor() {} getContext() { return new sandbox.CanvasRenderingContext2D(); } toDataURL() { return 'data:image/png;base64,'; } },
  WebGLRenderingContext: class { constructor() {} },
  OffscreenCanvas: class { constructor() {} getContext() { return new sandbox.CanvasRenderingContext2D(); } },
  CustomEvent: class extends Event { constructor(t, d) { super(t); Object.assign(this, d); } },
  Event: class { constructor(t) { this.type = t; } },
};

// Circular references
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.document.location = sandbox.location;

// ── Mock webpack require ──
const webpackModules = {};

function __webpack_require__(id) {
  if (webpackModules[id]) {
    return webpackModules[id].exports;
  }

  const mod = { exports: {} };
  webpackModules[id] = mod;

  if (id === 21777) {
    // core-js String.raw polyfill
    mod.exports = String;
  } else if (id === 31547) {
    // et._ = type checker
    mod.exports = {
      _: function(v) {
        const t = typeof v;
        if (t === 'object') {
          if (v === null) return 'null';
          if (Array.isArray(v)) return 'array';
          return 'object';
        }
        return t;
      }
    };
  } else {
    console.log('[mock] Unknown module:', id);
    mod.exports = {};
  }

  return mod.exports;
}

__webpack_require__.d = function(exports, definition) {
  for (const key in definition) {
    if (__webpack_require__.o(definition, key)) {
      Object.defineProperty(exports, key, {
        enumerable: true,
        get: definition[key]
      });
    }
  }
};

__webpack_require__.o = function(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

__webpack_require__.n = function(module) {
  const getter = module && module.__esModule
    ? () => module['default']
    : () => module;
  __webpack_require__.d(getter, { a: getter });
  return getter;
};

// ── Load module 68274 ──
const modCode = fs.readFileSync(path.join(DATA_DIR, 'mod_68274.js'), 'utf-8');

// The module is wrapped as: 68274:function(...){...}
// We need to call it as a function
const ctx = vm.createContext(sandbox);

// Wrap the module code to make it executable
// Format: function(__unused_webpack_module, __webpack_exports__, __webpack_require__) { ... }
const moduleFnCode = '(' + modCode.slice(modCode.indexOf('function(')) + ')';

console.log('[test] Compiling module 68274...');
const moduleFn = vm.runInContext(moduleFnCode, ctx, {
  filename: 'module_68274',
  timeout: 30000,
});

console.log('[test] Running module 68274...');
const mockModule = { exports: {} };
moduleFn(mockModule, mockModule.exports, __webpack_require__);

console.log('[test] Module exports:', Object.keys(mockModule.exports));

console.log('[test] Running signV2Init...');
const signV2Init = mockModule.exports.a;
if (typeof signV2Init === 'function') {
  signV2Init();
  console.log('[test] signV2Init completed');
} else {
  console.log('[test] signV2Init is not a function:', typeof signV2Init);
}

// Check what was set on global/window
console.log('[test] After signV2Init:');
console.log('  window.mnsv2:', typeof sandbox.mnsv2);
console.log('  global.mnsv2:', typeof sandbox.mnsv2);

// Find what new keys were added
const newFuncKeys = Object.keys(sandbox).filter(k => {
  return typeof sandbox[k] === 'function' && k.length <= 10 && k !== 'mnsv2';
});
console.log('  New short function keys:', newFuncKeys.slice(0, 10));

// Check ALL keys that look like function names (camelCase or snake_case)
const allKeys = Object.keys(sandbox);
const suspectKeys = allKeys.filter(k => {
  return ![
    'window','self','global','globalThis','document','location','navigator',
    'screen','history','console','performance','setTimeout','setInterval',
    'clearTimeout','clearInterval','TextEncoder','TextDecoder','URL','URLSearchParams',
    'atob','btoa','encodeURIComponent','decodeURIComponent','Blob','fetch','Headers',
    'XMLHttpRequest','crypto','Math','Date','Object','Array','String','Number',
    'Boolean','RegExp','Map','Set','WeakMap','WeakSet','Uint8Array','Uint16Array',
    'Uint32Array','Int8Array','Int16Array','Int32Array','Float32Array','Float64Array',
    'ArrayBuffer','DataView','Promise','Proxy','Reflect','Symbol','parseInt',
    'parseFloat','isNaN','isFinite','JSON','eval','Error','TypeError','RangeError',
    'SyntaxError','ReferenceError','Function','BigInt','BigInt64Array','BigUint64Array',
    'MutationObserver','IntersectionObserver','ResizeObserver','PerformanceObserver',
    'MessageChannel','Worker','WebSocket','Image','FormData','FileReader','AudioContext',
    'CanvasRenderingContext2D','HTMLCanvasElement','WebGLRenderingContext','OffscreenCanvas',
    'CustomEvent','Event','require','process','module','exports',
  ].includes(k);
});
console.log('  New suspect keys:', suspectKeys.slice(0, 20));
