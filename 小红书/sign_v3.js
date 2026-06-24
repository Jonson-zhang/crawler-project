#!/usr/bin/env node
/**
 * sign_v3.js — 小红书 X-s 离线签名 (52pj 文章指导下修正)
 *
 * 核心修正：
 *   1. 自定义 base64 表: "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"
 *   2. payload 正确值: x0="4.3.5", x2="Windows", x4=typeof data
 *   3. VMP env 补全所有稀疏槽位
 *   4. mnsv2 = _AUuXfEG27Xa3x (VMP 初始化后即签名入口)
 */
"use strict";

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const dom = require('./env.dom');

const DATA_DIR = path.join(__dirname, 'data');

// ═══ 自定义 Base64 (52pj 文章确认) ═══
const CUSTOM_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

function customBase64Encode(buf) {
  const bytes = typeof buf === 'string' ? Buffer.from(buf, 'utf-8') : buf;
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const a = bytes[i];
    const b = i + 1 < len ? bytes[i + 1] : 0;
    const c = i + 2 < len ? bytes[i + 2] : 0;
    result += CUSTOM_B64[a >> 2];
    result += CUSTOM_B64[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < len ? CUSTOM_B64[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < len ? CUSTOM_B64[c & 63] : '=';
  }
  // The article shows no padding replacement, but real x-s has no = signs
  // Let's check: the x-s header from earlier had no = chars
  return result.replace(/=/g, '');  // URL-safe: remove padding
}

// ═══ MD5 (via Node crypto — matches webpack module 5681) ═══
function md5(str) {
  return crypto.createHash('md5').update(str, 'utf-8').digest();
}

function md5Hex(str) {
  return crypto.createHash('md5').update(str, 'utf-8').digest('hex');
}

// ═══ VM 构建 ═══
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
    process:{env:{},platform:'win32',arch:'x64'},
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
  return [s, vm.createContext(s)];
}

let _sandbox, _ctx, _ready = false;

