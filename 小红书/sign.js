/**
 * sign.js — 小红书 X-s 离线签名
 * 补环境方式: 先用 vmp env 创建完整浏览器环境, 然后直接 eval eval 代码
 */
"use strict";
const fs = require('fs'), path = require('path'), crypto = require('crypto');

// ═══ 加载 VMP 兼容环境到 global ═══
// env_vmp.js 在全局 scope 创建构造函数和单例
const envMod = require('./env_vmp');

// ═══ Base64 ═══
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
  const arr = v.indexOf('[', mt);
  const q = v.indexOf('"', arr);
  let i = q + 1, raw = '';
  while (i < v.length) { if (v[i] === '\\') { raw += v[i]; raw += v[i+1]; i += 2; continue; } if (v[i] === '"') break; raw += v[i]; i++; }
  let code = '', j = 0;
  while (j < raw.length) {
    if (raw[j] === '\\') { const n = raw[j+1]; if (n === '"') { code += '"'; j += 2; continue; } if (n === 'n') { code += '\n'; j += 2; continue; } if (n === 'r') { code += '\r'; j += 2; continue; } if (n === 't') { code += '\t'; j += 2; continue; } if (n === 'x') { code += String.fromCharCode(parseInt(raw.slice(j+2, j+4), 16)); j += 4; continue; } j += 2; continue; }
    code += raw[j]; j++;
  }
  _EVAL = code; return code;
}

let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  t0 && console.error === console.error; // noop line for linter

  // eval 代码在当前 global scope 运行，已经注入了 env_vmp 的浏览器对象

  const _oe = console.error; console.error = () => {};
  try {
    (0, eval)(getEvalCode());
  } catch(e) {
    console.error = _oe;
    console.error('[sign] eval error:', e.message.slice(0, 300));
  }
  console.error = _oe;

  _mnsv2fn = global.mnsv2 || null;
  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
  const hc = md5(url + bodyStr), hu = md5(url);
  let x3;
  if (_mnsv2fn) { try { x3 = String(_mnsv2fn(url + bodyStr, hc, hu)); } catch(e) { x3 = 'ERR' + e.message.slice(0, 20); } }
  else { x3 = 'NOMNSV2'; }
  const payload = JSON.stringify({ x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4: 'object' });
  return { 'x-s': 'XYS_' + b64enc(Buffer.from(payload, 'utf-8')), 'x-t': String(Date.now()) };
}

if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  const bodyStr = process.argv[3] || '{"cursor_score":"","num":20}';
  let body; try { body = JSON.parse(bodyStr); } catch(e) { body = bodyStr; }
  init(); console.log(JSON.stringify(sign(url, body)));
}

module.exports = { init, sign };
