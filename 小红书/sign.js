/**
 * sign.js — 小红书 X-s 离线签名
 *
 * 用法: node sign.js <url> <body_json>
 */
"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const dom = require('./env.dom');

// ═══ 自定义 Base64 ═══
const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

function customBase64Encode(bytes) {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf-8') : bytes;
  let r = '';
  const len = buf.length;
  for (let i = 0; i < len; i += 3) {
    const a = buf[i], b = i+1<len ? buf[i+1] : 0, c = i+2<len ? buf[i+2] : 0;
    r += XHS_B64[a>>2] + XHS_B64[((a&3)<<4)|(b>>4)];
    r += i+1<len ? XHS_B64[((b&15)<<2)|(c>>6)] : XHS_B64[0];
    r += i+2<len ? XHS_B64[c&63] : XHS_B64[0];
  }
  return r;
}

// ═══ Webpack Runtime ═══
const WEBPACK_RUNTIME = `
(function(){
var m={},c={};
function r(id) {
  if (c[id]) return c[id].exports;
  if (!m[id]) m[id] = function(M,e) { M.exports = {}; };
  var M = c[id] = { id: id, exports: {} };
  m[id].call(M.exports, M, M.exports, r);
  return M.exports;
}
r.d=function(e,d){for(var k in d){if(r.o(d,k)&&!r.o(e,k))Object.defineProperty(e,k,{enumerable:true,get:d[k]})}};
r.n=function(m){var g=m&&m.__esModule?function(){return m['default']}:function(){return m};r.d(g,{a:g});return g};
r.o=function(o,p){return Object.prototype.hasOwnProperty.call(o,p)};
(self.webpackChunkxhs_pc_web=self.webpackChunkxhs_pc_web||[]).push=function(chunk){
  var cm=chunk[1];
  for(var id in cm){if(r.o(cm,id))m[id]=cm[id]}
};
m[21777]=function(M,e){M.exports=String;};
m[31547]=function(M,e,r){r.d(e,{_:function(){return function _t(v){var t=typeof v;return t==='object'?(v===null?'null':Array.isArray(v)?'array':'object'):t}}})};
self.__webpack_require__=r;
self.s=r;
})();`;

// ═══ 状态 ═══
let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  // 构建最小沙箱（只需 webpack 模块系统工作）
  const s = {
    window:{}, self:{}, global:{}, globalThis:{},
    document:dom.document, location:dom.location, navigator:dom.navigator,
    screen:dom.screen, performance:dom.performance,
    localStorage:dom.localStorage, sessionStorage:dom.sessionStorage,
    console:{log:()=>{},error:()=>{},warn:()=>{},info:()=>{}},
    setTimeout:(fn)=>{try{fn()}catch(e){}return 0;},
    TextEncoder,TextDecoder,URL,URLSearchParams,
    atob:x=>Buffer.from(x,'base64').toString('binary'),btoa:x=>Buffer.from(x,'binary').toString('base64'),
    encodeURIComponent,decodeURIComponent,
    crypto:require('crypto').webcrypto,
    fetch:()=>Promise.resolve({json:()=>Promise.resolve({}),text:()=>Promise.resolve('')}),
    Function,Math,Date,Object,Array,String,Number,Boolean,RegExp,Map,Set,
    Uint8Array,Uint16Array,Int8Array,Int16Array,Int32Array,
    Float32Array,Float64Array,ArrayBuffer,DataView,Promise,Proxy,Reflect,Symbol,
    parseInt,parseFloat,isNaN,isFinite,JSON,eval,
    Error,TypeError,RangeError,SyntaxError,ReferenceError,
    process:{env:{},platform:'win32'},
  };
  s.self=s;s.window=s;s.global=s;s.globalThis=s;s.document.location=s.location;
  const ctx = vm.createContext(s);

  // ═══ 注入浏览器变量到 Node global（eval 代码用 typeof 检查）═══
  // navigator/performance: Node 有 getter 无 setter，必须 defineProperty 覆盖
  Object.defineProperty(global, 'navigator', {value: s.navigator, configurable: true, writable: true});
  Object.defineProperty(global, 'performance', {value: s.performance, configurable: true, writable: true});
  global.document = s.document;
  global.screen = s.screen;
  global.top = s;

  // 抑制 eval 代码的 console.error dump
  const _oe = console.error;
  console.error = () => {};

  // 加载 vendor
  vm.runInContext(WEBPACK_RUNTIME, ctx, { filename:'runtime' });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'data','vendor.js'),'utf-8'), ctx, { filename:'vendor', timeout:120000 });

  // 如果 vendor 的 auto-init (P.ZP.isBrowser && signV2Init) 没触发，手动调用
  if (!global.glb?.mnsv2 && !global.mnsv2) {
    try { vm.runInContext('__webpack_require__(68274).a()', ctx); } catch(e) {}
  }

  console.error = _oe;

  // 获取 mnsv2（eval 中的 var 声明泄漏到 Node global）
  _mnsv2fn = global.mnsv2 || global.glb?.mnsv2 || null;

  // 清理 Node global（只清理注入的浏览器变量，保留 VMP 泄漏变量）
  delete global.document; delete global.top; delete global.screen;
  Object.defineProperty(global, 'navigator', {value: undefined, configurable: true, writable: true});
  Object.defineProperty(global, 'performance', {value: undefined, configurable: true, writable: true});

  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = s => crypto.createHash('md5').update(s,'utf8').digest('hex');
  const hc = md5(url + bodyStr), hu = md5(url);

  let x3;
  if (_mnsv2fn) {
    try { x3 = String(_mnsv2fn(url + bodyStr, hc, hu)); }
    catch(e) { x3 = 'ERR'; }
  } else { x3 = 'NOMNSV2'; }

  const payload = JSON.stringify({
    x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4: typeof data === 'string' ? 'string' : 'object'
  });

  return {
    'x-s': 'XYS_' + customBase64Encode(Buffer.from(payload,'utf-8')),
    'x-t': String(Date.now()),
    'x-s-common': '',
  };
}

// ═══ CLI ═══
if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  const bodyStr = process.argv[3] || '{"cursor_score":"","num":20}';
  let body;
  try { body = JSON.parse(bodyStr); } catch(e) { body = bodyStr; }
  init();
  console.log(JSON.stringify(sign(url, body)));
}

module.exports = { init, sign };
