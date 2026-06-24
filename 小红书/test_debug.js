"use strict";
const fs = require('fs');
const vm = require('vm');
const dom = require('./env.dom');

const s = {
  window:{},self:{},global:{},globalThis:{},
  EventTarget:dom.EventTarget, Node:dom.Node, Element:dom.Element, HTMLElement:dom.HTMLElement,
  HTMLCanvasElement:dom.HTMLCanvasElement, CanvasRenderingContext2D:dom.CanvasRenderingContext2D,
  WebGLRenderingContext:dom.WebGLRenderingContext, OffscreenCanvas:dom.OffscreenCanvas,
  AudioContext:dom.AudioContext, XMLHttpRequest:dom.XMLHttpRequest, Headers:dom.Headers,
  Blob:dom.Blob, File:dom.File, FileReader:dom.FileReader, FormData:dom.FormData,
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
  setTimeout:(fn)=>{fn();return 0;}, setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},
  TextEncoder,TextDecoder,URL,URLSearchParams,
  atob:x=>Buffer.from(x,'base64').toString('binary'), btoa:x=>Buffer.from(x,'binary').toString('base64'),
  encodeURIComponent,decodeURIComponent,
  crypto:require('crypto').webcrypto,
  fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
  Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
  Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,
  Promise,Proxy,Reflect,Symbol,BigInt,BigInt64Array,BigUint64Array,
  parseInt,parseFloat,isNaN,isFinite,JSON,eval,
  Error,TypeError,RangeError,SyntaxError,ReferenceError,
  require:function(id){if(id==='crypto')return require('crypto');},
  process:{env:{},platform:'win32',arch:'x64'},
};
s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;

const ctx = vm.createContext(s);

// Webpack runtime
const runtime = `
(function() {
  var modules={}, cache={};
  function __webpack_require__(id) { if(cache[id])return cache[id].exports; if(!modules[id]){modules[id]=function(m,e){m.exports={};};} var mod=cache[id]={id:id,exports:{}}; modules[id].call(mod.exports,mod,mod.exports,__webpack_require__); return mod.exports; }
  __webpack_require__.d=function(e,d){for(var k in d){if(__webpack_require__.o(d,k)&&!__webpack_require__.o(e,k))Object.defineProperty(e,k,{enumerable:true,get:d[k]});}};
  __webpack_require__.n=function(m){var g=m&&m.__esModule?function(){return m['default'];}:function(){return m;};__webpack_require__.d(g,{a:g});return g;};
  __webpack_require__.o=function(o,p){return Object.prototype.hasOwnProperty.call(o,p);};
  (self.webpackChunkxhs_pc_web=self.webpackChunkxhs_pc_web||[]).push=function(chunk){var cm=chunk[1];for(var id in cm){if(__webpack_require__.o(cm,id))modules[id]=cm[id];}};
  modules[21777]=function(m,e){m.exports=String;};
  modules[31547]=function(m,e,r){r.d(e,{_:function(){return function _t(v){var t=typeof v;return t==='object'?(v===null?'null':Array.isArray(v)?'array':'object'):t;}};});};
  self.__webpack_require__=__webpack_require__;
  self.s=__webpack_require__;
})();`;

vm.runInContext(runtime, ctx, {filename:'runtime'});

const vendorCode = fs.readFileSync('data/vendor.js','utf-8');
vm.runInContext(vendorCode, ctx, {filename:'vendor.js',timeout:120000});

console.log('--- Before signV2Init ---');
console.log('mnsv2 on sandbox:', typeof s.mnsv2);
console.log('mnsv2 on Node global:', typeof global.mnsv2);

// Try signV2Init
try {
  vm.runInContext('__webpack_require__(68274).a()', ctx);
  console.log('signV2Init done');
} catch(e) {
  console.error('signV2Init error:', e.message.slice(0, 300));
}

// Check where mnsv2 is
console.log('--- After signV2Init ---');
console.log('mnsv2 on sandbox:', typeof s.mnsv2);
console.log('mnsv2 on Node global:', typeof global.mnsv2);

// Find functions leaked to Node global
const newGlobals = Object.keys(global).filter(k => k.startsWith('_') && k.length < 30);
console.log('Leaked globals:', newGlobals);

// Check if glb is the sandbox
if (global.glb) {
  console.log('glb === s:', global.glb === s);
  console.log('glb === window:', global.glb === s.window);

  // Search for 3-arg functions on s
  for (const k of Object.keys(s)) {
    if (typeof s[k] === 'function' && s[k].length === 3) {
      console.log('3-arg func on sandbox:', k);
    }
  }

  // Search for functions on global.glb
  if (typeof global.glb === 'object') {
    const funcs = Object.keys(global.glb).filter(k => typeof global.glb[k] === 'function' && k.length < 10);
    console.log('Short funcs on glb:', funcs);

    for (const k of funcs) {
      if (global.glb[k].length === 3) {
        console.log('*** 3-arg func:', k, 'name:', global.glb[k].name);
      }
    }
  }
}

// Check if signV2Init created anything via the sandbox proxy
console.log('All sandbox func keys (short):', Object.keys(s).filter(k => typeof s[k] === 'function' && k.length < 10 && !['window','self','global','globalThis','URL','Blob','File','Image'].includes(k)));
