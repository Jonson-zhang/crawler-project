/**
 * 注入自定义 webpack 模块来访问模块系统
 * 利用 window.webpackJsonp.push 来注入一个模块，
 * 该模块会捕获 __webpack_require__ 并扫描所有模块
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
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

console.error('[inject] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error('\n=== INJECT CUSTOM MODULE ===');

    // Inject a custom webpack chunk via webpackJsonp.push
    // The chunk format is: [[chunkId], {moduleId: function(module, exports, require) { ... }}]
    const wpArray = win.webpackJsonp;
    if (!wpArray) {
        console.error('webpackJsonp not found!');
        process.exit(0);
    }

    console.error(`webpackJsonp found, pushing injected module...`);

    // Our injected module: captures the require function and module registry
    // webpack JSONP format: [[chunkIds], {modules}, [depChunkIds]]
    wpArray.push([["nhsa_inject"], {
        "nhsa_explorer": function(module, exports, require) {
            var result = { stage: 'loaded' };
            window.__wp_require = require;
            window.__inject_log = [];

            try {
                if (require.m) {
                    var modIds = Object.keys(require.m);
                    result.moduleCount = modIds.length;
                    window.__inject_log.push('m registry: ' + modIds.length + ' modules');

                    var cryptoMods = [];
                    for (var i = 0; i < modIds.length; i++) {
                        try {
                            var modSource = require.m[modIds[i]].toString();
                            if (modSource.indexOf('sm2') >= 0 || modSource.indexOf('sm4') >= 0 ||
                                modSource.indexOf('generateKeyPair') >= 0 || modSource.indexOf('doSignature') >= 0) {
                                cryptoMods.push({ id: modIds[i], length: modSource.length, preview: modSource.substring(0, 150) });
                            }
                        } catch(e2) {}
                    }
                    window.__crypto_modules = cryptoMods;
                    window.__inject_log.push('crypto modules: ' + cryptoMods.length);
                }
            } catch(e) { window.__inject_log.push('m registry error: ' + e.message); }

            try {
                if (require.c) {
                    var cacheIds = Object.keys(require.c);
                    result.cacheCount = cacheIds.length;
                    window.__inject_log.push('c cache: ' + cacheIds.length + ' entries');

                    for (var j = 0; j < cacheIds.length; j++) {
                        try {
                            var exp = require.c[cacheIds[j]].exports;
                            if (exp && typeof exp === 'object') {
                                if (exp.sm2 && exp.sm3 && exp.sm4) {
                                    window.__sm_crypto = exp;
                                    window.__sm_crypto_modId = cacheIds[j];
                                    window.__inject_log.push('SM-CRYPTO found at ' + cacheIds[j]);
                                    try {
                                        var kp = exp.sm2.generateKeyPairHex();
                                        window.__inject_log.push('SM2 test: ' + JSON.stringify(kp).substring(0,60));
                                    } catch(e3) { window.__inject_log.push('SM2 test err: ' + e3.message); }
                                }

                                var keys = Object.keys(exp);
                                if (keys.indexOf('get') >= 0 || keys.indexOf('post') >= 0 || keys.indexOf('request') >= 0) {
                                    if (!exp.sm2) {
                                        window.__possible_apis = window.__possible_apis || [];
                                        window.__possible_apis.push({ modId: cacheIds[j], keys: keys.slice(0,15) });
                                    }
                                }
                            }
                        } catch(e4) {}
                    }
                }
            } catch(e5) { window.__inject_log.push('c cache error: ' + e5.message); }

            window.__inject_result = result;
            module.exports = { injected: true };
        }
    }]);

    // Wait for the injected module to execute, then analyze
    setTimeout(() => {
        console.error('\n=== INJECTION RESULTS ===');

        // Check inject log
        var log = win.__inject_log || [];
        console.error('Inject log:');
        log.forEach(function(l) { console.error('  ' + l); });

        var smCrypto = win.__sm_crypto;
        if (smCrypto) {
            console.error('SM-CRYPTO FOUND at module ' + win.__sm_crypto_modId + '!');
            console.error('  sm2: ' + Object.keys(smCrypto.sm2).filter(function(k){return typeof smCrypto.sm2[k]==='function'}).join(', '));
            console.error('  sm3: ' + Object.keys(smCrypto.sm3).filter(function(k){return typeof smCrypto.sm3[k]==='function'}));
            console.error('  sm4: ' + Object.keys(smCrypto.sm4).filter(function(k){return typeof smCrypto.sm4[k]==='function'}).join(', '));

            // Test SM4
            try {
                var enc = smCrypto.sm4.encrypt('test123456', '00000000000000000000000000000000', {
                    mode: 'cbc', iv: '00000000000000000000000000000000'
                });
                console.error('  SM4 test encrypt("test123456"): ' + enc);
            } catch(e) {
                console.error('  SM4 test error: ' + e.message);
            }
        }

        var apis = win.__possible_apis || [];
        console.error('\nPossible APIs: ' + apis.length);
        apis.forEach(function(a) {
            console.error('  modId=' + a.modId + ' keys=' + a.keys.join(','));
        });

        var cryptoMods = win.__crypto_modules || [];
        console.error('\nCrypto modules (from m registry): ' + cryptoMods.length);
        cryptoMods.forEach(function(m) {
            console.error('  ' + m.id + ': ' + m.length + ' chars');
        });

        // Check inject result
        var result = win.__inject_result;
        if (result) {
            console.error('\nInject result: ' + JSON.stringify(result));
        }

        // If we have the crypto module, save it for later use
        if (smCrypto) {
            // Try to find SM4 key from the module
            // The key is typically used as: sm4.encrypt(data, key, opts)
            // Let's hook sm4.encrypt to capture the actual key used
            console.error('\nHooking SM4.encrypt to capture key...');
            try {
                var origEncrypt = smCrypto.sm4.encrypt;
                win.__sm4_orig_encrypt = origEncrypt;
            } catch(e) {}
        }

        process.exit(0);
    }, 3000);
}, 8000);
