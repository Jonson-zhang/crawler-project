/**
 * 提取 API Service — 通过 Proxy hook webpack require
 *
 * 策略:
 * 1. Hook Function.prototype.call 来拦截 webpack require 调用
 * 2. 当模块加载为 "68b2" 或相关模块时，捕获其 exports
 * 3. 所有模块加载后，遍历 module cache 找 API service
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const source = fs.readFileSync(APP_JS, 'utf-8');

// Patch 1: export crypto (as before)
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = source.indexOf(p1);
let patched = source.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";' +
    source.substring(i1 + p1.length);

// Patch 2: at the webpack bootstrap level, hook the internal require function
// In webpack, the internal require function is defined at the IIFE level
// The bootstrap calls this function to load all modules
// We need to find and hook it

// Webpack bootstrap pattern: function _0x476481(moduleId) { ... }
// This function is called for each module dependency
// It's at line 174 in the beautified source

// Let's patch the webpack require function directly
// Find: function _0x476481(_0x518e77)
const p2 = 'function _0x476481(_0x518e77){';
const i2raw = source.indexOf(p2);
if (i2raw >= 0) {
    // Insert after opening brace: capture this require function
    const insert2 = 'if(!window.__wp_r)window.__wp_r=_0x476481;';
    // Calculate offset from patch 1
    const off1 = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";'.length;
    const i2 = i2raw < i1 ? i2raw : i2raw + off1;
    patched = patched.substring(0, i2 + p2.length) + insert2 + patched.substring(i2 + p2.length);
    console.error('[patch] Webpack require hooked');
} else {
    console.error('[patch] Webpack require NOT found');
}

// jsdom
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const crypto = require('crypto');

win.crypto = { getRandomValues(a) {crypto.randomFillSync(a); return a;}, subtle:{} };
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');
win.TextEncoder = function(){};
win.TextEncoder.prototype.encode = s => Buffer.from(s,'utf-8');

console.error('[extract] Loading patched app.js...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {
    console.error('[extract] Error:', e.message);
}

setTimeout(() => {
    console.error('\n=== MODULE EXTRACTION ===');

    // Check if we have webpack require
    const wp_r = win.__wp_r;
    console.error('Webpack require captured:', !!wp_r);

    if (wp_r) {
        // Access module cache
        // webpack stores modules in: require.m (all module functions)
        // and require.c (installed modules)
        try {
            const m_count = Object.keys(wp_r.m || {}).length;
            const c_count = Object.keys(wp_r.c || {}).length;
            console.error(`Module registry: ${m_count} modules`);
            console.error(`Module cache: ${c_count} installed`);

            // Find SHA256 module
            for (const id of Object.keys(wp_r.c || {})) {
                try {
                    const exp = wp_r.c[id].exports;
                    if (exp && typeof exp === 'object') {
                        const keys = Object.keys(exp);
                        // Is this the SHA256 module?
                        if (keys.some(k => /sha|hash|hmac/i.test(k))) {
                            console.error(`\nSHA module at ${id}:`);
                            console.error(`  keys: ${keys.join(', ')}`);
                            win.__sha_module = exp;
                            win.__sha_module_id = id;
                        }
                        // Is this the API service?
                        if (keys.length >= 3 && keys.length <= 30 &&
                            (keys.includes('get') || keys.includes('post') || keys.includes('request') ||
                             keys.includes('interceptors'))) {
                            console.error(`\nAPI module at ${id}:`);
                            console.error(`  keys: ${keys.slice(0, 20).join(', ')}`);
                            win.__api_module = exp;
                            win.__api_module_id = id;
                        }
                    }
                } catch(e) {}
            }

            // Also scan m (module registry) for crypto-related functions
            console.error('\n=== Scanning m registry for crypto modules ===');
            for (const id of Object.keys(wp_r.m || {})) {
                const fnSrc = wp_r.m[id].toString();
                if (fnSrc.includes('x-tif-signature') || fnSrc.includes('signData') ||
                    fnSrc.includes('encData') || fnSrc.includes('sha256')) {
                    console.error(`  [${id}]: ${fnSrc.substring(0, 150)}`);
                }
            }
        } catch(e) {
            console.error('Module scan error:', e.message);
        }
    }

    // Show all window properties that might be API services
    console.error('\n=== Window property scan ===');
    const interestingKeys = Object.keys(win).filter(k => {
        try {
            const v = win[k];
            if (v && typeof v === 'object' && v !== win && !k.startsWith('_') && !k.startsWith('on')) {
                const ks = Object.keys(v);
                return ks.length >= 5 && ks.length <= 40 &&
                    (ks.includes('get') || ks.includes('post') || ks.includes('request'));
            }
        } catch(e) {}
        return false;
    });
    console.error('API-like window keys:', interestingKeys.join(', '));

    // Dump summary
    console.log(JSON.stringify({
        cryptoModule: win.__c_mod || null,
        shaModule: win.__sha_module_id || null,
        apiModule: win.__api_module_id || null,
        wp_r: !!win.__wp_r,
    }));

    process.exit(0);
}, 10000);

setTimeout(() => { process.exit(1); }, 35000);
