/**
 * Proxy 追踪 — 捕获 VMP 字节码初始化期间访问了沙箱的哪些属性
 */
"use strict";
const fs = require('fs'), vm = require('vm'), dom = require('./env.dom');

const TRACE_LOG = [];
const PROXIED = new WeakSet();
let _nextId = 1;

// ═══ 递归 Proxy ═══
function traceProxy(target, path) {
  if (target === null || target === undefined) return target;
  if (typeof target !== 'object' && typeof target !== 'function') return target;
  if (PROXIED.has(target)) return target;

  const id = _nextId++;
  const proxy = new Proxy(target, {
    get(_, key, receiver) {
      const val = Reflect.get(target, key, receiver);
      const fullKey = path + '.' + String(key);
      if (!fullKey.includes('Symbol(') && !fullKey.includes('__proto__')
          && typeof key !== 'symbol') {
        TRACE_LOG.push({ fullKey, vt: classify(val) });
      }
      return traceProxy(val, fullKey);
    },
    apply(_, thisArg, args) {
      TRACE_LOG.push({ fullKey: path + '()', vt: 'call', args: args.length });
      return Reflect.apply(target, thisArg, args);
    },
    construct(_, args) {
      TRACE_LOG.push({ fullKey: path + ' new()', vt: 'construct', args: args.length });
      return Reflect.construct(target, args);
    },
  });
  PROXIED.add(proxy);
  return proxy;
}

function classify(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'UNDEF';
  const t = typeof v;
  if (t === 'function') {
    try { return 'fn:' + (v.name || '?'); } catch(e) { return 'fn'; }
  }
  if (t === 'object') {
    if (Array.isArray(v)) return 'Array';
    try { if (v.constructor && v.constructor.name) return v.constructor.name; } catch(e) {}
    return 'object';
  }
  return t;
}

