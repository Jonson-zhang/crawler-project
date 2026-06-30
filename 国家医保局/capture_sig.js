/**
 * 国家医保局 — 在jsdom中拦截x-tif-signature计算
 * ==============================================
 *
 * 原理:
 *   1. jsdom加载app.js
 *   2. Hook crypto.subtle.digest 和 TextEncoder.encode
 *   3. 拦截XHR请求，捕获签名
 *   4. 匹配签名 → 找出SHA-256输入
 *
 * 用法: node capture_sig.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

// ===========================================================
// 1. jsdom环境
// ===========================================================

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
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
    subtle: {
        digest: function(algo, data) {
            // Capture SHA-256 inputs!
            const dataStr = Buffer.from(data).toString('binary');
            const result = crypto.createHash('sha256').update(data).digest();
            const resultHex = result.toString('hex');

            global.__nhsa_digests = global.__nhsa_digests || [];
            global.__nhsa_digests.push({
                algorithm: JSON.stringify(algo),
                dataLen: data.byteLength,
                dataHex: Buffer.from(data).toString('hex').substring(0, 400),
                dataStr: dataStr.substring(0, 300).replace(/[\x00-\x1f]/g, '.'),
                resultHex: resultHex,
            });

            return Promise.resolve(result.buffer.slice(
                result.byteOffset, result.byteOffset + result.byteLength
            ));
        },
    },
};

win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) {
    // Capture all string encodings
    global.__nhsa_encodes = global.__nhsa_encodes || [];
    global.__nhsa_encodes.push({
        str: str.substring(0, 300),
        stack: new Error().stack.split('\n').slice(2, 6).join('\n'),
    });
    return Buffer.from(str, 'utf-8');
};

win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// ===========================================================
// 2. XHR拦截
// ===========================================================

let captured = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const oo = xhr.open,
        os = xhr.send,
        osr = xhr.setRequestHeader;
    let url = '',
        headers = {};

    xhr.open = function (m, u) {
        url = u;
        return oo.apply(this, arguments);
    };
    xhr.setRequestHeader = function (k, v) {
        headers[k] = v;
        return osr.apply(this, arguments);
    };
    xhr.send = function (body) {
        if (!captured) {
            captured = {
                url,
                body: typeof body === 'string' ? body : '',
                headers: Object.assign({}, headers),
            };
        }
        os.call(this, body);
    };
    return xhr;
};

// ===========================================================
// 3. 加载app.js
// ===========================================================

console.error('[capture] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try {
    win.document.body.appendChild(script);
} catch (e) {
    console.error('[capture] Load error:', e.message);
}

// ===========================================================
// 4. 等待并分析结果
// ===========================================================

setTimeout(() => {
    console.error(`\n[capture] Captured digests: ${(global.__nhsa_digests || []).length}`);
    console.error(`[capture] Captured encodes: ${(global.__nhsa_encodes || []).length}`);

    if (captured) {
        console.error(`\n[capture] XHR URL: ${captured.url}`);
        console.error(`[capture] x-tif-signature: ${captured.headers['x-tif-signature']}`);
        console.error(`[capture] x-tif-timestamp: ${captured.headers['x-tif-timestamp']}`);
        console.error(`[capture] x-tif-nonce: ${captured.headers['x-tif-nonce']}`);
        console.error(`[capture] body preview: ${captured.body.substring(0, 200)}`);

        // Try to match
        const sig = captured.headers['x-tif-signature'];
        if (sig && global.__nhsa_digests) {
            console.error(`\n[capture] Trying to match signature: ${sig}`);
            for (const d of global.__nhsa_digests) {
                if (d.resultHex === sig) {
                    console.error(`\n*** MATCH FOUND ***`);
                    console.error(`Data hex: ${d.dataHex}`);
                    console.error(`Data str: ${d.dataStr}`);
                    console.error(`Data len: ${d.dataLen}`);
                    break;
                }
            }
            // Check if any digest matches something close
            for (const d of global.__nhsa_digests) {
                if (d.resultHex.length === 64) {
                    console.error(`\nSHA256 output: ${d.resultHex}`);
                    console.error(`  Input preview: ${d.dataStr.substring(0, 100)}`);
                }
            }
        }
    } else {
        console.error('[capture] No XHR captured!');
    }

    // Output full results as JSON
    console.log(JSON.stringify({
        captured,
        digestCount: (global.__nhsa_digests || []).length,
        digests: (global.__nhsa_digests || []).map(d => ({
            resultHex: d.resultHex,
            dataLen: d.dataLen,
            dataStr: d.dataStr,
        })),
    }, null, 2));

    process.exit(0);
}, 8000);
