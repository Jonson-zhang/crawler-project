#!/usr/bin/env node
/**
 * 欧冶 RS6 Cookie 生成器（sdenv 精简版）
 *
 * sdenv = C++ V8 Addon + jsdom，内置完整浏览器 API。
 * RS6 VM 在 sdenv 中"以为是 Chrome"，无需手写原型链。
 *
 * 用法: node ouyeel_sdenv.js '{"url":"https://www.ouyeel.com","entryPath":"/steel"}'
 */

const { jsdomFromUrl } = require("../兰州交通大学/node_modules/sdenv");

async function main() {
    const cfg = JSON.parse(process.argv[2] || "{}");
    const xurl = cfg.url || "https://www.ouyeel.com";
    const path = cfg.entryPath || "/steel";
    const ua = cfg.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

    const dom = await jsdomFromUrl(xurl + path, {
        userAgent: ua,
        consoleConfig: { error: () => {} },
    });

    const { cookieJar, window } = dom;

    // 等待 RS VM 完成并触发 sdenv:exit
    await new Promise(resolve => {
        window.addEventListener("sdenv:exit", () => resolve());
        setTimeout(resolve, 15000);
    });

    const cookies = cookieJar.getCookieStringSync(xurl);
    try { window.close(); } catch (e) {}

    process.stdout.write(JSON.stringify({
        success: !!cookies && cookies.length > 100,
        cookies: cookies || null,
        error: cookies ? null : "sdenv 未生成有效 Cookie",
    }));
    setTimeout(() => process.exit(0), 300);
}

main().catch(err => {
    process.stdout.write(JSON.stringify({ success: false, cookies: null, error: err.message }));
    setTimeout(() => process.exit(1), 300);
});
