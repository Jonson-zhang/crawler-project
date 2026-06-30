/**
 * 导出 webpack 模块缓存中所有感兴趣的 exports
 * 通过在 jsdom 中执行 app.js 后，直接遍历 _0x4ea056
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
let src = fs.readFileSync(APP_JS, 'utf-8');

// Patch 1: export crypto
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
const off1 = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";'.length;
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";' +
    src.substring(i1 + p1.length);

// Patch 2: at the END of the webpack require function, add module capture
// After line 180: (_0x1210ab["l"] = !0x0),
// We add: window['_m'+_0x518e77]=_0x1210ab.exports;

const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
if (i2raw < 0) {
    console.error('p2 not found in beautified source');
    // Try alternative: search for l = !0x0 pattern
    const alt = src.indexOf('["l"] = !0x0),');
    if (alt >= 0) {
        console.error('Found alt at', alt);
    }
    process.exit(1);
}

const insert2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"]),';
const i2 = i2raw < i1 ? i2raw : i2raw + off1;
patched = patched.substring(0, i2 + p2.length) + insert2 + patched.substring(i2 + p2.length);

console.error('[patch] Patch 1: crypto export (offset ' + i1 + ')');
console.error('[patch] Patch 2: module capture (offset ' + i2raw + ')');

// jsdom
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const crypto = require('crypto');

win.crypto = { getRandomValues(a) { crypto.randomFillSync(a); return a; }, subtle: {} };
win.btoa = s => Buffer.from(s, 'binary').toString('base64');
win.atob = s => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function () { };
win.TextEncoder.prototype.encode = s => Buffer.from(s, 'utf-8');

// XHR capture
let captured = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function (b) {
        if (u.includes('selectByKeys')) captured = { url: u, headers: { ...h }, body: b };
        os.call(this, b);
    };
    return x;
};

console.error('[export] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) {
    console.error('Load error:', e.message);
}

setTimeout(() => {
    console.error('\n=== EXPORTED MODULES ===');

    // Scan window for _mXXXX keys
    const modKeys = Object.keys(win).filter(k => k.startsWith('_m'));
    console.error(`Found ${modKeys.length} module exports on window`);

    // Find interesting modules
    const interesting = [];
    for (const k of modKeys) {
        const modId = k.substring(2); // Remove '_m' prefix
        try {
            const exp = win[k];
            if (exp && typeof exp === 'object') {
                const keys = Object.keys(exp);
                const fnKeys = keys.filter(kk => typeof exp[kk] === 'function');

                let score = 0;
                // Score based on interesting properties
                if (fnKeys.includes('get') || fnKeys.includes('post') || fnKeys.includes('request')) score += 10;
                if (keys.includes('interceptors')) score += 10;
                if (keys.includes('defaults')) score += 5;
                if (keys.some(kk => /sha|hash|hmac/i.test(kk))) score += 10;
                if (keys.some(kk => /encrypt|decrypt|sign/i.test(kk) && typeof exp[kk] === 'function')) score += 8;
                if (keys.length >= 2 && keys.length <= 30 && fnKeys.length >= 2) score += 3;

                if (score > 0 || fnKeys.length >= 3) {
                    interesting.push({
                        id: modId,
                        keys: keys,
                        functions: fnKeys,
                        score: score,
                    });
                }
            }
        } catch (e) { }
    }

    // Sort by score
    interesting.sort((a, b) => b.score - a.score);

    console.error('\n=== INTERESTING MODULES (top 20) ===');
    interesting.slice(0, 20).forEach(m => {
        console.error(`  [${m.id}] score=${m.score} keys(${m.keys.length}): ${m.keys.join(', ')}`);
        console.error(`    functions: ${m.functions.join(', ')}`);
    });

    // Specifically show SHA256-related
    console.error('\n=== SHA/HASH MODULES ===');
    for (const k of modKeys) {
        const exp = win[k];
        if (exp && typeof exp === 'object') {
            const keys = Object.keys(exp);
            if (keys.some(kk => /sha|hash|hmac|digest/i.test(kk))) {
                const modId = k.substring(2);
                console.error(`  [${modId}]: ${keys.join(', ')}`);
                // Store reference
                win.__sha_module = exp;
                win.__sha_module_id = modId;
            }
        }
    }

    // Show API service modules
    console.error('\n=== API SERVICE MODULES ===');
    for (const k of modKeys) {
        const exp = win[k];
        if (exp && typeof exp === 'object') {
            const keys = Object.keys(exp);
            const fnKeys = keys.filter(kk => typeof exp[kk] === 'function');
            if (fnKeys.includes('get') || fnKeys.includes('post') || fnKeys.includes('request')) {
                const modId = k.substring(2);
                console.error(`  [${modId}]: keys=${keys.join(', ')}`);
                win.__api = exp;
                win.__api_id = modId;
            }
        }
    }

    // Try to call API service
    if (win.__api) {
        console.error(`\n=== Trying API service [${win.__api_id}] ===`);
        const api = win.__api;

        // Check what methods are available
        const methods = Object.keys(api).filter(k => typeof api[k] === 'function');
        console.error(`Methods: ${methods.join(', ')}`);

        // Try calling with queryFixedHospital
        if (api.get) {
            try {
                console.error('Calling api.get({type: "queryFixedHospital"})...');
                // This will likely trigger XHR, which we intercept
            } catch (e) {
                console.error('API call error:', e.message);
            }
        }
    }

    // Check captured request
    if (captured) {
        console.error('\n=== CAPTURED XHR ===');
        console.error('URL:', captured.url);
        console.error('x-tif-signature:', captured.headers['x-tif-signature']);
        console.error('x-tif-timestamp:', captured.headers['x-tif-timestamp']);
        console.error('x-tif-nonce:', captured.headers['x-tif-nonce']);
        console.error('Body preview:', captured.body.substring(0, 300));
    }

    // Output JSON summary
    console.log(JSON.stringify({
        totalModules: modKeys.length,
        interesting: interesting.slice(0, 30).map(m => ({
            id: m.id, keys: m.keys, functions: m.functions
        })),
        captured: captured ? {
            sig: captured.headers['x-tif-signature'],
            ts: captured.headers['x-tif-timestamp'],
            nonce: captured.headers['x-tif-nonce'],
        } : null,
    }, null, 2));

    process.exit(0);
}, 10000);

setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 35000);
