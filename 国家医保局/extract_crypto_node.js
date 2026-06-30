/**
 * 国家医保局 — jsdom 完整加密提取
 * ==================================
 *
 * 加载 app.js，拦截加密函数 I/O，输出密钥和算法。
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

// ═══════════════════════════════════════════════════════════════
// 1. 创建 jsdom
// ═══════════════════════════════════════════════════════════════

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;

// Crypto
const nodeCrypto = require('crypto');
win.crypto = {
    getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    subtle: {},
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// ═══════════════════════════════════════════════════════════════
// 2. 拦截所有 Uint8Array 创建 (捕获密钥材料)
// ═══════════════════════════════════════════════════════════════

const capturedArrays = [];
const OrigUint8Array = Uint8Array;
const U8Proxy = new Proxy(OrigUint8Array, {
    construct(target, args) {
        const arr = new target(...args);
        if (arr.length === 16 || arr.length === 32) {
            const hex = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
            const stack = new Error().stack;
            capturedArrays.push({ len: arr.length, hex, stack: stack.substring(0, 300) });
        }
        return arr;
    }
});
global.Uint8Array = U8Proxy;
win.Uint8Array = U8Proxy;

// ═══════════════════════════════════════════════════════════════
// 3. 拦截 XHR — 捕获完整加密请求
// ═══════════════════════════════════════════════════════════════

const capturedXHR = [];
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const origOpen = xhr.open;
    const origSend = xhr.send;
    const origSetReq = xhr.setRequestHeader;
    let url = '', headers = {};

    xhr.open = function(m, u) { url = u; return origOpen.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { headers[k] = v; return origSetReq.apply(this, arguments); };
    xhr.send = function(body) {
        capturedXHR.push({
            url,
            headers: { ...headers },
            body: typeof body === 'string' ? body : '(other)',
            ts: Date.now(),
        });
        return origSend.call(this, body);
    };
    return xhr;
};

// ═══════════════════════════════════════════════════════════════
// 4. 加载 app.js
// ═══════════════════════════════════════════════════════════════

console.error('[extract] Loading app.js...');
const script = win.document.createElement('script');
const appCode = fs.readFileSync(APP_JS, 'utf-8');
script.textContent = appCode;
try { win.document.body.appendChild(script); } catch(e) {
    console.error('[extract] eval error:', e.message);
}

// ═══════════════════════════════════════════════════════════════
// 5. 等待并输出结果
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
    const result = {
        // 捕获的密钥材料 (16/32字节数组)
        keyArrays: capturedArrays.filter(a => a.hex !== '00000000000000000000000000000000'),
        // 捕获的 XHR 请求
        xhrCount: capturedXHR.length,
        xhrBodies: capturedXHR.map(r => ({
            url: r.url.substring(r.url.lastIndexOf('/')),
            body: r.body,
            xTifSig: r.headers['x-tif-signature'] || 'none',
            xTifTs: r.headers['x-tif-timestamp'] || 'none',
            xTifNonce: r.headers['x-tif-nonce'] || 'none',
        })),
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}, 5000);