// ═══ 构建沙箱 ═══
function buildSandbox() {
  // 先把单例 proxify
  const pxDoc = traceProxy(dom.document, 'document');
  const pxNav = traceProxy(dom.navigator, 'navigator');
  const pxScr = traceProxy(dom.screen, 'screen');
  const pxLoc = traceProxy(dom.location, 'location');
  const pxPerf = traceProxy(dom.performance, 'performance');
  const pxLS = traceProxy(dom.localStorage, 'localStorage');
  const pxSS = traceProxy(dom.sessionStorage, 'sessionStorage');
  const pxHist = traceProxy(dom.history, 'history');

  const s = {
    window:{}, self:{}, global:{}, globalThis:{},

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

    // Proxied 单例
    document: pxDoc, location: pxLoc, navigator: pxNav,
    screen: pxScr, history: pxHist, performance: pxPerf,
    localStorage: pxLS, sessionStorage: pxSS,

    console:{log:()=>{}, error:()=>{}, warn:()=>{}, info:()=>{}, debug:()=>{}},
    setTimeout:(fn, ms, ...a)=>{try{fn(...a)}catch(e){}return 0;},
    setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},

    TextEncoder, TextDecoder, URL, URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'), btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Request:class{constructor(){}}, Response:class{constructor(){}},
    Function, Math, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView, Promise, Proxy, Reflect, Symbol,
    BigInt, BigInt64Array, BigUint64Array,
    parseInt, parseFloat, isNaN, isFinite, JSON, eval,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError,
    require:function(id){if(id==='crypto')return require('crypto')},
    process:{env:{},platform:'win32',arch:'x64'},
  };
  s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location = pxLoc;
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
r.d=function(e,d){for(var k in d){if(r.o(d,k)&&!r.o(e,k))Object.defineProperty(e,k,{enumerable:true,get:d[k]})}};
r.n=function(m){var g=m&&m.__esModule?function(){return m['default']}:function(){return m};r.d(g,{a:g});return g};
r.o=function(o,p){return Object.prototype.hasOwnProperty.call(o,p)};
(self.webpackChunkxhs_pc_web=self.webpackChunkxhs_pc_web||[]).push=function(chunk){
  var cm=chunk[1];
  for(var id in cm){if(r.o(cm,id))m[id]=cm[id]}
};
m[21777]=function(M,e){M.exports=String;};
m[31547]=function(M,e,r){r.d(e,{_:function(){return function _t(v){var t=typeof v;return t==='object'?(v===null?'null':Array.isArray(v)?'array':'object'):t}}})};
self.__webpack_require__=r;
self.s=r;
})();`;

// ═══ 主流程 ═══
const s = buildSandbox();
const ctx = vm.createContext(s);

console.error('[trace] 加载 vendor.js...');
vm.runInContext(WEBPACK_RUNTIME, ctx, { filename: 'runtime.js' });
const t0 = Date.now();
vm.runInContext(fs.readFileSync('data/vendor.js', 'utf-8'), ctx, { filename: 'vendor.js', timeout: 120000 });
console.error('[trace] vendor 加载期间 trace: ' + TRACE_LOG.length + ' 条, 耗时 ' + (Date.now()-t0) + 'ms');
// 清空，只看 signV2Init 期间的
TRACE_LOG.length = 0;

// 调用 signV2Init
console.error('[trace] 调用 signV2Init...');
try {
  vm.runInContext('__webpack_require__(68274).a()', ctx);
  console.error('[trace] signV2Init 完成');
} catch(e) {
  console.error('[trace] signV2Init 错误:', e.message.slice(0, 300));
}
console.error('[trace] signV2Init 期间 trace: ' + TRACE_LOG.length + ' 条');

// ═══ 分析报告 ═══
// 去重
const seenMap = new Map();
for (const t of TRACE_LOG) {
  if (!seenMap.has(t.fullKey)) seenMap.set(t.fullKey, t.vt);
}
const unique = [...seenMap.entries()];

console.log('\n═══════════════════════════════════════');
console.log('  Proxy 追踪报告 (signV2Init 阶段)');
console.log('  去重: ' + unique.length + ' 个不同属性路径');
console.log('═══════════════════════════════════════');

// 按顶级对象分组
const TOP_KEYS = ['document', 'navigator', 'screen', 'performance', 'location', 'localStorage', 'sessionStorage', 'history'];
for (const top of TOP_KEYS) {
  const items = unique.filter(([k]) => k.startsWith(top + '.') || k === top);
  if (items.length === 0) continue;
  console.log('\n── ' + top + ' (' + items.length + ' 个属性) ──');
  // 显示前两层
  const topLevel = items.filter(([k]) => {
    const parts = k.split('.');
    return parts.length === 2 || (parts.length === 3 && parts[2] === '()');
  });
  for (const [k, v] of topLevel.slice(0, 40)) {
    const marker = v === 'UNDEF' ? ' ⚡' : '';
    const shortK = k.slice(top.length + 1); // 去掉对象名前缀
    console.log('  .' + shortK + ' → ' + v + marker);
  }
  if (topLevel.length > 40) console.log('  ... (' + (topLevel.length - 40) + ' 更多)');
}

// 列出所有 UNDEF
console.log('\n═══════════════════════════════════════');
console.log('  ⚡ 返回 undefined 的属性');
console.log('═══════════════════════════════════════');
const undefs = unique.filter(([k, v]) => v === 'UNDEF');
if (undefs.length === 0) {
  console.log('  (无)');
} else {
  for (const [k] of undefs) console.log('  ' + k);
  console.log('\n  共 ' + undefs.length + ' 个');
}

// 写出完整 trace
fs.writeFileSync('trace_unique.json', JSON.stringify(
  unique.filter(([k]) => TOP_KEYS.some(t => k.startsWith(t + '.') || k === t)),
  null, 2
));
console.error('\n[trace] 详细 saved to trace_unique.json');
