/**
 * 国家医保局 — 在jsdom中追踪x-tif-signature计算 (v2)
 * =====================================================
 *
 * 思路:
 *   1. jsdom加载app.js
 *   2. Hook TextEncoder.encode 和其他可能被SHA-256库使用的API
 *   3. Hook setRequestHeader 捕获签名时的调用栈
 *   4. Hook string concatenation 来捕获可能的签名输入
 *
 * 用法: node capture_sig2.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

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
    subtle: {},
};

// Hook btoa to capture possible hash inputs
const origBtoa = (s) => Buffer.from(s, 'binary').toString('base64');
const origAtob = (s) => Buffer.from(s, 'base64').toString('binary');
win.btoa = function(s) {
    global.__nhsa_btoa = global.__nhsa_btoa || [];
    global.__nhsa_btoa.push(s.substring(0, 200));
    return origBtoa(s);
};
win.atob = origAtob;

// Hook TextEncoder (captures string → bytes conversion)
function TextEncoder() {}
TextEncoder.prototype.encode = function(str) {
    global.__nhsa_encodes = global.__nhsa_encodes || [];
    if (str && str.length > 5) {
        global.__nhsa_encodes.push({
            str: str.substring(0, 500),
            stack: new Error().stack.split('\n').slice(2, 8).map(l => l.trim()).join(' | '),
        });
    }
    return Buffer.from(str, 'utf-8');
};
win.TextEncoder = TextEncoder;

// Hook String.prototype.charCodeAt to track string processing
// The js-sha256 library processes strings character by character
const origCharCodeAt = String.prototype.charCodeAt;
let charCodeAtCallCount = 0;
String.prototype.charCodeAt = function(idx) {
    charCodeAtCallCount++;
    return origCharCodeAt.call(this, idx);
};

// ===========================================================
// 2. XHR拦截 + 调用栈捕获
// ===========================================================

let finalSigCapture = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let url = '', headers = {};

    xhr.open = function (m, u) { url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function (k, v) {
        headers[k] = v;
        if (k === 'x-tif-signature') {
            finalSigCapture = {
                signature: v,
                url,
                headers: Object.assign({}, headers),
                stack: new Error().stack.split('\n').slice(1).join('\n'),
                charCodeAtCount: charCodeAtCallCount,
            };
            charCodeAtCallCount = 0;
        }
        return osr.apply(this, arguments);
    };
    xhr.send = function (body) {
        if (!finalSigCapture || !finalSigCapture.body) {
            finalSigCapture = finalSigCapture || {};
            finalSigCapture.body = typeof body === 'string' ? body : '';
            finalSigCapture.url = url;
            finalSigCapture.allHeaders = Object.assign({}, headers);
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
// 4. 等待并分析
// ===========================================================

setTimeout(() => {
    console.error(`\n[capture] === RESULTS ===`);
    console.error(`[capture] TextEncoder.encode calls: ${(global.__nhsa_encodes || []).length}`);
    console.error(`[capture] btoa calls: ${(global.__nhsa_btoa || []).length}`);

    if (finalSigCapture) {
        console.error(`\n[capture] Signature: ${finalSigCapture.signature}`);
        console.error(`[capture] URL: ${finalSigCapture.url}`);
        console.error(`[capture] Headers: ${JSON.stringify(finalSigCapture.allHeaders, null, 2)}`);
        console.error(`[capture] Body preview: ${(finalSigCapture.body||'').substring(0, 350)}`);
        console.error(`[capture] Stack:\n${finalSigCapture.stack}`);
    }

    // Show TextEncoder captured data
    if (global.__nhsa_encodes && global.__nhsa_encodes.length > 0) {
        console.error(`\n[capture] TextEncoder captures:`);
        global.__nhsa_encodes.forEach((e, i) => {
            console.error(`\n  [${i}] ${e.str.substring(0, 100)}`);
            console.error(`      Stack: ${e.stack}`);
        });
    }

    if (global.__nhsa_btoa && global.__nhsa_btoa.length > 0) {
        console.error(`\n[capture] btoa captures:`);
        global.__nhsa_btoa.forEach((s, i) => {
            console.error(`  [${i}] ${s.substring(0, 150)}`);
        });
    }

    // Output JSON
    console.log(JSON.stringify({
        signature: finalSigCapture ? finalSigCapture.signature : null,
        body: finalSigCapture ? finalSigCapture.body : null,
        encodeCount: (global.__nhsa_encodes || []).length,
        encodes: (global.__nhsa_encodes || []).slice(0, 20),
        btoaCount: (global.__nhsa_btoa || []).length,
        btoas: (global.__nhsa_btoa || []).slice(0, 10),
    }, null, 2));

    process.exit(0);
}, 10000);
