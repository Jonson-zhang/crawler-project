/**
 * sign.js — 小红书 Node.js 离线签名
 *
 * 用法:
 *   const { sign } = require('./sign');
 *   const headers = sign('/api/sns/web/v1/homefeed', {cursor_score:'', num:20});
 *   console.log(headers); // { 'x-s': '...', 'x-t': '...', 'x-s-common': '...' }
 *
 * 注意: 首次 require 时自动加载并初始化 VMP 环境 (~5-10秒)
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const dom = require('./env.dom');

// ═══ Build sandbox ═══
function buildSandbox() {
  const s = {
    // Global references
    window: {}, self: {}, global: {}, globalThis: {},

    // DOM with proper prototype chains
    EventTarget: dom.EventTarget,
    Node: dom.Node,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    HTMLDocument: dom.HTMLDocument,
    HTMLCanvasElement: dom.HTMLCanvasElement,
    CanvasRenderingContext2D: dom.CanvasRenderingContext2D,
    WebGLRenderingContext: dom.WebGLRenderingContext,
    OffscreenCanvas: dom.OffscreenCanvas,
    AudioContext: dom.AudioContext,
    XMLHttpRequest: dom.XMLHttpRequest,
    Headers: dom.Headers,
    Blob: dom.Blob,
    File: dom.File,
    FileReader: dom.FileReader,
    FormData: dom.FormData,
    MutationObserver: dom.MutationObserver,
    IntersectionObserver: dom.IntersectionObserver,
    ResizeObserver: dom.ResizeObserver,
    PerformanceObserver: dom.PerformanceObserver,
    Performance: dom.Performance,
    PerformanceTiming: dom.PerformanceTiming,
    PerformanceNavigation: dom.PerformanceNavigation,
    Navigator: dom.Navigator,
    Screen: dom.Screen,
    Location: dom.Location,
    History: dom.History,
    Event: dom.Event,
    CustomEvent: dom.CustomEvent,
    MessageChannel: dom.MessageChannel,
    Worker: dom.Worker,
    WebSocket: dom.WebSocket,
    Image: dom.Image,
    URL: URL,
    URLSearchParams: URLSearchParams,

    // Environment singletons
    document: dom.document,
    location: dom.location,
    navigator: dom.navigator,
    screen: dom.screen,
    history: dom.history,
    performance: dom.performance,
    localStorage: dom.localStorage,
    sessionStorage: dom.sessionStorage,
    console: dom.console,

    // JS builtins
    setTimeout: (fn, ms, ...args) => { fn(...args); return 0; },
    setInterval: () => 0,
    clearTimeout: dom.noop,
    clearInterval: dom.noop,
    TextEncoder, TextDecoder,
    atob: x => Buffer.from(x, 'base64').toString('binary'),
    btoa: x => Buffer.from(x, 'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    Function, Math, Date, Object, Array, String, Number, Boolean,
    RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    Promise, Proxy, Reflect, Symbol,
    BigInt, BigInt64Array, BigUint64Array,
    parseInt, parseFloat, isNaN, isFinite, JSON,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError,
    eval,
    crypto: require('crypto').webcrypto,

    // For fetching (not needed for sign, but scripts may reference)
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.resolve(new dom.Blob([])) }),
    Request: class { constructor() {} },
    Response: class { constructor() {} },
    AbortController: class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } },
  };

  // Circular references
  s.self = s;
  s.window = s;
  s.global = s;
  s.globalThis = s;

  // Fix document.location circular ref
  s.document.location = s.location;

  // require() mock
  s.require = function(id) {
    if (id === '@lwjjike/xbsdom') return undefined;
    if (id === 'crypto') return require('crypto');
    try { return require(id); } catch(e) {
      try { return require(path.join(__dirname, 'node_modules', id)); } catch(e2) {
        return undefined;
      }
    }
  };

  return s;
}

let _ctx = null;
let _sandbox = null;
let _ready = false;

function init() {
  if (_ready) return;

  _sandbox = buildSandbox();
  _ctx = vm.createContext(_sandbox);

  // Load DS API (sets up _BHjFmfUMEtxhI VM interpreter)
  const dsApi = fs.readFileSync(path.join(DATA_DIR, 'ds_api.js'), 'utf-8');
  vm.runInContext(dsApi, _ctx, { filename: 'ds_api.js', timeout: 120000 });

  // Load DS 6545c (sets up sign function registry _AUuXfEG27Xa3x)
  const ds6545 = fs.readFileSync(path.join(DATA_DIR, 'ds_6545c.js'), 'utf-8');
  vm.runInContext(ds6545, _ctx, { filename: 'ds_6545c.js', timeout: 120000 });

  // Load signer bundle (sabo VM with mnsv2)
  // Use formatted version for debugging
  const signerPath = path.join(DATA_DIR, 'signer_04b29_formatted.js');
  if (fs.existsSync(signerPath)) {
    const signer = fs.readFileSync(signerPath, 'utf-8');
    vm.runInContext(signer, _ctx, { filename: 'signer_04b29.js', timeout: 180000 });
  } else {
    const signer = fs.readFileSync(path.join(DATA_DIR, 'signer_04b29.js'), 'utf-8');
    vm.runInContext(signer, _ctx, { filename: 'signer_04b29.js', timeout: 180000 });
  }

  // Check what was exposed
  console.log('[sign] Environment ready');
  console.log('[sign] _dsf:       ', typeof _sandbox._dsf);
  console.log('[sign] _webmsxyw:  ', typeof _sandbox._webmsxyw);
  console.log('[sign] mnsv2:      ', typeof _sandbox.mnsv2);

  _ready = true;
}

/**
 * Compute x-s / x-t / x-s-common headers for a request
 *
 * @param {string} url - API path or full URL
 * @param {object} data - Request body (will be JSON.stringify'd)
 * @returns {object} Headers dict with x-s, x-t, x-s-common
 */
