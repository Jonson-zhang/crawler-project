/**
 * sign.js — 小红书 X-s 离线签名
 *
 * 加载 vendor.js (webpack bundle)，补环境后运行 signV2Init 创建 mnsv2，
 * 然后用 Node crypto + 自定义 Base64 实现 seccore_signv2。
 *
 * 用法:
 *   const { init, sign } = require('./sign');
 *   init();
 *   const headers = sign('/api/sns/web/v1/homefeed', {cursor_score:'', num:20});
 *
 * CLI:
 *   node sign.js <url> <body_json>
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const dom = require('./env.dom');

// ═══ 自定义 Base64 字母表 ═══
const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

function customBase64Encode(bytes) {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf-8') : bytes;
  let result = '';
  const len = buf.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = buf[i];
    const b2 = i + 1 < len ? buf[i + 1] : 0;
    const b3 = i + 2 < len ? buf[i + 2] : 0;
    result += XHS_B64[b1 >> 2];
    result += XHS_B64[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? XHS_B64[((b2 & 15) << 2) | (b3 >> 6)] : XHS_B64[0];
    result += i + 2 < len ? XHS_B64[b3 & 63] : XHS_B64[0];
  }
  return result;
}

// ═══ 最小 Webpack Runtime ═══
const WEBPACK_RUNTIME = `
(function() {
  var modules = {};
  var cache = {};

  function __webpack_require__(id) {
    if (cache[id]) return cache[id].exports;
    if (!modules[id]) {
      // Stub unknown modules
      modules[id] = function(m, e) { m.exports = {}; };
    }
    var mod = cache[id] = { id: id, exports: {} };
    modules[id].call(mod.exports, mod, mod.exports, __webpack_require__);
    return mod.exports;
  }

  __webpack_require__.d = function(exports, def) {
    for (var key in def) {
      if (__webpack_require__.o(def, key) && !__webpack_require__.o(exports, key)) {
        Object.defineProperty(exports, key, { enumerable: true, get: def[key] });
      }
    }
  };

  __webpack_require__.n = function(m) {
    var getter = m && m.__esModule ? function() { return m['default']; } : function() { return m; };
    __webpack_require__.d(getter, { a: getter });
    return getter;
  };

  __webpack_require__.o = function(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };

  // Intercept chunk push — extract modules
  (self.webpackChunkxhs_pc_web = self.webpackChunkxhs_pc_web || []).push = function(chunk) {
    var chunkModules = chunk[1];
    for (var id in chunkModules) {
      if (__webpack_require__.o(chunkModules, id)) {
        modules[id] = chunkModules[id];
      }
    }
  };

  // Pre-register external dependencies
  modules[21777] = function(m, e) { m.exports = String; };        // core-js String.raw
  modules[31547] = function(m, e, r) { r.d(e, { _: function() { return function _typeof(v) { var t = typeof v; return t === 'object' ? (v === null ? 'null' : Array.isArray(v) ? 'array' : 'object') : t; }; }}); };
  modules[34134] = function(m, e) { m.exports = {}; };            // perf module
  modules[17792] = function(m, e) { m.exports = {}; };            // cookie utils
  modules[12225] = function(m, e) { m.exports = {}; };            // misc
  modules[34885] = function(m, e) { m.exports = {}; };            // regeneratorRuntime
  modules[72169] = function(m, e) { m.exports = {}; };            // misc
  modules[109]   = function(m, e) { m.exports = {}; };
  modules[54060] = function(m, e) { m.exports = {}; };
  modules[20266] = function(m, e) { m.exports = {}; };
  modules[5681]  = function(m, e) { m.exports = {}; };
  modules[86651] = function(m, e) { m.exports = {}; };
  modules[43648] = function(m, e) { m.exports = {}; };
  modules[34333] = function(m, e) { m.exports = {}; };
  modules[55947] = function(m, e) { m.exports = {}; };
  modules[41593] = function(m, e) { m.exports = {}; };
  modules[9557]  = function(m, e) { m.exports = {}; };
  modules[58486] = function(m, e) { m.exports = {}; };
  modules[7608]  = function(m, e) { m.exports = {}; };
  modules[36277] = function(m, e) { m.exports = {}; };
  modules[74719] = function(m, e) { m.exports = {}; };
  modules[13398] = function(m, e) { m.exports = {}; };
  modules[21608] = function(m, e) { m.exports = {}; };
  modules[25069] = function(m, e) { m.exports = {}; };
  modules[50721] = function(m, e) { m.exports = {}; };
  modules[29112] = function(m, e) { m.exports = {}; };
  modules[80156] = function(m, e) { m.exports = {}; };

  // Need to provide 's' function used in vendor.js
  self.s = __webpack_require__;
  self.__webpack_require__ = __webpack_require__;
  self.__webpack_modules__ = modules;
})();
`;

// ═══ 构建沙箱 ═══
let _sandbox, _ctx, _ready = false;

function buildSandbox() {
  const s = {
    window: {}, self: {}, global: {}, globalThis: {},

    // ── DOM 原型链 ──
    EventTarget: dom.EventTarget,
    Node: dom.Node,
    Element: dom.Element,
    HTMLElement: dom.HTMLElement,
    HTMLHeadElement: dom.HTMLHeadElement,
    HTMLBodyElement: dom.HTMLBodyElement,
    HTMLCanvasElement: dom.HTMLCanvasElement,
    CanvasRenderingContext2D: dom.CanvasRenderingContext2D,
    CanvasGradient: dom.CanvasGradient,
    WebGLRenderingContext: dom.WebGLRenderingContext,
    OffscreenCanvas: dom.OffscreenCanvas,
    AudioContext: dom.AudioContext,
    OscillatorNode: dom.OscillatorNode,
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
    Event: dom.Event,
    CustomEvent: dom.CustomEvent,
    MessageChannel: dom.MessageChannel,
    Worker: dom.Worker,
    WebSocket: dom.WebSocket,
    Image: dom.Image,
    Performance: dom.Performance,
    PerformanceTiming: dom.PerformanceTiming,
    PerformanceNavigation: dom.PerformanceNavigation,
    Document: dom.Document,
    HTMLDocument: dom.HTMLDocument,
    Navigator: dom.Navigator,
    Screen: dom.Screen,
    Location: dom.Location,
    History: dom.History,

    // ── 环境单例 ──
    document: dom.document,
    location: dom.location,
    navigator: dom.navigator,
    screen: dom.screen,
    history: dom.history,
    performance: dom.performance,
    localStorage: dom.localStorage,
    sessionStorage: dom.sessionStorage,
    console: dom.console,

    // ── JS 原生 ──
    setTimeout: (fn, ms, ...args) => { try { fn(...args); } catch(e) {} return 0; },
    setInterval: () => 0,
    clearTimeout: () => {},
    clearInterval: () => {},
    TextEncoder, TextDecoder,
    URL, URLSearchParams,
    atob: x => Buffer.from(x, 'base64').toString('binary'),
    btoa: x => Buffer.from(x, 'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    crypto: require('crypto').webcrypto,
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve(''), blob: () => Promise.resolve(new dom.Blob([])) }),
    Request: class { constructor() {} },
    Response: class { constructor() {} },
    AbortController: class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } },
    Function, Math, Date, Object, Array, String, Number, Boolean,
    RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    Promise, Proxy, Reflect, Symbol,
    BigInt, BigInt64Array, BigUint64Array,
    parseInt, parseFloat, isNaN, isFinite, JSON, eval,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError,

    // Node.js require for crypto
    require: function(id) {
      if (id === 'crypto') return require('crypto');
      return undefined;
    },
    process: { env: {}, platform: 'win32', arch: 'x64' },
  };

  // 循环引用
  s.self = s;
  s.window = s;
  s.global = s;
  s.globalThis = s;
  s.document.location = s.location;

  return s;
}

// ═══ 初始化 ═══
function init() {
  if (_ready) return;

  _sandbox = buildSandbox();
  _ctx = vm.createContext(_sandbox);

  const t0 = Date.now();
  console.error('[sign] Injecting webpack runtime...');

  // 1. 注入 webpack runtime
  vm.runInContext(WEBPACK_RUNTIME, _ctx, { filename: 'runtime.js' });

  // 2. 加载 vendor.js
  console.error('[sign] Loading vendor.js...');
  const vendorCode = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  try {
    vm.runInContext(vendorCode, _ctx, { filename: 'vendor.js', timeout: 120000 });
  } catch (e) {
    console.error('[sign] vendor.js load error:', e.message);
    // Try to continue even if some modules failed
  }

  console.error('[sign] vendor.js loaded in', Date.now() - t0, 'ms');

  // 3. 调用 signV2Init 创建 mnsv2
  console.error('[sign] Running signV2Init...');
  try {
    const signV2Init = vm.runInContext('__webpack_require__(68274).a', _ctx);
    if (typeof signV2Init === 'function') {
      signV2Init();
      console.error('[sign] signV2Init completed');
    } else {
      console.error('[sign] signV2Init not found, trying direct call...');
      // signV2Init 可能已经在 vendor 加载时被 P.ZP.isBrowser 触发
    }
  } catch (e) {
    console.error('[sign] signV2Init error:', e.message);
    console.error('[sign] Stack:', (e.stack || '').split('\n').slice(0, 3).join('\n  '));
  }

  // 4. 检查 mnsv2 是否可用
  const hasMnsv2 = vm.runInContext('typeof window.mnsv2', _ctx);
  console.error('[sign] window.mnsv2:', hasMnsv2);

  _ready = true;
  console.error('[sign] Ready in', Date.now() - t0, 'ms');
}

// ═══ 签名 ═══
function sign(url, data) {
  init();

  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const combined = url + bodyStr;

  // MD5 哈希
  const md5 = (str) => crypto.createHash('md5').update(str, 'utf8').digest('hex');
  const hashCombined = md5(combined);
  const hashUrl = md5(url);

  // 调用 mnsv2
  let mnsv2Result;
  try {
    mnsv2Result = vm.runInContext(`
      (() => {
        try {
          var result = window.mnsv2(__combined, __hashCombined, __hashUrl);
          return String(result);
        } catch(e) {
          return 'ERROR:' + e.message;
        }
      })()
    `, _ctx, {
      __combined: combined,
      __hashCombined: hashCombined,
      __hashUrl: hashUrl,
    });
  } catch (e) {
    console.error('[sign] mnsv2 call error:', e.message);
    mnsv2Result = 'FALLBACK_' + crypto.createHash('md5')
      .update(combined + '_fallback').digest('hex');
  }

  // 构建 payload
  const payload = JSON.stringify({
    x0: '4.3.5',
    x1: 'xhs-pc-web',
    x2: 'Windows',
    x3: mnsv2Result,
    x4: typeof data === 'string' ? 'string' : 'object',
  });

  // 自定义 Base64 编码
  const xs = 'XYS_' + customBase64Encode(Buffer.from(payload, 'utf-8'));

  return {
    'x-s': xs,
    'x-t': String(Date.now()),
    'x-s-common': '',
  };
}

// ═══ CLI ═══
if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  const bodyStr = process.argv[3] || '{"cursor_score":"","num":20,"refresh_type":1,"note_index":0}';
  let body;
  try { body = JSON.parse(bodyStr); } catch(e) { body = bodyStr; }

  init();
  const result = sign(url, body);
  console.log(JSON.stringify(result));
}

module.exports = { init, sign };
