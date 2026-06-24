#!/usr/bin/env node
/**
 * ────────────────────────────────────────────────────────────
 *  第 1 层：RS6 Cookie 生成器（sdenv 环境）
 *
 *  依赖 sdenv（npm i sdenv）提供完整浏览器环境。
 *  sdenv = 反向的 env_framework — 它用 C++ V8 Addon 让 jsdom
 *  跑起来像真实浏览器，RS VM 在它里面"以为自己"在 Chrome 中执行。
 *
 *  输入(stdin JSON):  {"url":"https://...", "entryPath":"/zbxx/hwl.htm"}
 *  输出(stdout):      {"success":true, "cookies":"xxx", "error":null}
 * ────────────────────────────────────────────────────────────
 */
'use strict';
const { jsdomFromUrl } = require('sdenv');

// ── 读取 Python 传入的配置 ──
function readStdin() {
    return new Promise(r => {
        if (process.stdin.isTTY) { r(null); return; }
        let d = ''; process.stdin.setEncoding('utf-8');
        process.stdin.on('data', c => d += c);
        process.stdin.on('end', () => { try { r(JSON.parse(d)); } catch(e) { r(null); } });
        setTimeout(() => r(null), 2000);
    });
}

async function main() {
    const cfg = await readStdin() || {};
    const xurl = cfg.url || 'https://zbzx.lzjtu.edu.cn';
    const path = cfg.entryPath || '/zbxx/hwl.htm';
    const ua   = cfg.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    // ── sdenv 初始化浏览器环境 + 加载 412 页面 ──
    const dom = await jsdomFromUrl(xurl + path, {
        userAgent: ua,
        consoleConfig: { error: () => {} },
    });
    const { cookieJar, window } = dom;

    // ── 等待 RS VM 在 sdenv 中完成执行 ──
    //   RS VM 流程: 读取 $_ts 配置 → 采集环境指纹 (sdenv 提供)
    //   → Huffman+AES+CRC32 → Base64 → 写入 document.cookie
    //   → location.replace 跳转 → sdenv:exit 事件
    await new Promise(resolve => {
        window.addEventListener('sdenv:exit', () => resolve());
        window.addEventListener('sdenv:location.replace', () => {});
        setTimeout(resolve, 10000);   // 兜底：10 秒超时
    });

    // ── 提取 Cookie ──
    const cookies = cookieJar.getCookieStringSync(xurl);
    try { window.close(); } catch(e) {}

    process.stdout.write(JSON.stringify({
        success: !!cookies,
        cookies: cookies || null,
        error:   cookies ? null : 'sdenv 未生成有效 Cookie',
    }));
    setTimeout(() => process.exit(0), 300);
}

main().catch(err => {
    process.stdout.write(JSON.stringify({ success: false, cookies: null, error: err.message }));
    setTimeout(() => process.exit(1), 300);
});
