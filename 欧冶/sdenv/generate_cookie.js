#!/usr/bin/env node
/**
 * ────────────────────────────────────────────────────────────
 *  欧冶钢材网 — RuiShu Cookie 生成器
 *
 *  jsdom + 纯JS环境补丁方案。无需C++原生扩展。
 *
 *  工作流:
 *    1. Python 从 POST 响应获取 202 HTML + S Cookie
 *    2. create jsdom with browser env patches
 *    3. Load + execute engine JS → RuiShu 挑战完成
 *    4. 返回所有 Cookie 给 Python
 *
 *  输入(stdin JSON):
 *    {
 *      "html": "<!DOCTYPE html>...",             // 202 响应 HTML
 *      "cookies": { "T0k1m0u5AfREO": "..." },   // 初始 S Cookie
 *      "engineUrl": "/vdGfdDb5PQO5/...js",      // 引擎 JS URL
 *      "baseUrl": "https://www.ouyeel.com"
 *    }
 *
 *  输出(stdout JSON):
 *    {
 *      "success": true/false,
 *      "cookies": { "name": "value", ... },
 *      "error": null/错误信息,
 *      "nsd": 数字
 *    }
 * ────────────────────────────────────────────────────────────
 */
'use strict';

const { JSDOM } = require('jsdom');
const https = require('https');
const { injectEnv } = require('./ouyeel_env');

const PAGE_URL = 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50';

// ── 提取 engine JS URL ──
function extractEngineUrl(html) {
  const m = html.match(/src="([^"]*\.js)"\s*r=['"]m['"]/);
  return m ? m[1] : null;
}

// ── 提取 $_ts ──
function extractTs(html) {
  const nsdM = html.match(/nsd=(\d+)/);
  const cdM = html.match(/\$_ts\.cd="([^"]+)"/);
  return {
    nsd: nsdM ? parseInt(nsdM[1]) : 0,
    cd: cdM ? cdM[1] : '',
  };
}