function init() {
  if (_ready) return;
  [_sandbox, _ctx] = buildVM();

  console.log('[sign_v3] Loading scripts...');
  const t0 = Date.now();

  // 1. ds_api.js — VMP 解释器 _BHjFmfUMEtxhI + _dsf
  vm.runInContext(fs.readFileSync(path.join(DATA_DIR,'ds_api.js'),'utf-8'), _ctx, {filename:'ds_api',timeout:60000});

  // 2. ds_6545c.js — VMP 签名注册 _AUuXfEG27Xa3x
  // 关键：填充 env 数组的稀疏槽位，避免 VMP opcode 0x4f 读到 undefined
  const ds6545_raw = fs.readFileSync(path.join(DATA_DIR,'ds_6545c.js'),'utf-8');

  // 替换 auto-call: glb['_AUuXfEG27Xa3x'](__$c, [,,Function, document, ...])
  // 填充第 0,1 槽位 → 填 window + self
  const ds6545_patched = ds6545_raw.replace(
    /\[,,typeof Function/,
    '[window,self,typeof Function'
  );
  vm.runInContext(ds6545_patched, _ctx, {filename:'ds_6545c',timeout:60000});

  console.log('  Loaded in ' + (Date.now()-t0) + 'ms');
  console.log('  _dsf:', typeof _sandbox._dsf);
  console.log('  _BHjFmfUMEtxhI:', typeof _sandbox._BHjFmfUMEtxhI);
  console.log('  _AUuXfEG27Xa3x:', typeof _sandbox._AUuXfEG27Xa3x);

  // 3. 检查 hash 函数可用性
  const fn = _sandbox['_0c6b9e549fef9ab9b4798ad1f12ea82b'];
  if (typeof fn === 'function') {
    console.log('  VMP hash fn:', typeof fn, 'keys:', Object.getOwnPropertyNames(fn).filter(k=>k.length>2));
  }

  _ready = true;
}

/**
 * seccore_signv2 — 对标 vendor-dynamic.js + 52pj 文章
 */
function seccore_signv2(url, requestBody) {
  init();

  // 规范化输入
  const isObj = requestBody && typeof requestBody === 'object';
  const bodyStr = isObj ? JSON.stringify(requestBody) : (requestBody || '');
  const combined = url + bodyStr;

  // MD5 哈希 (webpack module 5681)
  const hashCombined = md5(combined);  // m = K.Pu([u].join(""))
  const hashUrl = md5(url);            // w = K.Pu(e)

  // mnsv2(combined, hashCombined, hashUrl) → x3
  // = _0c6b9e... VMP 函数 (ds_6545c.js 内部创建的 hash 闭包)
  let C;
  try {
    const fn = _sandbox['_0c6b9e549fef9ab9b4798ad1f12ea82b'];
    if (typeof fn !== 'function') throw new Error('VMP hash function not found');

    // VMP 双次调用模式
    const r1 = fn(combined, hashCombined, hashUrl);
    const r2 = (r1 === fn) ? fn() : r1;  // 第二次调用执行

    if (r2 instanceof Uint8Array) {
      C = Array.from(new Uint8Array(r2)).map(b => String.fromCharCode(b)).join('');
    } else {
      C = String(r2);
    }
  } catch(e) {
    console.error('[sign_v3] VMP error:', e.message.slice(0, 80));
    // 回退：用 MD5 混合物
    C = md5Hex(Buffer.concat([hashCombined, hashUrl, _sandbox._dsf()]).toString('hex'));
  }

  // 构建 payload (52pj 文章确认的值)
  const payload = {
    x0: '4.3.5',           // 版本号（不是 XYW_）
    x1: 'xhs-pc-web',       // 平台
    x2: 'Windows',          // OS（不是 PC）
    x3: C,                   // mnsv2 计算结果
    x4: isObj ? 'object' : 'string',  // 数据类型
  };

  // 自定义 base64 编码
  const payloadJson = JSON.stringify(payload);
  const x_s = 'XYS_' + customBase64Encode(Buffer.from(payloadJson, 'utf-8'));

  return {
    'x-s': x_s,
    'x-t': String(Date.now()),
  };
}

// ═══ CLI / Test ═══
if (require.main === module) {
  const testUrl = '/api/sns/web/v1/homefeed';
  const testBody = {cursor_score:'', num:20, refresh_type:1, note_index:0};

  console.log('\n=== Testing VMP hash function ===');
  init();

  // 直接测试 VMP hash 函数
  try {
    const combined = testUrl + JSON.stringify(testBody);
    const h1 = md5(combined);
    const h2 = md5(testUrl);
    console.log('combined:', combined.slice(0, 40) + '...');
    console.log('md5(combined):', h1.toString('hex'));
    console.log('md5(url):', h2.toString('hex'));

    const fn = _sandbox['_0c6b9e549fef9ab9b4798ad1f12ea82b'];
    console.log('VMP fn type:', typeof fn);
    if (typeof fn === 'function') {
      const r1 = fn(combined, h1, h2);
      console.log('r1 type:', typeof r1, 'same as fn:', r1 === fn);
      if (r1 === fn) {
        // 检查 fn 的内部计数器
        const keys = ['IIΙ', 'IΙI', 'IΙΙ', 'ΙII', 'ΙIΙ'];
        for (const k of keys) {
          if (fn[k] !== undefined) console.log('fn[' + k + '] =', fn[k]);
        }
        console.log('Trying second call...');
        const r2 = fn();
        console.log('r2 type:', typeof r2);
        console.log('r2:', String(r2).slice(0, 100));
      }
    }
  } catch(e) {
    console.error('VMP error:', e.message);
    console.error('Stack:', (e.stack||'').split('\n').slice(0, 3).join('\n  '));
  }

  console.log('\n=== Sign result ===');
  const result = seccore_signv2(testUrl, testBody);
  console.log('x-s:', result['x-s'].slice(0, 80) + '...');
  console.log('x-t:', result['x-t']);

  // ═══ HTTP 测试 ═══
  console.log('\n=== HTTP Test ===');
  const https = require('https');
  const postData = JSON.stringify(testBody);

  const cookies = JSON.parse(fs.readFileSync(path.join(DATA_DIR,'cookies.json'),'utf-8'));
  const cookieStr = Object.entries(cookies).map(([k,v]) => k + '=' + v).join('; ');

  const options = {
    hostname: 'edith.xiaohongshu.com',
    path: testUrl,
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
      if (res.statusCode === 200) {
        try {
          const obj = JSON.parse(data);
          const notes = obj.data?.notes || obj.data?.items || [];
          console.log('Got ' + notes.length + ' notes!');
        } catch(e) {}
      }
    });
  });
  req.on('error', (e) => console.error('Error:', e.message));
  req.write(postData);
  req.end();
}

module.exports = { init, seccore_signv2, sign: seccore_signv2 };
