/**
 * sign.js — 小红书 X-s 离线签名
 * webpack runtime + vm.createContext + 浏览器 env
 */
"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const dom = require('./env.dom');

const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
function b64enc(b){b=typeof b==='string'?Buffer.from(b,'utf-8'):b;let r='';for(let i=0;i<b.length;i+=3){const a=b[i],c=i+1<b.length?b[i+1]:0,d=i+2<b.length?b[i+2]:0;r+=XHS_B64[a>>2]+XHS_B64[((a&3)<<4)|(c>>4)];r+=i+1<b.length?XHS_B64[((c&15)<<2)|(d>>6)]:XHS_B64[0];r+=i+2<b.length?XHS_B64[d&63]:XHS_B64[0];}return r;}

const WEBPACK_RUNTIME=`
(function(){var m={},c={};function r(id){if(c[id])return c[id].exports;if(!m[id])m[id]=function(M,e){M.exports={};};var M=c[id]={id:id,exports:{}};m[id].call(M.exports,M,M.exports,r);return M.exports;}r.d=function(e,d){for(var k in d){if(r.o(d,k)&&!r.o(e,k))Object.defineProperty(e,k,{enumerable:true,get:d[k]})}};r.n=function(m){var g=m&&m.__esModule?function(){return m['default']}:function(){return m};r.d(g,{a:g});return g};r.o=function(o,p){return Object.prototype.hasOwnProperty.call(o,p)};(self.webpackChunkxhs_pc_web=self.webpackChunkxhs_pc_web||[]).push=function(chunk){var cm=chunk[1];for(var id in cm){if(r.o(cm,id))m[id]=cm[id]}};m[21777]=function(M,e){M.exports=String;};m[31547]=function(M,e,r){r.d(e,{_:function(){return function _t(v){var t=typeof v;return t==='object'?(v===null?'null':Array.isArray(v)?'array':'object'):t}}})};self.__webpack_require__=r;self.s=r;})();`;

let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  const s = {
    window:{}, self:{}, global:{}, globalThis:{},
    EventTarget:dom.EventTarget, Node:dom.Node, Element:dom.Element, HTMLElement:dom.HTMLElement,
    HTMLHeadElement:dom.HTMLHeadElement, HTMLBodyElement:dom.HTMLBodyElement,
    HTMLCanvasElement:dom.HTMLCanvasElement, CanvasRenderingContext2D:dom.CanvasRenderingContext2D,
    CanvasGradient:dom.CanvasGradient, WebGLRenderingContext:dom.WebGLRenderingContext,
    OffscreenCanvas:dom.OffscreenCanvas, AudioContext:dom.AudioContext, OscillatorNode:dom.OscillatorNode,
    XMLHttpRequest:dom.XMLHttpRequest, Headers:dom.Headers, Blob:dom.Blob, File:dom.File,
    FileReader:dom.FileReader, FormData:dom.FormData,
    MutationObserver:dom.MutationObserver, IntersectionObserver:dom.IntersectionObserver,
    ResizeObserver:dom.ResizeObserver, PerformanceObserver:dom.PerformanceObserver,
    Event:dom.Event, CustomEvent:dom.CustomEvent, MessageChannel:dom.MessageChannel,
    Worker:dom.Worker, WebSocket:dom.WebSocket, Image:dom.Image,
    Performance:dom.Performance, PerformanceTiming:dom.PerformanceTiming,
    PerformanceNavigation:dom.PerformanceNavigation,
    Document:dom.Document, HTMLDocument:dom.HTMLDocument, Navigator:dom.Navigator,
    Screen:dom.Screen, Location:dom.Location, History:dom.History,
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, history:dom.history, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:()=>{},error:()=>{},warn:()=>{},info:()=>{},debug:()=>{}},
    setTimeout:(fn)=>{try{fn()}catch(e){}return 0;},
    setInterval:()=>0, clearTimeout:()=>{}, clearInterval:()=>{},
    TextEncoder,TextDecoder,URL,URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'),btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent,decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    BigInt,BigInt64Array,BigUint64Array,
    parseInt,parseFloat,isNaN,isFinite,JSON,eval,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,
    require:function(id){if(id==='crypto')return require('crypto')},
    process:{env:{},platform:'win32',arch:'x64'},
    top:{}, InstallTrigger:{}, chrome:{},
    Plugin:dom.Plugin, PluginArray:dom.PluginArray,
    MimeType:dom.MimeType, MimeTypeArray:dom.MimeTypeArray,
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.top=s;s.document.location=s.location;

  const ctx = vm.createContext(s);

  // Inject Node global for VMP typeof checks
  global.document = s.document; global.top = s; global.screen = s.screen;
  global.InstallTrigger = {}; global.chrome = {};
  Object.defineProperty(global,'navigator',{value:s.navigator,configurable:true,writable:true});
  Object.defineProperty(global,'performance',{value:s.performance,configurable:true,writable:true});

  const _oe = console.error; console.error = () => {};

  vm.runInContext(WEBPACK_RUNTIME, ctx, {filename:'runtime'});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'data','vendor.js'),'utf-8'), ctx, {filename:'vendor',timeout:120000});

  // signV2Init: create mnsv2
  if (!s.mnsv2 && !global.mnsv2) {
    try { vm.runInContext('__webpack_require__(68274).a()', ctx); } catch(e) {}
  }

  console.error = _oe;

  // 从沙箱或 Node global 获取 mnsv2
  _mnsv2fn = s.mnsv2 || global.mnsv2 || null;

  // 清理 Node global
  delete global.document; delete global.top; delete global.screen;
  delete global.InstallTrigger; delete global.chrome;
  Object.defineProperty(global,'navigator',{value:undefined,configurable:true,writable:true});
  Object.defineProperty(global,'performance',{value:undefined,configurable:true,writable:true});

  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  if (typeof _mnsv2fn === 'function') { const c=require('crypto'); process.stderr.write('[sign] test output: '+String(_mnsv2fn('/a','abc','def')).slice(0,40)+'\n'); }
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = s => crypto.createHash('md5').update(s,'utf8').digest('hex');
  const x3 = _mnsv2fn ? String(_mnsv2fn(url+bodyStr, md5(url+bodyStr), md5(url))) : 'NOMNSV2';
  const payload = JSON.stringify({ x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4:'object' });
  return { 'x-s':'XYS_'+b64enc(Buffer.from(payload,'utf-8')), 'x-t':String(Date.now()) };
}

if (require.main === module) { const u=process.argv[2]||'/api/sns/web/v1/homefeed'; let b; try{b=JSON.parse(process.argv[3]||'{}')}catch(e){b=process.argv[3]||'{}'} init(); console.log(JSON.stringify(sign(u,b))); }
module.exports = { init, sign };
