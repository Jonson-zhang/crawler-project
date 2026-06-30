/**
 * 国家医保局 — 提取 webpack 加密模块
 * =====================================
 *
 * 策略:
 *   1. 在 jsdom 中 patch app.js 的 webpack bootstrap
 *   2. 每个 webpack 模块加载时记录其源码和 ID
 *   3. 筛选出与加密相关的模块 (sm2/sm3/sm4/x-tif-signature)
 *   4. 提取为独立可运行 bundle
 *
 * 用法: node extract_modules.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

// ===========================================================
// 1. Patch webpack bootstrap to capture modules
// ===========================================================

// 记录所有 webpack 模块: { moduleId: { source, exports, callCount } }
const moduleRegistry = {};

// The patch code that gets injected at the START of the webpack bootstrap
// We need to find the __webpack_require__ function and hook its internal module loader

const PATCH = `
(function() {
    // Store a reference to the original Object.defineProperty for webpack exports
    var _origDefineProperty = Object.defineProperty;

    // Hook: capture all module source code
    // Webpack modules are functions of the form:
    //   function(module, exports, __webpack_require__) { ... }
    // The module function itself is stored in __webpack_require__.m or similar

    // We'll hook function calls to capture module execution
    var _origCall = Function.prototype.call;
    var _origApply = Function.prototype.apply;

    // More reliable: hook the JSONP callback that webpack uses to register chunks
    var webpackJsonp = window.webpackJsonp || [];
    var _origPush = webpackJsonp.push;
    webpackJsonp.push = function(chunk) {
        // chunk[0] = chunk IDs, chunk[1] = modules: {moduleId: function(module, exports, require) {...}}
        var modules = chunk[1];
        if (modules) {
            window.__moduleCount = window.__moduleCount || 0;
            for (var modId in modules) {
                if (modules.hasOwnProperty(modId)) {
                    var fn = modules[modId];
                    window.__moduleCount++;
                    // Store module source
                    if (fn && fn.toString().length > 200) {
                        window['__mod_' + modId] = fn.toString().substring(0, 3000);
                    }
                    // Wrap the module function to trace its execution
                    var origFn = fn;
                    modules[modId] = function(module, exports, require) {
                        window.__moduleExecuted = window.__moduleExecuted || {};
                        window.__moduleExecuted[modId] = true;
                        return origFn.call(this, module, exports, require);
                    };
                }
            }
        }
        return _origPush.call(this, chunk);
    };

    // Also hook standard webpack JSONP array push (for lazy-loaded chunks)
    // webpack 4/5 uses window["webpackJsonp"] = [] and overrides its push
    window._webpack_modules = {};
})();
`;

// ===========================================================
// 2. jsdom environment
// ===========================================================

// First, let's modify app.js to inject our patch at the right place
// We need to patch it AFTER the webpackJsonp array is initialized but BEFORE modules are loaded

// Read app.js, find the pattern of webpackJsonp.push override
let appSource = fs.readFileSync(APP_JS, 'utf-8');
console.error(`[extract] Original app.js size: ${(appSource.length/1024/1024).toFixed(1)}MB`);

// The webpackJsonp variable is typically: _0x2e1850 / _0x15536f etc.
// Let's just inject our hook globally via jsdom's beforeParse

const dom = new JSDOM(`<html><body><div id="app"></div>
<script>${PATCH}</script>
</body></html>`, {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
});
const win = dom.window;

// 环境补丁
win.crypto = {
    getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    subtle: {
        digest(algo, data) {
            // Capture SHA256 calls
            const dataStr = Buffer.from(data).toString('binary');
            const result = require('crypto').createHash('sha256').update(data).digest();
            global.__digestCalls = global.__digestCalls || [];
            global.__digestCalls.push({
                algo: JSON.stringify(algo),
                dataLen: data.byteLength,
                dataPreview: dataStr.substring(0, 200),
                result: result.toString('hex'),
            });
            return Promise.resolve(new Uint8Array(result).buffer);
        },
    },
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };

// ===========================================================
// 3. Load app.js
// ===========================================================

console.error('[extract] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = appSource;
try { win.document.body.appendChild(script); } catch(e) {
    console.error(`[extract] Error: ${e.message}`);
}

// ===========================================================
// 4. Extract results
// ===========================================================

setTimeout(() => {
    const modCount = win.eval('window.__moduleCount') || 0;
    console.error(`\n[extract] === RESULTS ===`);
    console.error(`[extract] Modules captured: ${modCount}`);

    // List all captured modules
    const modules = {};
    // Scan window for __mod_XXX properties
    const winKeys = Object.keys(win);
    for (const key of winKeys) {
        if (key.startsWith('__mod_')) {
            const modId = key.replace('__mod_', '');
            const source = win[key];
            modules[modId] = source;
        }
    }

    console.error(`[extract] Captured ${Object.keys(modules).length} module sources`);

    // Find encryption-related modules
    const cryptoModules = [];
    for (const [modId, source] of Object.entries(modules)) {
        if (typeof source !== 'string') continue;
        const lower = source.toLowerCase();
        if (lower.includes('sm2') || lower.includes('sm4') || lower.includes('sm3') ||
            lower.includes('x-tif-signature') || lower.includes('encdata') ||
            lower.includes('signData') || lower.includes('generatekeypair') ||
            lower.includes('doencrypt') || lower.includes('dosignature') ||
            lower.includes('appcode') || lower.includes('signtype')) {
            cryptoModules.push({ modId, source: source.substring(0, 500) });
            console.error(`\n  [${modId}] crypto-related module:`);
            console.error(`    ${source.substring(0, 300)}`);
        }
    }
    console.error(`\n[extract] Crypto-related modules: ${cryptoModules.length}`);

    // Also scan the full app.js source for the x-tif-signature generation
    // The module that computes the signature will have a pattern like:
    // x-tif-signature + sha256 + (appCode + timestamp + nonce + ...)
    // Let's find it in our captured modules

    // Check the execute list
    const executed = win.eval('window.__moduleExecuted') || {};
    const execMods = Object.keys(executed);
    console.error(`\n[extract] Executed modules: ${execMods.length}`);

    // The webpack bootstrap might use a different pattern
    // Let's also check what webpackJsonp array looks like
    const wpj = win.eval('JSON.stringify(window.webpackJsonp).substring(0, 200)');
    console.error(`\n[extract] webpackJsonp: ${wpj}`);

    // Check for modules saved by our hook
    const wpm = win.eval(`
        (function() {
            var result = {};
            for (var k in window) {
                if (k.startsWith('_webpack_') || k.startsWith('__webpack_')) {
                    result[k] = typeof window[k];
                }
            }
            return JSON.stringify(result);
        })()
    `);
    console.error(`[extract] Webpack globals: ${wpm}`);

    // Save all captured modules to file
    const captureData = {
        totalModules: modCount,
        capturedSources: Object.keys(modules).length,
        cryptoModules: cryptoModules.map(m => ({ id: m.modId, preview: m.source })),
        moduleIds: Object.keys(modules),
        timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
        path.join(__dirname, 'config', 'modules_capture.json'),
        JSON.stringify(captureData, null, 2)
    );
    console.error(`\n[extract] Saved to config/modules_capture.json`);

    // Also output all modules for analysis
    let fullModules = '';
    for (const [modId, source] of Object.entries(modules)) {
        fullModules += `// ======== MODULE ${modId} ========\n${source}\n\n`;
    }
    if (fullModules.length > 0) {
        fs.writeFileSync(
            path.join(__dirname, 'config', 'all_modules.js'),
            fullModules
        );
        console.error(`[extract] Saved ${Object.keys(modules).length} modules to config/all_modules.js`);
    }

    process.exit(0);
}, 6000);
