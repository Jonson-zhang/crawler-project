/**
 * 提取加密模块 — 通过 hook webpack 的 window 导出
 *
 * webpack 在 window 上注册了一个数组 (如 webpackJsonp) 用于加载 chunk。
 * 模块加载时会通过这个数组的 push 方法加入新模块。
 *
 * 策略: hook window 上新增的数组对象的 push 方法
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

// ===========================================================
// 创建一个 wrapper: 在 app.js 执行之前扫描所有 window 属性，
// 然后 hook 新出现的数组的 push 方法
// ===========================================================

const HOOK_CODE = `
(function() {
    // 保存当前的 window keys
    var _beforeKeys = Object.keys(window);

    // 周期性检查是否有新的数组属性出现
    var _interval = setInterval(function() {
        var keys = Object.keys(window);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (_beforeKeys.indexOf(key) >= 0) continue;
            _beforeKeys.push(key);

            try {
                var val = window[key];
                if (Array.isArray(val) && !val.__nhsa_hooked) {
                    val.__nhsa_hooked = true;
                    window.__nhsa_wp_array_name = key;
                    window.__nhsa_wp_array = val;

                    // Hook push
                    var _origPush = val.push;
                    val.push = function(chunk) {
                        // chunk = [[chunkIds], {moduleId: function(module, exports, require) { ... }}]
                        if (chunk && chunk[1]) {
                            var modules = chunk[1];
                            window.__nhsa_modules = window.__nhsa_modules || {};
                            for (var modId in modules) {
                                if (modules.hasOwnProperty(modId)) {
                                    window.__nhsa_modules[modId] = modules[modId].toString();
                                }
                            }
                        }
                        val.__nhsa_chunks = val.__nhsa_chunks || [];
                        val.__nhsa_chunks.push(JSON.stringify(chunk).substring(0, 200));
                        return _origPush.call(this, chunk);
                    };
                }
            } catch(e) {}
        }
    }, 100);

    // Stop after 15 seconds
    setTimeout(function() { clearInterval(_interval); }, 15000);
})();
`;

const dom = new JSDOM(`<html><body><div id="app"></div><script>${HOOK_CODE}</script></body></html>`, {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
});
const win = dom.window;

win.crypto = {
    getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    subtle: {},
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');

console.error('[extract] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {
    console.error(`[extract] Error: ${e.message}`);
}

setTimeout(() => {
    console.error('\n=== EXTRACTION RESULTS ===');

    const wpName = win.__nhsa_wp_array_name;
    console.error(`Webpack array name: ${wpName}`);

    const modCount = Object.keys(win.__nhsa_modules || {}).length;
    console.error(`\nModules captured: ${modCount}`);

    // Show all module IDs
    const modIds = Object.keys(win.__nhsa_modules || {}).sort();
    console.error(`Module IDs (first 30): ${modIds.slice(0,30).join(', ')}`);

    // Find crypto-related modules
    console.error('\n=== Crypto-related modules ===');
    for (const [modId, source] of Object.entries(win.__nhsa_modules || {})) {
        if (typeof source !== 'string') continue;
        if (source.includes('sm2') || source.includes('sm4') ||
            source.includes('generateKeyPair') || source.includes('doSignature') ||
            source.includes('doEncrypt') || source.includes('x-tif-signature')) {
            console.error(`\n  Module ${modId} (${source.length} chars):`);
            console.error(`    ${source.substring(0, 300)}`);
        }
    }

    // Save all modules to file
    if (modCount > 0) {
        const savedModules = {};
        for (const [k, v] of Object.entries(win.__nhsa_modules || {})) {
            if (typeof v === 'string') savedModules[k] = v;
        }
        fs.writeFileSync(
            path.join(__dirname, 'config', 'extracted_modules.json'),
            JSON.stringify(savedModules, null, 2)
        );
        console.error(`\nSaved ${Object.keys(savedModules).length} modules to config/extracted_modules.json`);
    }

    process.exit(0);
}, 15000);
