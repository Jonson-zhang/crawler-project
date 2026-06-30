/**
 * 国家医保局 — jsdom 提取加密算法
 * =================================
 *
 * 在 jsdom 中加载 app.js，拦截 XHR 请求以捕获实际加密输出。
 * 已知输入 → 观察输出 → 推导算法。
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const appCode = fs.readFileSync(APP_JS, 'utf-8');

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const doc = win.document;

// Crypto polyfill
win.crypto = {
    getRandomValues(arr) {
        const b = crypto.randomBytes(arr.length);
        for (let i = 0; i < arr.length; i++) arr[i] = b[i];
        return arr;
    },
    subtle: {},
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// 拦截 XHR 以捕获加密后的请求体
const capturedRequests = [];
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
        if (url.includes('queryFixedHospital') || url.includes('selectByKeys')) {
            capturedRequests.push({
                url, method: this._method || 'POST',
                headers: { ...headers },
                body: typeof body === 'string' ? body : '(not string)',
                bodyLen: typeof body === 'string' ? body.length : 0,
            });
        }
        return origSend.call(this, body);
    };
    return xhr;
};

// Load app.js
console.error('[extract] Loading app.js...');
const script = doc.createElement('script');
script.textContent = appCode;
try { doc.body.appendChild(script); } catch(e) {
    console.error('[extract] Error:', e.message);
}

// Wait and then check
setTimeout(() => {
    console.log(JSON.stringify({
        capturedCount: capturedRequests.length,
        requests: capturedRequests.map(r => ({
            url: r.url.substring(r.url.lastIndexOf('/')),
            bodyPreview: r.body.substring(0, 200),
            headerKeys: Object.keys(r.headers),
            xTifSig: r.headers['x-tif-signature'] ? r.headers['x-tif-signature'].substring(0,20) : 'none',
        })),
    }, null, 2));
    process.exit(0);
}, 5000);
