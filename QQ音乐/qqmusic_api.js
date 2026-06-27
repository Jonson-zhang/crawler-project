/**
 * QQ音乐API签名和加解密工具 - Node.js 适配层
 *
 * 用法: node qqmusic_api.js <action> <data>
 *   action: sign | encrypt | decrypt
 *   data: JSON字符串 (sign/encrypt) 或 base64字符串 (decrypt)
 *
 * 输出: JSON { success: true, result: "..." } 或 { success: false, error: "..." }
 */

const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// 创建最小化浏览器环境
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'https://y.qq.com/',
  referrer: 'https://y.qq.com/',
  contentType: 'text/html',
  includeNodeLocations: false,
  storageQuota: 10000000,
});

// 设置全局变量
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location;
global.XMLHttpRequest = dom.window.XMLHttpRequest;
global.FormData = dom.window.FormData;

// 补充 navigator 属性
global.navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
global.navigator.appVersion = '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
global.navigator.platform = 'Win32';

// 补充 crypto (Node.js 18+ 自带 Web Crypto)
if (!global.crypto) {
  global.crypto = require('crypto').webcrypto;
}
if (!global.crypto.subtle) {
  global.crypto.subtle = require('crypto').webcrypto.subtle;
}

// 补充 TextEncoder/TextDecoder (Node.js 自带)
global.TextEncoder = global.TextEncoder || require('util').TextEncoder;
global.TextDecoder = global.TextDecoder || require('util').TextDecoder;

// 补充 performance
if (!global.performance) {
  global.performance = require('perf_hooks').performance;
}

// 设置 window 属性到 global
for (const key of Object.keys(global.window)) {
  if (typeof global[key] === 'undefined' && key !== 'window' && key !== 'document' && key !== 'navigator' && key !== 'location') {
    try {
      global[key] = global.window[key];
    } catch (e) {
      // skip non-configurable properties
    }
  }
}

// 初始化 webpackJsonp
global.window.webpackJsonp = global.window.webpackJsonp || [];

// 加载 webpack runtime
const runtimePath = path.join(__dirname, 'runtime.js');
const runtimeCode = fs.readFileSync(runtimePath, 'utf-8');
eval(runtimeCode);

// 加载 vendor.chunk.js (包含加密/签名模块)
const vendorPath = path.join(__dirname, 'vendor.chunk.js');
const vendorCode = fs.readFileSync(vendorPath, 'utf-8');
try {
  eval(vendorCode);
  console.error('[DEBUG] vendor.chunk.js loaded successfully');
} catch (e) {
  console.error('[DEBUG] vendor.chunk.js error:', e.message);
  console.error('[DEBUG] stack:', e.stack ? e.stack.substring(0, 500) : 'no stack');
}

// 现在 window._getSecuritySign, window.__cgiEncrypt, window.__cgiDecrypt 应该已设置

// Debug: check what's available
console.error('[DEBUG] window._getSecuritySign:', typeof global.window._getSecuritySign);
console.error('[DEBUG] window.__cgiEncrypt:', typeof global.window.__cgiEncrypt);
console.error('[DEBUG] window.__cgiDecrypt:', typeof global.window.__cgiDecrypt);
console.error('[DEBUG] window._getSecuritySign2:', typeof global.window._getSecuritySign2);
console.error('[DEBUG] webpackJsonp length:', global.window.webpackJsonp ? global.window.webpackJsonp.length : 'N/A');

function getSign(data) {
  const signFn = global.window._getSecuritySign || global.window._getSecuritySign2;
  if (!signFn) {
    throw new Error('_getSecuritySign not found on window');
  }
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  return signFn(dataStr);
}

async function encrypt(data) {
  const encryptFn = global.window.__cgiEncrypt;
  if (!encryptFn) {
    throw new Error('__cgiEncrypt not found on window');
  }
  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  return await encryptFn(dataStr);
}

function decrypt(data) {
  const decryptFn = global.window.__cgiDecrypt;
  if (!decryptFn) {
    throw new Error('__cgiDecrypt not found on window');
  }
  return decryptFn(data);
}

// 主入口
async function main() {
  const action = process.argv[2];
  const input = process.argv[3];

  if (!action || !input) {
    console.log(JSON.stringify({ success: false, error: 'Usage: node qqmusic_api.js <sign|encrypt|decrypt> <data>' }));
    process.exit(1);
  }

  try {
    let result;
    switch (action) {
      case 'sign':
        result = getSign(input);
        break;
      case 'encrypt':
        result = await encrypt(input);
        break;
      case 'decrypt':
        result = decrypt(input);
        break;
      default:
        throw new Error('Unknown action: ' + action);
    }
    console.log(JSON.stringify({ success: true, result: result }));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  }
}

main();
