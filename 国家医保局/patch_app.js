/**
 * Patch app.js 在 sm-crypto 模块处插入 window.__nhsa_crypto 导出
 * 然后在 jsdom 中加载 patched app.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const PATCHED_JS = path.join(__dirname, 'config', 'app_patched.js');

// Read beautified source
let source = fs.readFileSync(APP_JS, 'utf-8');
console.error(`[patch] Original size: ${(source.length/1024/1024).toFixed(1)}MB`);

// The sm-crypto module (id "68b2") exports via:
// _0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };
// We need to ADD: window.__nhsa_crypto = { sm2: ..., sm3: ..., sm4: ... };
// right AFTER this line.

// Patch 1: the sm-crypto aggregator module "68b2"
// Export { sm2, sm3, sm4 } to window
const pattern = `_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };`;
const idx = source.indexOf(pattern);

// Patch 2: the full SM2 module "4d09"
// Has generateKeyPairHex, doSignature, etc.
const pattern2 = `_0x1e473b[_0x302d81(0x254e)] = {`;
const idx2 = source.indexOf(pattern2);

if (idx < 0 || idx2 < 0) {
    console.error(`[patch] Patterns not found! idx=${idx}, idx2=${idx2}`);
    process.exit(1);
}

console.error(`[patch] Pattern 1 (68b2) found at offset ${idx}`);
console.error(`[patch] Pattern 2 (4d09) found at offset ${idx2}`);

// Read context of pattern 2 to find the full export
let sm2Full = source.substring(idx2, idx2 + 500);
console.error(`[patch] Pattern 2 context: ${sm2Full.substring(0, 200)}`);

// For pattern 1: add window export
const insert1 = ` window.__nhsa_crypto = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff }; window.__nhsa_crypto_source = '68b2';`;
const endLine1 = idx + pattern.length;

// For pattern 2: find where the export object closes
const exportStart = idx2 + pattern2.length;
const exportEnd = source.indexOf('};', exportStart);
if (exportEnd < 0) {
    console.error('[patch] Could not find end of pattern 2 export');
    process.exit(1);
}
const exportObj = source.substring(exportStart, exportEnd + 2);
console.error(`[patch] Pattern 2 export: ${exportObj.substring(0, 200)}`);

// Build patched source
const insert2 = ` window.__nhsa_sm2_full = ${exportObj}; window.__nhsa_sm2_full_source = '4d09';`;
const afterExport2 = exportEnd + 2; // after the '};'

// Apply patches (order matters: patch the later position first)
let patched = source;
patched = patched.substring(0, afterExport2) + insert2 + patched.substring(afterExport2);
// pattern 1 position shifted by insert2 length
const idx1_adjusted = afterExport2 < idx ? idx + insert2.length : idx;
patched = patched.substring(0, idx1_adjusted + pattern.length) + insert1 + patched.substring(idx1_adjusted + pattern.length);

console.error(`[patch] Patched size: ${(patched.length/1024/1024).toFixed(1)}MB`);

// Save patched version
fs.writeFileSync(PATCHED_JS, patched);
console.error('[patch] Saved to config/app_patched.js');

// Now test it
console.error('\n[test] Loading patched app.js in jsdom...');

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
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

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {
    console.error(`[test] Error: ${e.message}`);
}

setTimeout(() => {
    console.error('\n=== TEST RESULTS ===');

    // Check crypto
    const crypto = win.__nhsa_crypto;
    if (crypto) {
        console.error('*** SM-CRYPTO EXPORTED SUCCESSFULLY! ***');
        console.error(`Source module: ${win.__nhsa_crypto_source}`);
        console.error(`sm2 functions: ${Object.keys(crypto.sm2).filter(k=>typeof crypto.sm2[k]==='function').join(', ')}`);
        console.error(`sm3: ${typeof crypto.sm3}`);
        console.error(`sm4 functions: ${Object.keys(crypto.sm4).filter(k=>typeof crypto.sm4[k]==='function').join(', ')}`);

        // sm3 might be accessed differently (has 'default' property)
        const sm3func = typeof crypto.sm3 === 'function' ? crypto.sm3 :
                        (crypto.sm3.default ? crypto.sm3.default : crypto.sm3);
        console.error(`sm3 (resolved): ${typeof sm3func}`);

        // Test SM4 with different key format
        try {
            // SM4 key is typically a hex string
            const enc = crypto.sm4.encrypt('test123456', '00000000000000000000000000000000', {
                mode: 'cbc', iv: '00000000000000000000000000000000'
            });
            console.error(`\nSM4 encrypt("test123456"): "${enc}"`);
        } catch(e) {
            console.error(`SM4 error: ${e.message} (stack: ${e.stack})`);
        }

        // Try SM3
        if (typeof sm3func === 'function') {
            try {
                const h = sm3func('test');
                console.error(`\nSM3("test"): ${h}`);
            } catch(e) {
                console.error(`SM3 error: ${e.message}`);
            }
        }
    }

    // Check sm2_full module
    const sm2full = win.__nhsa_sm2_full;
    if (sm2full) {
        console.error(`\n*** SM2 FULL EXPORTED! ***`);
        console.error(`Source: ${win.__nhsa_sm2_full_source}`);
        console.error(`Functions: ${Object.keys(sm2full).join(', ')}`);

        if (typeof sm2full.generateKeyPairHex === 'function') {
            try {
                const kp = sm2full.generateKeyPairHex();
                console.error(`\nSM2 KeyPair:`);
                console.error(`  publicKey: ${kp.publicKey}`);
                console.error(`  privateKey: ${kp.privateKey.substring(0,32)}...`);
            } catch(e) {
                console.error(`generateKeyPairHex error: ${e.message}`);
            }
        }

        if (typeof sm2full.doSignature === 'function') {
            try {
                // Try signing with appCode as private key
                const privKey = Buffer.from('T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ', 'ascii').toString('hex');
                const sig = sm2full.doSignature('test message', privKey, { hash: true });
                console.error(`\nSM2 doSignature test: ${sig}`);
            } catch(e) {
                console.error(`doSignature error: ${e.message}`);
            }
        }
    } else {
        console.error('SM-CRYPTO NOT FOUND');
    }

    // Check captured request
    if (captured) {
        console.error(`\nCaptured request:`);
        console.error(`  URL: ${captured.url}`);
        console.error(`  sig: ${captured.headers['x-tif-signature']}`);
        console.error(`  ts: ${captured.headers['x-tif-timestamp']}`);
        console.error(`  nonce: ${captured.headers['x-tif-nonce']}`);
    }

    process.exit(0);
}, 10000);

// Safety timeout
setTimeout(() => {
    console.error('[test] FATAL timeout');
    process.exit(1);
}, 35000);
