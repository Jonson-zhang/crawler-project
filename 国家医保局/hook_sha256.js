/**
 * Hook SHA256 at module-export level to capture ALL calls
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto from 68b2
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let off = 0;
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' +
    src.substring(i1 + p1.length);
off += ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// Patch 2: export all modules
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + off;
const ins2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"]),';
patched = patched.substring(0, i2 + p2.length) + ins2 + patched.substring(i2 + p2.length);
off += ins2.length;

// Patch 3: hook SHA256 in module 21bf
// After module 21bf returns (line 3671), wrap all SHA functions
// Module 21bf exports: _0x5b865d["exports"] = _0x31bc86 (CryptoJS namespace)
// But the function names (SHA256, HmacSHA256) are set by _createHelper earlier
// _createHelper creates wrappers like:
//   function(msg, key) { return new Algo.init(key).finalize(msg); }
//
// Instead of patching the source, let's hook AFTER all chunks are loaded
// The webpack bootstrap loads modules sequentially, then webpackJsonp loads async chunks
// All encryption calls happen AFTER init

// Better approach: patch at the VERY END of the IIFE - after all modules register
// The last module in the list triggers the application init
// Let's find the final line of the webpack bootstrap and inject there

// Actually, the simplest: the webpack runtime calls modules in order,
// and modules that register themselves (like the request interceptor)
// are called via webpackJsonp push for lazy chunks or inline for entry chunks.
// The entry chunk loads the request interceptor which then hooks XHR.

// Let me patch at the END of the webpack bootstrap, right after ALL modules are processed.
// The last line of the file is approximately at the end.

// Find: the final call that starts the app
// After the module definitions, there's a chunk loading mechanism
const lastLine = src.length - 100;
// The last meaningful JS code in the file should be around here
// Let me find the pattern: })([function(...)])  (the main IIFE call)

// Actually, let me just patch app.js source at line 14618 (the location.replace call)
// to suppress the redirect error, and hook setRequestHeader directly

// Simplest approach: don't patch source at all.
// After loading, wrap _m21bf.SHA256 to capture calls BEFORE triggering XHR
// The selectByKeys request happens during init, so we need to hook BEFORE loading.
// Solution: pre-inject a script that polls for _m21bf and wraps it immediately.

const HOOK_INJECT = `
(function() {
    var _tid = setInterval(function() {
        if (window._m21bf && window._m21bf.SHA256 && !window._m21bf._hooked) {
            window._m21bf._hooked = true;
            clearInterval(_tid);

            // Helper: CryptoJS WordArray to hex
            window._wa2hex = function(wa) {
                var w = wa.words, s = wa.sigBytes, h = '';
                for (var i = 0; i < s; i++) {
                    h += ('0' + ((w[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff).toString(16)).slice(-2);
                }
                return h;
            };

            // Wrap SHA256
            var _orig = window._m21bf.SHA256;
            window._m21bf.SHA256 = function(msg, cfg) {
                var result = _orig.call(this, msg, cfg);
                window.__sha_calls = window.__sha_calls || [];
                window.__sha_calls.push({
                    msg_type: typeof msg,
                    msg_len: typeof msg === 'string' ? msg.length : (msg ? msg.sigBytes : 0),
                    msg_preview: typeof msg === 'string' ? msg.substring(0, 500) : 'CryptoJS:' + (msg ? msg.sigBytes : 0) + 'B',
                    result_hex: window._wa2hex(result),
                    stack: new Error().stack.split('\\\\n').slice(1, 6).join(' | '),
                });
                window.__sha_last = window.__sha_calls[window.__sha_calls.length - 1];
                return result;
            };

            // Also wrap HmacSHA256
            if (window._m21bf.HmacSHA256) {
                var _origHmac = window._m21bf.HmacSHA256;
                window._m21bf.HmacSHA256 = function(msg, key) {
                    var result = _origHmac.call(this, msg, key);
                    window.__hmac_calls = window.__hmac_calls || [];
                    window.__hmac_calls.push({
                        msg_preview: typeof msg === 'string' ? msg.substring(0, 200) : 'bytes',
                        key_preview: typeof key === 'string' ? key.substring(0, 100) : 'bytes',
                        result_hex: window._wa2hex(result),
                    });
                    return result;
                };
            }
        }
    }, 5);
})();
`;

// ===========================================================
// jsdom
// ===========================================================
const dom = new JSDOM(`<html><body><div id="app"></div><script>${HOOK_INJECT}</script></body></html>`, {
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

// XHR intercept
let captured = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function (b) {
        if (u.includes('selectByKeys') || u.includes('queryFixedHospital')) {
            captured = { url: u, headers: { ...h }, body: b };
        }
        os.call(this, b);
    };
    return x;
};

console.error('[hook] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    // Check SHA calls
    const shaCalls = win.__sha_calls || [];
    console.error(`SHA256 calls captured: ${shaCalls.length}`);

    shaCalls.forEach((c, i) => {
        console.error(`\n  [${i}] len=${c.msg_len} result=${c.result_hex}`);
        console.error(`       msg: ${c.msg_preview.substring(0, 200)}`);
    });

    // HMAC calls
    const hmacCalls = win.__hmac_calls || [];
    console.error(`\nHMAC calls captured: ${hmacCalls.length}`);
    hmacCalls.forEach((c, i) => {
        console.error(`  [${i}] result=${c.result_hex} msg=${c.msg_preview.substring(0, 100)} key=${c.key_preview}`);
    });

    // Check captured request
    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        console.error(`\n=== Captured x-tif-signature: ${sig} ===`);

        // Find which SHA call produced this signature
        for (const c of shaCalls) {
            if (c.result_hex === sig) {
                console.error(`\n*** FOUND! SHA256 call [${shaCalls.indexOf(c)}] produces x-tif-signature! ***`);
                console.error(`    Input type: ${c.msg_type}`);
                console.error(`    Input length: ${c.msg_len}`);
                console.error(`    Input: ${c.msg_preview}`);
                console.error(`    Call stack: ${c.stack}`);
            }
        }
        for (const c of hmacCalls) {
            if (c.result_hex === sig) {
                console.error(`\n*** FOUND! HMAC call [${hmacCalls.indexOf(c)}] produces x-tif-signature! ***`);
                console.error(`    Input: ${c.msg_preview}`);
                console.error(`    Key: ${c.key_preview}`);
            }
        }
    }

    // Output JSON for downstream
    console.log(JSON.stringify({
        shaCalls: shaCalls.length,
        hmacCalls: hmacCalls.length,
        captured: captured ? {
            sig: captured.headers['x-tif-signature'],
            ts: captured.headers['x-tif-timestamp'],
            nonce: captured.headers['x-tif-nonce'],
        } : null,
    }));

    process.exit(0);
}, 10000);

setTimeout(() => { process.exit(1); }, 35000);
