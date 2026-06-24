/**
 * sign.js — 小红书 X-s 离线签名
 *
 * 架构:
 *   1. env.dom.js 提供浏览器原型链 (EventTarget→Node→Element→HTMLElement 等)
 *   2. 注入最小 webpack runtime，加载 data/vendor.js
 *   3. 调用 signV2Init() → eval(VMP字节码) → 创建 VMP 运行器
 *   4. VMP 字节码执行 → 创建 window.mnsv2
 *   5. seccore_signv2 = MD5 + mnsv2 + 自定义Base64
 *
 * 用法:
 *   node sign.js <url> <body_json>
 *
 * 状态: seccore_signv2 框架就绪（MD5 + Base64），mnsv2 函数由 VMP 字节码创建。
 * VMP 字节码需要完整浏览器环境才能完整初始化，在 Node.js VM 中暂无法完成。
 * 当前使用哈希回退的 mnsv2，服务端可能拒绝（406）。需要打通 VMP 初始化链路后生效。
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const dom = require('./env.dom');

// ═══ 自定义 Base64 ═══
const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

function customBase64Encode(bytes) {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf-8') : bytes;
  let result = '';
  const len = buf.length;
  for (let i = 0; i < len; i += 3) {
    const a = buf[i], b = i + 1 < len ? buf[i + 1] : 0, c = i + 2 < len ? buf[i + 2] : 0;
    result += XHS_B64[a >> 2];
    result += XHS_B64[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < len ? XHS_B64[((b & 15) << 2) | (c >> 6)] : XHS_B64[0];
    result += i + 2 < len ? XHS_B64[c & 63] : XHS_B64[0];
  }
  return result;
}

// ═══ 构建沙箱 ═══
function buildSandbox() {
  const s = {
    window:{}, self:{}, global:{}, globalThis:{},
    // DOM 原型链
    EventTarget:dom.EventTarget, Node:dom.Node, Element:dom.Element, HTMLElement:dom.HTMLElement,
    HTMLHeadElement:dom.HTMLHeadElement, HTMLBodyElement:dom.HTMLBodyElement,
    HTMLCanvasElement:dom.HTMLCanvasElement, CanvasRenderingContext2D:dom.CanvasRenderingContext2D,
    CanvasGradient:dom.CanvasGradient, WebGLRenderingContext:dom.WebGLRenderingContext,
    OffscreenCanvas:dom.OffscreenCanvas, AudioContext:dom.AudioContext, OscillatorNode:dom.OscillatorNode,
    XMLHttpRequest:dom.XMLHttpRequest, Headers:dom.Headers, Blob:dom.Blob, File:dom.File,
    FileReader:dom.FileReader, FormData:dom.FormData,
    MutationObserver:dom.MutationObserver, IntersectionObserver:dom.IntersectionObserver,
    ResizeObserver:dom.ResizeObserver, PerformanceObserver:dom.PerformanceObserver,
    Event:dom.Event, CustomEvent:dom.CustomEvent, MessageChannel:dom.MessageChannel,
    Worker:dom.Worker, WebSocket:dom.WebSocket, Image:dom.Image,
    Performance:dom.Performance, PerformanceTiming:dom.PerformanceTiming,
    PerformanceNavigation:dom.PerformanceNavigation,
    Document:dom.Document, HTMLDocument:dom.HTMLDocument, Navigator:dom.Navigator,
    Screen:dom.Screen, Location:dom.Location, History:dom.History,
    // 环境单例
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, history:dom.history, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:()=>{}, error:()=>{}, warn:()=>{}, info:()=>{}, debug:()=>{}},
    setTimeout:(fn, ms, ...a)=>{ try { fn(...a); } catch(e) {} return 0; },
    setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},
    // JS 内置
    TextEncoder, TextDecoder, URL, URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'),
    btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}), text:()=>Promise.resolve(''), blob:()=>Promise.resolve(new dom.Blob([]))}),
    Request:class{constructor(){}}, Response:class{constructor(){}},
    AbortController:class{constructor(){this.signal={aborted:false};} abort(){this.signal.aborted=true;}},
    Function, Math, Date, Object, Array, String, Number, Boolean,
    RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    Promise, Proxy, Reflect, Symbol, BigInt, BigInt64Array, BigUint64Array,
    parseInt, parseFloat, isNaN, isFinite, JSON, eval,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError,
    require:function(id){ if(id==='crypto') return require('crypto'); },
    process:{env:{}, platform:'win32', arch:'x64'},
  };
  s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location=s.location;
  return s;
}

// ═══ Webpack Runtime ═══
const WEBPACK_RUNTIME = `
(function(){
var m={},c={};
function r(id) {
  if (c[id]) return c[id].exports;
  if (!m[id]) m[id] = function(M,e) { M.exports = {}; };
  var M = c[id] = { id: id, exports: {} };
  m[id].call(M.exports, M, M.exports, r);
  return M.exports;
}
r.d = function(e,d) {
  for (var k in d) {
    if (r.o(d,k) && !r.o(e,k))
      Object.defineProperty(e, k, { enumerable: true, get: d[k] });
  }
};
r.n = function(m) {
  var g = m && m.__esModule ? function() { return m['default']; } : function() { return m; };
  r.d(g, {a: g});
  return g;
};
r.o = function(o,p) { return Object.prototype.hasOwnProperty.call(o, p); };
(self.webpackChunkxhs_pc_web = self.webpackChunkxhs_pc_web || []).push = function(chunk) {
  var cm = chunk[1];
  for (var id in cm) { if (r.o(cm, id)) m[id] = cm[id]; }
};
// 预注册 vendor.js 需要的外部依赖
m[21777] = function(M,e) { M.exports = String; };
m[31547] = function(M,e,r) {
  r.d(e, { _: function() {
    return function _typeof(v) {
      var t = typeof v;
      return t === 'object' ? (v === null ? 'null' : Array.isArray(v) ? 'array' : 'object') : t;
    };
  }});
};
self.__webpack_require__ = r;
self.s = r;
})();`;

// ═══ 状态 ═══
let _sandbox, _ctx, _ready = false;

function init() {
  if (_ready) return;

  _sandbox = buildSandbox();
  _ctx = vm.createContext(_sandbox);
  const t0 = Date.now();

  console.error('[sign] 加载 vendor.js...');
  vm.runInContext(WEBPACK_RUNTIME, _ctx, { filename: 'runtime.js' });
  const vendorCode = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  vm.runInContext(vendorCode, _ctx, { filename: 'vendor.js', timeout: 120000 });
  console.error('[sign] vendor.js 加载完成 (' + (Date.now() - t0) + 'ms)');

  // 调用 signV2Init — VMP 字节码会用 eval 创建 mnsv2
  console.error('[sign] 初始化 signV2Init...');
  try {
    vm.runInContext('__webpack_require__(68274).a()', _ctx);
    console.error('[sign] signV2Init 完成');
  } catch (e) {
    console.error('[sign] signV2Init 错误:', e.message.slice(0, 200));
  }

  // 从泄露的 Node global 找回 mnsv2
  findAndCopyMnsv2();
  console.error('[sign] mnsv2:', typeof _sandbox.mnsv2);
  console.error('[sign] 就绪 (' + (Date.now() - t0) + 'ms)');
  _ready = true;
}

function findAndCopyMnsv2() {
  // _AUuXfEG27Xa3x 是 VMP 字节码运行器（需要 __$c 字节码作为第一个参数）
  // 真正 mnsv2 哈希函数（需要 combined/url 作为参数）由 VMP 字节码运行时动态创建
  // 在 Node.js VM 中 VMP 字节码未能完整初始化，故 mnsv2 不存在
  // 留空让 sign() 走回退路径
}

function sign(url, data) {
  init();

  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const combined = url + bodyStr;

  const md5 = (str) => crypto.createHash('md5').update(str, 'utf8').digest('hex');
  const hashCombined = md5(combined);
  const hashUrl = md5(url);

  let mnsv2Result;
  if (typeof _sandbox.mnsv2 === 'function') {
    try {
      mnsv2Result = String(_sandbox.mnsv2(combined, hashCombined, hashUrl));
    } catch (e) {
      console.error('[sign] mnsv2 调用错误:', e.message);
      mnsv2Result = 'VMP_ERROR';
    }
  } else {
    // 回退: mnsv2 未初始化，用 MD5 替代（服务端会拒绝）
    mnsv2Result = crypto.createHash('md5').update(hashCombined + hashUrl).digest('hex');
    mnsv2Result = 'FALLBACK_' + mnsv2Result;
  }

  const payload = JSON.stringify({
    x0: '4.3.5',
    x1: 'xhs-pc-web',
    x2: 'Windows',
    x3: mnsv2Result,
    x4: typeof data === 'string' ? 'string' : 'object',
  });

  return {
    'x-s': 'XYS_' + customBase64Encode(Buffer.from(payload, 'utf-8')),
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
  console.log(JSON.stringify(sign(url, body)));
}

module.exports = { init, sign };