function sign(url, data) {
  init();

  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const start = Date.now();

  // Call seccore_signv2 logic manually
  const result = vm.runInContext(`
    (() => {
      const url = __sign_url;
      const data = __sign_data;
      const body = __sign_body;

      // Build combined string
      const combined = url + body;

      // Hash functions (from ds_6545c's _dsf)
      const hashCombined = _dsf(combined);
      const hashUrl = _dsf(url);

      // mnsv2(u, m, w) — the VMP sign function
      // If not on window, try the internal function
      let C;
      if (typeof mnsv2 === 'function') {
        C = mnsv2(combined, hashCombined, hashUrl);
      } else if (typeof _0c6b9e549fef9ab9b4798ad1f12ea82b === 'function') {
        C = _0c6b9e549fef9ab9b4798ad1f12ea82b(combined, hashCombined, hashUrl);
      } else {
        throw new Error('mnsv2 not available');
      }

      // Build x-s payload
      const x0 = _dsf(body).reduce((s, b) => s + String.fromCharCode(b), '');
      // Or use: const x0 = 'XYW_'; // Need to decode the actual prefix
      const payload = JSON.stringify({
        x0: 'XYW_',  // This needs x0 prefix - find from code
        x1: 'xhs-pc-web',
        x2: 'PC',
        x3: C,
        x4: ''
      });

      // Base64 encode
      const x_s = 'XYS_' + btoa(String.fromCharCode.apply(null,
        new TextEncoder().encode(payload)
      ));

      return {
        'x-s': x_s,
        'x-t': String(Date.now()),
        'x-s-common': '', // TBD - separate computation
      };
    })()
  `, _ctx, {
    __sign_url: url,
    __sign_data: data,
    __sign_body: body,
  });

  return result;
}

module.exports = { init, sign, getContext: () => _ctx, getSandbox: () => _sandbox };
