/**
 * 关键验证: signV2Init 的 eval 内是否调用了 _AUuXfEG27Xa3x(__$c, env)?
 * 如果没有调用，手动调用看 mnsv2 输出是否变长
 */
"use strict";
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), dom = require('./env.dom');

function buildSandbox() {
  const s = {
    window:{}, self:{}, global:{}, globalThis:{},
    EventTarget:dom.EventTarget, Node:dom.Node, Element:dom.Element, HTMLElement:dom.HTMLElement,
    HTMLCanvasElement:dom.HTMLCanvasElement, CanvasRenderingContext2D:dom.CanvasRenderingContext2D,
    WebGLRenderingContext:dom.WebGLRenderingContext, OffscreenCanvas:dom.OffscreenCanvas,
    AudioContext:dom.AudioContext, XMLHttpRequest:dom.XMLHttpRequest, Headers:dom.Headers,
    Blob:dom.Blob, File:dom.File, FileReader:dom.FileReader, FormData:dom.FormData,
    MutationObserver:dom.MutationObserver, Event:dom.Event, CustomEvent:dom.CustomEvent,
    Worker:dom.Worker, WebSocket:dom.WebSocket, Image:dom.Image, Performance:dom.Performance,
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:()=>{}, error:()=>{}}, setTimeout:(fn)=>{fn();return 0;},
    TextEncoder,TextDecoder,URL,URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'), btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent,decodeURIComponent, crypto:require('crypto').webcrypto,
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    BigInt,BigInt64Array,BigUint64Array, parseInt,parseFloat,isNaN,isFinite,JSON,eval,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,
    process:{env:{},platform:'win32',arch:'x64'},
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
  return s;
}

const WEBPACK_RUNTIME = fs.readFileSync('sign.js','utf-8').match(/const WEBPACK_RUNTIME = \x60([\s\S]*?)\x60;/)[1];

const s = buildSandbox();
const ctx = vm.createContext(s);

// Inject
global.document = s.document; global.top = s; global.screen = s.screen;
Object.defineProperty(global, 'navigator', {value: s.navigator, configurable: true, writable: true});
Object.defineProperty(global, 'performance', {value: s.performance, configurable: true, writable: true});

const _oe = console.error; console.error = () => {};

vm.runInContext(WEBPACK_RUNTIME, ctx, { filename:'runtime' });
vm.runInContext(fs.readFileSync('data/vendor.js','utf-8'), ctx, { filename:'vendor', timeout:120000 });

// Check state after auto-init
let mnsv2Before = null;
if (global.glb?.mnsv2) {
  const url = '/api/sns/web/v1/homefeed';
  const body = '{"cursor_score":"","num":20}';
  const combined = url + body;
  const hc = crypto.createHash('md5').update(combined).digest('hex');
  const hu = crypto.createHash('md5').update(url).digest('hex');
  mnsv2Before = String(global.glb.mnsv2(combined, hc, hu));
}

// Now try calling _AUuXfEG27Xa3x with bytecode and env
const initFn = global._AUuXfEG27Xa3x;
const bytecode = global.__$c;
console.log('_AUuXfEG27Xa3x:', typeof initFn);
console.log('__$c:', bytecode ? bytecode.length + ' chars' : 'MISSING');

if (typeof initFn === 'function' && bytecode) {
  // Build the env array that the eval code would have used
  // Based on the eval code's last array: [,,typeof globalThis...,...]
  // The actual env array is built DYNAMICALLY in the eval code
  // slot 0-1: empty, slot 2: globalThis, slot 3: undefined, ...

  // Try various env arrays that match what VMP expects
  const envs = [
    { name: 'minimal', arr: [, , s, undefined, s.performance, encodeURIComponent, Array, TextEncoder, Date, Math, Uint8Array, s.document, setTimeout, RegExp, unescape, parseInt, Object, s.navigator, undefined, Set, Function, String, Error, undefined, Event, s, Reflect] },
    { name: 'with InstallTrigger {}', arr: [, , s, undefined, s.performance, encodeURIComponent, Array, TextEncoder, Date, Math, Uint8Array, s.document, setTimeout, RegExp, unescape, parseInt, Object, s.navigator, {}, Set, Function, String, Error, undefined, Event, s, Reflect] },
    { name: 'with chrome {}', arr: [, , s, undefined, s.performance, encodeURIComponent, Array, TextEncoder, Date, Math, Uint8Array, s.document, setTimeout, RegExp, unescape, parseInt, Object, s.navigator, undefined, Set, Function, String, Error, {}, Event, s, Reflect] },
    { name: 'all filled', arr: [, , s, {}, s.performance, encodeURIComponent, Array, TextEncoder, Date, Math, Uint8Array, s.document, setTimeout, RegExp, unescape, parseInt, Object, s.navigator, {}, Set, Function, String, Error, {}, Event, s, Reflect] },
  ];

  for (const { name, arr } of envs) {
    try {
      initFn(bytecode, arr);
      console.log(name + ': _AUuXfEG27Xa3x called OK');
    } catch(e) {
      console.log(name + ': _AUuXfEG27Xa3x ERR ' + e.message.slice(0, 80));
    }
  }
}

// Check mnsv2 after manual init attempts
if (global.glb?.mnsv2) {
  const url = '/api/sns/web/v1/homefeed';
  const body = '{"cursor_score":"","num":20}';
  const combined = url + body;
  const hc = crypto.createHash('md5').update(combined).digest('hex');
  const hu = crypto.createHash('md5').update(url).digest('hex');
  const result = String(global.glb.mnsv2(combined, hc, hu));
  console.log('\nBefore: ' + (mnsv2Before || 'none'));
  console.log('After:  ' + result);
}

console.error = _oe;

// Cleanup
delete global.document; delete global.top; delete global.screen;
