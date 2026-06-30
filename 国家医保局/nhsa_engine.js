/**
 * 国家医保局 — jsdom 加密引擎
 * ==============================
 *
 * 在 jsdom 中加载 app.js，利用 Vue 应用自身的加密层完成加解密。
 *
 * 用法:
 *   node nhsa_engine.js encrypt '{"keyword":"北京协和医院","pageNum":1,"pageSize":10}'
 *   node nhsa_engine.js decrypt '4A8E4673BB18D86FE780DACC31C49FE3'
 *   node nhsa_engine.js serve            # JSON-RPC via stdin/stdout
 *
 * 输出: JSON (含 headers + body)
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const PAGE_URL = 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical';

// ═══════════════════════════════════════════════════════════════
// 环境初始化
// ═══════════════════════════════════════════════════════════════

let _dom = null;
let _win = null;
let _initialized = false;
let _lastEncData = null;
let _lastHeaders = null;

function init() {
    if (_initialized) return;

    _dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
        url: PAGE_URL,
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        resources: 'usable',
    });
    _win = _dom.window;

    // Crypto
    _win.crypto = {
        getRandomValues(arr) {
            for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
            return arr;
        },
        subtle: {},
    };
    _win.btoa = s => Buffer.from(s, 'binary').toString('base64');
    _win.atob = s => Buffer.from(s, 'base64').toString('binary');

    // 拦截 XHR 以捕获加密请求
    const OrigXHR = _win.XMLHttpRequest;
    _win.XMLHttpRequest = function() {
        const xhr = new OrigXHR();
        const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
        let url = '', headers = {};

        xhr.open = function(m, u) { url = u; return oo.apply(this, arguments); };
        xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
        xhr.send = function(body) {
            // 捕获最后发送的加密请求
            if (url.includes('selectByKeys') || url.includes('queryFixedHospital')) {
                _lastEncData = {
                    url,
                    headers: { ...headers },
                    body: typeof body === 'string' ? body : '',
                };
            }
            try { os.call(this, body); } catch(e) {}
        };
        return xhr;
    };

    // 加载 app.js
    const script = _win.document.createElement('script');
    script.textContent = fs.readFileSync(APP_JS, 'utf-8');
    try { _win.document.body.appendChild(script); } catch(e) {
        // app.js 可能抛出一些无害的错误
    }

    _initialized = true;
}

// ═══════════════════════════════════════════════════════════════
// 加密 API
// ═══════════════════════════════════════════════════════════════

function encrypt(params) {
    init();

    return new Promise((resolve, reject) => {
        // 等待 jsdom 完全初始化 (Vue app mounted + initial API calls done)
        const maxWait = 15000;
        const start = Date.now();

        function check() {
            // 检查 Vue 应用是否已挂载
            try {
                const hasApp = _win.document.querySelector('#app');
                const inputs = _win.document.querySelectorAll('input');
                const searchInput = Array.from(inputs).find(
                    inp => inp.placeholder && inp.placeholder.includes('医疗机构名称')
                );

                if (searchInput && Date.now() - start > 2000) {
                    // Vue 已就绪，设置搜索值并触发查询
                    const setter = Object.getOwnPropertyDescriptor(
                        _win.HTMLInputElement.prototype, 'value'
                    ).set;
                    setter.call(searchInput, params.keyword || '');
                    searchInput.dispatchEvent(new _win.Event('input', { bubbles: true }));

                    // 点击查询按钮
                    setTimeout(() => {
                        const buttons = _win.document.querySelectorAll('button');
                        for (const btn of buttons) {
                            const span = btn.querySelector('span');
                            if (span && span.textContent.trim() === '查询') {
                                btn.click();
                                break;
                            }
                        }

                        // 等待 XHR 被拦截
                        setTimeout(() => {
                            if (_lastEncData) {
                                try {
                                    const body = JSON.parse(_lastEncData.body);
                                    resolve({
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'channel': 'web',
                                            'x-tif-paasid': 'undefined',
                                            'x-tif-signature': _lastEncData.headers['x-tif-signature'],
                                            'x-tif-timestamp': _lastEncData.headers['x-tif-timestamp'],
                                            'x-tif-nonce': _lastEncData.headers['x-tif-nonce'],
                                        },
                                        body,
                                    });
                                } catch(e) {
                                    resolve({ error: 'Parse error: ' + e.message });
                                }
                            } else {
                                resolve({ error: 'No XHR captured' });
                            }
                        }, 3000);
                    }, 500);
                    return;
                }
            } catch(e) {}

            if (Date.now() - start < maxWait) {
                setTimeout(check, 500);
            } else {
                reject(new Error('Timeout waiting for Vue app'));
            }
        }

        check();
    });
}

function decrypt(encDataHex) {
    init();
    // jsdom 方式解密: 在页面内执行解密（利用页面自身的解密函数）
    // 这需要访问 Vue 内部的解密逻辑，比较复杂
    // 作为备选：不做解密，由调用者自己处理
    return Promise.resolve({ error: 'decrypt not implemented yet' });
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const cmd = process.argv[2];

if (cmd === 'encrypt') {
    const input = process.argv[3] || '{"keyword":"医院","pageNum":1,"pageSize":10}';
    encrypt(JSON.parse(input)).then(r => {
        console.log(JSON.stringify(r));
        process.exit(0);
    }).catch(e => {
        console.log(JSON.stringify({ error: e.message }));
        process.exit(1);
    });

} else if (cmd === 'test') {
    encrypt({ keyword: '北京协和医院', pageNum: 1, pageSize: 10 }).then(r => {
        console.log(JSON.stringify(r, null, 2));
        process.exit(0);
    }).catch(e => {
        console.error(e);
        process.exit(1);
    });

} else {
    console.log(JSON.stringify({
        error: 'Usage: node nhsa_engine.js encrypt|test [json]',
    }));
    process.exit(1);
}