// ── 下载远程 JS ──
function fetchJs(url) {
  return new Promise((resolve, reject) => {
    console.error(`[sdenv] 下载: ${url}`);
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

async function main() {
  const input = await readStdin() || {};
  const html = input.html || '';
  const baseUrl = input.baseUrl || 'https://www.ouyeel.com';
  const initialCookies = input.cookies || {};

  if (!html) throw new Error('请通过 stdin 传入 202 挑战 HTML');

  const ts = extractTs(html);
  let engineUrl = input.engineUrl || extractEngineUrl(html);
  if (engineUrl && !engineUrl.startsWith('http')) engineUrl = baseUrl + engineUrl;

  console.error(`[sdenv] nsd=${ts.nsd}, cd_len=${ts.cd.length}, engine=${engineUrl ? engineUrl.split('/').pop() : 'none'}`);

  // ── Cookie 存储 (手动管理，因为 jsdom cookieJar 有 CORS 限制) ──
  const _cookieStore = {};
  if (initialCookies.T0k1m0u5AfREO) _cookieStore['T0k1m0u5AfREO'] = initialCookies.T0k1m0u5AfREO;
  if (initialCookies.cookiesession1) _cookieStore['cookiesession1'] = initialCookies.cookiesession1;
  const _cookieGet = () => Object.entries(_cookieStore).map(([k,v]) => `${k}=${v}`).join('; ');

  // ── 创建 JSDOM ──
  console.error('[sdenv] 创建 jsdom...');
  const dom = new JSDOM(html, {
    url: PAGE_URL,
    contentType: 'text/html',
    pretendToBeVisual: true,
    runScripts: 'outside-only',  // Scripts run via manual eval, not auto
    beforeParse(window) {
      // ── 注入浏览器环境 ──
      injectEnv(window, { url: PAGE_URL });

      // ── 覆盖 document.cookie 使用我们的存储 ──
      Object.defineProperty(window.document, 'cookie', {
        get: () => _cookieGet(),
        set: (v) => {
          if (v && v.indexOf('=') > 0) {
            const eq = v.indexOf('=');
            const semi = v.indexOf(';');
            const val = semi > 0 ? v.substring(0, semi) : v;
            const name = v.substring(0, eq).trim();
            const value = val.substring(eq + 1).trim();
            _cookieStore[name] = value;
            console.error(`[cookie] ${name}=${value.substring(0, 40)}...`);
          }
        },
        configurable: true,
      });

      console.error('[sdenv] 环境就绪');
    },
  });

  const window = dom.window;

  // ── 预初始化 $_ts ──
  window.$_ts = {};

  // ── 手动执行内联脚本 (在环境中执行) ──
  // jsdom with runScripts:'outside-only' won't auto-execute <script> tags
  // Extract and execute the $_ts initialization script
  // We need to prepend "window." to the script to run in global scope
  const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let initJsDone = false;
  let tailJsDone = false;

  for (const tag of scriptTags) {
    const code = tag.replace(/<script[^>]*>/, '').replace('<\/script>', '').trim();
    if (!code) continue;

    // Check if it's the external script (has src attribute)
    if (tag.includes('src=') && !code) continue;

    // Execute in a wrapper that handles window context
    const wrappedCode = `(function() { ${code} }).call(window);`;
    try {
      window.eval(wrappedCode);
      if (code.includes('$_ts')) {
        initJsDone = true;
        console.error('[sdenv] $_ts 初始化脚本已执行');
      }
    } catch(e) {
      console.error(`[sdenv] 脚本错误: ${e.message.substring(0, 100)}`);
    }
  }

  console.error(`[sdenv] $_ts: nsd=${window.$_ts?.nsd}, cd长度=${window.$_ts?.cd?.length || 0}`);

  // ── 加载并执行引擎 JS ──
  if (engineUrl) {
    try {
      const engineJs = await fetchJs(engineUrl);
      console.error(`[sdenv] 引擎 JS: ${(engineJs.length / 1024).toFixed(1)} KB`);

      // 在 jsdom window 中执行引擎 JS
      window.eval(engineJs);
      console.error('[sdenv] 引擎 JS 执行完成');
    } catch(e) {
      console.error(`[sdenv] 引擎错误: ${e.message}`);
    }
  }

  // ── 执行尾部 _$h7() 调用 ──
  // The 202 HTML has: <script>_$h7();</script> at the end
  const tailMatch = html.match(/<script[^>]*>\s*_?\$?\w+\(\);\s*<\/script>\s*$/);
  if (tailMatch) {
    try {
      window.eval(tailMatch[0].replace(/<\/?script[^>]*>/g, ''));
      console.error('[sdenv] 尾部脚本已执行');
    } catch(e) {}
  } else {
    // Try to find any remaining script in the HTML
    const allScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    if (allScripts) {
      for (const s of allScripts) {
        const code = s.replace(/<script[^>]*>/, '').replace('</script>', '').trim();
        if (code && !code.includes('$_ts') && !code.includes('r=\'m\'')) {
          try { window.eval(code); } catch(e) {}
        }
      }
    }
  }

  // ── 尝试调用 $_ts.lcd (如果引擎设置了) ──
  try {
    if (typeof window.$_ts?.lcd === 'function') {
      console.error('[sdenv] 调用 $_ts.lcd()...');
      window.$_ts.lcd();
    }
  } catch(e) {
    console.error(`[sdenv] $_ts.lcd 调用错误: ${e.message}`);
  }

  // ── 等待挑战完成 ──
  console.error('[sdenv] 等待挑战完成...');

  await new Promise((resolve) => {
    const pollInterval = setInterval(() => {
      const ck = _cookieGet();
      if (ck && ck.includes('T0k1m0u5AfREP')) {
        console.error('[sdenv] ✅ P Cookie 已生成!');
        clearInterval(pollInterval);
        clearTimeout(timeout);
        resolve();
      }
    }, 300);

    const timeout = setTimeout(() => {
      console.error('[sdenv] ⏰ 等待超时');
      clearInterval(pollInterval);
      resolve();
    }, 20000);
  });

  // ── 结果 ──
  try { window.close(); } catch(e) {}

  const hasP = !!_cookieStore['T0k1m0u5AfREP'];
  const hasO = !!_cookieStore['T0k1m0u5AfREO'];

  process.stdout.write(JSON.stringify({
    success: hasP,
    cookies: { ..._cookieStore },
    error: hasP ? null : hasO ? 'O Cookie 存在但未生成 P Cookie' : '未生成任何瑞数 Cookie',
    nsd: ts.nsd || window.$_ts?.nsd,
  }));
  setTimeout(() => process.exit(0), 300);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    success: false, cookies: {}, error: err.message,
  }));
  setTimeout(() => process.exit(1), 300);
});
