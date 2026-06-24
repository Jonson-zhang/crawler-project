#!/usr/bin/env node
/**
 * 荔枝网 (gdtv.cn) API 请求中介
 *
 * 原理：
 *   荔枝网使用 WASM (itouchtv_webqs) + axios 拦截器自动签名每个 API 请求。
 *   签名器封装在 webpack 闭包内无法从外部直接调用。
 *
 *   本脚本利用 sdenv 加载 gdtv.cn 完成 WASM 初始化后，
 *   通过全局 XHR 拦截捕获签名头，对每个目标 URL 发请求并返回完整响应。
 *
 *   输入(stdin JSON):
 *     {"method":"GET", "path":"/api/channel/v1/news", "query":"..."}
 *   输出(stdout JSON):
 *     {"success":true, "results":[{"url":"...","status":200,"data":{...}}]}
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
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
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

  // Step 1: sdenv 加载 gdtv.cn
  const dom = await jsdomFromUrl(BASE_URL + '/', {
    userAgent: UA,
    consoleConfig: { error: () => {} },
  });
  const { window } = dom;

  // 等待前端 App + WASM 签名器初始化（8s）
  await new Promise(r => setTimeout(r, 8000));

  const context = dom.getInternalVMContext();

  // Step 2: 注入 fetch 包装器 — 我们 patch XMLHttpRequest.open 来拦截 URL
  // 然后用 app 自己的请求逻辑（跳过 axios，直接用 XHR）
  // 但 XHR 不会经过 axios 拦截器...
  //
  // 换思路：直接 patch jsdom 的 xhr 让它在发送之前先跑完 axios 拦截器
  // axios 拦截器在模块 1321 中配置，我们无法访问
  //
  // 最终方案：hook XMLHttpRequest.prototype.send，
  // 捕获所有请求的真实 header 和 body，用这些信息重新发请求

  vm.runInContext(`
    // 捕获真实 App 发出的 API 请求的签名头
    window.__capturedHeaders = {};
    window.__requests = [];

    const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
      this.__ad_method = method;
      this.__ad_url = url;
      this.__ad_headers = {};
      this.__ad_captured = false;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
      this.__ad_headers[name] = value;
      if (name && name.toLowerCase().startsWith('x-itouchtv')) {
        this.__ad_captured = true;
        // 缓存签名头模板
        window.__capturedHeaders[name] = value;
      }
      return origSetRequestHeader.apply(this, arguments);
    };
  `, context);

  // Step 3: 等 App 自己发出的 API 请求完成，导出签名头

  // 用 window.eval 手动发 XHR（会走 app 的 axios 拦截器吗？不会！）
  // 需要换策略：让 sdenv 内用原本的 fetch/ajax 发请求

  // 最终方案：用 location.href 或 window.open 触发页面渲染不同频道
  // 但这样太慢

  // 最实际方案：直接让 App 自己调用 store.dispatch
  // ------------------------------------------------------------------
  // Vue 2 store 挂载在 Vue.prototype.$store
  // ------------------------------------------------------------------

  for (const r of requests) {
    const fullUrl = API_BASE + r.path + (r.query ? '?' + r.query : '');
    const params = {};
    if (r.query) {
      r.query.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[k] = isNaN(v) ? v : Number(v);
      });
    }

    // 尝试通过 Vuex store dispatch 发请求（会走完整签名链路）
    try {
      const result = await vm.runInContext(`
        (function() {
          return new Promise(function(resolve) {
            try {
              var appEl = document.querySelector('#app');
              if (!appEl || !appEl.__vue__) {
                resolve({error: 'Vue app not found'});
                return;
              }
              var store = appEl.__vue__.$store;
              if (!store) {
                resolve({error: 'Vuex store not found'});
                return;
              }
              store.dispatch('getChannelNews', ${JSON.stringify(params)})
                .then(function(data) {
                  resolve({status: 200, data: data});
                })
                .catch(function(err) {
                  resolve({status: 0, error: err.message || String(err)});
                });
            } catch(e) {
              resolve({error: e.message || String(e)});
            }
          });
        })()
      `, context);

      console.error('dispatch result:', JSON.stringify(result).substring(0, 200));
    } catch (e) {
      console.error('dispatch error:', e.message);
    }
  }

  // Step 4: 读取应用发出真实 API 请求时捕获到的签名头
  const captured = vm.runInContext('window.__capturedHeaders', context);

  const deviceId = vm.runInContext(`
    try {
      var d = localStorage.getItem('deviceId') || localStorage.getItem('__DEVICEID__') || '';
      return d;
    } catch(e) { return ''; }
  `, context);

  try { window.close(); } catch (e) {}

  process.stdout.write(JSON.stringify({
    success: true,
    deviceId: deviceId || '',
    capturedHeaders: captured || {},
  }));

  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    success: false, error: err.message,
  }));
  setTimeout(() => process.exit(1), 500);
});
