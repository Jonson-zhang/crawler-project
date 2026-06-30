/**
 * 国家医保局 — jsdom 加密服务器 (终极版)
 * =========================================
 *
 * 原理: jsdom 加载 patched app.js → 内部加密链完整运行 →
 * 直接调用内部 API service 生成加密请求。
 *
 * 关键突破:
 *   - 594个webpack模块全部导出到 window._mXXXX
 *   - SM4/SM2/SHA256 内部函数可直接调用
 *   - selectByKeys 请求正确生成 (含 x-tif-signature)
 *
 * 对于 queryFixedHospital:
 *   通过 webpack require 获取 API service → 直接调用
 *
 * 用法:
 *   node server.js
 *   (JSON-RPC over stdin/stdout)
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const readline = require('readline');

const APP_JS = path.join(__dirname, 'config', 'app.js');

function log(msg) { process.stderr.write('[server] ' + msg + '\n'); }

// ============================================================
// Init: patch + load app.js
// ============================================================

let _win = null;
let _sm4Key = null;
let _internalSm4 = null;
let _internalSm2 = null;
let _internalSha256 = null;

function wa2hex(wa) {
    if (typeof wa === 'string') return wa;
    if (!wa || !wa.words) return '';
    const w = wa.words, s = wa.sigBytes;
    let h = '';
    for (let i = 0; i < s; i++) h += ('0' + ((w[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff).toString(16)).slice(-2);
    return h;
}

function init() {
    if (_win) return Promise.resolve();

    return new Promise((resolve) => {
        let src = fs.readFileSync(APP_JS, 'utf-8');

        // Use proper offset tracking for multiple patches
        const patches = [];

        function addPatch(pattern, insertCode) {
            const pos = src.indexOf(pattern);
            if (pos < 0) throw new Error('Pattern not found: ' + pattern.substring(0, 50));
            patches.push({ pos, insert: insertCode, pattern });
        }

        addPatch('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
            ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};');

        addPatch('(_0x1210ab["l"] = !0x0),',
            '(window["_m"+_0x518e77]=_0x1210ab["exports"]),');

        addPatch('function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {',
            'window.__k=_0x1a6c05;window.__kp=_0x2e1290;');

        // Sort and apply
        patches.sort((a, b) => a.pos - b.pos);
        let patched = src;
        let cumOff = 0;
        for (const p of patches) {
            const ap = p.pos + cumOff;
            patched = patched.substring(0, ap + p.pattern.length) +
                p.insert + patched.substring(ap + p.pattern.length);
            cumOff += p.insert.length;
        }

        log('Loading patched app.js (' + (patched.length / 1024 / 1024).toFixed(1) + 'MB)...');

        const dom = new JSDOM('<html><body></body></html>', {
            url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
            pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
        });
        const win = dom.window;
        win.crypto = {
            getRandomValues(a) { crypto.randomFillSync(a); return a; }, subtle: {}
        };
        win.btoa = s => Buffer.from(s, 'binary').toString('base64');
        win.atob = s => Buffer.from(s, 'base64').toString('binary');
        win.TextEncoder = function () { };
        win.TextEncoder.prototype.encode = s => Buffer.from(s, 'utf-8');

        // Capture the first encrypted request (selectByKeys, happens during init)
        let firstReq = null;
        const OX = win.XMLHttpRequest;
        win.XMLHttpRequest = function () {
            const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
            let u = '', h = {};
            x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
            x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
            x.send = function (b) {
                if (!firstReq && (u.includes('selectByKeys') || u.includes('queryFixedHospital'))) {
                    firstReq = { url: u, headers: { ...h }, body: typeof b === 'string' ? b : '' };
                }
                os.call(this, b);
            };
            return x;
        };

        const script = win.document.createElement('script');
        script.textContent = patched;
        try { win.document.body.appendChild(script); } catch (e) { }

        setTimeout(() => {
            _win = win;
            _sm4Key = win.__k;
            _internalSm4 = win.__c ? win.__c.sm4 : null;
            _internalSm2 = win.__c ? win.__c.sm2 : null;
            _internalSha256 = win._m21bf ? win._m21bf.SHA256 : null;

            log('SM4 key captured: ' + (_sm4Key ? 'yes' : 'NO'));
            log('Internal SM4: ' + (_internalSm4 ? 'yes' : 'NO'));
            log('Internal SM2: ' + (_internalSm2 ? 'yes' : 'NO'));
            log('Internal SHA256: ' + (_internalSha256 ? 'yes' : 'NO'));
            log('First XHR captured: ' + (firstReq ? firstReq.url : 'NONE'));

            _win.__firstReq = firstReq;
            resolve();
        }, 5000);
    });
}

// ============================================================
// Encrypt: generate encrypted request (SM4 + SM2 + x-tif-sig)
// ============================================================

function encrypt(params) {
    const win = _win;
    if (!win) throw new Error('Not initialized');

    const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
    const VERSION = '1.0.0';
    const ts = Math.floor(Date.now() / 1000);
    const nonce = (() => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let r = '';
        for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
        return r;
    })();

    // Step 1: SM4 encrypt using internal SM4
    const plainJson = JSON.stringify(params);
    const plainBytes = Buffer.from(plainJson, 'utf-8');
    const padLen = 16 - (plainBytes.length % 16);
    const padded = Buffer.alloc(plainBytes.length + padLen);
    plainBytes.copy(padded);
    for (let i = plainBytes.length; i < padded.length; i++) padded[i] = padLen;
    const plainArr = Array.from(padded);

    // Internal SM4 key captured from runtime
    const keyArr = _sm4Key ? Array.from(_sm4Key) : null;
    if (!keyArr) throw new Error('SM4 key not captured');

    const encArr = _internalSm4.encrypt(plainArr, keyArr);
    const encData = Buffer.from(encArr).toString('hex');

    // Step 2: SM2 sign using internal SM2
    const inner = {
        data: { encData },
        appCode: AC, version: VERSION,
        encType: 'SM4', signType: 'SM2', timestamp: ts,
    };
    const sm2KeyHex = Buffer.from(AC, 'ascii').toString('hex');
    const signData = _internalSm2.doSignature(JSON.stringify(inner), sm2KeyHex, { hash: true });

    // Step 3: Build body
    const body = {
        data: {
            data: { encData },
            appCode: AC, version: VERSION,
            encType: 'SM4', signType: 'SM2',
            timestamp: ts, signData,
        }
    };
    const bodyJson = JSON.stringify(body);

    // Step 4: x-tif-signature
    // Formula: SHA256(AC + ts + nonce + bodyJson) — using internal SHA256
    const sigInput = AC + ts + nonce + bodyJson;
    const xTifSig = _internalSha256 ? wa2hex(_internalSha256(sigInput)) :
        crypto.createHash('sha256').update(sigInput).digest('hex');

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
            sm4key: Array.from(_sm4Key).map(b => String.fromCharCode(b)).join(''),
            sm2key: sm2KeyHex,
            sigInput: sigInput.substring(0, 200),
        }
    };
}

// ============================================================
// JSON-RPC Server
// ============================================================

async function main() {
    await init();

    // CLI mode
    if (process.argv.length > 2) {
        const cmd = process.argv[2];
        const input = process.argv[3] || '{}';

        if (cmd === 'encrypt') {
            try {
                const result = encrypt(JSON.parse(input));
                console.log(JSON.stringify({ id: 1, result }, null, 2));
            } catch (e) {
                console.log(JSON.stringify({ id: 1, error: { message: e.message } }));
            }
        } else if (cmd === 'status') {
            console.log(JSON.stringify({
                id: 1,
                result: {
                    sm4Key: !!_sm4Key,
                    internalSm4: !!_internalSm4,
                    internalSm2: !!_internalSm2,
                    internalSha256: !!_internalSha256,
                    firstReq: _win.__firstReq ? {
                        url: _win.__firstReq.url,
                        sig: _win.__firstReq.headers['x-tif-signature'],
                    } : null,
                }
            }, null, 2));
        }
        process.exit(0);
    }

    // JSON-RPC stdin mode
    log('Ready for JSON-RPC');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
        let reqId = 0;
        try {
            const req = JSON.parse(line);
            reqId = req.id;
            const { method, params = {} } = req;
            if (method === 'encrypt') {
                respond(reqId, encrypt(params));
            } else if (method === 'ping') {
                respond(reqId, { pong: true });
            } else {
                respond(reqId, null, { message: 'Unknown: ' + method });
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
