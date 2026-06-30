/**
 * Patch app.js to export sm-crypto, then hook SM4.encrypt to capture key
 */
const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, 'config', 'app.js');

let source = fs.readFileSync(APP_JS, 'utf-8');
console.error(`[patch] Size: ${(source.length/1024/1024).toFixed(1)}MB`);

// Patch 1: sm-crypto module "68b2" → export {sm2, sm3, sm4} globally
const pattern = `_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };`;
const idx = source.indexOf(pattern);
if (idx < 0) { console.error('Pattern not found!'); process.exit(1); }
console.error(`[patch] Found at offset ${idx}`);

const insert = ` window.__nhsa_crypto = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };`;
const patched = source.substring(0, idx + pattern.length) + insert + source.substring(idx + pattern.length);

console.error(`[patch] Patched size: ${(patched.length/1024/1024).toFixed(1)}MB`);

// ===========================================================
// jsdom test
// ===========================================================
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
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
let captured = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', headers = {};
    xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function(body) {
        if (_url.includes('selectByKeys') || _url.includes('queryFixedHospital')) {
            captured = { url: _url, headers: {...headers}, body };
        }
        os.call(this, body);
    };
    return xhr;
};

console.error('[test] Loading patched app.js...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    const crypto = win.__nhsa_crypto;
    console.error(crypto ? '*** CRYPTO EXPORTED! ***' : 'CRYPTO NOT FOUND');
    if (!crypto) { process.exit(1); }

    console.error(`sm2: ${Object.keys(crypto.sm2).filter(k=>typeof crypto.sm2[k]==='function').join(', ')}`);
    console.error(`sm3 type: ${typeof crypto.sm3}, keys: ${Object.keys(crypto.sm3 || {}).slice(0,5)}`);
    console.error(`sm4: ${Object.keys(crypto.sm4).filter(k=>typeof crypto.sm4[k]==='function').join(', ')}`);

    // Hook SM4.encrypt to capture the SM4 key
    const origEncrypt = crypto.sm4.encrypt;
    let sm4KeyCaptured = null;

    crypto.sm4.encrypt = function(plaintext, key, opts) {
        sm4KeyCaptured = { plaintext, key, opts: JSON.stringify(opts), stack: new Error().stack };
        // Also store in window
        win.__nhsa_sm4_key = key;
        win.__nhsa_sm4_opts = opts;
        return origEncrypt.apply(this, arguments);
    };

    // Also hook SM2.doSignature to capture signing key
    const origDoSig = crypto.sm2.doSignature;
    let sm2KeyCaptured = null;
    if (typeof origDoSig === 'function') {
        crypto.sm2.doSignature = function(msg, privKey, opts) {
            sm2KeyCaptured = { msg: msg.substring(0,200), privKey: privKey.substring(0,50), opts: JSON.stringify(opts) };
            win.__nhsa_sm2_privkey = privKey;
            return origDoSig.apply(this, arguments);
        };
    }

    // Check captured request
    if (captured) {
        console.error(`\nCaptured: sig=${captured.headers['x-tif-signature']}`);
        console.error(`ts=${captured.headers['x-tif-timestamp']}`);
        console.error(`nonce=${captured.headers['x-tif-nonce']}`);
        console.error(`body=${captured.body.substring(0,300)}`);
    }

    // Check captured keys
    if (sm4KeyCaptured) {
        console.error(`\nSM4 Key captured: ${sm4KeyCaptured.key}`);
        console.error(`SM4 plaintext: ${sm4KeyCaptured.plaintext}`);
        console.error(`SM4 opts: ${sm4KeyCaptured.opts}`);
    } else {
        console.error('\nSM4 key NOT captured (encrypt happened before hook?)');
        console.error(`Check window.__nhsa_sm4_key: ${win.__nhsa_sm4_key || 'null'}`);
    }

    if (sm2KeyCaptured) {
        console.error(`\nSM2 Key captured: ${sm2KeyCaptured.privKey}`);
    }

    // Try to call SM4 encrypt manually with the captured key
    if (win.__nhsa_sm4_key) {
        console.error(`\nTesting SM4 with captured key...`);
        try {
            const key = win.__nhsa_sm4_key;
            const testEnc = origEncrypt('test message', key, { mode: 'cbc', iv: '00000000000000000000000000000000' });
            console.error(`SM4("test message") = ${testEnc}`);
        } catch(e) {
            console.error(`Test error: ${e.message}`);
        }
    }

    process.exit(0);
}, 10000);

setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 35000);
