/**
 * 国家医保局 — 加密服务器 (jsdom + app.js)
 * =========================================
 *
 * 完全方案: jsdom 加载 app.js → 拦截内部 API 服务 → 直接调用加密
 *
 * 用法:
 *   node nhsa_encrypt_server.js                 # stdin JSON-RPC
 *   node nhsa_encrypt_server.js encrypt '{"keyword":"医院","pageNum":1,"pageSize":10}'
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const readline = require('readline');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

function log(msg) { process.stderr.write(`[nhsa] ${msg}\n`); }

// ===========================================================
// Initialize jsdom + app.js
// ===========================================================

let apiService = null;   // The _0x189636["k"] object
let smCrypto = null;     // {sm2, sm3, sm4}
let capturedEncRequest = null;
let isReady = false;

const PATCH_SCRIPT = `
// Patch: inject after app.js webpack runtime
// Wait for modules to be loaded, then scan global scope for API service
(function scan() {
    if (typeof window !== 'undefined' && window.__nhsa_scanned) return;
    if (typeof window !== 'undefined') window.__nhsa_scanned = true;

    // Try every 500ms until modules are found
    var attempts = 0;
    var maxAttempts = 20;
    var interval = setInterval(function() {
        attempts++;
        if (attempts > maxAttempts) { clearInterval(interval); return; }

        // Scan ALL window properties for sm-crypto module
        for (var key in window) {
            try {
                var val = window[key];
                if (val && typeof val === 'object' && val.sm2 && val.sm4 && !val.__scanned) {
                    val.__scanned = true;
                    window.__nhsa_crypto = val;
                }
            } catch(e) {}
        }
        if (window.__nhsa_crypto) {
            clearInterval(interval);
        }
    }, 500);
})();
`;

function init() {
    return new Promise((resolve, reject) => {
        log('Creating jsdom...');

        const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
            url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
            pretendToBeVisual: true,
            runScripts: 'dangerously',
            resources: 'usable',
        });
        const win = dom.window;

        // Environment patches
        win.crypto = {
            getRandomValues(arr) {
                try { require('crypto').randomFillSync(arr); } catch(e) {
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
        TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };
        win.TextEncoder = TextEncoder;

        // XHR intercept - capture queryFixedHospital requests
        const OrigXHR = win.XMLHttpRequest;
        win.XMLHttpRequest = function() {
            const xhr = new OrigXHR();
            const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
            let _url = '', headers = {};
            xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
            xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
            xhr.send = function(body) {
                if (_url.includes('queryFixedHospital')) {
                    capturedEncRequest = {
                        url: _url,
                        headers: Object.assign({}, headers),
                        body: typeof body === 'string' ? body : '',
                    };
                    // Simulate successful response
                    Object.defineProperty(xhr, 'readyState', { get: () => 4, configurable: true });
                    Object.defineProperty(xhr, 'status', { get: () => 200, configurable: true });
                    Object.defineProperty(xhr, 'responseText', {
                        get: () => JSON.stringify({
                            code: 0, message: '成功',
                            data: { data: { encData: '' }, encType: 'SM4', signType: 'SM2',
                                     appCode: APP_CODE, version: '1.0.0',
                                     timestamp: Date.now(), signData: '' }
                        }),
                        configurable: true
                    });
                    if (xhr.onreadystatechange) {
                        try { xhr.onreadystatechange(); } catch(e) {}
                    }
                    return;
                }
                if (_url.includes('selectByKeys')) {
                    // Capture the initial selectByKeys to verify encryption works
                    capturedEncRequest = {
                        url: _url,
                        headers: Object.assign({}, headers),
                        body: typeof body === 'string' ? body : '',
                    };
                }
                os.call(this, body);
            };
            return xhr;
        };

        // Load app.js
        log(`Loading app.js (${(fs.readFileSync(APP_JS).length/1024/1024).toFixed(1)}MB)...`);
        const script = win.document.createElement('script');
        script.textContent = fs.readFileSync(APP_JS, 'utf-8');
        try { win.document.body.appendChild(script); } catch(e) {
            log(`Load warning: ${e.message}`);
        }

        // Also load patcher
        const patchScript = win.document.createElement('script');
        patchScript.textContent = PATCH_SCRIPT;
        try { win.document.body.appendChild(patchScript); } catch(e) {}

        // Wait for initialization
        setTimeout(() => {
            // Try to find the API service in the window scope
            // In webpack, modules may have exported via different patterns
            // Let's capture what we have

            // Check crypto
            smCrypto = win.__nhsa_crypto;
            if (smCrypto) {
                log(`Crypto found! sm2: ${Object.keys(smCrypto.sm2).filter(k=>typeof smCrypto.sm2[k]==='function').join(',')}`);
                log(`  sm4: ${Object.keys(smCrypto.sm4).filter(k=>typeof smCrypto.sm4[k]==='function').join(',')}`);
            } else {
                log('Crypto module not found in global scope');
            }

            // The requesting module builds requests with specific parameters.
            // Let's find it by looking for objects with request/config patterns in window
            // The API service in ServiceSearchModule.js calls _0x189636["k"]["<method>"]
            // Let's scan for it
            function findApiService(obj, name, visited, depth) {
                if (depth > 4 || !obj || typeof obj !== 'object' || visited.has(obj)) return;
                visited.add(obj);
                try {
                    const keys = Object.keys(obj);
                    // Look for objects with a "k" property that's an object with get/post methods
                    if (keys.includes('k') && obj.k && typeof obj.k === 'object') {
                        const kKeys = Object.keys(obj.k);
                        if (kKeys.some(k => typeof obj.k[k] === 'function') && kKeys.length >= 2) {
                            log(`Found API service at: ${name}`);
                            log(`  keys: ${keys.slice(0,10).join(',')}`);
                            log(`  k keys: ${kKeys.slice(0,10).join(',')}`);
                            apiService = obj;
                            return;
                        }
                    }
                    for (const key of keys.slice(0, 40)) {
                        if (['window','self','top','parent','document','location','console',
                             'navigator','screen','history','localStorage','sessionStorage',
                             'crypto','performance','XMLHttpRequest','fetch','WebSocket',
                             'Worker','setTimeout','setInterval','Array','Object','String',
                             'Number','Boolean','Function','Math','Date','RegExp','Promise',
                             'Symbol','Map','Set','WeakMap','Error','JSON','Element',
                             'HTMLElement'].includes(key)) continue;
                        if (key.startsWith('__') || key.startsWith('webkit') || key.startsWith('on')) continue;
                        try { findApiService(obj[key], `${name}.${key}`, visited, depth+1); } catch(e) {}
                    }
                } catch(e) {}
            }

            const visited = new Set();
            findApiService(win, 'window', visited, 0);

            if (apiService) {
                log('API service found!');
            } else {
                log('API service not found via scanning');
            }

            // Even without the API service, the selectByKeys call generates valid encrypted requests
            // The app.js generates the selectByKeys encData with SM4 key internally
            // We can use that to find the SM4 key through known-plaintext attack

            isReady = true;
            log('Ready');
            resolve();
        }, 5000);
    });
}

// ===========================================================
// Encrypt - generate encrypted request
// ===========================================================

function encrypt(params) {
    return new Promise((resolve, reject) => {
        if (!isReady) return reject(new Error('Not initialized'));

        capturedEncRequest = null;
        const keyword = params.keyword || '';
        const pageNum = params.pageNum || 1;
        const pageSize = params.pageSize || 10;

        // Strategy: modify the search input via DOM and trigger search
        // Even though Vue components may not render, the API service might still be accessible

        // Method 1: Direct DOM manipulation (works if Vue is loaded)
        try {
            const win = global.__nhsa_win;
            const inputs = win.document.querySelectorAll('input');
            let searchInput = null;
            for (const inp of inputs) {
                if (inp.placeholder && inp.placeholder.includes('医疗机构')) {
                    searchInput = inp;
                    break;
                }
            }

            if (searchInput) {
                const setter = Object.getOwnPropertyDescriptor(
                    win.HTMLInputElement.prototype, 'value'
                ).set;
                setter.call(searchInput, keyword);
                searchInput.dispatchEvent(new win.Event('input', { bubbles: true }));

                setTimeout(() => {
                    const btns = win.document.querySelectorAll('button');
                    for (const btn of btns) {
                        if (btn.textContent && btn.textContent.trim() === '查询') {
                            btn.click();
                            break;
                        }
                    }

                    // Wait for XHR capture
                    let waited = 0;
                    const checkTimer = setInterval(() => {
                        waited++;
                        if (capturedEncRequest) {
                            clearInterval(checkTimer);
                            resolve({
                                headers: {
                                    'Content-Type': 'application/json',
                                    'channel': 'web',
                                    'x-tif-paasid': 'undefined',
                                    'x-tif-signature': capturedEncRequest.headers['x-tif-signature'],
                                    'x-tif-timestamp': capturedEncRequest.headers['x-tif-timestamp'],
                                    'x-tif-nonce': capturedEncRequest.headers['x-tif-nonce'],
                                },
                                body: JSON.parse(capturedEncRequest.body),
                                url: capturedEncRequest.url,
                            });
                        }
                        if (waited > 40) {
                            clearInterval(checkTimer);
                            reject(new Error('Timeout waiting for encrypted request'));
                        }
                    }, 500);
                }, 500);
            } else {
                // Method 2: Try to call the API directly via event bus
                if (win.__vueEventBus && typeof win.__vueEventBus.$emit === 'function') {
                    try {
                        win.__vueEventBus.$emit('searchMedical', { keyword, pageNum, pageSize });
                    } catch(e) {
                        reject(new Error(`EventBus emit error: ${e.message}`));
                    }
                } else {
                    reject(new Error('No search input found and no event bus available'));
                }
            }
        } catch(e) {
            reject(e);
        }
    });
}

// ===========================================================
// Main
// ===========================================================

async function main() {
    await init();

    // CLI mode
    if (process.argv.length > 2) {
        const cmd = process.argv[2];
        const input = process.argv[3] || '{}';

        if (cmd === 'encrypt') {
            try {
                const result = await encrypt(JSON.parse(input));
                console.log(JSON.stringify({ id: 1, result }));
            } catch(e) {
                console.log(JSON.stringify({ id: 1, error: { message: e.message } }));
            }
        } else if (cmd === 'test') {
            // Just verify initialization
            console.log(JSON.stringify({
                id: 1,
                result: {
                    ready: isReady,
                    hasCrypto: !!smCrypto,
                    hasApiService: !!apiService,
                    lastSelectByKeys: capturedEncRequest ? {
                        sig: capturedEncRequest.headers['x-tif-signature'],
                        body: capturedEncRequest.body,
                    } : null,
                }
            }));
        }
        process.exit(0);
    }

    // JSON-RPC stdin mode
    log('Ready for JSON-RPC');
    const rl = readline.createInterface({ input: process.stdin });

    rl.on('line', async (line) => {
        let reqId = 0;
        try {
            const req = JSON.parse(line);
            reqId = req.id;
            const { method, params } = req;

            if (method === 'encrypt') {
                const result = await encrypt(params || {});
                respond(reqId, { encrypted: result });
            } else if (method === 'ping') {
                respond(reqId, { pong: true });
            } else if (method === 'status') {
                respond(reqId, {
                    ready: isReady,
                    hasCrypto: !!smCrypto,
                    hasApiService: !!apiService,
                });
            } else {
                respond(reqId, null, { message: `Unknown: ${method}` });
            }
        } catch(e) {
            respond(reqId, null, { message: e.message });
        }
    });

    respond(0, { status: 'ready' });

    function respond(id, result, error) {
        const resp = { id };
        if (error) resp.error = error;
        else resp.result = result;
        process.stdout.write(JSON.stringify(resp) + '\n');
    }
}

main().catch(e => {
    log(`Fatal: ${e.message}`);
    process.exit(1);
});
