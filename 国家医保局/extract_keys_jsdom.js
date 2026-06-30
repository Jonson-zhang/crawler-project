/**
 * 从 jsdom 提取加密函数 I/O，用已知输入输出反推密钥
 *
 * 用法: node extract_keys_jsdom.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

const APP_JS = path.join(__dirname, 'config', 'app.js');

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;

win.crypto = {
    getRandomValues(arr) { for (let i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256);return arr; },
    subtle: {},
};
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');

// ── 拦截所有 Uint8Array 创建（密钥材料）──
const keyMaterials = [];
const OrigUint8Array = Uint8Array;
const OrigArray = Array;
win.Uint8Array = new Proxy(OrigUint8Array, {
    construct(target, args) {
        const arr = new target(...args);
        if (arr.length === 16 || arr.length === 32 || arr.length === 64) {
            const hex = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
            const stack = new Error().stack.split('\n').slice(1,6).join('|');
            // 去重
            if (!keyMaterials.some(m => m.hex === hex)) {
                keyMaterials.push({ len: arr.length, hex, stack: stack.substring(0,400) });
            }
        }
        return arr;
    }
});

// ── 拦截 XHR 以获取完整请求体 ──
let capturedBody = null, capturedHeaders = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let url = '', hdrs = {};
    xhr.open = function(m,u) { url=u; return oo.apply(this,arguments); };
    xhr.setRequestHeader = function(k,v) { hdrs[k]=v; return osr.apply(this,arguments); };
    xhr.send = function(body) {
        if (url.includes('queryFixedHospital') || url.includes('selectByKeys')) {
            capturedBody = typeof body === 'string' ? body : '';
            capturedHeaders = { ...hdrs };
        }
        try { os.call(this, body); } catch(e) {}
    };
    return xhr;
};

// ── 加载 app.js ──
process.stderr.write('[extract] Loading app.js...\n');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {
    process.stderr.write(`[extract] Error: ${e.message}\n`);
}

setTimeout(() => {
    // 输出结果
    const result = {
        keyMaterials: keyMaterials.filter(m => m.hex !== '00000000000000000000000000000000' && m.hex !== '0000000000000000000000000000000000000000000000000000000000000000'),
        capturedRequest: capturedBody ? JSON.parse(capturedBody) : null,
        capturedHeaders: capturedHeaders,
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
}, 8000);
