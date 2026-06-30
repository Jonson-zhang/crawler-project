/**
 * 国家医保局 — jsdom 加密服务器 (JSON-RPC stdin/stdout)
 * ========================================================
 *
 * 持久化 Node.js 进程，加载 app.js 后通过 stdin/stdout 提供加密服务。
 * Python 端通过 subprocess 与此进程通信。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

function log(msg) { process.stderr.write(`[nhsa] ${msg}\n`); }

// ═══════════════════════════════════════════════════════════════
// jsdom 环境初始化
// ═══════════════════════════════════════════════════════════════

log('Starting jsdom...');
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const doc = win.document;

// Crypto
win.crypto = {
    getRandomValues(arr) { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); return arr; },
    subtle: {},
};
win.btoa = s => Buffer.from(s, 'binary').toString('base64');
win.atob = s => Buffer.from(s, 'base64').toString('binary');

// ═══════════════════════════════════════════════════════════════
// XHR 拦截
// ═══════════════════════════════════════════════════════════════

let pendingResolve = null;
let capturedRequest = null;

const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', _headers = {};

    xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { _headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function(body) {
        if (_url.includes('queryFixedHospital')) {
            capturedRequest = {
                url: _url, method: 'POST',
                reqHeaders: { ..._headers },
                reqBody: typeof body === 'string' ? body : '',
                timestamp: Date.now(),
            };
            if (pendingResolve) {
                const r = pendingResolve;
                pendingResolve = null;
                r(capturedRequest);
            }
        }
        try { os.call(this, body); } catch(e) {}
    };
    return xhr;
};

// ═══════════════════════════════════════════════════════════════
// 加载 app.js
// ═══════════════════════════════════════════════════════════════

log('Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {
    log(`app.js threw: ${e.message.substring(0, 200)}`);
}

// ═══════════════════════════════════════════════════════════════
// 辅助：等待 DOM 元素出现
// ═══════════════════════════════════════════════════════════════

function waitFor(selectorFn, maxWait = 10000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        function check() {
            const el = selectorFn();
            if (el) return resolve(el);
            if (Date.now() - start > maxWait) return reject(new Error('waitFor timeout'));
            setTimeout(check, 200);
        }
        check();
    });
}

// ═══════════════════════════════════════════════════════════════
// 触发搜索 → 捕获加密请求
// ═══════════════════════════════════════════════════════════════

async function triggerSearch(keyword, pageNum, pageSize) {
    // 等待搜索输入框出现 (Vue 渲染完成)
    const searchInput = await waitFor(() => {
        const inputs = win.document.querySelectorAll('input');
        for (const inp of inputs) {
            if (inp.placeholder && inp.placeholder.includes('医疗机构名称')) return inp;
        }
        return null;
    }, 15000);

    // 设置输入值
    const setter = Object.getOwnPropertyDescriptor(
        win.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(searchInput, keyword);
    searchInput.dispatchEvent(new win.Event('input', { bubbles: true }));

    // 等待并点击查询按钮
    await new Promise(r => setTimeout(r, 300));
    const buttons = win.document.querySelectorAll('button');
    let clicked = false;
    for (const btn of buttons) {
        const span = btn.querySelector('span');
        if (span && span.textContent.trim() === '查询') {
            btn.click();
            clicked = true;
            break;
        }
    }
    if (!clicked) throw new Error('Search button not found');

    // 等待 XHR 被拦截 (页面加密层发起请求)
    return new Promise((resolve, reject) => {
        const start = Date.now();
        pendingResolve = resolve;

        // 超时检查
        function check() {
            if (pendingResolve === null) return; // already resolved
            if (Date.now() - start > 12000) {
                pendingResolve = null;
                reject(new Error('XHR intercept timeout'));
            } else {
                setTimeout(check, 500);
            }
        }
        check();
    });
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC (stdin/stdout)
// ═══════════════════════════════════════════════════════════════

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
    let reqId = 0;
    try {
        const req = JSON.parse(line);
        reqId = req.id;
        const { method, params = {} } = req;

        if (method === 'encrypt') {
            const result = await triggerSearch(
                params.keyword || '',
                params.pageNum || 1,
                params.pageSize || 10
            );
            const body = JSON.parse(result.reqBody);
            respond(reqId, {
                headers: {
                    'Content-Type': 'application/json',
                    channel: 'web',
                    'x-tif-paasid': 'undefined',
                    'x-tif-signature': result.reqHeaders['x-tif-signature'] || '',
                    'x-tif-timestamp': result.reqHeaders['x-tif-timestamp'] || '',
                    'x-tif-nonce': result.reqHeaders['x-tif-nonce'] || '',
                    Accept: 'application/json',
                    Origin: 'https://fuwu.nhsa.gov.cn',
                    Referer: 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
                },
                body,
            });

        } else if (method === 'ping') {
            respond(reqId, { pong: true });

        } else {
            respond(reqId, null, { code: -1, message: 'Unknown method: ' + method });
        }

    } catch (e) {
        respond(reqId, null, { code: -1, message: e.message });
    }
});

function respond(id, result, error) {
    const resp = { id };
    if (error) resp.error = error;
    else resp.result = result;
    process.stdout.write(JSON.stringify(resp) + '\n');
}

log('Ready');
respond(0, { status: 'ready' });
