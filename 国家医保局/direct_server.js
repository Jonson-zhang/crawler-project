/**
 * 直接加密服务器 — 利用 jsdom 里的完整加密链路
 *
 * 策略: 模拟 Vue 组件的数据变化来触发生成 queryFixedHospital 请求
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const readline = require('readline');

function log(msg) { process.stderr.write('[direct] ' + msg + '\n'); }

// ============================================================
// Init
// ============================================================
let _win = null, _ready = false;

function init() {
    if (_win) return Promise.resolve();

    return new Promise((resolve) => {
        let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

        // Patches with proper offset tracking
        const patches = [];
        function addPatch(pattern, insert) {
            const pos = src.indexOf(pattern);
            if (pos >= 0) patches.push({ pos, insert, plen: pattern.length });
        }

        // Export all modules + crypto + hook SM4
        addPatch('(_0x1210ab["l"] = !0x0),',
            '(window["_m"+_0x518e77]=_0x1210ab["exports"]),');
        addPatch('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
            ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";');
        addPatch('function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {',
            'window.__k=_0x1a6c05;window.__kp=_0x2e1290;');

        // Also hook the REQUEST INTERCEPTOR to capture how x-tif-signature is set
        // The interceptor at line 24596 calls transformRequest which generates the signature
        // But we need to find transformRequest (module a63)

        // Sort by position
        patches.sort((a, b) => a.pos - b.pos);

        let patched = src;
        let off = 0;
        for (const p of patches) {
            const ap = p.pos + off;
            patched = patched.substring(0, ap + p.plen) +
                p.insert + patched.substring(ap + p.plen);
            off += p.insert.length;
        }

        log('Loading patched app.js (' + (patched.length / 1024 / 1024).toFixed(1) + 'MB)...');

        const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
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

        // Hook XHR send to intercept ALL encrypted requests
        // Instead of trying to generate them, we INTERCEPT the ones the app creates
        const OX = win.XMLHttpRequest;
        win.XMLHttpRequest = function () {
            const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
            let u = '', h = {};
            x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
            x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
            x.send = function (b) {
                // Store ALL encrypted requests (not just selectByKeys)
                if (u.includes('/api/')) {
                    win.__all_requests = win.__all_requests || [];
                    win.__all_requests.push({
                        url: u,
                        headers: { ...h },
                        body: typeof b === 'string' ? b : '',
                        time: Date.now(),
                    });
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
            _ready = true;

            log('SM4 key captured: ' + (win.__k ? 'yes' : 'NO'));
            log('All XHR captured: ' + (win.__all_requests || []).length);

            if (win.__all_requests) {
                win.__all_requests.forEach((r, i) => {
                    log('  [' + i + '] ' + r.url + ' sig=' + r.headers['x-tif-signature']);
                });
            }

            resolve();
        }, 5000);
    });
}

// ============================================================
// Encrypt: try to trigger queryFixedHospital via Vue
// ============================================================
function encryptViaVue(params) {
    return new Promise((resolve, reject) => {
        const win = _win;
        if (!win) return reject(new Error('Not initialized'));

        const keyword = params.keyword || '医院';
        const pageNum = params.pageNum || 1;
        const pageSize = params.pageSize || 10;

        // Clear previous requests
        win.__all_requests = [];

        // Strategy 1: try Vue eventBus
        const bus = win.__vueEventBus;
        if (bus) {
            log('Trying Vue event bus...');
            // Try various event names that might trigger search
            const eventNames = ['search', 'query', 'searchMedical', 'handleSearch', 'searchData',
                'onSearch', 'doSearch', 'queryData', 'fetchData'];
            for (const name of eventNames) {
                try {
                    bus.$emit(name, { keyword, pageNum, pageSize });
                } catch (e) { }
            }
        }

        // Strategy 2: find the axios instance and call it directly
        // Scan window for the API service
        try {
            for (const k of Object.keys(win)) {
                if (!k.startsWith('_m')) continue;
                const mod = win[k];
                if (!mod || typeof mod !== 'object') continue;
                const keys = Object.keys(mod);

                // Look for objects with both 'get' and 'post' (axios instances)
                if (keys.includes('get') && keys.includes('post') && typeof mod.get === 'function') {
                    log('Found axios instance at ' + k);
                    try {
                        mod.post('/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital', {
                            keyword, pageNum, pageSize
                        }).catch(() => { });
                        break;
                    } catch (e) { }
                }

                // Look for objects with 'queryFixedHospital' key
                if (keys.includes('queryFixedHospital')) {
                    log('Found queryFixedHospital handler at ' + k);
                }
            }
        } catch (e) { }

        // Wait for XHR capture
        let waited = 0;
        const check = setInterval(() => {
            waited++;
            const reqs = win.__all_requests || [];
            const qfh = reqs.filter(r => r.url.includes('queryFixedHospital'));
            if (qfh.length > 0) {
                clearInterval(check);
                resolve(qfh[0]);
            }
            if (waited > 30) {
                clearInterval(check);
                // Return any captured selectByKeys as fallback info
                reject(new Error('No queryFixedHospital captured after 15s. Requests: ' +
                    reqs.map(r => r.url.split('/').pop()).join(', ')));
            }
        }, 500);
    });
}

// ============================================================
// Fallback: manual encrypt (what we already have working)
// ============================================================
function encryptManual(params) {
    const win = _win;
    const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
    const VERSION = '1.0.0';
    const ts = Math.floor(Date.now() / 1000);
    const nonce = (() => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let r = '';
        for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)];
        return r;
    })();

    const plainJson = JSON.stringify(params);
    const plainBytes = Buffer.from(plainJson, 'utf-8');
    const padLen = 16 - (plainBytes.length % 16);
    const padded = Buffer.alloc(plainBytes.length + padLen);
    plainBytes.copy(padded);
    for (let i = plainBytes.length; i < padded.length; i++) padded[i] = padLen;

    const keyArr = win.__k ? Array.from(win.__k) : null;
    if (!keyArr) throw new Error('SM4 key not captured');

    // Internal SM4 encrypt
    const encArr = win.__c.sm4.encrypt(Array.from(padded), keyArr);
    const encData = Buffer.from(encArr).toString('hex');

    // Sign with internal SM2 + FIELD_D key
    const fieldDHex = '009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42';
    const inner = {
        data: { encData },
        appCode: AC, version: VERSION,
        encType: 'SM4', signType: 'SM2', timestamp: ts,
    };
    const innerJson = JSON.stringify(inner);

    // Use internal doSignature
    const doSig = win._m4d09 ? win._m4d09.doSignature : null;
    let signData = '';
    if (doSig) {
        signData = doSig(innerJson, fieldDHex, { hash: true });
    } else {
        // Fallback to npm
        const sm2 = require('sm-crypto').sm2;
        signData = sm2.doSignature(innerJson, fieldDHex.substring(0, 64), { hash: true });
    }

    const body = {
        data: {
            data: { encData },
            appCode: AC, version: VERSION,
            encType: 'SM4', signType: 'SM2',
            timestamp: ts, signData,
        }
    };
    const bodyJson = JSON.stringify(body);

    // x-tif-signature: SHA256(AC + ts + nonce + bodyJson)
    // Using internal SHA256 when available
    const xTifSig = crypto.createHash('sha256')
        .update(AC + ts + nonce + bodyJson)
        .digest('hex');

    return {
        headers: {
            'Content-Type': 'application/json', 'channel': 'web',
            'x-tif-paasid': 'undefined',
            'x-tif-signature': xTifSig,
            'x-tif-timestamp': String(ts),
            'x-tif-nonce': nonce,
        },
        body,
    };
}

// ============================================================
// Main
// ============================================================
async function main() {
    await init();

    if (process.argv.length > 2) {
        const cmd = process.argv[2];
        const input = process.argv[3] || '{}';

        if (cmd === 'encrypt') {
            try {
                // Try Vue trigger first, fallback to manual
                const result = await encryptViaVue(JSON.parse(input));
                console.log(JSON.stringify({ id: 1, result, method: 'vue' }, null, 2));
            } catch (e) {
                log('Vue trigger failed: ' + e.message);
                log('Using manual encrypt...');
                try {
                    const result = encryptManual(JSON.parse(input));
                    console.log(JSON.stringify({ id: 1, result, method: 'manual' }, null, 2));
                } catch (e2) {
                    console.log(JSON.stringify({ id: 1, error: { message: e2.message } }));
                }
            }
        } else if (cmd === 'status') {
            const reqs = _win.__all_requests || [];
            console.log(JSON.stringify({
                id: 1,
                result: {
                    sm4Key: !!_win.__k,
                    requests: reqs.map(r => ({
                        url: r.url.split('/').pop(),
                        sig: r.headers['x-tif-signature'],
                    })),
                }
            }, null, 2));
        }
        process.exit(0);
    }

    // stdin JSON-RPC
    log('Ready');
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', async (line) => {
        let reqId = 0;
        try {
            const req = JSON.parse(line);
            reqId = req.id;
            if (req.method === 'encrypt') {
                try {
                    const result = await encryptViaVue(req.params || {});
                    respond(reqId, result);
                } catch (e) {
                    respond(reqId, encryptManual(req.params || {}));
                }
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
