/**
 * 国家医保局 — 直接 hook hash 输出
 * Hook Array.prototype.join, String.prototype.toUpperCase 等
 * 来捕获 SHA256 hex 结果字符串
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

const HOOKS = `
(function() {
    // Hook: track what produces 64-char hex strings
    // SHA256/SM3 outputs 64 hex chars
    var _origJoin = Array.prototype.join;
    Array.prototype.join = function(sep) {
        var result = _origJoin.apply(this, arguments);
        if (result.length === 64 && /^[0-9a-f]{64}$/.test(result) && sep === '') {
            window.__nhsa_hash64 = window.__nhsa_hash64 || [];
            window.__nhsa_hash64.push({
                result: result,
                arrayLen: this.length,
                preview: this.slice(0, 8).map(function(b) {
                    return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join(''),
                stack: new Error().stack.split('\\\\n').slice(1,6).join(' | '),
            });
        }
        return result;
    };

    // Also hook String.fromCharCode with many args (byte array → string)
    var _origFromCharCodeApply = Function.prototype.apply;
    // Hook the hex string building: typically (b >>> 4).toString(16) + (b & 0xf).toString(16)
    var _origToString = Number.prototype.toString;
    Number.prototype.toString = function(radix) {
        var result = _origToString.apply(this, arguments);
        if (radix === 16 && result.length <= 2) {
            window.__nhsa_toHexCalls = (window.__nhsa_toHexCalls || 0) + 1;
        }
        return result;
    };

    // Hook: capture all array buffer/crypto operations
    var _origSlice = Array.prototype.slice;
    var _origCall = Function.prototype.call;

    window.__nhsa_hash64 = [];
    window.__nhsa_hooks_v3 = true;
})();
`;

const dom = new JSDOM(`<html><body><div id="app"></div><script>${HOOKS}</script></body></html>`, {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
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
win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };

// XHR intercept
let capturedReq = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', headers = {};
    xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function(body) {
        if (_url.includes('selectByKeys')) {
            capturedReq = { url: _url, headers: {...headers}, body };
        }
        os.call(this, body);
    };
    return xhr;
};

console.error('[hook] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    const hashes = win.__nhsa_hash64 || [];
    console.error(`Hash64 candidates: ${hashes.length}`);
    hashes.forEach((h, i) => {
        console.error(`\n  [${i}] hex: ${h.result}`);
        console.error(`       bytes: ${h.preview}... (${h.arrayLen} bytes)`);
        console.error(`       stack: ${h.stack}`);
    });

    const req = capturedReq;
    if (req) {
        console.error(`\n=== Target sig: ${req.headers['x-tif-signature']} ===`);
        // Check which hash64 matches
        for (const h of hashes) {
            if (h.result === req.headers['x-tif-signature']) {
                console.error(`\n*** FOUND! This 64-char hex matches x-tif-signature! ***`);
                console.error(`    Input was ${h.arrayLen}-byte array`);
                console.error(`    First 8 bytes: ${h.preview}`);
            }
        }
    }

    // Also scan for hash functions
    // Look for any function that returns 64-char hex strings
    const toHexCount = win.__nhsa_toHexCalls || 0;
    console.error(`\nNumber.toString(16) calls: ${toHexCount}`);

    // Try to list all 64-char hexes in window that could be hash outputs
    console.error('\nAll captured 64-char hexes:');
    hashes.forEach((h, i) => {
        console.error(`  ${i}: ${h.result} (${h.arrayLen}B input)`);
    });

    process.exit(0);
}, 8000);
