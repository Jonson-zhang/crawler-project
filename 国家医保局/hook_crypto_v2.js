/**
 * 国家医保局 — Hook v2: 更精确地捕获 SHA256 输入
 * 直接 hook 所有可能调用 hash 的函数
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
let appSource = fs.readFileSync(APP_JS, 'utf-8');

// Global capture
global.__hashes = [];
global.__sm4_calls = [];
global.__sm2_calls = [];

// ===========================================================
// Hook injection
// ===========================================================

const HOOKS = `
(function() {
    // Hook 1: Wrap String constructor to capture all string building
    var _origString = String;
    // Track which strings get passed to functions that look like hash implementations

    // Hook 2: More precise charCodeAt tracking
    var _origCCA = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function(idx) {
        var result = _origCCA.apply(this, arguments);
        var self = this.toString();
        if (idx === 0 && self.length > 50 && (
            self.indexOf('T98HPCGN') >= 0 ||
            self.indexOf('SM4') >= 0 ||
            self.indexOf('encData') >= 0 ||
            self.indexOf('timestamp') >= 0
        )) {
            window.__nhsa_processed_strings = window.__nhsa_processed_strings || [];
            window.__nhsa_processed_strings.push(self);
        }
        return result;
    };

    // Hook 3: Track all binary operations on strings
    var _origPlus = '';
    // Actually, we can't hook + operator. Let's track all function calls that receive strings

    window.__nhsa_processed_strings = [];
    window.__nhsa_hooks2_installed = true;
})();
`;

const dom = new JSDOM(`<html><body><div id="app"></div><script>${HOOKS}</script></body></html>`, {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
});
const win = dom.window;

// Simple env
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
            global.__finalRequest = {
                url: _url,
                headers: Object.assign({}, headers),
                body: typeof body === 'string' ? body : '',
            };
        }
        os.call(this, body);
    };
    return xhr;
};

// ===========================================================
// Hack: inject a SHA256 wrapper that logs all inputs
// ===========================================================
// The app.js likely has a custom SHA256 implementation.
// We'll search for it in the global scope after loading.

console.error('[hook] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = appSource;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    const req = global.__finalRequest;
    if (!req) {
        console.error('No request captured!');
        process.exit(0);
    }

    const sig = req.headers['x-tif-signature'];
    const ts = req.headers['x-tif-timestamp'];
    const nonce = req.headers['x-tif-nonce'];
    const body = req.body;

    console.error(`Signature: ${sig}`);
    console.error(`Timestamp: ${ts}`);
    console.error(`Nonce: ${nonce}`);
    console.error(`Body: ${body.substring(0, 400)}`);

    // Processed strings
    const strs = win.__nhsa_processed_strings || [];
    console.error(`\nProcessed strings: ${strs.length}`);
    strs.forEach((s, i) => {
        console.error(`  [${i}] (${s.length}c): ${s.substring(0, 300)}`);
    });

    // Now try to brute force: hash ALL processed strings
    console.error(`\n=== Brute forcing SHA256 against processed strings ===`);
    for (const s of strs) {
        const h = crypto.createHash('sha256').update(s).digest('hex');
        if (h === sig) {
            console.error(`\n*** MATCH! SHA256 of string [${s.length}c]:`);
            console.error(`    ${s}`);
        }
    }

    // Try SM3
    console.error(`\n=== Trying SM3 ===`);
    try {
        const sm3 = require('sm-crypto').sm3;
        for (const s of strs) {
            const h = sm3(s);
            if (h === sig) {
                console.error(`\n*** SM3 MATCH! Input:`);
                console.error(`    ${s}`);
            }
        }
    } catch(e) {
        console.error(`SM3 not available: ${e.message}`);
    }

    // Try variations: with & without key field, with nonce, etc.
    console.error(`\n=== Trying variations of captured strings ===`);

    // The captured string pattern (from v1): appCode=T98HPCGN5...&data={}&encType=SM4&signType=SM2&timestamp=...&version=1.0.0&key=...
    // Let's rebuild it with the actual timestamp
    const appCode = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
    const pubKey = 'NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P';

    const variations = [
        `appCode=${appCode}&data={}&encType=SM4&signType=SM2&timestamp=${ts}&version=1.0.0&key=${pubKey}`,
        `appCode=${appCode}&data={}&encType=SM4&signType=SM2&timestamp=${ts}&version=1.0.0`,
        `appCode=${appCode}&encType=SM4&signType=SM2&timestamp=${ts}&version=1.0.0&key=${pubKey}`,
        `appCode=${appCode}&timestamp=${ts}&version=1.0.0&key=${pubKey}`,
        // Without key
        `appCode=${appCode}&data={}&encType=SM4&signType=SM2&timestamp=${ts}&version=1.0.0&key=`,
        // Try different data values
        `appCode=${appCode}&data=${encodeURIComponent(body)}&encType=SM4&signType=SM2&timestamp=${ts}&version=1.0.0&key=${pubKey}`,
        // URL-encoded
        `appCode=${encodeURIComponent(appCode)}&data=%7B%7D&encType=SM4&signType=SM2&timestamp=${ts}&version=1.0.0&key=${encodeURIComponent(pubKey)}`,
    ];

    for (const v of variations) {
        const h = crypto.createHash('sha256').update(v).digest('hex');
        if (h === sig) {
            console.error(`\n*** SHA256 MATCH! ***`);
            console.error(`Input: ${v}`);
        }
        // Also try SM3
        try {
            const sm3 = require('sm-crypto').sm3;
            const h3 = sm3(v);
            if (h3 === sig) {
                console.error(`\n*** SM3 MATCH! ***`);
                console.error(`Input: ${v}`);
            }
        } catch(e) {}
    }

    // Try: body itself
    console.error(`\n=== Trying body directly ===`);
    const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
    console.error(`SHA256(body): ${bodyHash} ${bodyHash === sig ? 'MATCH!' : ''}`);

    const innerBody = JSON.parse(body).data;
    const innerStr = JSON.stringify(innerBody);
    const innerHash = crypto.createHash('sha256').update(innerStr).digest('hex');
    console.error(`SHA256(inner): ${innerHash} ${innerHash === sig ? 'MATCH!' : ''}`);

    process.exit(0);
}, 8000);
