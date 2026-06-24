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

// Wrap sandbox with anti-undefined Proxy
const handler = {
  get(target, prop, receiver) {
    if (prop === 'then') return undefined; // prevent Promise resolution interference
    let val = Reflect.get(target, prop, receiver);
    if (val === undefined && typeof prop === 'string' && prop !== 'constructor') {
      // Auto-create a stub object that won't crash property access
      const stub = function() { return stub; };
      stub.toString = () => '[object Object]';
      stub.valueOf = () => 0;
      const stubProxy = new Proxy(stub, handler); // recursive protection
      return stubProxy;
    }
    return val;
  }
};
const proxySandbox = new Proxy(s, handler);

const ctx = vm.createContext(proxySandbox);
const D = path.join(__dirname,'data');

// Load ds_api.js + ds_6545c.js normally (let them use original auto-call)
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{timeout:60000});
vm.runInContext(fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8'),ctx,{timeout:60000});
console.log('Scripts loaded with Proxy sandbox');

// Test VMP hash with Proxy protection
const url = '/api/sns/web/v1/homefeed';
const body = JSON.stringify({cursor_score:'',num:20});
const combined = url + body;
function md5(s) { return crypto.createHash('md5').update(s,'utf-8').digest(); }
const h1 = md5(combined);
const h2 = md5(url);

// Inject test data
vm.runInContext('__combined = "' + combined.replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '"', ctx);
vm.runInContext('__h1 = new Uint8Array([' + Array.from(h1).join(',') + '])', ctx);
vm.runInContext('__h2 = new Uint8Array([' + Array.from(h2).join(',') + '])', ctx);

const r = vm.runInContext(`
  (() => {
    try {
      const fn = _0c6b9e549fef9ab9b4798ad1f12ea82b;
      if (typeof fn !== 'function') return {error: 'fn not found'};

      const stateBefore = {};
      for (const k of ['IIΙ','IΙI','IΙΙ','ΙII','ΙIΙ']) stateBefore[k] = fn[k];

      const result = fn(__combined, __h1, __h2);

      const stateAfter = {};
      for (const k of ['IIΙ','IΙI','IΙΙ','ΙII','ΙIΙ']) stateAfter[k] = fn[k];

      return {
        stateBefore, stateAfter,
        rType: typeof result,
        rIsFn: result === fn,
        rStr: typeof result === 'string' ? result.slice(0,100) : null,
        rBytes: result instanceof Uint8Array ? Array.from(result).map(b=>b.toString(16).padStart(2,'0')).join('') : null,
      };
    } catch(e) {
      return {ok: false, error: e.message.slice(0, 300)};
    }
  })()
`, ctx);

console.log('\nProxy-protected VMP test:');
console.log(JSON.stringify(r, null, 2));
