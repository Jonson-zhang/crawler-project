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
  // Needed for some env checks
  process: { env: {}, versions: { node: '20.0.0' } },
};
s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
const ctx = vm.createContext(s);
const D = path.join(__dirname,'data');

// Load ds_api.js
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{timeout:60000});

// Patch ds_6545c.js: replace the auto-call env array to fill empty slots
// Original: [,,Function, document, performance, MutationObserver, Object]
// Patched:  [window, undefined, Function, document, performance, MutationObserver, Object, ...]
const ds6545_raw = fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8');

// The auto-call is at the end: glb['_AUuXfEG27Xa3x'](__$c, [,,typeof Function...])
// Let's find the exact match and replace it
const patched = ds6545_raw.replace(
  /glb\['_AUuXfEG27Xa3x'\]\(__\$c,\s*\[,,(typeof[^\]]+)\]\)/,
  'glb["_AUuXfEG27Xa3x"](__$c, [window, undefined, typeof Function !== "undefined" ? Function : undefined, typeof document !== "undefined" ? document : undefined, typeof performance !== "undefined" ? performance : undefined, typeof MutationObserver !== "undefined" ? MutationObserver : undefined, typeof Object !== "undefined" ? Object : undefined, typeof navigator !== "undefined" ? navigator : undefined, typeof location !== "undefined" ? location : undefined, typeof screen !== "undefined" ? screen : undefined])'
);

console.log('Patched length diff:', patched.length - ds6545_raw.length);

try {
  vm.runInContext(patched, ctx, {filename:'ds_6545c_patched',timeout:60000});
  console.log('Patched ds_6545c.js loaded OK');
} catch(e) {
  console.log('Patched ds_6545c.js error:', e.message);
}

// Test the VMP hash
const testCode = `
(() => {
  const combined = "/api/sns/web/v1/homefeed" + JSON.stringify({cursor_score:"",num:20});
  const h1 = new Uint8Array(_dsf(combined));
  const h2 = new Uint8Array(_dsf("/api/sns/web/v1/homefeed"));

  try {
    const fn = _0c6b9e549fef9ab9b4798ad1f12ea82b;
    // First call: sets up args
    const r1 = fn(combined, h1, h2);
    console.log("r1 === fn:", r1 === fn);

    // Second call: executes
    if (r1 === fn) {
      const r2 = fn();
      console.log("r2 type:", typeof r2);
      if (r2 instanceof Uint8Array) {
        return { ok: true, hex: Array.from(r2).map(b=>b.toString(16).padStart(2,"0")).join("") };
      }
      return { ok: true, result: String(r2).slice(0, 100) };
    }
    return { ok: false, r1Type: typeof r1 };
  } catch(e) {
    return { ok: false, error: e.message.slice(0, 200) };
  }
})()
`;

const r = vm.runInContext(testCode, ctx);
console.log('\nVMP test result:');
console.log(JSON.stringify(r, null, 2));
