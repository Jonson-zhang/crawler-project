const fs = require('fs'); const path = require('path'); const vm = require('vm'); const crypto = require('crypto');
const dom = require('./env.dom');
const s = {window:{},self:{},global:{},globalThis:{},
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
  fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
  Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
  Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
  parseInt,parseFloat,isNaN,isFinite,JSON,
  Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,eval,
  crypto:require('crypto').webcrypto,
  require:function(id){if(id==='@lwjjike/xbsdom')return undefined;return require(id);},
};
s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
const ctx = vm.createContext(s);
const D = path.join(__dirname,'data');

// Load ds_api.js normally
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{timeout:60000});

// Create extended env array in sandbox (no circular refs in the array)
vm.runInContext(`
__extended_env = [
  window,
  window,
  Function,
  document,
  performance,
  MutationObserver,
  Object,
  navigator,
  location,
  screen,
  history,
  console,
  localStorage,
  sessionStorage,
  Date,
  Math,
  RegExp,
  Array,
  String,
  JSON,
  parseInt,
  parseFloat,
  Error,
  TypeError,
  Uint8Array,
  Symbol,
  Map,
  Set,
  Promise,
  Proxy,
  Reflect,
  Boolean,
  Number,
  parseInt,
  isNaN,
  isFinite,
  undefined,
  encodeURIComponent,
  decodeURIComponent,
  eval,
  XMLHttpRequest,
  Headers,
  Blob,
  Event,
  FileReader,
  FormData,
  Image,
  AudioContext,
  HTMLCanvasElement,
  CanvasRenderingContext2D,
  WebGLRenderingContext,
  OffscreenCanvas,
  MessageChannel,
  Worker,
  WebSocket,
  atob,
  btoa,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  localStorage,
  sessionStorage,
]
`, ctx);

console.log('Extended env created, length:', vm.runInContext('__extended_env.length', ctx));

// Patch ds_6545c.js — only replace the env array, not the __$c string
const ds6545_raw = fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8');

// The env array starts with: [,,typeof Function...
// Replace ONLY the array literal (not the __$c string which has similar chars)
const patched = ds6545_raw.replace(
  /\[,,\s*typeof Function[^\]]*\]/,
  '__extended_env'
);

console.log('Regex matched:', patched !== ds6545_raw);
if (patched === ds6545_raw) {
  // Fallback: find the LAST occurrence of [,,typeof
  const idx = ds6545_raw.lastIndexOf('[,,typeof');
  if (idx >= 0) {
    const endIdx = ds6545_raw.indexOf('])', idx);
    const before = ds6545_raw.slice(0, idx);
    const after = ds6545_raw.slice(endIdx + 2);
    const patched2 = before + '__extended_env' + after;
    vm.runInContext(patched2, ctx, {filename:'ds_6545c_extended',timeout:60000});
    console.log('Patched ds_6545c.js (fallback) loaded OK');
  }
} else {
  vm.runInContext(patched, ctx, {filename:'ds_6545c_extended',timeout:60000});
  console.log('Patched ds_6545c.js loaded OK');
}

function md5(s) { return crypto.createHash('md5').update(s,'utf-8').digest(); }

const url = '/api/sns/web/v1/homefeed';
const body = JSON.stringify({cursor_score:'',num:20});
const combined = url + body;
const h1 = md5(combined);
const h2 = md5(url);

const testCode = `
(() => {
  const combined = __combined;
  const h1 = __h1;
  const h2 = __h2;

  try {
    const fn = _0c6b9e549fef9ab9b4798ad1f12ea82b;
    if (typeof fn !== 'function') return {error: 'fn not found'};

    const stateBefore = {};
    for (const k of ['IIΙ','IΙI','IΙΙ','ΙII','ΙIΙ']) stateBefore[k] = fn[k];

    const r = fn(combined, h1, h2);

    const stateAfter = {};
    for (const k of ['IIΙ','IΙI','IΙΙ','ΙII','ΙIΙ']) stateAfter[k] = fn[k];

    return { stateBefore, rType: typeof r, rIsFn: r === fn, rStr: String(r).slice(0,100), stateAfter };
  } catch(e) {
    return {ok: false, error: e.message.slice(0, 300), stack: (e.stack||'').split('\\n').slice(0,4).join(' | ')};
  }
})()
`;

const opts = {__combined: combined, __h1: h1, __h2: h2};
// Inject test data into sandbox
vm.runInContext('__combined = "' + combined.replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"', ctx);
vm.runInContext('__h1 = new Uint8Array([' + Array.from(h1).join(',') + '])', ctx);
vm.runInContext('__h2 = new Uint8Array([' + Array.from(h2).join(',') + '])', ctx);

const r = vm.runInContext(testCode, ctx);
console.log('\nVMP test result:');
console.log(JSON.stringify(r, null, 2));
