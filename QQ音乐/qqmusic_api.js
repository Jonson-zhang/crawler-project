/**
 * QQ音乐 API 签名/加解密工具 — JSDOM 补环境
 *
 * 用法:
 *   node qqmusic_api.js sign <json>
 *   node qqmusic_api.js encrypt <json>
 *   node qqmusic_api.js decrypt <base64>
 *   node qqmusic_api.js sign --file <path>
 *
 * 输出: JSON { success: true, result: "..." }
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// ── 1. JSDOM 浏览器环境 ────────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'https://y.qq.com/',
  referrer: 'https://y.qq.com/',
  contentType: 'text/html',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.XMLHttpRequest = dom.window.XMLHttpRequest;
global.FormData = dom.window.FormData;

global.navigator.userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
global.navigator.platform = 'Win32';

if (!global.crypto) global.crypto = require('crypto').webcrypto;
if (!global.crypto.subtle) global.crypto.subtle = require('crypto').webcrypto.subtle;

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

if (!global.performance) global.performance = require('perf_hooks').performance;

// 拷贝 JSDOM window 上的其余属性到 global
for (const key of Object.keys(global.window)) {
  if (typeof global[key] === 'undefined' &&
      key !== 'window' && key !== 'document' && key !== 'navigator' && key !== 'location') {
    try { global[key] = global.window[key]; } catch (_) {}
  }
}

// ── 2. 加载 webpack runtime ────────────────────────────────
global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf-8'));

// ── 3. 注入缺失模块 stub ──────────────────────────────────
// vendor.chunk.js 字节码解释器运行时依赖 module 380/381/382
// （readable-stream Debuglog/BufferList/Queue），否则模块8执行失败
global.window.webpackJsonp.push([
  [999],
  {
    380: function (e) {
      e.exports = { debuglog: function () { return function () {}; }, inspect: { colors: false } };
    },
    381: function (e) {
      (e.exports = function () {
        this.head = null; this.tail = null; this.length = 0;
      });
      e.exports.prototype.push = function (e) {
        var n = { data: e, next: null };
        this.length > 0 ? (this.tail.next = n) : (this.head = n);
        this.tail = n; ++this.length;
      };
      e.exports.prototype.unshift = function (e) {
        var n = { data: e, next: this.head };
        0 === this.length && (this.tail = n);
        this.head = n; ++this.length;
      };
      e.exports.prototype.shift = function () {
        if (0 !== this.length) {
          var e = this.head.data;
          return 1 === this.length && (this.head = this.tail = null),
            (this.head = this.head.next), --this.length, e;
        }
      };
    },
    382: function (e) {
      function n() { this.head = null; this.tail = null; this.length = 0; }
      n.prototype.push = function (e) {
        var t = { data: e, next: null };
        this.length > 0 ? (this.tail.next = t) : (this.head = t);
        this.tail = t; ++this.length;
      };
      n.prototype.unshift = function (e) {
        var t = { data: e, next: this.head };
        0 === this.length && (this.tail = t);
        this.head = t; ++this.length;
      };
      n.prototype.shift = function () {
        if (0 !== this.length) {
          var e = this.head.data;
          return 1 === this.length && (this.head = this.tail = null),
            (this.head = this.head.next), --this.length, e;
        }
      };
      e.exports = n;
    },
  },
]);

// ── 4. 加载 vendor.chunk.js ─────────────────────────────────
eval(fs.readFileSync(path.join(__dirname, 'vendor.chunk.js'), 'utf-8'));

// ── 5. 执行所有已注册模块，触发 sign/encrypt/decrypt 挂载到 window ──
const wp = global.window.__webpack_require__;
if (wp && wp.m) {
  Object.keys(wp.m).forEach(function (id) {
    try { wp(id); } catch (_) {}
  });
}

// ── 6. 获取函数引用 ────────────────────────────────────────
const getSecuritySign = global.window._getSecuritySign || global.window._getSecuritySign2;
const cgiEncrypt = global.window.__cgiEncrypt;
const cgiDecrypt = global.window.__cgiDecrypt;

// ── 7. 主入口 ──────────────────────────────────────────────
async function main() {
  const action = process.argv[2];
  let input = process.argv[3];

  // --file 参数
  if (input === '--file' && process.argv[4]) {
    input = fs.readFileSync(process.argv[4], 'utf-8');
  }
  // stdin 输入
  if (input === '-' || (input === undefined && process.argv.length <= 3)) {
    input = fs.readFileSync(0, 'utf-8');
  }

  if (!action || !input) {
    process.stderr.write(JSON.stringify({
      success: false, error: 'Usage: node qqmusic_api.js <sign|encrypt|decrypt> <data>',
    }) + '\n');
    process.exit(1);
  }

  const timeout = setTimeout(function () {
    process.stderr.write(JSON.stringify({ success: false, error: 'Operation timed out' }) + '\n');
    process.exit(1);
  }, 30000);

  try {
    let result;
    switch (action) {
      case 'sign':
        if (!getSecuritySign) throw new Error('Sign function not available');
        result = getSecuritySign(typeof input === 'string' ? input : JSON.stringify(input));
        break;
      case 'encrypt':
        if (!cgiEncrypt) throw new Error('Encrypt function not available');
        result = await cgiEncrypt(typeof input === 'string' ? input : JSON.stringify(input));
        break;
      case 'decrypt':
        if (!cgiDecrypt) throw new Error('Decrypt function not available');
        {
          const binaryBuf = Buffer.from(input.trim(), 'base64');
          const uint8 = new Uint8Array(binaryBuf.buffer, binaryBuf.byteOffset, binaryBuf.byteLength);
          result = cgiDecrypt(uint8);
        }
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    clearTimeout(timeout);
    process.stdout.write(JSON.stringify({ success: true, result: result }) + '\n');
  } catch (e) {
    clearTimeout(timeout);
    process.stderr.write(JSON.stringify({ success: false, error: e.message }) + '\n');
    process.exit(1);
  }
}

main();
