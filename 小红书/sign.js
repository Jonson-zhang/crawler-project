/**
 * sign.js — 小红书 X-s 离线签名
 * 最小环境: 只覆盖 Node.js v24 没有的浏览器 API
 */
"use strict";
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dom = require('./env.dom');

const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
function b64enc(bytes) {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf-8') : bytes;
  let r = '';
  for (let i = 0; i < buf.length; i += 3) {
    const a = buf[i], b = i+1<buf.length ? buf[i+1] : 0, c = i+2<buf.length ? buf[i+2] : 0;
    r += XHS_B64[a>>2] + XHS_B64[((a&3)<<4)|(b>>4)];
    r += i+1<buf.length ? XHS_B64[((b&15)<<2)|(c>>6)] : XHS_B64[0];
    r += i+2<buf.length ? XHS_B64[c&63] : XHS_B64[0];
  }
  return r;
}

// ═══ 从 vendor.js 提取 eval 代码 ═══
let _EVAL = null;
function getEvalCode() {
  if (_EVAL) return _EVAL;
  const v = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  const mt = v.indexOf('__makeTemplateObject([');
  const arr = v.indexOf('[', mt), q = v.indexOf('"', arr);
  let i = q + 1, raw = '';
  while (i < v.length) { if (v[i] === '\\') { raw += v[i]; raw += v[i+1]; i += 2; continue; } if (v[i] === '"') break; raw += v[i]; i++; }
  let code = '', j = 0;
  while (j < raw.length) {
    if (raw[j] === '\\') {
      const n = raw[j+1];
      if (n === '"') { code += '"'; j += 2; continue; }
      if (n === 'n') { code += '\n'; j += 2; continue; }
      if (n === 'r') { code += '\r'; j += 2; continue; }
      if (n === 't') { code += '\t'; j += 2; continue; }
      if (n === 'x') { code += String.fromCharCode(parseInt(raw.slice(j+2, j+4), 16)); j += 4; continue; }
      j += 2; continue;
    }
    code += raw[j]; j++;
  }
  _EVAL = code; return code;
}

let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  // ═══ Node.js v24 已自带: navigator, performance, crypto, Event, EventTarget,
  //      URL, fetch, Blob, WebSocket, MessageChannel, TextEncoder 等 ═══
  // ═══ 只补 Node 缺失的 ═══

  // 保存将被覆盖的 Node 原生对象
  const _saved = { navigator: undefined, performance: undefined };
  try { _saved.navigator = global.navigator; } catch(e) {}
  try { _saved.performance = global.performance; } catch(e) {}

  // navigator: 用 env.dom.js 的完整浏览器版本替换（Node 的太简陋, userAgent="Node.js/24"）
  Object.defineProperty(global, 'navigator', { value: dom.navigator, configurable: true, writable: true });

  // performance: 用 env.dom.js 的替换（Node 的缺少 timing 等属性）
  Object.defineProperty(global, 'performance', { value: dom.performance, configurable: true, writable: true });

  // document (Node 没有 DOM)
  global.document = dom.document;

  // screen (Node 没有)
  global.screen = dom.screen;

  // location (用 setter 覆盖，Node 的 location 是 URL 模块的对象)
  try { Object.defineProperty(global, 'location', { value: dom.location, configurable: true, writable: true }); } catch(e) {}

  // top = window
  global.top = global;

  // VMP env slot 需要的变量
  global.InstallTrigger = undefined;  // Chrome
  global.chrome = {};                  // Chrome has chrome object

  // DOM 相关 (Node 没有)
  global.HTMLCanvasElement = dom.HTMLCanvasElement;
  global.CanvasRenderingContext2D = dom.CanvasRenderingContext2D;
  global.WebGLRenderingContext = dom.WebGLRenderingContext;
  global.OffscreenCanvas = dom.OffscreenCanvas;
  global.AudioContext = dom.AudioContext;
  global.XMLHttpRequest = dom.XMLHttpRequest;
  global.MutationObserver = dom.MutationObserver;
  global.IntersectionObserver = dom.IntersectionObserver;
  global.ResizeObserver = dom.ResizeObserver;
  global.PerformanceObserver = dom.PerformanceObserver;
  global.localStorage = dom.localStorage;
  global.sessionStorage = dom.sessionStorage;
  global.Image = dom.Image;
  global.Worker = dom.Worker;
  global.WebSocket = dom.WebSocket;  // 覆盖 Node 的内置 WebSocket (可能更真实)
  global.FormData = dom.FormData;
  global.FileReader = dom.FileReader;

  // 增强 navigator (Node 自带的不够完整)
  try {
    Object.defineProperty(global, 'navigator', {
      value: Object.assign({}, origNav, dom.navigator),
      configurable: true, writable: true
    });
  } catch(e) {}

  const _oe = console.error; console.error = () => {};

  // ═══ 执行 eval 代码 ═══
  try {
    (0, eval)(getEvalCode());
  } catch(e) {
    console.error = _oe;
    console.error('[sign] eval error:', e.message.slice(0, 300));
  }

  console.error = _oe;

  _mnsv2fn = global.mnsv2 || null;

  // 清理: 恢复 Node 原生对象
  delete global.document; delete global.top; delete global.screen;
  delete global.InstallTrigger; delete global.chrome;
  if (_saved.navigator) Object.defineProperty(global, 'navigator', { value: _saved.navigator, configurable: true, writable: true });
  if (_saved.performance) Object.defineProperty(global, 'performance', { value: _saved.performance, configurable: true, writable: true });

  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
  const hc = md5(url + bodyStr), hu = md5(url);
  let x3;
  if (_mnsv2fn) { try { x3 = String(_mnsv2fn(url + bodyStr, hc, hu)); } catch(e) { x3 = 'ERR'; } }
  else { x3 = 'NOMNSV2'; }
  const payload = JSON.stringify({ x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4: typeof data === 'string' ? 'string' : 'object' });
  return { 'x-s': 'XYS_' + b64enc(Buffer.from(payload, 'utf-8')), 'x-t': String(Date.now()), 'x-s-common': '' };
}

if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  const bodyStr = process.argv[3] || '{"cursor_score":"","num":20}';
  let body; try { body = JSON.parse(bodyStr); } catch(e) { body = bodyStr; }
  init(); console.log(JSON.stringify(sign(url, body)));
}

module.exports = { init, sign };
