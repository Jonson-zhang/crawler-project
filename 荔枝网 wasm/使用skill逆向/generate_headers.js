#!/usr/bin/env node
/**
 * 荔枝网 (gdtv.cn) API 签名中介
 *
 * 原理：
 *   荔枝网使用 WASM (itouchtv_webqs) 对每个 API 请求生成 ca-signature。
 *   签名算法封装在 webpack 模块闭包中，无法直接提取。
 *
 *   本脚本利用 sdenv 加载 gdtv.cn → 初始化 WASM 签名器后，
 *   在 jsdom 内用 XMLHttpRequest 发出请求（复用已初始化的签名逻辑），
 *   将响应数据返回给 Python。
 *
 *   Python 只需指定 path + query，本脚本负责完整请求并返回 JSON body。
 *
 * 输入(stdin JSON)：
 *   {"method":"GET", "path":"/api/channel/v1/news", "query":"beginScore=0&pageSize=11&channelId=117"}
 *
 *   或批量：
 *   {"requests": [{"path":"...","query":"..."}, ...]}
 *
 * 输出(stdout JSON)：
 *   {"success":true, "results":[{"url":"...","data":{...}}, ...]}
 */

'use strict';
const { jsdomFromUrl } = require('sdenv');
const vm = require('vm');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.gdtv.cn';
const API_BASE = 'https://gdtv-api.gdtv.cn';

function readStdin() {
  return new Promise(resolve => {
    if (process.stdin.isTTY) { resolve(null); return; }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { resolve(null); }
    });
    setTimeout(() => resolve(null), 2000);
  });
}

async function main() {
  const input = await readStdin();
  const requests = (input && input.requests) ? input.requests : [{
    method: (input && input.method) || 'GET',
    path: (input && input.path) || '/api/channel/v1/news',
    query: (input && input.query) || 'beginScore=0&pageSize=11&channelId=117',
  }];

  // Step 1: sdenv 加载 gdtv.cn 首页
  const dom = await jsdomFromUrl(BASE_URL + '/', {
    userAgent: UA,
    consoleConfig: { error: () => {} },
  });
  const { window } = dom;

  // 等待前端框架 + WASM 签名器初始化
  await new Promise(r => setTimeout(r, 8000));

  // Step 2: 在 jsdom 上下文中注入工具函数
  // 利用已初始化的 axios 实例发请求（axios 拦截器会自动附加签名头）
  const context = dom.getInternalVMContext();
  vm.runInContext(`
    window.__ad_results = [];
    window.__ad_fetch = function(url) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve({status: xhr.status, body: JSON.parse(xhr.responseText)});
            } catch(e) {
              resolve({status: xhr.status, body: xhr.responseText});
            }
          } else {
            resolve({status: xhr.status, error: xhr.statusText, body: xhr.responseText});
          }
        };
        xhr.onerror = function() {
          resolve({status: 0, error: 'Network error'});
        };
        xhr.timeout = 15000;
        xhr.ontimeout = function() {
          resolve({status: 0, error: 'Timeout'});
        };
        xhr.send();
      });
    };
  `, context);

  // Step 3: 依次请求
  const results = [];
  for (const r of requests) {
    const fullUrl = API_BASE + r.path + (r.query ? '?' + r.query : '');
    try {
      const result = await vm.runInContext(
        `window.__ad_fetch('${fullUrl}')`, context
      );
      results.push({ url: fullUrl, ...result });
    } catch (e) {
      results.push({ url: fullUrl, error: e.message });
    }
  }

  try { window.close(); } catch (e) {}

  process.stdout.write(JSON.stringify({
    success: true,
    results: results,
  }));

  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    success: false, error: err.message, results: [],
  }));
  setTimeout(() => process.exit(1), 500);
});
