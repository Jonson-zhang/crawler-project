const fs = require('fs'); const path = require('path'); const vm = require('vm');
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
  fetch:()=>Promise.resolve({json:()=>Promise.resolve({})}),
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

// Load ds_6545c.js with instrumentation to capture auto-call result
const ds6545_raw = fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8');

// Replace the auto-call to capture result AND prevent side effects
const instrumented = ds6545_raw.replace(
  /glb\['_AUuXfEG27Xa3x'\]\(/,
  'window.__auto_init_result = glb["_AUuXfEG27Xa3x"]('
);

try {
  vm.runInContext(instrumented, ctx, {filename:'ds_6545c_instrumented',timeout:60000});
  console.log('ds_6545c.js loaded OK');
} catch(e) {
  console.log('ds_6545c.js error:', e.message);
}

// Check auto-init result
const autoResult = vm.runInContext('window.__auto_init_result',ctx);
console.log('Auto-init result type:', typeof autoResult);
console.log('Auto-init result:', String(autoResult).slice(0, 200));

// Also check if _AUuXfEG27Xa3x silently returns an error
const fnCheck = vm.runInContext(`
  (() => {
    const r = {};
    // Check _AUuXfEG27Xa3x's behavior when called
    r._AUuXfEG27Xa3x_type = typeof _AUuXfEG27Xa3x;

    // Check what __$c and __bc look like (the bytecodes)
    r.__$c_len = (window.__$c||"").length;
    r.__bc_len = (window.__bc||"").length;

    // Check _dsf functionality
    try {
      const buf = _dsf("test");
      r._dsf_works = buf instanceof Uint8Array;
      r._dsf_len = buf.length;
    } catch(e) {
      r._dsf_error = e.message;
    }

    // Check _0c6b9e...
    try {
      const fn = _0c6b9e549fef9ab9b4798ad1f12ea82b;
      r.hashFn_defined = typeof fn === "function";
      if (r.hashFn_defined) {
        // Check the env items on the VMP function
        const internalKeys = Object.getOwnPropertyNames(fn).filter(k => k.length > 2);
        r.hashFn_keys = internalKeys;
      }
    } catch(e) {}

    return r;
  })()
`, ctx);
console.log('\nVMP state:');
console.log(JSON.stringify(fnCheck, null, 2));
