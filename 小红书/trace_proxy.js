/**
 * Proxy 追踪脚本 — 捕获 VMP 字节码在沙箱中访问了哪些属性
 *
 * 策略:
 *  1. 用递归 Proxy 包裹 document/navigator/screen/performance 等单例
 *  2. 记录每次属性访问（object → key → value/undefined）
 *  3. 运行 vendor.js + signV2Init
 *  4. 汇总报告：哪些属性被访问但返回 undefined
 */
"use strict";
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const dom = require('./env.dom');

const TRACE = []; // [{object, key, valueType, value, stack}]

function trace(obj, label) {
  // 只追踪 DOM 单例对象
  const TARGETS = ['document', 'navigator', 'screen', 'performance', 'location',
                    'localStorage', 'sessionStorage', 'history'];
  if (!TARGETS.includes(label)) return obj;
  if (typeof obj !== 'object' || obj === null) return obj;
  if (obj.___proxy___) return obj; // 已经 proxy 过

  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      const val = Reflect.get(target, key, receiver);
      const valType = val === null ? 'null' : typeof val;
      TRACE.push({ obj: label, key: String(key), valType, isUndef: val === undefined });
      if (val === undefined && !['__proto__', 'prototype'].includes(String(key)) && !String(key).startsWith('Symbol(')) {
        // 跳过 console.log 等常见存根
      }
      // 递归 proxy 子对象
      if (val !== null && typeof val === 'object' && !val.___proxy___) {
        return trace(val, label + '.' + String(key));
      }
      return val;
    },
    set(target, key, value) {
      TRACE.push({ obj: label, key: String(key), valType: 'set', isUndef: false });
      return Reflect.set(target, key, value);
    },
    has(target, key) {
      const result = Reflect.has(target, key);
      TRACE.push({ obj: label, key: 'in:' + String(key), valType: 'has:' + result, isUndef: false });
      return result;
    },
    getOwnPropertyDescriptor(target, key) {
      const desc = Reflect.getOwnPropertyDescriptor(target, key);
      TRACE.push({ obj: label, key: 'desc:' + String(key), valType: desc ? 'desc' : 'undefined', isUndef: !desc });
      return desc;
    },
  });
  proxy.___proxy___ = true;
  return proxy;
}

// ═══ 构建沙箱（单例用 Proxy 包裹）════
function buildSandbox() {
  const s = {
    window:{}, self:{}, global:{}, globalThis:{},

    // DOM 原型链（不 proxy，原型本身不被追踪）
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

    // ═══ 环境单例（用 Proxy 包裹）═══
    document: trace(dom.document, 'document'),
    location: document_createProxy(dom.location, 'location'),
    navigator: document_createProxy(dom.navigator, 'navigator'),
    screen: document_createProxy(dom.screen, 'screen'),
    history: document_createProxy(dom.history, 'history'),
    performance: document_createProxy(dom.performance, 'performance'),
    localStorage: document_createProxy(dom.localStorage, 'localStorage'),
    sessionStorage: document_createProxy(dom.sessionStorage, 'sessionStorage'),

    console: {log:()=>{}, error:()=>{}, warn:()=>{}, info:()=>{}, debug:()=>{}},
    setTimeout:(fn)=>{fn();return 0;}, setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},

    // JS 原生
    TextEncoder, TextDecoder, URL, URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'), btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}), text:()=>Promise.resolve('')}),
    Function, Math, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, ArrayBuffer, DataView,
    Promise, Proxy, Reflect, Symbol, BigInt, BigInt64Array, BigUint64Array,
    parseInt, parseFloat, isNaN, isFinite, JSON, eval,
    Error, TypeError, RangeError, SyntaxError, ReferenceError, EvalError,
    require:function(id){if(id==='crypto') return require('crypto')},
    process:{env:{}, platform:'win32', arch:'x64'},
  };
  s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location=s.location;
  return s;
}

