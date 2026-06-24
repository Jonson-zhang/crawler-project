/**
 * 用 jsdom 完整 DOM 运行 VMP eval 代码
 */
const fs = require('fs'), crypto = require('crypto');
const { JSDOM } = require('jsdom');

// 构建 jsdom 窗口
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'https://www.xiaohongshu.com/explore',
  referrer: 'https://www.xiaohongshu.com/',
  contentType: 'text/html',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
});

const win = dom.window;

// 注入 jsdom 全局到 Node global
global.window = win;
global.document = win.document;
global.navigator = win.navigator;
global.screen = win.screen;
global.location = win.location;
global.performance = win.performance;
global.top = win;
global.self = win;
global.globalThis = win;
global.InstallTrigger = undefined;  // Chrome
global.chrome = undefined;           // Firefox - jsdom is neither
global.localStorage = win.localStorage;
global.sessionStorage = win.sessionStorage;
global.MutationObserver = win.MutationObserver;
global.Event = win.Event;
global.CustomEvent = win.CustomEvent;
global.XMLHttpRequest = win.XMLHttpRequest;

console.error('[jsdom] DOM ready');

// 提取 eval 代码
const v = fs.readFileSync('data/vendor.js', 'utf-8');
const mt = v.indexOf('__makeTemplateObject([');
const arr = v.indexOf('[', mt);
const q = v.indexOf('"', arr);
let i = q + 1, raw = '';
while (i < v.length) {
  if (v[i] === '\\') { raw += v[i]; raw += v[i+1]; i += 2; continue; }
  if (v[i] === '"') break;
  raw += v[i]; i++;
}
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

console.error('[jsdom] eval code:', code.length, 'chars');

const _oe = console.error; console.error = () => {};
try {
  (0, eval)(code);
} catch(e) {
  console.error = _oe;
  console.error('[jsdom] eval error:', e.message.slice(0, 300));
}
console.error = _oe;

// Check mnsv2
const m = global.mnsv2;
console.error('[jsdom] mnsv2:', typeof m);

if (typeof m === 'function') {
  const url = '/api/sns/web/v1/homefeed';
  const body = '{"cursor_score":"","num":20}';
  const combined = url + body;
  const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
  const hc = md5(combined), hu = md5(url);
  const result = String(m(combined, hc, hu));
  console.error('[jsdom] Result:', result.slice(0, 100), 'len:', result.length);

  // Check if we got a proper hash!
  if (result.length > 20) {
    console.error('SUCCESS - full hash generated!');
    fs.writeFileSync('_mnsv2_result.txt', result);
    console.log(result);
  } else {
    console.error('Still short:', result);
  }
} else {
  console.error('NO mnsv2');
}

// Cleanup
global.window = undefined; global.document = undefined;
