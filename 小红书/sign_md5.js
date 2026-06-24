#!/usr/bin/env node
/**
 * sign_md5.js — 小红书签名 (用 MD5 代替 mnsv2 VMP)
 *
 * 直接对照 vendor-dynamic.js 的 seccore_signv2 实现
 * 用 module 5681 (MD5) + base64 编码
 *
 * 如果服务器返回 406/签名错误，说明 mnsv2 不是纯 MD5
 * 需要进一步在上一个阶段逆向 _0c6b9e... VMP 函数
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const dom = require('./env.dom');

const DATA_DIR = path.join(__dirname, 'data');

// ═══ MD5 from module 5681 (vendor_6f49.js) ═══
// Simplified: using Node.js crypto.MD5
function md5(str) {
  return crypto.createHash('md5').update(str).digest();
}

// Words-based MD5 (matching the webpack module's format)
function md5Words(str) {
  const bytes = Buffer.from(str, 'utf-8');
  const words = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }

  // Padding
  const bitLen = bytes.length * 8;
  words[bytes.length >>> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[((bytes.length + 8) >>> 6 << 4) + 14] = bitLen;

  // MD5 rounds
  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;

  for (let i = 0; i < words.length; i += 16) {
    const [oa, ob, oc, od] = [a, b, c, d];

    // Round 1
    a = FF(a, b, c, d, words[i+0],  7, 0xD76AA478);
    d = FF(d, a, b, c, words[i+1], 12, 0xE8C7B756);
    c = FF(c, d, a, b, words[i+2], 17, 0x242070DB);
    b = FF(b, c, d, a, words[i+3], 22, 0xC1BDCEEE);
    a = FF(a, b, c, d, words[i+4],  7, 0xF57C0FAF);
    d = FF(d, a, b, c, words[i+5], 12, 0x4787C62A);
    c = FF(c, d, a, b, words[i+6], 17, 0xA8304613);
    b = FF(b, c, d, a, words[i+7], 22, 0xFD469501);
    a = FF(a, b, c, d, words[i+8],  7, 0x698098D8);
    d = FF(d, a, b, c, words[i+9], 12, 0x8B44F7AF);
    c = FF(c, d, a, b, words[i+10],17, 0xFFFF5BB1);
    b = FF(b, c, d, a, words[i+11],22, 0x895CD7BE);
    a = FF(a, b, c, d, words[i+12], 7, 0x6B901122);
    d = FF(d, a, b, c, words[i+13],12, 0xFD987193);
    c = FF(c, d, a, b, words[i+14],17, 0xA679438E);
    b = FF(b, c, d, a, words[i+15],22, 0x49B40821);

    // Round 2
    a = GG(a, b, c, d, words[i+1],  5, 0xF61E2562);
    d = GG(d, a, b, c, words[i+6],  9, 0xC040B340);
    c = GG(c, d, a, b, words[i+11],14, 0x265E5A51);
    b = GG(b, c, d, a, words[i+0], 20, 0xE9B6C7AA);
    a = GG(a, b, c, d, words[i+5],  5, 0xD62F105D);
    d = GG(d, a, b, c, words[i+10], 9, 0x02441453);
    c = GG(c, d, a, b, words[i+15],14, 0xD8A1E681);
    b = GG(b, c, d, a, words[i+4], 20, 0xE7D3FBC8);
    a = GG(a, b, c, d, words[i+9],  5, 0x21E1CDE6);
    d = GG(d, a, b, c, words[i+14], 9, 0xC33707D6);
    c = GG(c, d, a, b, words[i+3], 14, 0xF4D50D87);
    b = GG(b, c, d, a, words[i+8], 20, 0x455A14ED);
    a = GG(a, b, c, d, words[i+13], 5, 0xA9E3E905);
    d = GG(d, a, b, c, words[i+2],  9, 0xFCEFA3F8);
    c = GG(c, d, a, b, words[i+7], 14, 0x676F02D9);
    b = GG(b, c, d, a, words[i+12],20, 0x8D2A4C8A);

    // Round 3
    a = HH(a, b, c, d, words[i+5],  4, 0xFFFA3942);
    d = HH(d, a, b, c, words[i+8], 11, 0x8771F681);
    c = HH(c, d, a, b, words[i+11],16, 0x6D9D6122);
    b = HH(b, c, d, a, words[i+14],23, 0xFDE5380C);
    a = HH(a, b, c, d, words[i+1],  4, 0xA4BEEA44);
    d = HH(d, a, b, c, words[i+4], 11, 0x4BDECFA9);
    c = HH(c, d, a, b, words[i+7], 16, 0xF6BB4B60);
    b = HH(b, c, d, a, words[i+10],23, 0xBEBFBC70);
    a = HH(a, b, c, d, words[i+13], 4, 0x289B7EC6);
    d = HH(d, a, b, c, words[i+0], 11, 0xEAA127FA);
    c = HH(c, d, a, b, words[i+3], 16, 0xD4EF3085);
    b = HH(b, c, d, a, words[i+6], 23, 0x04881D05);
    a = HH(a, b, c, d, words[i+9],  4, 0xD9D4D039);
    d = HH(d, a, b, c, words[i+12],11, 0xE6DB99E5);
    c = HH(c, d, a, b, words[i+15],16, 0x1FA27CF8);
    b = HH(b, c, d, a, words[i+2], 23, 0xC4AC5665);

    // Round 4
    a = II(a, b, c, d, words[i+0],  6, 0xF4292244);
    d = II(d, a, b, c, words[i+7], 10, 0x432AFF97);
    c = II(c, d, a, b, words[i+14],15, 0xAB9423A7);
    b = II(b, c, d, a, words[i+5], 21, 0xFC93A039);
    a = II(a, b, c, d, words[i+12], 6, 0x655B59C3);
    d = II(d, a, b, c, words[i+3], 10, 0x8F0CCC92);
    c = II(c, d, a, b, words[i+10],15, 0xFFEFF47D);
    b = II(b, c, d, a, words[i+1], 21, 0x85845DD1);
    a = II(a, b, c, d, words[i+8],  6, 0x6FA87E4F);
    d = II(d, a, b, c, words[i+15],10, 0xFE2CE6E0);
    c = II(c, d, a, b, words[i+6], 15, 0xA3014314);
    b = II(b, c, d, a, words[i+13],21, 0x4E0811A1);
    a = II(a, b, c, d, words[i+4],  6, 0xF7537E82);
    d = II(d, a, b, c, words[i+11],10, 0xBD3AF235);
    c = II(c, d, a, b, words[i+2], 15, 0x2AD7D2BB);
    b = II(b, c, d, a, words[i+9], 21, 0xEB86D391);

    a = (a + oa) | 0;
    b = (b + ob) | 0;
    c = (c + oc) | 0;
    d = (d + od) | 0;
  }

  return [a, b, c, d];
}

function FF(a, b, c, d, x, s, t) {
  const n = a + ((b & c) | (~b & d)) + (x | 0) + t;
  return ((n << s) | (n >>> (32 - s))) + b;
}
function GG(a, b, c, d, x, s, t) {
  const n = a + ((b & d) | (c & ~d)) + (x | 0) + t;
  return ((n << s) | (n >>> (32 - s))) + b;
}
function HH(a, b, c, d, x, s, t) {
  const n = a + (b ^ c ^ d) + (x | 0) + t;
  return ((n << s) | (n >>> (32 - s))) + b;
}
function II(a, b, c, d, x, s, t) {
  const n = a + (c ^ (b | ~d)) + (x | 0) + t;
  return ((n << s) | (n >>> (32 - s))) + b;
}

// Convert word array back to MD5 hash bytes
function wordsToMd5Bytes(words) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    bytes[i * 4] = (words[i] >>> 0) & 0xFF;
    bytes[i * 4 + 1] = (words[i] >>> 8) & 0xFF;
    bytes[i * 4 + 2] = (words[i] >>> 16) & 0xFF;
    bytes[i * 4 + 3] = (words[i] >>> 24) & 0xFF;
  }
  return bytes;
}
function wordsToHex(words) {
  return Array.from(wordsToMd5Bytes(words)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══ Build VM context ═══
function buildVM() {
  const s = {
    window:{},self:{},global:{},globalThis:{},
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
  return [s, vm.createContext(s)];
}

let _ctx, _sandbox, _ready = false;
function init() {
  if (_ready) return;
  [_sandbox, _ctx] = buildVM();
  vm.runInContext(fs.readFileSync(path.join(DATA_DIR,'ds_api.js'),'utf-8'),_ctx,{filename:'ds_api',timeout:60000});
  vm.runInContext(fs.readFileSync(path.join(DATA_DIR,'ds_6545c.js'),'utf-8'),_ctx,{filename:'ds_6545c',timeout:60000});
  console.log('[sign_md5] VM loaded, _dsf:', typeof _sandbox._dsf);
  _ready = true;
}

// ═══ seccore_signv2 implementation ═══
function seccore_signv2(url, data) {
  init();

  // Build combined string
  const isObj = data && typeof data === 'object';
  let combined = url;
  if (isObj) combined += JSON.stringify(data);
  else if (typeof data === 'string') combined += data;

  // MD5 hashes (matching vendor_6f49.js module 5681)
  const hashCombined = md5(combined);  // = (0,K.Pu)([u].join(""))
  const hashUrl = md5(url);            // = (0,K.Pu)(e)

  // Get device token from VMP
  const deviceToken = _sandbox._dsf();

  // mnsv2 = VMP operation. For now, use a placeholder:
  // mnsv2(u, m, w) where u=combined, m=md5(combined), w=md5(url)
  // As a fallback, combine them:
  const mnsInput = Buffer.concat([
    Buffer.from(combined),
    hashCombined,
    hashUrl,
    deviceToken,
  ]);
  const C = md5Words(mnsInput); // placeholder mnsv2

  // Build payload
  const P = {
    x0: 'XYW_',
    x1: 'xhs-pc-web',
    x2: 'PC',
    x3: wordsToHex(C),
    x4: isObj ? '' : (typeof data)
  };

  const payload = JSON.stringify(P);
  const x_s = 'XYS_' + Buffer.from(payload).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return {
    'x-s': x_s,
    'x-t': String(Date.now()),
  };
}

// ═══ Test ═══
if (require.main === module) {
  const url = '/api/sns/web/v1/homefeed';
  const body = {cursor_score:'', num:20, refresh_type:1, note_index:0};
  console.log('\nTesting sign_md5...');
  console.log(JSON.stringify(seccore_signv2(url, body), null, 2));
}

module.exports = { init, seccore_signv2, sign: seccore_signv2 };
