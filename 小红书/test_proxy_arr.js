const fs = require('fs'); const path = require('path'); const vm = require('vm'); const crypto = require('crypto');
const dom = require('./env.dom');

// Create a LazyArray proxy that returns stubs for any index
function createLazyEnv() {
  const cache = {};
  return new Proxy([], {
    get(target, prop, receiver) {
      if (prop === 'length') return 9999;
      const idx = parseInt(prop);
      if (isNaN(idx)) return Reflect.get(target, prop, receiver);
      if (cache[idx]) return cache[idx];
      // Create stub based on index
      const known = {
        0: undefined, 1: undefined,
        2: Function, 3: document_obj, 4: performance, 5: MutationObserver, 6: Object,
        7: navigator, 8: location, 9: screen, 10: history,
      };
      if (known[idx] !== undefined) { cache[idx] = known[idx]; return known[idx]; }
      // Auto-stub for any other index
      cache[idx] = {};
      return cache[idx];
    }
  });
}

// Build sandbox
const s = {window:{},self:{},global:{},globalThis:{},
  EventTarget:dom.EventTarget,Node:dom.Node,Element:dom.Element,HTMLElement:dom.HTMLElement,
  Document:dom.Document,HTMLDocument:dom.HTMLDocument,
  HTMLCanvasElement:dom.HTMLCanvasElement,CanvasRenderingContext2D:dom.CanvasRenderingContext2D,
  WebGLRenderingContext:dom.WebGLRenderingContext,OffscreenCanvas:dom.OffscreenCanvas,
  AudioContext:dom.AudioContext,XMLHttpRequest:dom.XMLHttpRequest,
  Headers:dom.Headers,Blob:dom.Blob,File:dom.File,FileReader:dom.FileReader,FormData:dom.FormData,
  MutationObserver:dom.MutationObserver,IntersectionObserver:dom.IntersectionObserver,
  ResizeObserver:dom.ResizeObserver,PerformanceObserver:dom.PerformanceObserver,
  Performance:dom.Performance,PerformanceTiming:dom.PerformanceTiming,
  PerformanceNavigation:dom.PerformanceNavigation,Navigator:dom.Navigator,
  Screen:dom.Screen,Location:dom.Location,History:dom.History,
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
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
  Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
  Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
  parseInt,parseFloat,isNaN,isFinite,JSON,
  Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,eval,
  crypto:require('crypto').webcrypto,
};
s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;

// Create lazy env
const document_obj = s.document; const performance = s.performance; const navigator = s.navigator;
const location = s.location; const screen = s.screen; const history = s.history;
const MutationObserver = s.MutationObserver;
const lazyEnv = createLazyEnv();

// Patch ds_6545c.js to use our lazy env
const ctx = vm.createContext(s);
const D = path.join(__dirname,'data');

// Load ds_api.js
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{timeout:60000});

// Inject lazy env
s.__lazy_env = lazyEnv;

// Patch ds_6545c.js
const raw = fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8');
const patched = raw.replace(/\[,,\s*typeof Function[^\]]*\]/, '__lazy_env');
vm.runInContext(patched, ctx, {filename:'ds_6545c_lazy',timeout:60000});
console.log('Scripts loaded with lazy env');

const url = '/api/sns/web/v1/homefeed';
const body = JSON.stringify({cursor_score:'',num:20});
const combined = url + body;
function md5(s) { return crypto.createHash('md5').update(s,'utf-8').digest(); }
const h1 = md5(combined);
const h2 = md5(url);

s.__c = combined; s.__h1 = h1; s.__h2 = h2;

const r = vm.runInContext(`
(() => {
  try {
    const fn = _0c6b9e549fef9ab9b4798ad1f12ea82b;
    if (typeof fn !== 'function') return {error: 'fn not found'};
    const result = fn(__c, __h1, __h2);
    return {
      ok: true,
      rType: typeof result,
      rIsFn: result === fn,
      rStr: String(result).slice(0,200),
      rBytes: result instanceof Uint8Array ? Array.from(new Uint8Array(result)).map(b=>b.toString(16).padStart(2,'0')).join('') : null,
    };
  } catch(e) {
    return {ok: false, error: e.message.slice(0,200)};
  }
})()
`, ctx);

console.log('\nLazy env VMP result:');
console.log(JSON.stringify(r, null, 2));
