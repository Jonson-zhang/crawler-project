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

// ═══ 自定义 Base64 ═══
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

// ═══ 构建沙箱 ═══
function buildSandbox() {
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
    Performance:dom.Performance, PerformanceTiming:dom.PerformanceTiming, PerformanceNavigation:dom.PerformanceNavigation,
    Document:dom.Document, HTMLDocument:dom.HTMLDocument, Navigator:dom.Navigator,
    Screen:dom.Screen, Location:dom.Location, History:dom.History,
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, history:dom.history, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:()=>{},error:()=>{},warn:()=>{},info:()=>{},debug:()=>{}},
    setTimeout:(fn)=>{try{fn();}catch(e){}return 0;}, setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},
    TextEncoder,TextDecoder,URL,URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'), btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent,decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Request:class{constructor(){}}, Response:class{constructor(){}},
    AbortController:class{constructor(){this.signal={aborted:false};}abort(){this.signal.aborted=true;}},
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,
    Promise,Proxy,Reflect,Symbol,BigInt,BigInt64Array,BigUint64Array,
    parseInt,parseFloat,isNaN,isFinite,JSON,eval,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,
    require:function(id){if(id==='crypto')return require('crypto');},
    process:{env:{},platform:'win32',arch:'x64'},
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
  return s;
}

// ═══ Webpack Runtime ═══
const WEBPACK_RUNTIME = `
(function(){
var m={},c={};
function r(id){if(c[id])return c[id].exports;if(!m[id])m[id]=function(M,e){M.exports={};};var M=c[id]={id:id,exports:{}};m[id].call(M.exports,M,M.exports,r);return M.exports}
r.d=function(e,d){for(var k in d){if(r.o(d,k)&&!r.o(e,k))Object.defineProperty(e,k,{enumerable:true,get:d[k]})}};
r.n=function(m){var g=m&&m.__esModule?function(){return m['default']}:function(){return m};r.d(g,{a:g});return g};
r.o=function(o,p){return Object.prototype.hasOwnProperty.call(o,p)};
(self.webpackChunkxhs_pc_web=self.webpackChunkxhs_pc_web||[]).push=function(chunk){var cm=chunk[1];for(var id in cm){if(r.o(cm,id))m[id]=cm[id]}};
m[21777]=function(M,e){M.exports=String;};
m[31547]=function(M,e,r){r.d(e,{_:function(){return function _t(v){var t=typeof v;return t==='object'?(v===null?'null':Array.isArray(v)?'array':'object'):t}}})};
self.__webpack_require__=r;
self.s=r;
})();`;

// ═══ 状态 ═══
let _sandbox, _ctx, _ready = false;

/**
 * 从 signV2Init 泄露到 Node global 的对象中找到 mnsv2 函数
 */
function findMnsv2() {
  // signV2Init 的 eval 代码通过 decode 函数设置 key
  // 遍历 Node global 上泄露的变量
  const glb = global.glb;
  if (!glb || typeof glb !== 'object') return null;

  // 方法1: 在 glb 上找 3 参数的函数
  for (const key of Object.keys(glb)) {
    const v = glb[key];
    if (typeof v === 'function' && v.length === 3 && key !== '_AUuXfEG27Xa3x') {
      // 检查函数体是否包含 signature 特征
      const src = String(v);
      if (src.includes('fromCharCode') || src.includes('IΙΙ')) {
        return v;
      }
    }
  }

  // 方法2: 使用解码函数查找
  const decodeFn = global._0xe762c0 || global._0xc8b2;
  if (typeof decodeFn === 'function') {
    for (let i = 0; i <= 0xff; i++) {
      try {
        const name = decodeFn(i);
        if (typeof name === 'string' && name.length >= 3 && name.length <= 7 && typeof glb[name] === 'function') {
          if (glb[name].length === 3) return glb[name];
        }
      } catch(e) {}
    }
  }

  // 方法3: 直接检查 Node global 上的短函数
  for (const key of Object.keys(global)) {
    if (key.length >= 3 && key.length < 8 && typeof global[key] === 'function' && global[key].length === 3) {
      const src = String(global[key]);
      if (src.includes('IΙΙ') || src.includes('fromCharCode')) {
        return global[key];
      }
    }
  }

  return null;
}

function init() {
  if (_ready) return;

  _sandbox = buildSandbox();
  _ctx = vm.createContext(_sandbox);

  const t0 = Date.now();
  console.error('[sign] Loading vendor.js...');

  // 1. 注入 webpack runtime
  vm.runInContext(WEBPACK_RUNTIME, _ctx, { filename: 'runtime.js' });

  // 2. 加载 vendor.js
  const vendorCode = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  vm.runInContext(vendorCode, _ctx, { filename: 'vendor.js', timeout: 120000 });

  console.error('[sign] vendor.js loaded in', Date.now() - t0, 'ms');

  // 3. 调用 signV2Init（清理可能的泄露变量避免重复声明错误）
  console.error('[sign] Running signV2Init...');
  try {
    // 清理可能从之前运行中泄露的变量
    delete global.glb;
    delete global._0x5ae8;
    delete global._0xc8b2;
    delete global._0xe762c0;
    delete global.__$c;
    delete global._AUuXfEG27Xa3x;
    delete global.__bc;

    const signV2Init = vm.runInContext('__webpack_require__(68274).a', _ctx);
    signV2Init();

    console.error('[sign] signV2Init completed');
  } catch (e) {
    if (e.message && e.message.includes('already been declared')) {
      // 已经运行过但 glb 泄露了，尝试查找 mnsv2
      console.error('[sign] signV2Init already ran (glb leaked), finding mnsv2...');
    } else {
      console.error('[sign] signV2Init error:', e.message.slice(0, 200));
    }
  }

  // 4. 找到 mnsv2 并注入沙箱
  const mnsv2Fn = findMnsv2();
  if (mnsv2Fn) {
    vm.runInContext('window.mnsv2 = mnsv2Fn', _ctx, { mnsv2Fn: mnsv2Fn });
    console.error('[sign] mnsv2 injected into sandbox');
  } else {
    console.error('[sign] Could not find mnsv2 on leaked globals');
    console.error('[sign] global.glb keys:', global.glb ? Object.keys(global.glb).filter(k => typeof global.glb[k] === 'function' && k.length < 10) : 'N/A');
  }

  console.error('[sign] window.mnsv2:', typeof _sandbox.mnsv2);
  console.error('[sign] Ready in', Date.now() - t0, 'ms');

  _ready = true;
}

function sign(url, data) {
  init();

  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const combined = url + bodyStr;

  // MD5
  const md5 = (str) => crypto.createHash('md5').update(str, 'utf8').digest('hex');
  const hashCombined = md5(combined);
  const hashUrl = md5(url);

  // 调用 mnsv2
  let mnsv2Result;
  try {
    mnsv2Result = vm.runInContext(`
      (() => {
        if (typeof window.mnsv2 !== 'function') return 'ERR:no_mnsv2';
        var result = window.mnsv2(__combined, __hashCombined, __hashUrl);
        return String(result);
      })()
    `, _ctx, {
      __combined: combined,
      __hashCombined: hashCombined,
      __hashUrl: hashUrl,
    });
  } catch (e) {
    console.error('[sign] mnsv2 error:', e.message);
    mnsv2Result = 'FALLBACK_';
  }

  // 构建 payload
  const payload = JSON.stringify({
    x0: '4.3.5',
    x1: 'xhs-pc-web',
    x2: 'Windows',
    x3: mnsv2Result,
    x4: typeof data === 'string' ? 'string' : 'object',
  });

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
