/**
 * 国家医保局 — 运行时 Hook 加密函数
 * ===================================
 *
 * 策略: 在 jsdom 中，通过 Proxy 和函数包装 hook 所有可能的加密入口:
 *   1. Hook Uint8Array(16) 构造函数 → 捕获 SM4 密钥
 *   2. Hook String 操作 → 捕获 SHA256 输入拼接
 *   3. Hook sm4.encrypt, sm2.doSignature, sm3
 *
 * 用法: node hook_crypto_runtime.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

let appSource = fs.readFileSync(APP_JS, 'utf-8');
console.error(`[hook] app.js loaded: ${(appSource.length/1024/1024).toFixed(1)}MB`);

// ===========================================================
// Inject hooks BEFORE app.js runs, via prepended script
// ===========================================================

const HOOKS = `
(function() {
    // ===================================================
    // Hook 1: Uint8Array constructor → capture SM4 key
    // ===================================================
    var _Uint8Array = Uint8Array;
    window.Uint8Array = function() {
        var arr = new _Uint8Array(...arguments);
        if (arguments.length === 1 && typeof arguments[0] === 'number' && arguments[0] === 16) {
            window.__nhsa_u8_16_count = (window.__nhsa_u8_16_count || 0) + 1;
            // Override fill to capture the actual data
            var _fill = arr.fill;
            var _set = arr.set;
            arr.fill = function(val) {
                window.__nhsa_u8_fill = {
                    val: val,
                    stack: new Error().stack.split('\\\\n').slice(1,6).join(' | '),
                };
                return _fill.apply(this, arguments);
            };
            arr.set = function(data) {
                if (data.length === 16) {
                    var hex = '';
                    for (var i = 0; i < data.length; i++) hex += ('0' + data[i].toString(16)).slice(-2);
                    window.__nhsa_sm4_key_candidates = window.__nhsa_sm4_key_candidates || [];
                    window.__nhsa_sm4_key_candidates.push({
                        hex: hex,
                        ascii: String.fromCharCode.apply(null, data),
                        stack: new Error().stack.split('\\\\n').slice(1,8).join(' | '),
                    });
                }
                return _set.apply(this, arguments);
            };
        }
        return arr;
    };
    Uint8Array.prototype = _Uint8Array.prototype;

    // ===================================================
    // Hook 2: All String concatenations → find sig input
    // ===================================================
    var _origStringConcat = String.prototype.concat;
    String.prototype.concat = function() {
        var result = _origStringConcat.apply(this, arguments);
        var full = this.toString() + Array.from(arguments).join('');
        if (full.length > 50 && full.length < 10000 &&
            (full.indexOf('T98HPCGN') >= 0 || full.indexOf('SM4') >= 0)) {
            window.__nhsa_concat_captures = window.__nhsa_concat_captures || [];
            window.__nhsa_concat_captures.push({
                len: full.length,
                preview: full.substring(0, 300),
            });
        }
        return result;
    };

    // ===================================================
    // Hook 3: String.prototype.charCodeAt - trace signature hashing
    // ===================================================
    var _origCCA = String.prototype.charCodeAt;
    window.__nhsa_string_stream = '';
    String.prototype.charCodeAt = function(idx) {
        if (idx === 0 && this.length > 50) {
            // Record the start of processing a new string
            if (window.__nhsa_string_stream.length > 0 &&
                window.__nhsa_string_stream.indexOf('T98HPCGN') >= 0) {
                window.__nhsa_sig_input_candidates = window.__nhsa_sig_input_candidates || [];
                window.__nhsa_sig_input_candidates.push(window.__nhsa_string_stream);
            }
            window.__nhsa_string_stream = this.toString();
        }
        return _origCCA.apply(this, arguments);
    };

    // ===================================================
    // Hook 4: console.log → maybe used by debugging code
    // ===================================================
    if (!window._nhsa_console_ready) {
        var _origLog = console.log;
        console.log = function() {
            var msg = Array.from(arguments).join(' ');
            window.__nhsa_console = window.__nhsa_console || [];
            window.__nhsa_console.push(msg.substring(0, 200));
            _origLog.apply(console, arguments);
        };
        window._nhsa_console_ready = true;
    }

    // ===================================================
    // Hook 5: Track hex → byte conversions (for SM4 key)
    // ===================================================
    var _origFromCharCode = String.fromCharCode;
    String.fromCharCode = function() {
        var args = Array.from(arguments);
        var result = _origFromCharCode.apply(String, args);
        if (args.length === 16 && args.every(function(a) { return a >= 0 && a < 256; })) {
            window.__nhsa_fromCharCode16 = window.__nhsa_fromCharCode16 || [];
            window.__nhsa_fromCharCode16.push({
                bytes: args,
                result: result,
                stack: new Error().stack.split('\\\\n').slice(1,5).join(' | '),
            });
        }
        return result;
    };

    window.__nhsa_hooks_installed = true;
})();
`;

// ===========================================================
// jsdom
// ===========================================================

const dom = new JSDOM(`<html><body><div id="app"></div><script>${HOOKS}</script></body></html>`, {
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
    subtle: {},
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };

// XHR intercept
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', headers = {};
    xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function(body) {
        if (_url.includes('selectByKeys') || _url.includes('queryFixedHospital')) {
            console.error(`\n[XHR] ${_url}`);
            console.error(`[XHR] Headers:`);
            for (const [k, v] of Object.entries(headers)) {
                console.error(`  ${k}: ${v}`);
            }
            console.error(`[XHR] Body: ${(body||'').substring(0, 500)}`);
            win.__nhsa_final_request = { url: _url, headers: {...headers}, body };
        }
        os.call(this, body);
    };
    return xhr;
};

// Load app.js
console.error('[hook] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = appSource;
try { win.document.body.appendChild(script); } catch(e) {
    console.error(`[hook] Error: ${e.message}`);
}

// Wait and analyze
setTimeout(() => {
    console.error('\n=== HOOK RESULTS ===\n');

    // SM4 key candidates
    const sm4Cands = win.__nhsa_sm4_key_candidates || [];
    console.error(`SM4 key candidates (Uint8Array(16).set): ${sm4Cands.length}`);
    sm4Cands.forEach((c, i) => {
        console.error(`  [${i}] hex: ${c.hex}  ascii: "${c.ascii}"`);
        console.error(`       stack: ${c.stack}`);
    });

    // Uint8Array(16) fill
    const u8Fill = win.__nhsa_u8_fill;
    if (u8Fill) {
        console.error(`\nUint8Array(16).fill value: ${u8Fill.val}`);
    }

    // fromCharCode(16 bytes)
    const fcc = win.__nhsa_fromCharCode16 || [];
    console.error(`\nString.fromCharCode(16 bytes): ${fcc.length}`);
    fcc.forEach((c, i) => {
        console.error(`  [${i}] bytes: ${JSON.stringify(c.bytes)} → "${c.result}"`);
    });

    // Signature input candidates
    const sigInputs = win.__nhsa_sig_input_candidates || [];
    console.error(`\nSig input candidates (from charCodeAt): ${sigInputs.length}`);
    sigInputs.forEach((s, i) => {
        console.error(`  [${i}] (${s.length} chars): ${s.substring(0, 200)}`);
    });

    // Concat captures
    const concats = win.__nhsa_concat_captures || [];
    console.error(`\nConcat captures (with T98HPCGN): ${concats.length}`);
    concats.forEach((c, i) => {
        console.error(`  [${i}] len=${c.len}: ${c.preview}`);
    });

    // Final request
    const req = win.__nhsa_final_request;
    if (req) {
        console.error(`\nFinal XHR:`);
        console.error(`  URL: ${req.url}`);
        console.error(`  x-tif-signature: ${req.headers['x-tif-signature']}`);
        console.error(`  x-tif-timestamp: ${req.headers['x-tif-timestamp']}`);
        console.error(`  x-tif-nonce: ${req.headers['x-tif-nonce']}`);
    }

    process.exit(0);
}, 8000);
