/**
 * 国家医保局 — jsdom加密服务器
 * ==============================
 *
 * 在jsdom中运行app.js，通过拦截app的内部XHR获取正确的加密请求。
 * Python通过stdin/stdout JSON-RPC调用。
 *
 * 每个请求:
 *   1. 在jsdom中修改Vue组件状态触发搜索
 *   2. 拦截XHR获取加密后的请求体+签名头
 *   3. 返回加密请求给Python
 *   4. Python用requests发送到真实API
 *
 * 用法:
 *   作为子进程: python main.py → node jsdom_server.js (stdin JSON-RPC)
 *   单独测试:   node jsdom_server.js encrypt '{"keyword":"医院"}'
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');
const readline = require('readline');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

function log(msg) { process.stderr.write(`[jsdom] ${msg}\n`); }

// ═══════════════════════════════════════════════════════════════
// 初始化 jsdom
// ═══════════════════════════════════════════════════════════════

let dom, win, capturedRequest = null, isReady = false;

function init() {
    return new Promise((resolve, reject) => {
        log('Creating jsdom...');

        dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
            url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
            pretendToBeVisual: true,
            runScripts: 'dangerously',
            resources: 'usable',
        });
        win = dom.window;

        // 环境补丁
        win.crypto = {
            getRandomValues(arr) {
                try { crypto.randomFillSync(arr); } catch(e) {
                    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
                }
                return arr;
            },
            subtle: {},
        };
        win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
        win.atob = (s) => Buffer.from(s, 'base64').toString('binary');

        // TextEncoder
        function TextEncoder() {}
        TextEncoder.prototype.encode = function(str) {
            return Buffer.from(str, 'utf-8');
        };
        win.TextEncoder = TextEncoder;

        // XHR 拦截
        const OrigXHR = win.XMLHttpRequest;
        win.XMLHttpRequest = function () {
            const xhr = new OrigXHR();
            const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
            let url = '', headers = {}, method = 'GET';

            xhr.open = function (m, u) { method = m; url = u; return oo.apply(this, arguments); };
            xhr.setRequestHeader = function (k, v) { headers[k] = v; return osr.apply(this, arguments); };
            xhr.send = function (body) {
                // 拦截 queryFixedHospital 请求
                if (url.includes('queryFixedHospital') && !capturedRequest) {
                    capturedRequest = {
                        url, method,
                        headers: Object.assign({}, headers),
                        body: typeof body === 'string' ? body : '',
                    };
                    // 返回一个模拟成功响应，阻止实际网络请求
                    // 注意：不调用os.call会阻止请求发出
                    // 但为了让页面继续运行，需要触发状态变化
                    if (xhr.onreadystatechange) {
                        Object.defineProperty(xhr, 'readyState', { get: () => 4 });
                        Object.defineProperty(xhr, 'status', { get: () => 200 });
                        Object.defineProperty(xhr, 'responseText', {
                            get: () => JSON.stringify({
                                code: 0,
                                data: {
                                    data: { encData: '' },
                                    encType: 'SM4', signType: 'SM2',
                                    appCode: APP_CODE, version: '1.0.0',
                                    timestamp: Date.now(), signData: ''
                                },
                                message: '成功'
                            })
                        });
                        try { xhr.onreadystatechange(); } catch(e) {}
                    }
                    return;
                }
                // 让其他请求正常通过
                os.call(this, body);
            };
            return xhr;
        };

        // 添加错误处理
        win.onerror = (msg) => {
            log(`JS error: ${msg}`);
        };

        // 加载app.js
        log('Loading app.js (3.7MB)...');
        const appSource = fs.readFileSync(APP_JS, 'utf-8');
        log(`Loaded ${(appSource.length/1024/1024).toFixed(1)}MB`);

        const script = win.document.createElement('script');
        script.textContent = appSource;

        try {
            win.document.body.appendChild(script);
            log('app.js loaded successfully!');
        } catch (e) {
            log(`Load error: ${e.message}`);
        }

        // 等待Vue应用初始化
        setTimeout(() => {
            // 检查Vue是否初始化
            const hasVue = win.document.querySelector('.el-table') !== null ||
                           win.document.querySelector('#app') !== null;
            log(`Vue initialized: ${hasVue}`);
            isReady = true;
            resolve();
        }, 3000);
    });
}

// ═══════════════════════════════════════════════════════════════
// 搜索加密
// ═══════════════════════════════════════════════════════════════

function encrypt(params) {
    return new Promise((resolve, reject) => {
        const keyword = params.keyword || '';
        const pageNum = params.pageNum || 1;
        const pageSize = params.pageSize || 10;

        capturedRequest = null;
        const timeout = setTimeout(() => {
            if (capturedRequest) {
                resolve(capturedRequest);
            } else {
                reject(new Error('encrypt timeout — no XHR captured'));
            }
        }, 15000);

        try {
            // 尝试通过Vue实例触发搜索
            // 方法1: 找到搜索input并触发
            const inputs = win.document.querySelectorAll('input');
            let searchInput = null;
            for (const input of inputs) {
                if (input.placeholder && input.placeholder.includes('医疗机构')) {
                    searchInput = input;
                    break;
                }
            }

            if (searchInput) {
                // 设置input值 (通过Vue reactivity)
                const nativeSetter = Object.getOwnPropertyDescriptor(
                    win.HTMLInputElement.prototype, 'value'
                ).set;
                nativeSetter.call(searchInput, keyword);
                searchInput.dispatchEvent(new win.Event('input', { bubbles: true }));
                log(`Set search input: "${keyword}"`);

                // 延迟后点击搜索按钮
                setTimeout(() => {
                    const btns = win.document.querySelectorAll('button');
                    let clicked = false;
                    for (const btn of btns) {
                        if (btn.textContent && btn.textContent.trim() === '查询') {
                            btn.click();
                            clicked = true;
                            log('Clicked search button');
                            break;
                        }
                    }
                    if (!clicked) {
                        log('WARNING: Search button not found');
                    }
                }, 500);
            } else {
                log('WARNING: Search input not found, trying Vue global...');
                // 尝试通过全局Vue事件总线
                if (win.__vueEventBus) {
                    win.__vueEventBus.$emit('search', { keyword, pageNum, pageSize });
                }
            }
        } catch (e) {
            clearTimeout(timeout);
            reject(e);
        }
    });
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC
// ═══════════════════════════════════════════════════════════════

function respond(id, result, error) {
    const resp = { id };
    if (error) resp.error = error;
    else resp.result = result;
    process.stdout.write(JSON.stringify(resp) + '\n');
}

// ═══════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════

async function main() {
    await init();

    // CLI mode
    if (process.argv.length > 2) {
        const cmd = process.argv[2];
        const input = process.argv[3] || '{}';
        if (cmd === 'encrypt') {
            try {
                const result = await encrypt(JSON.parse(input));
                respond(1, result);
            } catch (e) {
                respond(1, null, { message: e.message });
            }
        } else {
            respond(1, null, { message: 'Unknown CLI: ' + cmd });
        }
        process.exit(0);
    }

    // JSON-RPC stdin mode
    log('Ready for JSON-RPC on stdin');
    const rl = readline.createInterface({ input: process.stdin });

    rl.on('line', async (line) => {
        let reqId = 0;
        try {
            const req = JSON.parse(line);
            reqId = req.id;
            const { method, params = {} } = req;
            if (method === 'encrypt') {
                const result = await encrypt(params);
                respond(reqId, result);
            } else if (method === 'ping') {
                respond(reqId, { pong: true, ready: isReady });
            } else {
                respond(reqId, null, { message: 'Unknown method: ' + method });
            }
        } catch (e) {
            respond(reqId, null, { message: e.message });
        }
    });

    respond(0, { status: 'ready' });
}

main().catch(e => {
    log(`Fatal: ${e.message}`);
    process.exit(1);
});
