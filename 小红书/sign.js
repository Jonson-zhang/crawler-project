/**
 * sign.js — 小红书 X-s 离线签名
 *
 * 用法:
 *   node sign.js <url> <body_json>
 *
 * Python:
 *   const {init, sign} = require('./sign');
 *   init();
 *   const h = sign(url, body);
 */
"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const dom = require('./env.dom');

// ═══ 自定义 Base64 ═══
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

// ═══ 构建沙箱 ═══
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
    Performance:dom.Performance, Document:dom.Document, Navigator:dom.Navigator,
    Screen:dom.Screen, Location:dom.Location, History:dom.History,
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:()=>{},error:()=>{},warn:()=>{},info:()=>{},debug:()=>{}},
    setTimeout:(fn)=>{try{fn()}catch(e){}return 0;},
    setInterval:()=>0,clearTimeout:()=>{},clearInterval:()=>{},
    TextEncoder,TextDecoder,URL,URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'),btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent,decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    BigInt,BigInt64Array,BigUint64Array,
    parseInt,parseFloat,isNaN,isFinite,JSON,eval,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,
    require:function(id){if(id==='crypto')return require('crypto')},
    process:{env:{},platform:'win32',arch:'x64'},
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
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

// ═══ 状态 ═══
let _sandbox, _ctx, _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  _sandbox = buildSandbox();
  _ctx = vm.createContext(_sandbox);
  const t0 = Date.now();

  // 1. ═══ 注入 document/top 到 Node global（必须在加载 vendor 前）═══
  //    vendor.js 末尾自动调用 signV2Init，eval 代码用 typeof 检查这些变量
  global.document = _sandbox.document;
  global.top = _sandbox; // top = window

  // 2. runtime + vendor（vendor 末尾自动触发 signV2Init）
  vm.runInContext(WEBPACK_RUNTIME, _ctx, { filename: 'runtime' });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'data','vendor.js'),'utf-8'),
    _ctx, { filename: 'vendor', timeout: 120000 });

  // 3. 如果 vendor 的 auto-init 没触发，手动调用
  if (!global.glb || !global.glb.mnsv2) {
    try {
      vm.runInContext('__webpack_require__(68274).a()', _ctx);
    } catch(e) {}
  }

  // 5. 从 glb 获取 mnsv2
  if (global.glb && typeof global.glb.mnsv2 === 'function') {
    _mnsv2fn = global.glb.mnsv2;
  }

  // 6. 清理 Node global（避免污染后续 require 的模块）
  //    注意: var 创建的变量不能 delete，用 = undefined
  try { delete global.document; } catch(e) { global.document = undefined; }
  try { delete global.top; } catch(e) { global.top = undefined; }
  global.glb = undefined; global._0x5ae8 = undefined; global._0xc8b2 = undefined;
  global._0xe762c0 = undefined; global.__$c = undefined;
  global._AUuXfEG27Xa3x = undefined; global.__bc = undefined;

  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const combined = url + bodyStr;
  const md5 = s => crypto.createHash('md5').update(s,'utf8').digest('hex');
  const hc = md5(combined), hu = md5(url);

  let mnsv2Result;
  if (_mnsv2fn) {
    try { mnsv2Result = String(_mnsv2fn(combined, hc, hu)); }
    catch(e) { mnsv2Result = 'VMP_ERR'; }
  } else {
    mnsv2Result = 'NOMNSV2';
  }

  const payload = JSON.stringify({
    x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows',
    x3: mnsv2Result, x4: typeof data === 'string' ? 'string' : 'object'
  });

  return {
    'x-s': 'XYS_' + customBase64Encode(Buffer.from(payload,'utf-8')),
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
