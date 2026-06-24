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
  document:dom.document, location:dom.location, navigator:dom.navigator,
  screen:dom.screen, history:dom.history, performance:dom.performance,
  localStorage:dom.localStorage, sessionStorage:dom.sessionStorage, console:dom.console,
  setTimeout:(fn,ms,a)=>{fn(a);return 0;}, setInterval:()=>0,
  clearTimeout:dom.noop, clearInterval:dom.noop,
  TextEncoder,TextDecoder, atob:x=>Buffer.from(x,'base64').toString('binary'),
  btoa:x=>Buffer.from(x,'binary').toString('base64'), encodeURIComponent,decodeURIComponent,
  fetch:()=>Promise.resolve({json:()=>Promise.resolve({})}),
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
  Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
  Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
  parseInt,parseFloat,isNaN,isFinite,JSON,
  Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,eval,
  crypto:require('crypto').webcrypto,
  require: function(id) { if (id==='@lwjjike/xbsdom') return undefined; return require(id); },
};
s.self=s; s.window=s; s.global=s; s.globalThis=s; s.document.location=s.location;

const ctx = vm.createContext(s);
const D = path.join(__dirname,'data');

console.log('[1] Loading ds_api.js...');
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{filename:'ds_api',timeout:60000});

console.log('[2] Loading ds_6545c.js...');
vm.runInContext(fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8'),ctx,{filename:'ds_6545c',timeout:60000});

console.log('[3] Loading signer_04b29_formatted.js...');
// Before loading, intercept window property writes
vm.runInContext(`
  var _orig_defProp = Object.defineProperty;
  var _captured = {};
  Object.defineProperty = function(obj, prop, desc) {
    if (prop === 'mns' || prop === 'mnsv2' || prop.includes('sign')) {
      _captured[prop] = {
        type: typeof desc.value,
        str: typeof desc.value === 'function' ? desc.value.toString().slice(0,300) : String(desc.value).slice(0,100),
      };
    }
    return _orig_defProp.call(Object, obj, prop, desc);
  };
  window._captured_defProp = _captured;
`, ctx);

try {
  vm.runInContext(fs.readFileSync(path.join(D,'signer_04b29_formatted.js'),'utf-8'),ctx,{filename:'signer',timeout:180000});
  console.log('   OK');
} catch(e) {
  console.log('   ERR:', e.message.slice(0,150));
}

// Check
const check = vm.runInContext(`
  (() => {
    const r = {};
    r.mnsv2 = typeof window.mnsv2;
    r.mns = typeof window.mns;
    r.capturedProps = window._captured_defProp || {none: true};
    r._webmsxyw = typeof window._webmsxyw;

    // Search ALL window functions for mns references
    for (const k of Object.getOwnPropertyNames(window)) {
      if (typeof window[k] === 'function') {
        try {
          const src = window[k].toString();
          if (src.includes('mns') || src.includes('_sabo')) {
            r['fn_' + k] = src.slice(0, 100);
          }
        } catch(e) {}
      }
    }
    return r;
  })()
`, ctx);

console.log('\nResults:');
console.log(JSON.stringify(check, null, 2));

// Try direct approach: call _webmsxyw as the sabo entry
console.log('\n[Test] Calling _webmsxyw directly...');
try {
  const result = vm.runInContext('typeof _webmsxyw === "function" ? _webmsxyw.toString().slice(0,500) : typeof _webmsxyw', ctx);
  console.log('_webmsxyw:', result);
} catch(e) {
  console.log('Error:', e.message);
}

// Final test: try _dsf and the hash function
console.log('\n[Test] Hash functions...');
try {
  const t1 = vm.runInContext('(function(c){ return Array.from(new Uint8Array(_dsf(c))).map(b=>b.toString(16).padStart(2,"0")).join(""); })("test")', ctx);
  console.log('_dsf("test"):', t1);
} catch(e) {
  console.log('_dsf error:', e.message);
}
