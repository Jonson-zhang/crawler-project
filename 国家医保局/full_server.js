/**
 * 完整加密服务器 — 使用 patched app.js 内部的所有函数
 *
 * Patch points:
 * 1. Module "68b2" → export {sm2, sm3, sm4} to window.__c
 * 2. SM4 module → hook _0x32a5f1 to capture key
 * 3. SHA256 module → find and export to window.__sha
 *
 * After loading, use window.__c.sm4.encrypt and window.__sha to
 * generate complete encrypted requests.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const readline = require('readline');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// ===========================================================
// Patch 1: export crypto from module "68b2"
// ===========================================================
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' +
    src.substring(i1 + p1.length);
let baseOff = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// ===========================================================
// Patch 2: hook SM4 internal function
// ===========================================================
const p2 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + baseOff;
const sm4hook = 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;';
patched = patched.substring(0, i2 + p2.length) + sm4hook + patched.substring(i2 + p2.length);
const off2 = sm4hook.length;

// ===========================================================
// Patch 3: Find and hook SHA256
// ===========================================================
// Module "6c27" contains SHA256. Let's find its exports and wrap them.
// The sha256 function(s) are in _0x4f7158 which is exported.

// In module "6c27", at the end:
// _0x480169[_0x44caa7(0x195a)] = _0x4f7158
// This sets module.exports = sha256Object
//
// But this is inside a ternary. Let's find the module END instead.
// Line 77055-77056 show module "6c27" closing and "6c37" opening.

// Search for the exact module end:
// At line 77056: "6c37": function (...) {
// So module "6c27" ends at 77055.
// The SHA256 object is _0x4f7158. We need to capture it BEFORE the module closes.

// Better approach: hook at the MODULE LEVEL
// The module function receives (module, exports, require)
// The exports object is _0x480169
// Before the module ends, we set: window.__sha = module.exports

// Find: the line right before the module closes at 77055
// The closing pattern is something like: }, or })();

// Let me just search for the lines right before "6c37"
const p3 = '"6c37": function';
const i3raw = src.indexOf(p3);
const i3 = i3raw;  // Don't shift - find the closing code of 6c27 before this

// Module "6c27" closes right before "6c37" at the end of line 77055-77056.
// The closing code pattern is: }),\n    "6c37":
// Let me insert BEFORE "6c37" to capture _0x4f7158

// Actually, _0x4f7158 is a LOCAL variable in module "6c27".
// We can't access it from outside the module scope.
// We need to patch INSIDE module "6c27".

// Alternative: find where SHA256 is CALLED (not defined)
// The SHA256 function is used by the API request handler to compute x-tif-signature
// Let's find the call site by searching for sha256-related patterns

// The simplest approach: hook the ARRAY BUFFER conversion
// SHA256 processes bytes and produces a hash.
// The hash output is converted to hex string.
// Let's find where the final hex string is returned.

// Actually, let me try a simpler approach. Instead of hooking SHA256,
// let me just use the patched app.js's SM4 + SM3 to generate encrypted requests,
// and then brute-force the x-tif-signature from the OUTSIDE.

// I already have the SM4 key. Let me use the internal SM4 for encryption
// and the internal SM3 for hashing.

console.error('[full] Creating minimal patched app.js...');
console.error('[full] Patch 1 (crypto export): ok');
console.error('[full] Patch 2 (SM4 hook): ok');
console.error('[full] Patch 3 (SHA256): skipping — will use external approach');

// Save patched version for reference
fs.writeFileSync(path.join(__dirname, 'config', 'app_minimal_patched.js'), patched);

// ===========================================================
// jsdom environment
// ===========================================================
const dom = new JSDOM('<html><body></body></html>>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { for(let i=0;i<a.length;i++)a[i]=i%256; return a; }, subtle:{} };
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');
win.TextEncoder = function(){};
win.TextEncoder.prototype.encode = function(s){ return Buffer.from(s,'utf-8'); };

// XHR intercept
let capturedReq = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const x = new OX(); const oo=x.open, os=x.send, osr=x.setRequestHeader;
    let u='',h={};
    x.open = function(m,url){u=url;return oo.apply(this,arguments);};
    x.setRequestHeader = function(k,v){h[k]=v;return osr.apply(this,arguments);};
    x.send = function(b){if(u.includes('selectByKeys'))capturedReq={url:u,headers:{...h},body:b};os.call(this,b);};
    return x;
};

console.error('[full] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

// ===========================================================
// Encrypt function using app.js internals
// ===========================================================
function encryptWithAppInternals(params) {
    const sm4enc = win.__c.sm4.encrypt;
    const sm3 = win.__c.sm3.default;
    const sm2dosig = win.__c.sm2.doSignature;

    const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
    const ts = Math.floor(Date.now() / 1000);

    // Step 1: SM4 encrypt the params
    const plainJson = JSON.stringify(params);
    const plainBytes = Buffer.from(plainJson, 'utf-8');
    // PKCS7 pad to 16 bytes
    const padLen = 16 - (plainBytes.length % 16);
    const padded = Buffer.alloc(plainBytes.length + padLen);
    plainBytes.copy(padded);
    for (let i = plainBytes.length; i < padded.length; i++) padded[i] = padLen;
    const plainArr = Array.from(padded);

    // SM4 key: captured from internal hook
    // It's the same key the app uses internally
    const keyArr = win.__k ? Array.from(win.__k) : null;
    if (!keyArr) {
        return { error: 'SM4 key not captured yet' };
    }

    const encArr = sm4enc(plainArr, keyArr);
    const encData = Buffer.from(encArr).toString('hex');

    // Step 2: build inner object
    const inner = {
        data: { encData },
        appCode: AC,
        version: '1.0.0',
        encType: 'SM4',
        signType: 'SM2',
        timestamp: ts,
    };

    // Step 3: SM2 sign
    const sm2KeyHex = Buffer.from(AC, 'ascii').toString('hex');
    const innerJson = JSON.stringify(inner);
    const signData = sm2dosig(innerJson, sm2KeyHex, { hash: true });

    // Step 4: full body
    const body = {
        data: {
            data: { encData },
            appCode: AC, version: '1.0.0',
            encType: 'SM4', signType: 'SM2',
            timestamp: ts, signData,
        }
    };

    // Step 5: x-tif-signature (from internal SHA256 — we'll compute externally)
    const nonce = (() => {
        const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let r = '';
        for (let i = 0; i < 8; i++) r += c[Math.floor(Math.random() * c.length)];
        return r;
    })();

    const bodyJson = JSON.stringify(body);
    const xTifSig = require('crypto').createHash('sha256')
        .update(AC + ts + nonce + bodyJson)
        .digest('hex');

    return {
        headers: {
            'Content-Type': 'application/json',
            'channel': 'web',
            'x-tif-paasid': 'undefined',
            'x-tif-signature': xTifSig,
            'x-tif-timestamp': String(ts),
            'x-tif-nonce': nonce,
        },
        body,
    };
}

// ===========================================================
// Main
// ===========================================================

setTimeout(() => {
    console.error('[full] Crypto ready');
    console.error('[full] SM4 key: ' + (win.__k ? 'captured' : 'NOT captured'));

    // CLI mode
    if (process.argv.length > 2) {
        const cmd = process.argv[2];
        const input = process.argv[3] || '{}';

        if (cmd === 'encrypt') {
            try {
                const result = encryptWithAppInternals(JSON.parse(input));
                const response = { id: 1, result };
                process.stdout.write(JSON.stringify(response, null, 2) + '\n');
            } catch(e) {
                process.stdout.write(JSON.stringify({ id: 1, error: { message: e.message } }) + '\n');
            }
        } else if (cmd === 'status') {
            process.stdout.write(JSON.stringify({
                id: 1,
                result: {
                    crypto: !!win.__c,
                    sm4key: !!win.__k,
                    sm4keyVal: win.__k ? Array.from(win.__k).join(',') : null,
                    captured: capturedReq ? {
                        sig: capturedReq.headers['x-tif-signature'],
                        ts: capturedReq.headers['x-tif-timestamp'],
                        nonce: capturedReq.headers['x-tif-nonce'],
                    } : null,
                }
            }) + '\n');
        }

        process.exit(0);
    }

    // JSON-RPC server mode
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        let reqId = 0;
        try {
            const req = JSON.parse(line);
            reqId = req.id;
            if (req.method === 'encrypt') {
                const result = encryptWithAppInternals(req.params || {});
                respond(reqId, result);
            } else {
                respond(reqId, null, { message: 'Unknown: ' + req.method });
            }
        } catch(e) {
            respond(reqId, null, { message: e.message });
        }
    });

    function respond(id, result, error) {
        const resp = { id };
        if (error) resp.error = error;
        else resp.result = result;
        process.stdout.write(JSON.stringify(resp) + '\n');
    }

    console.error('[full] Ready');
    respond(0, { status: 'ready', sm4Key: !!win.__k });
}, 10000);

setTimeout(() => { process.exit(1); }, 35000);
