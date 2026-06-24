#!/usr/bin/env node
/**
 * sign_v2.js — 小红书离线签名 v2
 * 使用 _dsf() 作为 mnsv2 VMP 的替代，直接实现 seccore_signv2 算法
 *
 * 用法: node sign_v2.js [url] [body_json]
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const dom = require('./env.dom');

const DATA_DIR = path.join(__dirname, 'data');

// ═══ MD5 (matching webpack module 5681) ═══
function md5(str) {
  return crypto.createHash('md5').update(str, 'utf-8').digest();
}

// ═══ Base64 URL-safe ═══
function base64UrlEncode(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ═══ Build VM with proto chains ═══
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
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,WeakMap,WeakSet,
    Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    BigInt,BigInt64Array,BigUint64Array,
    parseInt,parseFloat,isNaN,isFinite,JSON,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,EvalError,eval,
    crypto:require('crypto').webcrypto,
    require:function(id){if(id==='@lwjjike/xbsdom')return undefined;return require(id);},
    process: { env: {}, version: 'v20.0.0', versions: { node: '20.0.0' }, platform: 'win32', arch: 'x64' },
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
  return [s, vm.createContext(s)];
}

let _sandbox, _ctx, _ready = false;

function init() {
  if (_ready) return;
  [_sandbox, _ctx] = buildVM();

  console.log('[sign_v2] Loading signer scripts...');
  const t0 = Date.now();

  // ds_api.js — sets up _BHjFmfUMEtxhI VMP interpreter + _dsf
  vm.runInContext(fs.readFileSync(path.join(DATA_DIR,'ds_api.js'),'utf-8'),_ctx,{filename:'ds_api.js',timeout:60000});
  console.log('  ds_api.js OK (' + (Date.now()-t0) + 'ms)');

  // ds_6545c.js — sets up _AUuXfEG27Xa3x signer registry
  vm.runInContext(fs.readFileSync(path.join(DATA_DIR,'ds_6545c.js'),'utf-8'),_ctx,{filename:'ds_6545c.js',timeout:60000});
  console.log('  ds_6545c.js OK (' + (Date.now()-t0) + 'ms)');

  // Use the latest signer (f218) which has _webmsxyw
  const signerFile = path.join(DATA_DIR, '04b29480233f4def5c875875b6bdc3b1.js');
  vm.runInContext(fs.readFileSync(signerFile,'utf-8'),_ctx,{filename:'signer.js',timeout:180000});
  console.log('  signer.js OK (' + (Date.now()-t0) + 'ms)');

  console.log('  _dsf:', typeof _sandbox._dsf);
  console.log('  _webmsxyw:', typeof _sandbox._webmsxyw);

  _ready = true;
}

/**
 * seccore_signv2 — 小红书 X-s 签名
 * 对标 vendor-dynamic.js 中的实现
 */
function seccore_signv2(url, data) {
  init();

  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const isObj = data && typeof data === 'object';

  // Build combined string: url + body
  const combined = url + body;

  // MD5 of combined (module 5681, K.Pu)
  const m = md5(combined);  // 16 bytes

  // MD5 of URL only
  const w = md5(url);       // 16 bytes

  // mnsv2(combined, m, w) — VMP hash
  // As mnsv2 replacement, use _dsf() as device-specific hash + MD5 mix
  // _dsf produces 16 bytes device fingerprint, combine with MD5s for uniqueness
  const dsfBuf = _sandbox._dsf();
  const mnsInput = Buffer.concat([Buffer.from(combined), m, w, dsfBuf]);
  const C_md5 = md5(mnsInput.toString('hex'));
  const C = Array.from(C_md5).map(b => b.toString(16).padStart(2,'0')).join('');

  // Build payload
  const payload = {
    x0: 'XYW_',
    x1: 'xhs-pc-web',
    x2: 'PC',
    x3: C,
    x4: isObj ? '' : (typeof data),
  };

  const payloadJson = JSON.stringify(payload);
  const x_s = 'XYS_' + base64UrlEncode(Buffer.from(payloadJson));

  return {
    'x-s': x_s,
    'x-t': String(Date.now()),
  };
}

// ═══ CLI / Test ═══
if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  const bodyStr = process.argv[3] || '{"cursor_score":"","num":20,"refresh_type":1,"note_index":0}';
  const body = JSON.parse(bodyStr);

  const result = seccore_signv2(url, body);

  console.log('\n=== Sign Result ===');
  console.log('x-s:', result['x-s'].slice(0, 80) + '...');
  console.log('x-t:', result['x-t']);

  // Now try an actual HTTP request
  console.log('\n=== HTTP Test ===');
  const https = require('https');
  const postData = JSON.stringify(body);
  const fullUrl = 'https://edith.xiaohongshu.com' + url;

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cookies.json'), 'utf-8'));
  const cookieStr = Object.entries(cookies).map(([k,v]) => k + '=' + v).join('; ');

  const options = {
    hostname: 'edith.xiaohongshu.com',
    path: url,
    method: 'POST',
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'x-s': result['x-s'],
      'x-t': result['x-t'],
      'cookie': cookieStr,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'origin': 'https://www.xiaohongshu.com',
      'referer': 'https://www.xiaohongshu.com/',
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data.slice(0, 300));
    });
  });

  req.on('error', (e) => console.error('Request error:', e.message));
  req.write(postData);
  req.end();
}

module.exports = { init, seccore_signv2, sign: seccore_signv2 };