function document_createProxy(obj, label) {
  if (typeof obj !== 'object' || obj === null) return obj;
  return trace(obj, label);
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

// ═══ 主流程 ═══
const s = buildSandbox();
const ctx = vm.createContext(s);

console.log('[trace] 加载 webpack runtime...');
vm.runInContext(WEBPACK_RUNTIME, ctx, { filename: 'runtime.js' });

console.log('[trace] 加载 vendor.js...');
const t0 = Date.now();
vm.runInContext(fs.readFileSync('data/vendor.js', 'utf-8'), ctx, { filename: 'vendor.js', timeout: 120000 });
console.log('[trace] vendor.js 加载完成 (' + (Date.now() - t0) + 'ms)');

// 记录 vendor 加载期间访问的 trace
const vendorTraceCount = TRACE.length;
console.log('[trace] vendor 加载期间产生 ' + vendorTraceCount + ' 条访问记录');

console.log('[trace] 调用 signV2Init...');
TRACE.length = 0; // 清空，只关注 signV2Init 期间
try {
  vm.runInContext('__webpack_require__(68274).a()', ctx);
  console.log('[trace] signV2Init 完成');
} catch(e) {
  console.error('[trace] signV2Init 错误:', e.message.slice(0, 300));
}
const signV2InitTraceCount = TRACE.length;

// ═══ 分析报告 ═══
console.log('\n═══════════════════════════════════════');
console.log('  Proxy 追踪报告 — signV2Init 阶段');
console.log('═══════════════════════════════════════');
console.log('总访问次数:', signV2InitTraceCount);

// 1. 按对象分组
const byObj = {};
for (const t of TRACE) {
  if (!byObj[t.obj]) byObj[t.obj] = { keys: new Set(), undefKeys: new Set(), count: 0 };
  byObj[t.obj].count++;
  byObj[t.obj].keys.add(t.key);
  if (t.isUndef) byObj[t.obj].undefKeys.add(t.key);
}

// 2. 展示每个对象被访问的 key
const order = ['document', 'navigator', 'screen', 'performance', 'location',
               'localStorage', 'sessionStorage', 'history'];
for (const name of order) {
  const info = byObj[name];
  if (!info) continue;
  console.log('\n── ' + name + ' (' + info.count + ' 次访问，' + info.keys.size + ' 个不同 key) ──');
  const keys = [...info.keys].sort();
  for (const k of keys) {
    const marker = info.undefKeys.has(k) ? ' ⚡ UNDEFINED' : '';
    console.log('  .' + k + marker);
  }
}

// 3. 突出显示返回 undefined 的属性
console.log('\n═══════════════════════════════════════');
console.log('  ⚡ 返回 undefined 的属性（需补全）');
console.log('═══════════════════════════════════════');

let totalUndef = 0;
for (const name of order) {
  const info = byObj[name];
  if (!info || info.undefKeys.size === 0) continue;
  console.log('\n' + name + ':');
  for (const k of [...info.undefKeys].sort()) {
    console.log('  .' + k);
    totalUndef++;
  }
}

if (totalUndef === 0) {
  console.log('  (无) — 所有被访问的属性都有值');
} else {
  console.log('\n合计 ' + totalUndef + ' 个 undefined 属性');
}

// 4. 展示 eval 中的错误
if (global.glb) {
  console.log('\n═══════════════════════════════════════');
  console.log('  VMP 函数泄露');
  console.log('═══════════════════════════════════════');
  const glbKeys = Object.getOwnPropertyNames(global.glb).filter(k =>
    typeof global.glb[k] === 'function' && k.length <= 20
  );
  console.log('glb 上的函数:', glbKeys);

  // 检查 mnsv2 相关的 3-arg 函数
  const fn3 = Object.getOwnPropertyNames(global).filter(k =>
    typeof global[k] === 'function' && global[k].length === 3
  );
  if (fn3.length > 0) {
    console.log('\nNode global 上的 3 参数函数:');
    for (const k of fn3) {
      console.log('  ' + k + ': ' + String(global[k]).slice(0, 100));
    }
  }
}

// 5. 导出原始 trace 供后续分析
fs.writeFileSync('trace_output.json', JSON.stringify({
  traces: TRACE.slice(0, 5000),  // 前 5000 条
  byObject: Object.fromEntries(Object.entries(byObj).map(([k, v]) => [
    k, { count: v.count, keys: [...v.keys], undefKeys: [...v.undefKeys] }
  ])),
  totalTraces: signV2InitTraceCount,
}, null, 2));
console.log('\n[trace] 详细 trace 已保存到 trace_output.json');
