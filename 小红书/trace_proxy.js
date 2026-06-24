/**
 * 深入调试: 找出 signV2Init 期间的错误并修复
 */
"use strict";
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), dom = require('./env.dom');

function buildSandbox() {
  const s = {
    window:{}, self:{}, global:{}, globalThis:{},
    EventTarget:dom.EventTarget, Node:dom.Node, Element:dom.Element, HTMLElement:dom.HTMLElement,
    HTMLCanvasElement:dom.HTMLCanvasElement, CanvasRenderingContext2D:dom.CanvasRenderingContext2D,
    WebGLRenderingContext:dom.WebGLRenderingContext, OffscreenCanvas:dom.OffscreenCanvas,
    AudioContext:dom.AudioContext, XMLHttpRequest:dom.XMLHttpRequest, Headers:dom.Headers,
    Blob:dom.Blob, File:dom.File, FileReader:dom.FileReader, FormData:dom.FormData,
    MutationObserver:dom.MutationObserver, IntersectionObserver:dom.IntersectionObserver,
    ResizeObserver:dom.ResizeObserver, PerformanceObserver:dom.PerformanceObserver,
    Event:dom.Event, CustomEvent:dom.CustomEvent, MessageChannel:dom.MessageChannel,
    Worker:dom.Worker, WebSocket:dom.WebSocket, Image:dom.Image,
    Performance:dom.Performance, PerformanceTiming:dom.PerformanceTiming,
    PerformanceNavigation:dom.PerformanceNavigation,
    Document:dom.Document, HTMLDocument:dom.HTMLDocument, Navigator:dom.Navigator,
    Screen:dom.Screen, Location:dom.Location, History:dom.History,
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, history:dom.history, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:function(...a){process.stderr.write('[VM LOG] '+a.join(' ')+'\n');}, error:function(...a){process.stderr.write('[VM ERROR] '+a.join(' ')+'\n');}, warn:function(){}, info:function(){}, debug:function(){}},
    setTimeout:(fn,ms,...a)=>{try{fn(...a)}catch(e){}return 0;},
    setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},
    TextEncoder, TextDecoder, URL, URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'), btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent, decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Function, Math, Date, Object, Array, String, Number, Boolean, RegExp, Map, Set, WeakMap, WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    BigInt,BigInt64Array,BigUint64Array,
    parseInt,parseFloat,isNaN,isFinite,JSON,eval,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,
    require:function(id){if(id==='crypto')return require('crypto')},
    process:{env:{},platform:'win32',arch:'x64'},
  };
  s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location=s.location;
  return s;
}

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

const s = buildSandbox();
const ctx = vm.createContext(s);

console.error('Loading vendor.js...');
vm.runInContext(WEBPACK_RUNTIME, ctx, { filename: 'runtime.js' });
vm.runInContext(fs.readFileSync('data/vendor.js', 'utf-8'), ctx, { filename: 'vendor.js', timeout: 120000 });

// Clean + inject globals
delete global.glb; delete global._0x5ae8; delete global._0xc8b2; delete global._0xe762c0;
delete global.__$c; delete global._AUuXfEG27Xa3x; delete global.__bc; delete global.mnsv2;
global.document = s.document;
global.top = s;
delete global.chrome;

// Intercept eval to catch errors
const origEval = s.eval;
s.eval = function(code) {
  try {
    return origEval(code);
  } catch(e) {
    console.error('[EVAL ERROR]', e.message.slice(0, 500));
    console.error('[EVAL STACK]', (e.stack||'').slice(0, 500));
    throw e;
  }
};

console.error('Calling signV2Init...');
try {
  vm.runInContext('__webpack_require__(68274).a()', ctx);
} catch(e) {
  console.error('[signV2Init ERROR]', e.message.slice(0, 500));
}

// ═══ Full mnsv2 test ═══
const mnsv2 = global.glb?.mnsv2;
if (typeof mnsv2 === 'function') {
  const url = '/api/sns/web/v1/homefeed';
  const body = '{"cursor_score":"","num":20,"refresh_type":1,"note_index":0}';
  const combined = url + body;
  const hc = crypto.createHash('md5').update(combined).digest('hex');
  const hu = crypto.createHash('md5').update(url).digest('hex');

  console.log('\n=== Full mnsv2 test ===');

  // Call with seccore_signv2 signature
  const result = mnsv2(combined, hc, hu);
  console.log('Result type:', typeof result);
  console.log('Result constructor:', result?.constructor?.name);
  console.log('Full result:', String(result));
  console.log('Result length:', String(result).length);

  // Also print as Uint8Array if applicable
  if (result instanceof Uint8Array) {
    console.log('Uint8Array bytes:', Array.from(result).slice(0, 30));
  }

  // Now assemble full x-s
  const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
  function customBase64Encode(bytes) {
    const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf-8') : bytes;
    let r = '';
    const len = buf.length;
    for (let i = 0; i < len; i += 3) {
      const a = buf[i], b = i+1<len ? buf[i+1] : 0, c = i+2<len ? buf[i+2] : 0;
      r += XHS_B64[a>>2] + XHS_B64[((a&3)<<4)|(b>>4)];
      r += i+1<len ? XHS_B64[((b&15)<<2)|(c>>6)] : XHS_B64[0];
      r += i+2<len ? XHS_B64[c&63] : XHS_B64[0];
    }
    return r;
  }

  const payload = JSON.stringify({
    x0: '4.3.5', x1: 'xhs-pc-web', x2: 'Windows',
    x3: String(result), x4: 'object',
  });
  const xs = 'XYS_' + customBase64Encode(Buffer.from(payload, 'utf-8'));
  console.log('\nx-s:', xs.slice(0, 100) + '...');
  console.log('x-t:', String(Date.now()));
}

delete global.document; delete global.top;
