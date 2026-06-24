const fs = require('fs'); const path = require('path'); const vm = require('vm'); const crypto = require('crypto');
const dom = require('./env.dom');
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
const ctx = vm.createContext(s);
const D = path.join(__dirname,'data');
function md5(str) { return crypto.createHash('md5').update(str,'utf-8').digest(); }

const url = '/api/sns/web/v1/homefeed';
const body = JSON.stringify({cursor_score:'',num:20});
const combined = url + body;
const h1 = md5(combined);
const h2 = md5(url);

// LOAD ONLY ds_api.js (contains _BHjFmfUMEtxhI + _dsf)
vm.runInContext(fs.readFileSync(path.join(D,'ds_api.js'),'utf-8'),ctx,{timeout:60000});
console.log('After ds_api.js:');
console.log('  _BHjFmfUMEtxhI type:', typeof s._BHjFmfUMEtxhI);
console.log('  _dsf type:', typeof s._dsf);

// Test _BHjFmfUMEtxhI as mnsv2: (combined, md5_h1, md5_h2)
// v3.3.3 of the skill: the env check might use different arg order
// Let's try ALL argument orders

console.log('\n=== Testing _BHjFmfUMEtxhI as mnsv2 ===');

// Inject test data
s.__c = combined; s.__h1 = h1; s.__h2 = h2;
s.__dsf = s._dsf();

// Test 1: (combined, h1, h2) - standard mnsv2 call
console.log('1. _BHjFmfUMEtxhI(combined, h1, h2):');
try {
  const r1 = vm.runInContext('_BHjFmfUMEtxhI(__c, __h1, __h2)', ctx);
  console.log('   type:', typeof r1, '|', String(r1).slice(0,100));
} catch(e) { console.log('   ERR:', e.message.slice(0,80)); }

// Test 2: (url, body, null) - previous test that failed
console.log('2. _BHjFmfUMEtxhI(url, body, null):');
try {
  const r2 = vm.runInContext('_BHjFmfUMEtxhI("' + url + '", ' + JSON.stringify(body) + ', null)', ctx);
  console.log('   type:', typeof r2, '|', String(r2).slice(0,100));
} catch(e) { console.log('   ERR:', e.message.slice(0,80)); }

// Test 3: (combined, null, dsf_output)
console.log('3. _BHjFmfUMEtxhI(combined, null, dsf):');
try {
  const r3 = vm.runInContext('_BHjFmfUMEtxhI(__c, null, __dsf)', ctx);
  console.log('   type:', typeof r3, '|', String(r3).slice(0,100));
} catch(e) { console.log('   ERR:', e.message.slice(0,80)); }

// Test 4: Try ALL the hash-named functions
console.log('\n4. Search for mnsv2-like functions:');
const keys = Object.keys(s).filter(k => typeof s[k] === 'function' && s[k].length === 3 && k.length > 10);
console.log('   3-arg custom functions:', keys);

for (const k of keys) {
  try {
    const r = vm.runInContext(k + '(__c, __h1, __h2)', ctx);
    console.log('   ' + k + '(c,h1,h2):', String(r).slice(0,80));
  } catch(e) {
    // skip errors
  }
}

// Test 5: Check if _BHjFmfUMEtxhI works after loading ds_6545c.js
console.log('\n5. After loading ds_6545c.js:');
vm.runInContext(fs.readFileSync(path.join(D,'ds_6545c.js'),'utf-8'),ctx,{timeout:60000});

// Re-test
try {
  const r5 = vm.runInContext('_BHjFmfUMEtxhI(__c, __h1, __h2)', ctx);
  console.log('   _BHjFmfUMEtxhI(c,h1,h2):', typeof r5, '|', String(r5).slice(0,100));
} catch(e) { console.log('   ERR:', e.message.slice(0,80)); }

// Test _AUuXfEG27Xa3x as mnsv2
try {
  const r6 = vm.runInContext('_AUuXfEG27Xa3x(__c, __h1, __h2)', ctx);
  console.log('   _AUuXfEG27Xa3x(c,h1,h2):', typeof r6, '|', String(r6).slice(0,100));
} catch(e) { console.log('   ERR:', e.message.slice(0,80)); }
