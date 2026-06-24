#!/usr/bin/env node
/**
 * 完整 webpack 链加载测试 — 含 bundler-runtime
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dom = require('./env.dom');

const s = {
  window:{}, self:{}, global:{}, globalThis:{},
  EventTarget:dom.EventTarget,Node:dom.Node,Element:dom.Element,HTMLElement:dom.HTMLElement,
  HTMLDocument:dom.HTMLDocument,HTMLCanvasElement:dom.HTMLCanvasElement,
  CanvasRenderingContext2D:dom.CanvasRenderingContext2D,WebGLRenderingContext:dom.WebGLRenderingContext,
  OffscreenCanvas:dom.OffscreenCanvas,AudioContext:dom.AudioContext,
  XMLHttpRequest:dom.XMLHttpRequest,Headers:dom.Headers,Blob:dom.Blob,File:dom.File,
  FileReader:dom.FileReader,FormData:dom.FormData,MutationObserver:dom.MutationObserver,
  IntersectionObserver:dom.IntersectionObserver,ResizeObserver:dom.ResizeObserver,
  PerformanceObserver:dom.PerformanceObserver,Performance:dom.Performance,
  PerformanceTiming:dom.PerformanceTiming,PerformanceNavigation:dom.PerformanceNavigation,
  Navigator:dom.Navigator,Screen:dom.Screen,Location:dom.Location,History:dom.History,
  Event:dom.Event,CustomEvent:dom.CustomEvent,MessageChannel:dom.MessageChannel,
  Worker:dom.Worker,WebSocket:dom.WebSocket,Image:dom.Image,
  URL,URLSearchParams,
  document:dom.document,location:dom.location,navigator:dom.navigator,
  screen:dom.screen,history:dom.history,performance:dom.performance,
  localStorage:dom.localStorage,sessionStorage:dom.sessionStorage,console:dom.console,
  setTimeout:(fn,ms,a)=>{fn(a);return 0;},setInterval:()=>0,
  clearTimeout:dom.noop,clearInterval:dom.noop,
  TextEncoder,TextDecoder,atob:x=>Buffer.from(x,'base64').toString('binary'),
  btoa:x=>Buffer.from(x,'binary').toString('base64'),encodeURIComponent,decodeURIComponent,
  fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve(''),blob:()=>Promise.resolve(new dom.Blob([]))}),
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
  Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
  Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
  BigInt,BigInt64Array,BigUint64Array,
  parseInt,parseFloat,isNaN,isFinite,JSON,
  Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,eval,
  crypto:require('crypto').webcrypto,
  require:function(id){if(id==='@lwjjike/xbsdom')return undefined;return require(id);},
  // For window.__webpack_require__
  __webpack_require__: null,
};
s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
const ctx = vm.createContext(s);
const D = path.join(__dirname,'data');

function load(name) {
  const fp = path.join(D, name);
  if (!fs.existsSync(fp)) { console.log('[MISS] ' + name); return false; }
  try {
    const code = fs.readFileSync(fp, 'utf-8');
    vm.runInContext(code, ctx, { filename: name, timeout: 180000 });
    console.log('[OK] ' + name);
    return true;
  } catch(e) {
    console.log('[ERR] ' + name + ': ' + e.message.slice(0, 120));
    const lines = (e.stack||'').split('\n');
    for (const line of lines.slice(1, 4)) console.log('      ' + line.trim());
    return false;
  }
}

// ═══ ORDER MATTERS ═══
// 1. bundler-runtime (defines __webpack_require__ + webpackChunkxhs_pc_web.push handler)
// 2. DS scripts (VMP interpreters, NOT webpack)
// 3. library chunks (webpack, push to chunk array)
// 4. app chunks (webpack, contains seccore_signv2)
// 5. signer (sabo VM, sets _webmsxyw)

console.log('=== Phase 1: Core ===');
load('bundler-runtime.11657a30.js');
load('ds_api.js');
load('ds_6545c.js');

console.log('\n=== Phase 2: Libraries (webpack) ===');
load('library-polyfill.29a884fe.js');
load('library-lodash.c2803696.js');
load('library-axios.1c2d8386.js');
load('library-vue.aea14f59.js');

console.log('\n=== Phase 3: App (webpack) ===');
load('vendor_6f49.js');
load('vendor-dynamic.js');
load('bf7d4e.js');
load('WorldCupShared.b53633e1.js');

console.log('\n=== Phase 4: Signer (sabo) ===');
load('signer_f218.js');

console.log('\n=== Phase 5: Main app (webpack) ===');
load('index_46f7b.js');

// ═══ Check results ═══
console.log('\n=== Results ===');
const check = vm.runInContext(`
  (() => {
    const r = {};
    r.__webpack_require__ = typeof __webpack_require__;
    r.webpackChunkLen = window.webpackChunkxhs_pc_web ? window.webpackChunkxhs_pc_web.length : -1;
    r._webmsxyw = typeof window._webmsxyw;
    r.mnsv2 = typeof window.mnsv2;
    r.mns = typeof window.mns;
    r.sign = typeof window.sign;
    r.seccore_signv2 = typeof window.seccore_signv2;
    r._dsf = typeof window._dsf;

    // Search for any function containing 'mns'
    const mnsFns = [];
    for (const k of Object.getOwnPropertyNames(window)) {
      try {
        if (typeof window[k] === 'function') {
          const src = window[k].toString();
          if (src.includes('mns') || src.includes('_sabo') || k.startsWith('_')) {
            if (mnsFns.length < 15) mnsFns.push(k + ':' + src.slice(0, 50));
          }
        }
      } catch(e) {}
    }
    r.mnsFns = mnsFns;

    return r;
  })()
`, ctx);
console.log(JSON.stringify(check, null, 2));

// ═══ Try calling sign ═══
console.log('\n=== Test Sign ===');
vm.runInContext(`
  try {
    const url = '/api/sns/web/v1/homefeed';
    const body = JSON.stringify({cursor_score:'',num:20});
    const result = window.seccore_signv2(url, body);
    console.log('seccore_signv2 result:');
    console.log('  x-s:', result['x-s'] ? result['x-s'].slice(0, 100) : 'NOT_SET');
  } catch(e) {
    console.log('seccore_signv2 error:', e.message.slice(0, 200));
  }
`, ctx);
