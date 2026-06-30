/**
 * 国家医保局 — 直接调用内部 API 函数
 * ====================================
 *
 * 策略: app.js 已初始化 API 服务层 (_0x189636["k"]),
 * 直接调用它来生成加密请求，绕过 Vue 组件。
 *
 * API 服务 "_0x189636" 是 webpack 模块导出的 API service 对象.
 * "_0x189636.k" 是通用请求方法，接受 {type, data} 参数.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

// Read beautified source
let appSource = fs.readFileSync(APP_JS, 'utf-8');

// ===========================================================
// Patch: expose the API service globally
// ===========================================================
// After app.js loads, find the API service and expose it as window.__nhsa_api

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
    beforeParse(window) {
        // Hook Object.defineProperty to capture the API service module export
        const origDP = Object.defineProperty;
        Object.defineProperty = function(obj, prop, desc) {
            if (desc && desc.value) {
                const v = desc.value;
                // The API service has a method "k" that takes {type, data}
                // We're looking for an object with a "k" method that handles requests
                if (typeof v === 'object' && v !== null && typeof v.k === 'function') {
                    // Check if it looks like the API service
                    const kStr = v.k.toString();
                    if (kStr.length > 100 && kStr.includes('selectByKeys') === false) {
                        // Might be the API service, check deeper
                        const keys = Object.keys(v);
                        if (keys.length > 1 && keys.length < 15) {
                            window.__nhsa_api = v;
                            console.error(`[HOOK] Captured API service: ${String(prop)} keys=${keys.join(',')}`);
                            console.error(`[HOOK] k function preview: ${kStr.substring(0,200)}`);
                        }
                    }
                }
                // Also capture sm-crypto
                if (typeof v === 'object' && v !== null && v.sm2 && v.sm3 && v.sm4) {
                    window.__nhsa_crypto = v;
                    console.error(`[HOOK] Captured sm-crypto: ${String(prop)}`);
                }
            }
            // Capture any function that uses x-tif-signature
            if (desc.value && typeof desc.value === 'function') {
                const fnStr = desc.value.toString();
                if (fnStr.includes('x-tif-signature') || fnStr.includes('signData')) {
                    if (fnStr.length < 5000) {
                        window['__fn_' + String(prop).replace(/[^a-zA-Z0-9]/g, '_')] = fnStr;
                    }
                }
            }
            return origDP.call(Object, obj, prop, desc);
        };
    },
});
const win = dom.window;

win.crypto = {
    getRandomValues(arr) {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
    },
    subtle: {},
};
win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
win.atob = (s) => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };

// XHR intercept
let capturedRequest = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', headers = {};
    xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function(body) {
        if (_url.includes('queryFixedHospital')) {
            capturedRequest = { url: _url, headers: {...headers}, body };
            // Don't actually send
            return;
        }
        os.call(this, body);
    };
    return xhr;
};

console.error('[invoke] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = appSource;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    // Check if API was captured
    const api = win.__nhsa_api;
    if (api) {
        console.error(`Found API service! Keys: ${Object.keys(api).join(', ')}`);

        // Try to call it with queryFixedHospital parameters
        try {
            console.error('\nTrying to call API directly...');
            const kMethod = api.k;

            // The API call in ServiceSearchModule uses:
            // _0x189636["k"][_0x3d231b(0x10e6)]({ type: "queryFixedHospital" })
            // where _0x3d231b(0x10e6) = some method name

            // Let's try different API method names
            const possibleMethods = ['get', 'post', 'request', 'fetch', 'call', 'send', 'invoke'];
            for (const method of possibleMethods) {
                if (typeof kMethod[method] === 'function') {
                    console.error(`  k.${method} exists!`);
                    try {
                        const result = kMethod[method]({
                            type: 'queryFixedHospital',
                            data: {
                                keyword: '医院',
                                pageNum: 1,
                                pageSize: 10,
                            }
                        });
                        if (result && result.then) {
                            result.then(r => {
                                console.error(`  k.${method}() returned: ${JSON.stringify(r).substring(0,300)}`);
                            }).catch(e => {
                                console.error(`  k.${method}() error: ${e.message}`);
                            });
                        }
                    } catch(e) {
                        console.error(`  k.${method}() threw: ${e.message}`);
                    }
                }
            }
        } catch(e) {
            console.error(`API call error: ${e.message}`);
        }
    } else {
        console.error('API service not captured');
    }

    // Check crypto
    const crypto_module = win.__nhsa_crypto;
    if (crypto_module) {
        console.error(`\nCrypto module found!`);
        console.error(`  sm2: ${Object.keys(crypto_module.sm2).filter(k => typeof crypto_module.sm2[k] === 'function').join(', ')}`);
        console.error(`  sm4: ${Object.keys(crypto_module.sm4).filter(k => typeof crypto_module.sm4[k] === 'function').join(', ')}`);

        // Test SM4 encryption
        try {
            const enc = crypto_module.sm4.encrypt('test12345678901', '00000000000000000000000000000000', {
                mode: 'cbc', iv: '00000000000000000000000000000000'
            });
            console.error(`  SM4 test encrypt: ${enc}`);
        } catch(e) {
            console.error(`  SM4 test error: ${e.message}`);
        }

        // Generate SM2 keypair
        try {
            const kp = crypto_module.sm2.generateKeyPairHex();
            console.error(`  SM2 keypair: ${JSON.stringify(kp).substring(0,200)}`);
        } catch(e) {
            console.error(`  SM2 keypair error: ${e.message}`);
        }
    }

    // List captured functions
    console.error('\nCaptured functions:');
    const fnKeys = Object.keys(win).filter(k => k.startsWith('__fn_'));
    fnKeys.forEach(k => {
        console.error(`  ${k}: ${win[k].substring(0, 150)}`);
    });

    // Check capturedRequest
    if (capturedRequest) {
        console.error(`\n=== Captured queryFixedHospital ===`);
        console.error(`Headers: ${JSON.stringify(capturedRequest.headers, null, 2)}`);
        console.error(`Body: ${capturedRequest.body}`);
    }

    process.exit(0);
}, 8000);
