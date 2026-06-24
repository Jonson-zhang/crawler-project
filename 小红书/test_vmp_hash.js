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
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{timeout:60000});
vm.runInContext(fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8'),ctx,{timeout:60000});

// Test VMP hash function
const code = `
(() => {
  const combined = "/api/sns/web/v1/homefeed" + JSON.stringify({cursor_score:"",num:20});
  const h1 = new Uint8Array(_dsf(combined));
  const h2 = new Uint8Array(_dsf("/api/sns/web/v1/homefeed"));
  console.log("_dsf(combined)=", Array.from(h1).map(b=>b.toString(16).padStart(2,"0")).join(""));
  console.log("_dsf(url)=", Array.from(h2).map(b=>b.toString(16).padStart(2,"0")).join(""));

  try {
    const fn = _0c6b9e549fef9ab9b4798ad1f12ea82b;
    console.log("fn type:", typeof fn);
    console.log("fn src:", fn.toString().slice(0, 200));

    // Double-call pattern
    const r1 = fn(combined, h1, h2);
    console.log("r1 type:", typeof r1);
    console.log("r1 === fn:", r1 === fn);

    // Check fn state
    for (const k of ["II", "II", "II", "II"]) {
      if (fn[k] !== undefined) console.log("fn[" + k + "]=", fn[k]);
    }

    return { fnType: typeof fn, r1Type: typeof r1 };
  } catch(e) {
    return { error: e.message.slice(0, 200), stack: (e.stack||"").split("\\n").slice(0,5).join("\\n  ") };
  }
})()
`;

const r = vm.runInContext(code, ctx);
console.log(JSON.stringify(r, null, 2));
