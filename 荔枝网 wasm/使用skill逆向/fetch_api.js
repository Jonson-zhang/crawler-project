#!/usr/bin/env node
/**
 * 荔枝网 API 请求中介（sdenv 版）
 *
 * sdenv 加载 gdtv.cn → WASM 签名器初始化 →
 * 在 jsdom window 中用 XHR 发请求（走 app 签名路径）→ 返回 JSON 数据
 *
 * 输入(stdin): JSON, {"path":"/api/channel/v1/news","query":"..."}
 * 输出(stdout): JSON, {"success":true,"data":{...}}
 */

'use strict';
const { jsdomFromUrl } = require('sdenv');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const BASE = 'https://www.gdtv.cn';
const API = 'https://gdtv-api.gdtv.cn';

function readStdin() {
  return new Promise(r => {
    if (process.stdin.isTTY) { r({path:'/api/channel/v1/news',query:'beginScore=0&pageSize=11&channelId=117'}); return; }
    let d = ''; process.stdin.setEncoding('utf-8');
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => { try { r(JSON.parse(d)); } catch(e) { r(null); } });
    setTimeout(() => r(null), 2000);
  });
}

async function main() {
  const input = await readStdin();
  if (!input || !input.path) {
    process.stdout.write(JSON.stringify({success:false,error:'no path'}));
    process.exit(1);
  }

  // Step 1: sdenv 加载页面初始化 WASM
  const dom = await jsdomFromUrl(BASE + '/', {
    userAgent: UA,
    consoleConfig: { error: () => {} },
  });

  // 等待 WASM + Vue app 初始化
  await new Promise(r => setTimeout(r, 8000));

  const fullUrl = API + input.path + (input.query ? '?' + input.query : '');

  // Step 2: 在 jsdom 中发请求
  // XMLHttpRequest 在 jsdom 中直接走 Node.js http 层，不经过浏览器的 WASM 签名
  // 但我们需要签名...
  //
  // 解法: jsdom 的 XHR 走到 sdenv 的 ResourceLoader，
  // 但拦截器工作在 axios 层（在 window 上下文中）
  //
  // 实际解法: patch XMLHttpRequest.prototype.send 让它先调 axios
  // 真·最终解法: 在 window 中找 Vue store，dispatch action

  const window = dom.window;

  // 检查 Vue store 是否可用
  let data = null;
  let error = null;

  try {
    // 尝试通过 Vuex 发请求
    const result = await new Promise((resolve) => {
      try {
        const app = window.document.querySelector('#app');
        if (!app || !app.__vue__ || !app.__vue__.$store) {
          resolve({ error: 'Vue store not accessible' });
          return;
        }

        const params = {};
        if (input.query) {
          input.query.split('&').forEach(p => {
            const [k, v] = p.split('=');
            params[k] = isNaN(Number(v)) ? v : Number(v);
          });
        }

        app.__vue__.$store.dispatch('getChannelNews', params)
          .then(result => resolve({ data: result }))
          .catch(err => resolve({ error: err.message || String(err) }));
      } catch (e) {
        resolve({ error: e.message });
      }
    });

    data = result.data;
    error = result.error;
  } catch (e) {
    error = e.message;
  }

  // 如果 Vue store 不可用，尝试 XHR（可能没有签名头）
  if (error) {
    try {
      data = await new Promise((resolve) => {
        const xhr = new window.XMLHttpRequest();
        xhr.open('GET', fullUrl);
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (e) { resolve(xhr.responseText); }
        };
        xhr.onerror = () => resolve(null);
        xhr.send();
      });
      error = data ? null : 'XHR failed';
    } catch (e) {
      error = e.message;
    }
  }

  try { window.close(); } catch (e) {}

  process.stdout.write(JSON.stringify({
    success: !!data,
    data: data || null,
    error: error || null,
  }));

  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({ success: false, error: err.message }));
  setTimeout(() => process.exit(1), 500);
});
