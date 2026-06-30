/**
 * 国家医保局 — 完整加密服务器 (使用 app.js 内部所有模块)
 * ==========================================================
 *
 * 加载 patched app.js → 导出所有 webpack 模块 → 直接调用内部函数
 *
 * 导出的关键模块:
 *   _m68b2: sm-crypto 聚合 {sm2, sm3, sm4}
 *   _m4d09: SM2 全套 {doSignature, doEncrypt, ...}
 *   _m21bf: SHA256 + HmacSHA256 (CryptoJS word array format)
 *   _me04e: SM4 {encrypt, decrypt}
 *   _mb50d: XHR 请求分发
 *   _m2444: axios 配置
 *
 * 用法:
 *   node nhsa_crypto_server.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const readline = require('readline');

const APP_JS = path.join(__dirname, 'config', 'app.js');

function log(msg) { process.stderr.write('[nhsa] ' + msg + '\n'); }

// ===========================================================
// Patch + Load app.js
// ===========================================================
let _initialized = false;
let _win = null;

function init() {
    return new Promise((resolve) => {
        if (_initialized) { resolve(); return; }

        let src = fs.readFileSync(APP_JS, 'utf-8');

        // Patch 1: export sm-crypto
        const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
        const i1 = src.indexOf(p1);
        const off1 = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";'.length;
        let patched = src.substring(0, i1 + p1.length) +
            ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";' +
            src.substring(i1 + p1.length);

        // Patch 2: capture all module exports
        const p2 = '(_0x1210ab["l"] = !0x0),';
        const i2raw = src.indexOf(p2);
        const insert2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"]),';
        const i2 = i2raw < i1 ? i2raw : i2raw + off1;
        patched = patched.substring(0, i2 + p2.length) + insert2 + patched.substring(i2 + p2.length);

        log('Loading patched app.js...');

        const dom = new JSDOM('<html><body></body></html>', {
            url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
            pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
        });
        const win = dom.window;
        win.crypto = { getRandomValues(a) { crypto.randomFillSync(a); return a; }, subtle: {} };
        win.btoa = s => Buffer.from(s, 'binary').toString('base64');
        win.atob = s => Buffer.from(s, 'base64').toString('binary');
        win.TextEncoder = function () { };
        win.TextEncoder.prototype.encode = s => Buffer.from(s, 'utf-8');

        const script = win.document.createElement('script');
        script.textContent = patched;
        try { win.document.body.appendChild(script); } catch (e) {}

        setTimeout(() => {
            _win = win;
            _initialized = true;

            log('Modules loaded: ' + Object.keys(win).filter(k => k.startsWith('_m')).length);
            log('Crypto exported: ' + !!win.__c);

            // Verify SHA256
            const sha = win._m21bf;
            if (sha) log('SHA256: ' + (sha.SHA256 ? 'ok' : 'missing'));

            // Verify SM4
            const sm4 = win._me04e;
            if (sm4) log('SM4: ' + (sm4.encrypt ? 'ok' : 'missing'));

            resolve();
        }, 5000);
    });
}

// ===========================================================
// Helper: convert CryptoJS word array → hex string
// ===========================================================
function wordArrayToHex(wa) {
    if (typeof wa === 'string') return wa;
    if (!wa || !wa.words || !wa.sigBytes) return String(wa);

    const words = wa.words;
    const sigBytes = wa.sigBytes;
    let hex = '';
    for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        hex += ('0' + byte.toString(16)).slice(-2);
    }
    return hex;
}

// ===========================================================
// Encrypt function — uses internal SM4 + SM2 + SHA256
// ===========================================================
function nhsaEncrypt(params) {
    const win = _win;
    if (!win) throw new Error('Not initialized');

    const sha256Mod = win._m21bf;     // { SHA256, HmacSHA256 }
    const sm4Mod = win._me04e;        // { encrypt, decrypt }
    const sm2Mod = win._m4d09;        // { doSignature, ... }
    const sm3Mod = win.__c.sm3;       // { default: sm3_func }

    const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
    const VERSION = '1.0.0';

    // Build encrypt parameters
    const keyword = params.keyword || '';
    const pageNum = params.pageNum || 1;
    const pageSize = params.pageSize || 10;
    const plainJson = JSON.stringify({ keyword, pageNum, pageSize });

    // Step 1: SM4 encrypt (using internal SM4 from app.js)
    // The internal SM4 takes plaintext as an array and key as a string
    // SM4 key = "C3AE5873D08418DA" (16 ASCII chars)
    const sm4KeyStr = 'C3AE5873D08418DA'; // captured from app.js runtime
    const plainBytes = Buffer.from(plainJson, 'utf-8');
    const padLen = 16 - (plainBytes.length % 16);
    const padded = Buffer.alloc(plainBytes.length + padLen);
    plainBytes.copy(padded);
    for (let i = plainBytes.length; i < padded.length; i++) padded[i] = padLen;
    const plainArr = Array.from(padded);

    // Use internal SM4 encrypt(array, key_string)
    const encArr = sm4Mod.encrypt(plainArr, sm4KeyStr);
    const encData = Buffer.from(encArr).toString('hex');

    // Step 2: SM2 sign
    const ts = Math.floor(Date.now() / 1000);
    const sm2KeyHex = Buffer.from(AC, 'ascii').toString('hex');
    const inner = {
        data: { encData },
        appCode: AC, version: VERSION,
        encType: 'SM4', signType: 'SM2',
        timestamp: ts,
    };
    const innerJson = JSON.stringify(inner);

    // Use internal SM2 doSignature
    const signData = sm2Mod.doSignature(innerJson, sm2KeyHex, { hash: true });

    // Build full body
    const body = {
        data: {
            data: { encData },
            appCode: AC, version: VERSION,
            encType: 'SM4', signType: 'SM2',
            timestamp: ts, signData,
        }
    };
    const bodyJson = JSON.stringify(body);

    // Step 3: x-tif-signature (using internal SHA256)
    // We DON'T know the exact formula yet, so we use the nonce-based signature
    // from the earlier working jsdom capture approach
    const nonce = (() => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let r = '';
        for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
        return r;
    })();

    // Compute SHA256 using internal CryptoJS SHA256
    // Internal SHA256 returns {words, sigBytes} — convert to hex
    const sigInput = AC + ts + nonce + bodyJson;
    const shaResult = sha256Mod.SHA256(sigInput);
    const xTifSig = wordArrayToHex(shaResult);

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
        _debug: {
            sm4key: sm4KeyStr,
            sm2key: sm2KeyHex,
            sigInput: sigInput.substring(0, 200),
            internalSha256: xTifSig,
        }
    };
}

// ===========================================================
// Also: capture XHR interceptor to get the REAL signature
// ===========================================================
let capturedRealReq = null;

function enableXhrCapture() {
    const win = _win;
    if (!win) return;

    // We need to monkey-patch XHR in the NOW-LOADED jsdom
    // But the app.js already created its XHR references...
    // Actually, since our jsdom hooks XHR BEFORE app.js loads,
    // any new XHR created by app.js goes through OUR constructor
    // But app.js loaded with the original XHR, so we need a different approach

    // Instead: use the ALREADY-CAPTURED selectByKeys request
    // which happened during app.js initialization

    // Check: did we capture any XHR during load?
    if (win.__nhsa_last_xhr) {
        capturedRealReq = win.__nhsa_last_xhr;
        log('Captured real request from init: sig=' + capturedRealReq.headers['x-tif-signature']);
    }
}

// ===========================================================
// CLI
// ===========================================================
async function main() {
    await init();

    if (process.argv.length > 2) {
        const cmd = process.argv[2];
        const input = process.argv[3] || '{}';

        if (cmd === 'encrypt') {
            try {
                const result = nhsaEncrypt(JSON.parse(input));
                process.stdout.write(JSON.stringify({ id: 1, result }, null, 2) + '\n');
            } catch (e) {
                process.stdout.write(JSON.stringify({ id: 1, error: { message: e.message } }) + '\n');
            }
        } else if (cmd === 'status') {
            const sha = _win._m21bf;
            process.stdout.write(JSON.stringify({
                id: 1,
                result: {
                    modulesLoaded: Object.keys(_win).filter(k => k.startsWith('_m')).length,
                    sha256: sha ? (typeof sha.SHA256 === 'function') : false,
                    internalShaHash: sha ? wordArrayToHex(sha.SHA256('test')) : null,
                    nodeShaHash: crypto.createHash('sha256').update('test').digest('hex'),
                }
            }, null, 2) + '\n');
        } else if (cmd === 'sha256') {
            // CLI tool: compute SHA256 using internal function
            const sha = _win._m21bf;
            if (sha) {
                const input = process.argv[3] || 'test';
                const result = sha.SHA256(input);
                const hex = wordArrayToHex(result);
                console.log('Input: ' + input);
                console.log('Internal SHA256: ' + hex);
                console.log('Node SHA256:    ' + crypto.createHash('sha256').update(input).digest('hex'));
                console.log('Match: ' + (hex === crypto.createHash('sha256').update(input).digest('hex')));
            }
        } else if (cmd === 'test_sm4') {
            // Test internal SM4 vs node sm-crypto
            const sm4Mod = _win._me04e;
            if (sm4Mod) {
                const key = 'C3AE5873D08418DA';
                const pt = Buffer.from('test123456789012');
                const arr = Array.from(pt);
                const enc = sm4Mod.encrypt(arr, key);
                const hex = Buffer.from(enc).toString('hex');
                console.log('Internal SM4: ' + hex);

                try {
                    const nodeEnc = require('sm-crypto').sm4.encrypt(
                        'test123456789012',
                        Buffer.from(key, 'ascii').toString('hex'),
                        { mode: 'cbc', iv: '00000000000000000000000000000000' }
                    );
                    console.log('Node SM4:    ' + nodeEnc);
                    console.log('Match: ' + (hex === nodeEnc));
                } catch (e) {
                    console.log('Node SM4 error: ' + e.message);
                }
            }
        }

        process.exit(0);
    }

    // JSON-RPC server mode
    log('Ready for JSON-RPC');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        let reqId = 0;
        try {
            const req = JSON.parse(line);
            reqId = req.id;
            if (req.method === 'encrypt') {
                respond(reqId, nhsaEncrypt(req.params || {}));
            } else if (req.method === 'ping') {
                respond(reqId, { pong: true });
            } else {
                respond(reqId, null, { message: 'Unknown: ' + req.method });
            }
        } catch (e) {
            respond(reqId, null, { message: e.message });
        }
    });

    function respond(id, result, error) {
        const resp = { id };
        if (error) resp.error = error;
        else resp.result = result;
        process.stdout.write(JSON.stringify(resp) + '\n');
    }

    respond(0, { status: 'ready' });
}

main().catch(e => { log('Fatal: ' + e.message); process.exit(1); });
