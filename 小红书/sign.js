"use strict";
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

const XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
function b64enc(bytes) {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf-8') : bytes;
  let r = ''; for (let i = 0; i < buf.length; i += 3) { const a=buf[i],b=i+1<buf.length?buf[i+1]:0,c=i+2<buf.length?buf[i+2]:0; r+=XHS_B64[a>>2]+XHS_B64[((a&3)<<4)|(b>>4)]; r+=i+1<buf.length?XHS_B64[((b&15)<<2)|(c>>6)]:XHS_B64[0]; r+=i+2<buf.length?XHS_B64[c&63]:XHS_B64[0]; } return r;
}

// 从 vendor.js 提取 eval 代码
function getEvalCode() {
  const v = fs.readFileSync(path.join(__dirname, 'data', 'vendor.js'), 'utf-8');
  const mt = v.indexOf('__makeTemplateObject(['), arr = v.indexOf('[', mt), q = v.indexOf('"', arr);
  let i = q + 1, raw = '';
  while (i < v.length) { if (v[i] === '\\') { raw += v[i]; raw += v[i+1]; i += 2; continue; } if (v[i] === '"') break; raw += v[i]; i++; }
  let code = '', j = 0;
  while (j < raw.length) { if (raw[j] === '\\') { const n = raw[j+1]; if (n === '"') { code += '"'; j += 2; continue; } if (n === 'n') { code += '\n'; j += 2; continue; } if (n === 'r') { code += '\r'; j += 2; continue; } if (n === 't') { code += '\t'; j += 2; continue; } if (n === 'x') { code += String.fromCharCode(parseInt(raw.slice(j+2, j+4), 16)); j += 4; continue; } j += 2; continue; } code += raw[j]; j++; }
  return code;
}

let _mnsv2fn = null, _ready = false;

function init() {
  if (_ready) return;
  const t0 = Date.now();

  // 构建沙箱: Node 真实 API + 我们补的浏览器 API
  const sandbox = {};
  for (const k of Object.getOwnPropertyNames(global)) {
    try { sandbox[k] = global[k]; } catch(e) {}
  }
  // 把 Function.toString 和 eval 保留原版 (VM context 会用自己的)
  const ctx = vm.createContext(sandbox);

  // 1. 加载 VMP 环境代码到沙箱
  const envCode = fs.readFileSync(path.join(__dirname, 'env_vmp.js'), 'utf-8');
  vm.runInContext(envCode, ctx, { filename: 'env_vmp.js' });

  // 2. 加载 eval 代码到沙箱
  const _oe = console.error; console.error = () => {};
  try { vm.runInContext(getEvalCode(), ctx, { filename: 'vmp_eval.js', timeout: 120000 }); } catch(e) {}
  console.error = _oe;

  // 3. 从沙箱获取 mnsv2
  _mnsv2fn = sandbox.mnsv2 || null;

  console.error('[sign] ready in', Date.now()-t0, 'ms, mnsv2:', typeof _mnsv2fn);
  _ready = true;
}

function sign(url, data) {
  init();
  const bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
  const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
  const x3 = _mnsv2fn ? (() => { try { return String(_mnsv2fn(url + bodyStr, md5(url + bodyStr), md5(url))); } catch(e) { return 'ERR'; } })() : 'NOMNSV2';
  const payload = JSON.stringify({ x0:'4.3.5', x1:'xhs-pc-web', x2:'Windows', x3, x4:'object' });
  return { 'x-s': 'XYS_' + b64enc(Buffer.from(payload, 'utf-8')), 'x-t': String(Date.now()) };
}

if (require.main === module) {
  const url = process.argv[2] || '/api/sns/web/v1/homefeed';
  let body; try { body = JSON.parse(process.argv[3] || '{"cursor_score":"","num":20}'); } catch(e) { body = process.argv[3] || '{"cursor_score":"","num":20}'; }
  init(); console.log(JSON.stringify(sign(url, body)));
}

module.exports = { init, sign };
