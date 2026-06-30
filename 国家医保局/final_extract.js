/**
 * Final extraction: patch app.js AND inject hooks BEFORE app.js runs
 * Captures: SM4 key, SM2 private key, x-tif-signature input
 */
const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, 'config', 'app.js');
let source = fs.readFileSync(APP_JS, 'utf-8');

// Patch 1: export sm-crypto from module "68b2"
const pattern = `_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };`;
const idx = source.indexOf(pattern);
if (idx < 0) { console.error('Pattern not found'); process.exit(1); }

// Add: window.__nhsa_crypto + hook via defineProperty to work with getters
const insert = `;window.__nhsa_crypto={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};
(function(){var om=_0x1c05ff;var oe=om.encrypt;Object.defineProperty(om,'encrypt',{value:function(p,k,o){window.__k=k;window.__kp=p;window.__ko=JSON.stringify(o);return oe.call(this,p,k,o);},configurable:true,writable:true});var oms=_0x48bced;var os=oms.doSignature;if(os){Object.defineProperty(oms,'doSignature',{value:function(m,pk,op){window.__sk=pk;window.__sm=m;return os.call(this,m,pk,op);},configurable:true,writable:true});}})();`;

const patched = source.substring(0, idx + pattern.length) + insert + source.substring(idx + pattern.length);

console.error(`[final] Patched, size: ${(patched.length/1024/1024).toFixed(1)}MB`);

// ===========================================================
// jsdom
// ===========================================================
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const crypto = require('crypto');

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
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); }

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

console.error('[final] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error('\n=== RESULTS ===\n');

    // SM4 key
    const sm4Key = win.__k;
    const sm4Plain = win.__kp;
    const sm4Opts = win.__ko;
    console.error(`SM4 key: ${sm4Key}`);
    console.error(`SM4 plaintext: ${sm4Plain}`);
    console.error(`SM4 opts: ${sm4Opts}`);

    // SM2 key
    const sm2Key = win.__sk;
    const sm2Msg = win.__sm;
    console.error(`\nSM2 privKey: ${sm2Key}`);
    console.error(`SM2 message (first 200): ${(sm2Msg||'').substring(0,200)}`);

    // Captured request
    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        const ts = captured.headers['x-tif-timestamp'];
        console.error(`\nCaptured:`);
        console.error(`  sig: ${sig}`);
        console.error(`  ts: ${ts}`);
        console.error(`  nonce: ${captured.headers['x-tif-nonce']}`);
        console.error(`  body: ${captured.body.substring(0,400)}`);

        // Verify SM4 key: encrypt the plaintext and compare with captured encData
        if (sm4Key) {
            const body = JSON.parse(captured.body);
            const encData = body.data.data.encData;

            // Use the hook to call the original encrypt
            try {
                const origEnc = win.__nhsa_crypto.sm4.encrypt;
                // The hook might be broken since we wrapped it
                // Let's compute manually
            } catch(e) {}

            console.error(`\n  encData from request: ${encData}`);
            console.error(`  SM4 key: ${sm4Key}`);

            // Try encrypting the same plaintext with the key
            const testEnc = require('sm-crypto').sm4.encrypt(sm4Plain, sm4Key, {mode:'cbc', iv:'00000000000000000000000000000000'});
            console.error(`  Test encrypt: ${testEnc}`);
            console.error(`  Match: ${testEnc.toUpperCase() === encData.toUpperCase()}`);
        }
    }

    // Verify x-tif-signature
    // The sig input might be derivable from sm4 key + body
    if (captured && sm4Key) {
        const sig = captured.headers['x-tif-signature'];
        const ts = captured.headers['x-tif-timestamp'];
        const body = captured.body;
        const inner = JSON.parse(body).data;

        // Try: SHA256 of SM4 plaintext + timestamp
        const candidate1 = sm4Plain + ts;
        console.error(`\nSHA256 test candidates:`);
        console.error(`  SHA256(sm4Plain+ts): ${crypto.createHash('sha256').update(candidate1).digest('hex')} ${crypto.createHash('sha256').update(candidate1).digest('hex') === sig ? 'MATCH!' : ''}`);

        // Try the Body without signData
        const innerNoSign = {...inner};
        delete innerNoSign.signData;
        const bodyNoSign = JSON.stringify({data: innerNoSign});
        console.error(`  SHA256(bodyNoSign): ${crypto.createHash('sha256').update(bodyNoSign).digest('hex')}`);

        // Try SM4 key as part of signature input
        const candidate2 = sm4Key + ts + innerNoSign;
        console.error(`  SHA256(sm4Key+ts+innerNoSign): ${crypto.createHash('sha256').update(candidate2).digest('hex')}`);
    }

    // Test sm3
    const sm3 = win.__nhsa_crypto.sm3;
    if (sm3 && sm3.default) {
        try {
            const h = sm3.default('test');
            console.error(`\nsm3.default("test"): ${h}`);
        } catch(e) {}
    }

    process.exit(0);
}, 10000);

setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 35000);
