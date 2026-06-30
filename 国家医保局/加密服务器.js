/**
 * 国家医保局 — jsdom 加密服务器 (JSON-RPC stdin/stdout)
 * ========================================================
 *
 * 持久化 Node.js 进程，加载 app.js 后通过 stdin/stdout 提供加密服务。
 *
 * 协议: 每行一个 JSON
 *   → {"id":1, "method":"encrypt", "params": {"keyword":"xxx", "pageNum":1}}
 *   ← {"id":1, "result": {"headers":{...}, "body":{...}}}
 *
 * Python 端通过 subprocess 与此进程通信。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

// ═══════════════════════════════════════════════════════════════
// 初始化 jsdom 环境
// ═══════════════════════════════════════════════════════════════

function log(msg) { process.stderr.write(`[nhsa] ${msg}\n`); }

log('Starting jsdom...');
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
});
const win = dom.window;

// Crypto polyfill
win.crypto = {
    getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    subtle: {},
};
win.btoa = s => Buffer.from(s, 'binary').toString('base64');
win.atob = s => Buffer.from(s, 'base64').toString('binary');

// ═══════════════════════════════════════════════════════════════
// XHR 拦截器 (捕获加密请求)
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

    // 同时 Hook addEventListener 以捕获响应
    const origAE = xhr.addEventListener;
    xhr.addEventListener = function(event, fn) {
        if (event === 'readystatechange') {
            const origFn = fn;
            fn = function() {
                if (xhr.readyState === 4 && xhr.status === 200 && xhr.responseText) {
                    // 如果是 queryFixedHospital 的响应，缓存解密数据
                    if (_url.includes('queryFixedHospital')) {
                        capturedRequest = {
                            url: _url,
                            reqHeaders: { ..._headers },
                            reqBody: typeof capturedRequest === 'object' ? null : null,
                            respBody: xhr.responseText,
                        };
                    }
                }
                return origFn.apply(this, arguments);
            };
        }
        return origAE.call(this, event, fn);
    };

    xhr.send = function(body) {
        if (_url.includes('queryFixedHospital')) {
            capturedRequest = {
                url: _url,
                method: 'POST',
                reqHeaders: { ..._headers },
                reqBody: typeof body === 'string' ? body : '',
                timestamp: Date.now(),
            };
            if (pendingResolve) {
                pendingResolve(capturedRequest);
                pendingResolve = null;
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
    log(`app.js threw: ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
// 加密函数 — 模拟 Vue 搜索交互
// ═══════════════════════════════════════════════════════════════

function triggerSearch(keyword, pageNum = 1, pageSize = 10) {
    return new Promise((resolve, reject) => {
        pendingResolve = resolve;

        // 设置搜索输入
        const inputs = win.document.querySelectorAll('input');
        let searchInput = null;
        for (const inp of inputs) {
            if (inp.placeholder && inp.placeholder.includes('医疗机构名称')) {
                searchInput = inp;
                break;
            }
        }

        if (!searchInput) {
            reject(new Error('Search input not found'));
            return;
        }

        const setter = Object.getOwnPropertyDescriptor(
            win.HTMLInputElement.prototype, 'value'
        ).set;
        setter.call(searchInput, keyword);
        searchInput.dispatchEvent(new win.Event('input', { bubbles: true }));

        // 点击查询
        setTimeout(() => {
            const btns = win.document.querySelectorAll('button');
            let clicked = false;
            for (const btn of btns) {
                const span = btn.querySelector('span');
                if (span && span.textContent.trim() === '查询') {
                    btn.click();
                    clicked = true;
                    break;
                }
            }
            if (!clicked) {
                pendingResolve = null;
                reject(new Error('Search button not found'));
            }
        }, 300);

        // 超时
        setTimeout(() => {
            if (pendingResolve) {
                pendingResolve = null;
                reject(new Error('Search timeout'));
            }
        }, 10000);
    });
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC 处理
// ═══════════════════════════════════════════════════════════════

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
    try {
        const req = JSON.parse(line);
        const { id, method, params } = req;

        if (method === 'encrypt') {
            const result = await triggerSearch(
                params.keyword || '',
                params.pageNum || 1,
                params.pageSize || 10
            );

            // 解析捕获的请求
            const body = JSON.parse(result.reqBody);

            respond(id, {
                headers: {
                    'Content-Type': 'application/json',
                    'channel': 'web',
                    'x-tif-paasid': 'undefined',
                    'x-tif-signature': result.reqHeaders['x-tif-signature'],
                    'x-tif-timestamp': result.reqHeaders['x-tif-timestamp'],
                    'x-tif-nonce': result.reqHeaders['x-tif-nonce'],
                    'Accept': 'application/json',
                    'Origin': 'https://fuwu.nhsa.gov.cn',
                    'Referer': 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
                },
                body,
            });
        } else if (method === 'ping') {
            respond(id, { pong: true });
        } else {
            respond(id, null, { code: -1, message: `Unknown method: ${method}` });
        }
    } catch (e) {
        respond(req?.id, null, { code: -1, message: e.message });
    }
});

function respond(id, result, error) {
    const resp = { id };
    if (error) resp.error = error;
    else resp.result = result;
    process.stdout.write(JSON.stringify(resp) + '\n');
}

log('Ready - listening on stdin');
respond(0, { status: 'ready' });
