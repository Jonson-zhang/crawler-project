/**
 * 国家医保局 — jsdom 加密服务器 (JSON-RPC stdin/stdout)
 *
 * 原理:
 *   加载 app.js 后，通过拦截 XHR.prototype.send 捕获加密请求。
 *   然后注入脚本修改 Vue 数据 → 触发 API 调用 → 捕获加密后的 body。
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
function log(msg) { process.stderr.write(`[nhsa] ${msg}\n`); }

// jsdom
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

// ═══════════════════════════════════════════════════════════════
// XHR 拦截 + Vue 注入
// ═══════════════════════════════════════════════════════════════

let pendingResolve = null;
let capturedRequest = null;

// 在 app.js 加载前注入全局拦截
win.__nhsa_trigger = null;
win.__nhsa_result = null;

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
                reqHeaders: { ..._headers },
                reqBody: typeof body === 'string' ? body : '',
            };
            if (pendingResolve) {
                const r = pendingResolve; pendingResolve = null;
                r(capturedRequest);
            }
        }
        try { os.call(this, body); } catch(e) {}
    };
    return xhr;
};

// 加载 app.js
log('Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {
    log(`app.js error: ${e.message.substring(0,200)}`);
}

// ═══════════════════════════════════════════════════════════════
// 搜索触发 — 用 Vue 内部方法而非 DOM click
// ═══════════════════════════════════════════════════════════════

async function triggerSearch(keyword) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        pendingResolve = resolve;
        let retries = 0;

        function tryClick() {
            retries++;
            if (retries > 40) {
                pendingResolve = null;
                reject(new Error('Search retries exhausted'));
                return;
            }

            // 方法1: 直接找 DOM 并 click
            const inputs = win.document.querySelectorAll('input');
            for (const inp of inputs) {
                if (inp.placeholder && inp.placeholder.includes('医疗机构名称')) {
                    const setter = Object.getOwnPropertyDescriptor(
                        win.HTMLInputElement.prototype, 'value'
                    ).set;
                    setter.call(inp, keyword);
                    inp.dispatchEvent(new win.Event('input', { bubbles: true }));
                    break;
                }
            }

            const btns = win.document.querySelectorAll('button');
            for (const btn of btns) {
                const span = btn.querySelector('span');
                if (span && span.textContent.trim() === '查询') {
                    btn.click();
                    break;
                }
            }

            // 如果没找到按钮，稍后重试
            if (!pendingResolve) return;
            if (Date.now() - start > 15000) {
                pendingResolve = null;
                reject(new Error('Search timeout'));
                return;
            }
            setTimeout(tryClick, 1000);
        }

        // 初始延迟 (等待 Vue 初始化)
        setTimeout(tryClick, 3000);
    });
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC
// ═══════════════════════════════════════════════════════════════

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
    let reqId = 0;
    try {
        const req = JSON.parse(line);
        reqId = req.id;
        const { method, params = {} } = req;

        if (method === 'encrypt') {
            const r = await triggerSearch(params.keyword || '');
            const body = JSON.parse(r.reqBody);
            respond(reqId, {
                headers: {
                    'Content-Type': 'application/json', channel: 'web',
                    'x-tif-paasid': 'undefined',
                    'x-tif-signature': r.reqHeaders['x-tif-signature'] || '',
                    'x-tif-timestamp': r.reqHeaders['x-tif-timestamp'] || '',
                    'x-tif-nonce': r.reqHeaders['x-tif-nonce'] || '',
                    Accept: 'application/json',
                    Origin: 'https://fuwu.nhsa.gov.cn',
                    Referer: 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
                },
                body,
            });
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

log('Ready');
respond(0, { status: 'ready' });
