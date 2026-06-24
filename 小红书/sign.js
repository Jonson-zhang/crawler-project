/**
 * sign.js — 小红书 X-s 离线签名
 *
 * 直接执行 VMP eval 代码在 Node global 上，补上浏览器变量
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

// ═══ 从 vendor.js 提取 eval 代码 ═══
let _EVAL_CODE = null;
function getEvalCode() {
  if (_EVAL_CODE) return _EVAL_CODE;
  const vendor = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  const mt = vendor.indexOf('__makeTemplateObject([');
  if (mt < 0) throw new Error('template not found');
  // 找第一个 "[ 之后的第一个 "
  const arrOpen = vendor.indexOf('[', mt);
  const strStart = vendor.indexOf('"', arrOpen);
  // 解析 JS 字符串
  let i = strStart + 1, raw = '';
  while (i < vendor.length) {
    if (vendor[i] === '\\') { raw += vendor[i]; raw += vendor[i+1]; i += 2; continue; }
    if (vendor[i] === '"') break;
    raw += vendor[i]; i++;
  }
  // 解码转义序列
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
  _EVAL_CODE = code;
  return code;
}

// ═══ 状态 ═══
let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  // ═══ 关键: 先把浏览器变量注入 Node global ═══
  //     eval 代码最后一行 typeof 检查在 global scope 找这些变量
  //     注意: navigator/performance 有 getter 无 setter，必须 defineProperty
  Object.defineProperty(global, 'navigator', {value: dom.navigator, configurable: true, writable: true});
  Object.defineProperty(global, 'performance', {value: dom.performance, configurable: true, writable: true});
  global.document = dom.document;
  global.screen = dom.screen;
  global.top = global;
  global.InstallTrigger = {};      // Firefox: object
  global.chrome = undefined;         // Firefox: undefined
  // 原型链
  global.EventTarget = dom.EventTarget;
  global.Node = dom.Node;
  global.Element = dom.Element;
  global.HTMLElement = dom.HTMLElement;
  global.HTMLCanvasElement = dom.HTMLCanvasElement;
  global.CanvasRenderingContext2D = dom.CanvasRenderingContext2D;
  global.WebGLRenderingContext = dom.WebGLRenderingContext;
  global.AudioContext = dom.AudioContext;
  global.XMLHttpRequest = dom.XMLHttpRequest;
  global.MutationObserver = dom.MutationObserver;
  global.Event = dom.Event;
  global.CustomEvent = dom.CustomEvent;
  global.Performance = dom.Performance;
  global.location = dom.location;
  global.localStorage = dom.localStorage;
  global.sessionStorage = dom.sessionStorage;

  // 保存已有的 native globals（防止 eval 覆盖）
  const saved = {};
  for (const k of ['navigator','performance','document','screen','top','location',
    'EventTarget','Node','Element','HTMLElement','Event','CustomEvent',
    'localStorage','sessionStorage','Performance']) {
    try { saved[k] = global[k]; } catch(e) {}
  }

  const _oe = console.error; console.error = () => {};

  // ═══ 直接 eval eval 代码（在 Node global scope） ═══
  const evalCode = getEvalCode();
  try {
    // eval 代码自包含：定义变量、调用 glb[_AUuXfEG27Xa3x](__$c, [env])
    // 用 vm.runInThisContext 确保 var 声明泄漏到 global
    vm.runInThisContext(evalCode, { filename: 'vmp_eval.js' });
  } catch(e) {
    console.error = _oe;
    console.error('[sign] eval error:', e.message.slice(0, 300));
  }

  console.error = _oe;

  // 恢复被覆盖的 globals
  for (const k of Object.keys(saved)) {
    try { if (saved[k] !== undefined) global[k] = saved[k]; } catch(e) {}
  }

  // 获取 mnsv2（var 声明泄漏到 global）
  _mnsv2fn = global.mnsv2 || null;

  // 清理
  delete global.document; delete global.top; delete global.screen;
  delete global.InstallTrigger; delete global.chrome;

  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = s => crypto.createHash('md5').update(s,'utf8').digest('hex');
  const hc = md5(url + bodyStr), hu = md5(url);
  let x3;
  if (_mnsv2fn) { try { x3 = String(_mnsv2fn(url + bodyStr, hc, hu)); } catch(e) { x3 = 'ERR'; } }
  else { x3 = 'NOMNSV2'; }
  const payload = JSON.stringify({
    x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4: typeof data === 'string' ? 'string' : 'object'
  });
  return {
    'x-s': 'XYS_' + customBase64Encode(Buffer.from(payload,'utf-8')),
    'x-t': String(Date.now()),
    'x-s-common': '',
  };
}

module.exports = { init, sign };
