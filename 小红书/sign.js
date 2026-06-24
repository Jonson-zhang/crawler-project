/**
 * sign.js — 小红书 X-s 离线签名
 * 环境: v_jstools 录制的 v.js
 */
"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
function b64enc(bb){bb=typeof bb==='string'?Buffer.from(bb,'utf-8'):bb;let r='';for(let i=0;i<bb.length;i+=3){const a=bb[i],c=i+1<bb.length?bb[i+1]:0,d=i+2<bb.length?bb[i+2]:0;r+=XHS_B64[a>>2]+XHS_B64[((a&3)<<4)|(c>>4)];r+=i+1<bb.length?XHS_B64[((c&15)<<2)|(d>>6)]:XHS_B64[0];r+=i+2<bb.length?XHS_B64[d&63]:XHS_B64[0];}return r;}

const WEBPACK_RUNTIME = `
(function(){var m={},c={};function r(id){if(c[id])return c[id].exports;if(!m[id])m[id]=function(M,e){M.exports={};};var M=c[id]={id:id,exports:{}};m[id].call(M.exports,M,M.exports,r);return M.exports;}r.d=function(e,d){for(var k in d){if(r.o(d,k)&&!r.o(e,k))Object.defineProperty(e,k,{enumerable:true,get:d[k]})}};r.n=function(em){var g=em&&em.__esModule?function(){return em['default']}:function(){return em};r.d(g,{a:g});return g};r.o=function(o,p){return Object.prototype.hasOwnProperty.call(o,p)};(self.webpackChunkxhs_pc_web=self.webpackChunkxhs_pc_web||[]).push=function(chunk){var cm=chunk[1];for(var id in cm){if(r.o(cm,id))m[id]=cm[id]}};m[21777]=function(M,e){M.exports=String;};m[31547]=function(M,e,rx){rx.d(e,{_:function(){return function _t(v){var t=typeof v;return t==='object'?(v===null?'null':Array.isArray(v)?'array':'object'):t}}})};self.__webpack_require__=r;self.s=r;})();`;

let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  // 1. 构建沙箱 (预注入 v.js 运行时需要的全局变量占位)
  const _stub = function() {};
  const _storage = function() { return { _d:{}, getItem:function(k){return this._d[k]||null}, setItem:function(k,v){this._d[k]=String(v)}, removeItem:function(k){delete this._d[k]}, clear:function(){this._d={}}, get length(){return Object.keys(this._d).length} }; };
  const s = {
    sessionStorage: _storage(),
    localStorage: _storage(),
    location: { href: 'https://www.xiaohongshu.com/explore', host: 'www.xiaohongshu.com', protocol: 'https:', origin: 'https://www.xiaohongshu.com', pathname: '/explore', toString: function(){return this.href} },
    navigator: { userAgent: 'Mozilla/5.0', platform: 'Win32', language: 'zh-CN' },
    document: { cookie: '', createElement: function(){return{style:{}}}, querySelector: function(){return null}, addEventListener: _stub, removeEventListener: _stub, head: {appendChild:_stub}, body: {appendChild:_stub}, documentElement: {style:{}} },
    screen: { width:1920, height:1080 },
    history: { length: 1, state: null, pushState: _stub, replaceState: _stub },
    console: { log: _stub, error: _stub, warn: _stub, info: _stub, debug: _stub },
    performance: { now: function(){return Date.now();}, timeOrigin: Date.now() - 1000 },
    requestAnimationFrame: function(cb){ return setTimeout(cb, 16); },
    cancelAnimationFrame: function(id){ clearTimeout(id); },
    self: undefined, // will be set by v.js
    window: undefined, // will be set by v.js
  };
  for (const k of Object.getOwnPropertyNames(global)) {
    if (k in s) continue;
    try { s[k] = global[k]; } catch(e) {}
  }
  const ctx = vm.createContext(s);

  // 2. 加载 v_jstools 录制的浏览器环境
  const envCode = fs.readFileSync(path.join(__dirname, 'v.js'), 'utf-8');
  try {
    vm.runInContext(envCode, ctx, { filename: 'v_env.js', timeout: 30000 });
  } catch(e) {
    process.stderr.write('[sign] v.js error: ' + e.message.slice(0, 300) + '\n');
  }
  // v.js 设置 window 但可能没设置 self。确保 self/window/global/globalThis 存在
  if (s.window && !s.self) vm.runInContext('self = window', ctx);
  if (!s.window) vm.runInContext('window = this', ctx);
  if (!s.global) vm.runInContext('global = window', ctx);
  if (!s.globalThis) vm.runInContext('globalThis = window', ctx);

  // 3. 加载 webpack runtime + vendor.js (在沙箱中, mnsv2 会泄漏到 s)
  const _oe = console.error; console.error = function(){};
  vm.runInContext(WEBPACK_RUNTIME, ctx, { filename: 'runtime' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8'), ctx, { filename: 'vendor', timeout: 120000 });

  if (!s.mnsv2) {
    try { vm.runInContext('__webpack_require__(68274).a()', ctx); } catch(e) {}
  }

  console.error = _oe;

  // 4. 获取 mnsv2
  _mnsv2fn = s.mnsv2 || null;

  // Debug: 查找所有 mnsv 相关
  const _ms = Object.getOwnPropertyNames(s).filter(function(k){ return k.indexOf('mns')>=0 || k.indexOf('nsv')>=0 || (k.length<10 && typeof s[k]==='function' && s[k].length===0 && String(s[k]).indexOf('_0x30ce91')>0); });
  process.stderr.write('[sign] mns-related keys: ' + _ms.join(', ') + '\n');

  // Check if mnsv2 is on window or any nested object
  if (!_mnsv2fn && s.window && typeof s.window === 'object') {
    _mnsv2fn = s.window.mnsv2 || null;
    if (_mnsv2fn) process.stderr.write('[sign] found mnsv2 on window\n');
  }

  if (typeof _mnsv2fn === 'function') {
    try {
      const t = String(_mnsv2fn('/api/sns/web/v1/homefeed',
        crypto.createHash('md5').update('/api/sns/web/v1/homefeed{}').digest('hex'),
        crypto.createHash('md5').update('/api/sns/web/v1/homefeed').digest('hex')));
      process.stderr.write('[sign] ready in ' + (Date.now() - t0) + ' ms, mnsv2: ' + t.slice(0, 60) + ' len=' + t.length + '\n');
    } catch(e) {
      process.stderr.write('[sign] ready, mnsv2 function (err: ' + e.message.slice(0, 80) + ')\n');
    }
  } else {
    process.stderr.write('[sign] ready, mnsv2: ' + typeof _mnsv2fn + '\n');
  }

  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = function(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); };
  const x3 = _mnsv2fn ? String(_mnsv2fn(url + bodyStr, md5(url + bodyStr), md5(url))) : 'NOMNSV2';
  const p = JSON.stringify({ x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4:'object' });
  return { 'x-s': 'XYS_' + b64enc(Buffer.from(p, 'utf-8')), 'x-t': String(Date.now()) };
}

if (require.main === module) { var u = process.argv[2] || '/api/sns/web/v1/homefeed'; var b; try { b = JSON.parse(process.argv[3] || '{}'); } catch(e) { b = process.argv[3] || '{}'; } init(); console.log(JSON.stringify(sign(u, b))); }
module.exports = { init, sign };
