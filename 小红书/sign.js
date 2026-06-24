/**
 * sign.js — 小红书 X-s 离线签名
 * 用法: node sign.js <url> <body_json>
 */
"use strict";
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dom = require('./env.dom');

const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
function customBase64Encode(bytes) {
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

function getEvalCode() {
  if (getEvalCode._cached) return getEvalCode._cached;
  const vendor = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  const mt = vendor.indexOf('__makeTemplateObject([');
  const arr = vendor.indexOf('[', mt);
  const q = vendor.indexOf('"', arr);
  let i = q + 1, raw = '';
  while (i < vendor.length) {
    if (vendor[i] === '\\') { raw += vendor[i]; raw += vendor[i+1]; i += 2; continue; }
    if (vendor[i] === '"') break;
    raw += vendor[i]; i++;
  }
  let code = '', j = 0;
  while (j < raw.length) {
    if (raw[j] === '\\') {
      const n = raw[j+1];
      if (n === '"') { code += '"'; j += 2; continue; }
      if (n === '\\') { code += '\\'; j += 2; continue; }
      if (n === 'n') { code += '\n'; j += 2; continue; }
      if (n === 'r') { code += '\r'; j += 2; continue; }
      if (n === 't') { code += '\t'; j += 2; continue; }
      if (n === 'x') { code += String.fromCharCode(parseInt(raw.slice(j+2, j+4), 16)); j += 4; continue; }
      code += raw[j]; j += 2; continue;
    }
    code += raw[j]; j++;
  }
  getEvalCode._cached = code;
  return code;
}

let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  // ═══ 在 Node global 上注入浏览器完整环境 ═══
  // 原型链
  global.EventTarget = dom.EventTarget;
  global.Node = dom.Node;
  global.Element = dom.Element;
  global.HTMLElement = dom.HTMLElement;
  global.HTMLCanvasElement = dom.HTMLCanvasElement;
  global.CanvasRenderingContext2D = dom.CanvasRenderingContext2D;
  global.WebGLRenderingContext = dom.WebGLRenderingContext;
  global.OffscreenCanvas = dom.OffscreenCanvas;
  global.AudioContext = dom.AudioContext;
  global.XMLHttpRequest = dom.XMLHttpRequest;
  global.Headers = dom.Headers;
  global.Blob = dom.Blob;
  global.File = dom.File;
  global.FileReader = dom.FileReader;
  global.FormData = dom.FormData;
  global.MutationObserver = dom.MutationObserver;
  global.IntersectionObserver = dom.IntersectionObserver;
  global.ResizeObserver = dom.ResizeObserver;
  global.PerformanceObserver = dom.PerformanceObserver;
  global.Event = dom.Event;
  global.CustomEvent = dom.CustomEvent;
  global.MessageChannel = dom.MessageChannel;
  global.Worker = dom.Worker;
  global.WebSocket = dom.WebSocket;
  global.Image = dom.Image;
  global.Performance = dom.Performance;
  global.PerformanceTiming = dom.PerformanceTiming;
  global.PerformanceNavigation = dom.PerformanceNavigation;
  global.Document = dom.Document;
  global.HTMLDocument = dom.HTMLDocument;
  global.Navigator = dom.Navigator;
  global.Screen = dom.Screen;
  global.Location = dom.Location;
  global.History = dom.History;
  // Plugin/Mime stubs
  global.Plugin = dom.Plugin;
  global.PluginArray = dom.PluginArray;
  global.MimeType = dom.MimeType;
  global.MimeTypeArray = dom.MimeTypeArray;

  // 浏览器单例
  global.document = dom.document;
  global.location = dom.location;
  global.screen = dom.screen;
  global.history = dom.history;
  global.performance = dom.performance;
  global.localStorage = dom.localStorage;
  global.sessionStorage = dom.sessionStorage;
  global.console = {log:()=>{}, error:()=>{}, warn:()=>{}, info:()=>{}, debug:()=>{}};

  // navigator 必须 defineProperty 覆盖
  Object.defineProperty(global, 'navigator', {value: dom.navigator, configurable: true, writable: true});

  // VMP env slot: top, InstallTrigger, chrome
  global.top = global;
  global.InstallTrigger = undefined;  // Chrome
  global.chrome = {};                  // Chrome

  const _oe = console.error; console.error = () => {};

  // ═══ 直接执行 VMP eval 代码 ═══
  const evalCode = getEvalCode();
  try {
    // 使用 (0, eval) 在全局作用域执行
    (0, eval)(evalCode);
  } catch(e) {
    console.error = _oe;
    console.error('[sign] eval error:', e.message.slice(0, 300));
  }

  console.error = _oe;

  // 获取 mnsv2
  _mnsv2fn = global.mnsv2 || null;

  // 清理
  delete global.document; delete global.top; delete global.screen;
  delete global.InstallTrigger; delete global.chrome;
  Object.defineProperty(global, 'navigator', {value: undefined, configurable: true, writable: true});

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
    try { x3 = String(_mnsv2fn(url + bodyStr, hc, hu)); } catch(e) { x3 = 'ERR'; }
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

if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  const bodyStr = process.argv[3] || '{"cursor_score":"","num":20}';
  let body; try { body = JSON.parse(bodyStr); } catch(e) { body = bodyStr; }
  init(); console.log(JSON.stringify(sign(url, body)));
}

module.exports = { init, sign };
