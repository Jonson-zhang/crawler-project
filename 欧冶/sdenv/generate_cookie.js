#!/usr/bin/env node
/**
 * ────────────────────────────────────────────────────────────
 *  欧冶钢材网 — sdenv 瑞数 Cookie 生成器
 *
 *  工作流:
 *    1. Python 发起 POST → 获得 202 挑战 HTML + S Cookie
 *    2. generate_cookie.js 通过 sdenv 创建浏览器环境，
 *       加载挑战 HTML，自动获取并执行引擎 JS
 *    3. 等待瑞数 VM 完成挑战 → 生成 P Cookie
 *    4. 返回所有 Cookie 给 Python
 *
 *  输入(stdin JSON):
 *    {
 *      "html": "<!DOCTYPE html>...",       // 202 挑战 HTML
 *      "cookies": { "T0k1m0u5AfREO": "..." },  // 初始 S Cookie
 *      "baseUrl": "https://www.ouyeel.com"
 *    }
 *
 *  输出(stdout JSON):
 *    { "success": true/false, "cookies": {...}, "error": null/msg }
 * ────────────────────────────────────────────────────────────
 */
'use strict';

const { jsdomFromText } = require('sdenv');
const https = require('https');

// ── 提取 $_ts 初始值（仅用于日志） ──
function extractTs(html) {
  const nsdM = html.match(/nsd=(\d+)/);
  const cdM = html.match(/\$_ts\.cd="([^"]+)"/);
  return {
    nsd: nsdM ? parseInt(nsdM[1]) : 0,
    cd: cdM ? cdM[1] : '',
  };
}

// ── 下载远程 JS（备用：当自动加载失败时手动 eval） ──
function fetchJs(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── 读取 stdin ──
function readStdin() {
  return new Promise(r => {
    if (process.stdin.isTTY) { r(null); return; }
    let d = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try { r(JSON.parse(d)); } catch(e) { r(null); }
    });
    setTimeout(() => r(null), 5000);
  });
}

// ════════════════════════════════════════════════════════════

const PAGE_URL = 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50';

async function main() {
  const input = await readStdin() || {};
  const html = input.html || '';
  const baseUrl = input.baseUrl || 'https://www.ouyeel.com';
  const initialCookies = input.cookies || {};

  if (!html) {
    throw new Error('请通过 stdin 传入 202 挑战 HTML');
  }

  // 提取引擎 JS URL（从 HTML 中）
  const srcM = html.match(/src="([^"]*\.js)"\s*r=['"]m['"]/);
  const engineUrl = srcM ? (srcM[1].startsWith('http') ? srcM[1] : baseUrl + srcM[1]) : null;

  const ts = extractTs(html);
  console.error(`[sdenv] nsd=${ts.nsd}, cd_len=${ts.cd.length}, engine=${engineUrl ? engineUrl.split('/').pop() : 'none'}`);

  // ── 创建 sdenv 浏览器环境 ──
  console.error('[sdenv] 创建浏览器环境...');

  const dom = await jsdomFromText(html, {
    // 设置页面 URL 让 jsdom 能解析相对路径脚本
    url: PAGE_URL,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    consoleConfig: {
      log: (...a) => { const m = a.join(' '); if (m.length < 200) console.error('[sdenv:log]', m); },
      warn: (...a) => console.error('[sdenv:warn]', ...a),
      error: () => {},   // 静默瑞数的"正常"错误
    },
    beforeParse(window, sdenvEnv) {
      // ── 注入初始 Cookie 到 document.cookie ──
      if (initialCookies.T0k1m0u5AfREO) {
        try {
          window.document.cookie = `T0k1m0u5AfREO=${initialCookies.T0k1m0u5AfREO}; path=/; domain=.ouyeel.com`;
        } catch(e) {}
      }
      if (initialCookies.cookiesession1) {
        try {
          window.document.cookie = `cookiesession1=${initialCookies.cookiesession1}; path=/; domain=.ouyeel.com`;
        } catch(e) {}
      }
      console.error('[sdenv] 环境就绪');
    },
  });

  const { cookieJar, window } = dom;

  // ── 等待瑞数挑战完成 ──
  console.error('[sdenv] 等待瑞数挑战完成...');

  let completed = false;
  const result = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('[sdenv] ⏰ 超时（25秒）');
      resolve('timeout');
    }, 25000);

    // 轮询 Cookie
    const cookiePoller = setInterval(() => {
      const ck = cookieJar.getCookieStringSync(PAGE_URL);
      if (ck && ck.includes('T0k1m0u5AfREP')) {
        console.error('[sdenv] ✅ P Cookie 已生成');
        clearTimeout(timeout);
        clearInterval(cookiePoller);
        completed = true;
        resolve('cookie_found');
      }
    }, 300);

    // sdenv:exit 事件
    window.addEventListener('sdenv:exit', () => {
      if (!completed) {
        console.error('[sdenv] sdenv:exit 事件');
        clearTimeout(timeout);
        clearInterval(cookiePoller);
        completed = true;
        resolve('sdenv_exit');
      }
    });
    window.addEventListener('sdenv:location.replace', () => {});
  });

  // ── 提取 Cookie ──
  const cookieStr = cookieJar.getCookieStringSync(PAGE_URL);
  const parsed = {};
  if (cookieStr) {
    cookieStr.split(';').forEach(pair => {
      const eq = pair.indexOf('=');
      if (eq > 0) parsed[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
    });
  }

  // 也检查 document.cookie
  try {
    const docCk = window.document?.cookie;
    if (docCk) {
      docCk.split(';').forEach(pair => {
        const eq = pair.indexOf('=');
        if (eq > 0) parsed[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
      });
    }
  } catch(e) {}

  try { window.close(); } catch(e) {}

  const hasP = !!parsed.T0k1m0u5AfREP;
  const hasO = !!parsed.T0k1m0u5AfREO;

  process.stdout.write(JSON.stringify({
    success: hasP || hasO,
    cookies: parsed,
    // 即使没有 P Cookie，如果有 O Cookie 也算部分成功
    error: (!hasP && !hasO) ? 'sdenv 未生成任何瑞数 Cookie' :
           hasP ? null : '有 O Cookie 但未生成 P Cookie（挑战可能被重定向）',
  }));
  setTimeout(() => process.exit(0), 300);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    success: false,
    cookies: {},
    error: err.message,
  }));
  setTimeout(() => process.exit(1), 300);
});
