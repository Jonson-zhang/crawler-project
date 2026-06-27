/**
 * QQ音乐 API 签名/加解密工具 - Node.js 原型链补环境
 *
 * 用法:
 *   node qqmusic_api.js sign <json_data>
 *   node qqmusic_api.js encrypt <json_data>
 *   node qqmusic_api.js decrypt <base64_or_binary_data>
 *
 *   数据也可通过 stdin 传入 (使用 - 作为数据参数)
 *
 * 输出: JSON { success: true, result: "..." }
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto').webcrypto;

// ── 构建最小浏览器环境 ──────────────────────────────────
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'https://y.qq.com/',
  referrer: 'https://y.qq.com/',
  contentType: 'text/html',
});

// 原型链方式补全全局对象
const winProto = Object.getOwnPropertyDescriptors(dom.window);
for (const [key, desc] of Object.entries(winProto)) {
  if (key === 'window' || key === 'document' || key === 'navigator' || key === 'location') continue;
  if (typeof global[key] !== 'undefined') continue;
  try { Object.defineProperty(global, key, { ...desc, configurable: true }); } catch (e) {}
}

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.XMLHttpRequest = dom.window.XMLHttpRequest;
global.FormData = dom.window.FormData;

// 补全 navigator 属性
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  configurable: true, writable: true
});
Object.defineProperty(global.navigator, 'platform', {
  value: 'Win32', configurable: true, writable: true
});

// 补全 crypto (Web Crypto API)
global.crypto = nodeCrypto;
global.window.crypto = nodeCrypto;

// 补全 TextEncoder/TextDecoder
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// 补全 performance
global.performance = require('perf_hooks').performance;

// ── 初始化 webpack 模块系统 ─────────────────────────────
global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(__dirname, 'runtime.js'), 'utf-8'));

// 加载必需的 chunk 文件
['common.chunk.js', 'vendor.chunk.js'].forEach(f => {
  const p = path.join(__dirname, f);
  if (fs.existsSync(p)) eval(fs.readFileSync(p, 'utf-8'));
});

// 执行模块8 (包含签名/加解密函数)
const wpRequire = global.window.__webpack_require__;
if (wpRequire && wpRequire.m && wpRequire.m[8]) {
  wpRequire(8);
}

// ── 获取函数引用 ────────────────────────────────────────
const getSecuritySign = global.window._getSecuritySign;
const cgiEncrypt = global.window.__cgiEncrypt;
const cgiDecrypt = global.window.__cgiDecrypt;

// ── 主入口 ──────────────────────────────────────────────
async function main() {
  const action = process.argv[2];
  let input = process.argv[3];

  // 支持 --file 参数：从文件读取大数据
  if (input === '--file' && process.argv[4]) {
    input = require('fs').readFileSync(process.argv[4], 'utf-8');
  }

  // 支持 stdin 输入
  if (input === '-' || (input === undefined && process.argv.length <= 3)) {
    input = require('fs').readFileSync(0, 'utf-8');
  }

  if (!action || !input) {
    process.stderr.write(JSON.stringify({ success: false, error: 'Usage: node qqmusic_api.js <sign|encrypt|decrypt> <data>' }) + '\n');
    process.exit(1);
  }

  const timeout = setTimeout(() => {
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
        // decrypt需要 ArrayBuffer: base64解码后传Uint8Array
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
    process.exit(0);
  } catch (e) {
    clearTimeout(timeout);
    process.stdout.write(JSON.stringify({ success: false, error: e.message }) + '\n');
    process.exit(1);
  }
}

main();
