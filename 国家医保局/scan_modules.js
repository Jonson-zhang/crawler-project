/**
 * 扫描 webpack 模块缓存，找到加密模块和 API 服务
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
let appSource = fs.readFileSync(APP_JS, 'utf-8');

// ===========================================================
// Inject hook BEFORE webpack bootstraps
// ===========================================================
// The app.js webpack runtime uses `_0xe330b8` as the modules parameter.
// We inject code to capture the webpack require function.

const INJECT = `
(function() {
    // Hook the webpack jsonp callback
    var _origDefineProperty = Object.defineProperty;

    // Try to capture all exports as they're defined
    Object.defineProperty = function(obj, prop, desc) {
        if (desc && desc.value && typeof desc.value === 'function') {
            var fnStr = desc.value.toString();
            if (fnStr.includes('x-tif-signature') && fnStr.length < 10000) {
                window.__sig_related = { prop: String(prop), fn: fnStr };
            }
            if (fnStr.includes('encData') && fnStr.includes('signData') && fnStr.length < 5000) {
                window.__encrypt_related = { prop: String(prop), fn: fnStr };
            }
        }
        if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null) {
            var v = desc.value;
            if (v.sm2 && v.sm4) {
                window.__crypto_module = v;
                window.__crypto_prop = String(prop);
            }
            // Look for modules with request-related methods
            if (typeof v.k === 'function' || typeof v.get === 'function' || typeof v.post === 'function') {
                var keys = Object.keys(v);
                if (keys.length >= 2) {
                    window.__possible_apis = window.__possible_apis || [];
                    window.__possible_apis.push({ prop: String(prop), keys: keys.slice(0,15) });
                }
            }
        }
        return _origDefineProperty.call(Object, obj, prop, desc);
    };

    // Also hook Object.keys, Object.assign for module scanning
    var _origAssign = Object.assign;
    Object.assign = function() {
        var result = _origAssign.apply(this, arguments);
        for (var i = 1; i < arguments.length; i++) {
            var src = arguments[i];
            if (src && typeof src === 'object') {
                if (src.sm2 && src.sm4) {
                    window.__crypto_module = src;
                }
                if (typeof src.k === 'function' && !src.sm2) {
                    var ks = Object.keys(src);
                    window.__possible_apis = window.__possible_apis || [];
                    window.__possible_apis.push({ source: 'assign', keys: ks.slice(0,15) });
                }
            }
        }
        return result;
    };

    window.__nhsa_scan_ready = true;
})();
`;

// Inject into the HTML before app.js
const dom = new JSDOM(`<html><body><div id="app"></div><script>${INJECT}</script></body></html>`, {
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

// XHR intercept
let capturedReq = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let _url = '', headers = {};
    xhr.open = function(m, u) { _url = u; return oo.apply(this, arguments); };
    xhr.setRequestHeader = function(k, v) { headers[k] = v; return osr.apply(this, arguments); };
    xhr.send = function(body) {
        if (_url.includes('selectByKeys') || _url.includes('queryFixedHospital')) {
            capturedReq = { url: _url, headers: {...headers}, body };
        }
        os.call(this, body);
    };
    return xhr;
};

console.error('[scan] Loading app.js...');
const script = win.document.createElement('script');
script.textContent = appSource;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    console.error('\n=== SCAN RESULTS ===\n');

    // 1. Check captured crypto
    const crypto_mod = win.__crypto_module;
    if (crypto_mod) {
        console.error(`CRYPTO MODULE FOUND at prop: ${win.__crypto_prop}`);
        console.error(`  sm2 methods: ${Object.keys(crypto_mod.sm2).filter(k=>typeof crypto_mod.sm2[k]==='function').join(', ')}`);
        console.error(`  sm3 methods: ${Object.keys(crypto_mod.sm3).filter(k=>typeof crypto_mod.sm3[k]==='function').join(', ')}`);
        console.error(`  sm4 methods: ${Object.keys(crypto_mod.sm4).filter(k=>typeof crypto_mod.sm4[k]==='function').join(', ')}`);

        // Save for later use
        global.__crypto = crypto_mod;
    }

    // 2. Check captured signature function
    const sigFn = win.__sig_related;
    if (sigFn) {
        console.error(`\nSIGNATURE-RELATED FUNCTION:`);
        console.error(`  prop: ${sigFn.prop}`);
        console.error(`  preview: ${sigFn.fn.substring(0, 500)}`);
    }

    // 3. Check captured encrypt function
    const encFn = win.__encrypt_related;
    if (encFn) {
        console.error(`\nENCRYPT-RELATED FUNCTION:`);
        console.error(`  prop: ${encFn.prop}`);
        console.error(`  preview: ${encFn.fn.substring(0, 500)}`);
    }

    // 4. Check possible APIs
    const apis = win.__possible_apis || [];
    console.error(`\nPOSSIBLE API SERVICES: ${apis.length}`);
    apis.forEach((a, i) => {
        console.error(`  [${i}] source=${a.source}, prop=${a.prop}, keys=${a.keys.join(',')}`);
    });

    // 5. Deep scan window for objects with k/get/post method
    console.error(`\n=== DEEP SCAN WINDOW ===`);
    const visited = new Set();

    function findApi(obj, name, depth) {
        if (depth > 3 || !obj || typeof obj !== 'object' || visited.has(obj)) return;
        visited.add(obj);
        try {
            const keys = Object.keys(obj);
            if (keys.includes('k') && typeof obj.k === 'object' && obj.k) {
                const kKeys = Object.keys(obj.k);
                if (kKeys.includes('get') || kKeys.includes('post') || kKeys.includes('request')) {
                    console.error(`  API FOUND at ${name}`);
                    console.error(`    keys: ${keys.slice(0,10).join(',')}`);
                    console.error(`    k keys: ${kKeys.slice(0,10).join(',')}`);
                }
            }
            // Scan deeper
            for (const key of keys.slice(0, 30)) {
                if (['window','self','top','parent','document','location','console','navigator',
                     'screen','history','localStorage','sessionStorage','crypto','performance',
                     'XMLHttpRequest','fetch','WebSocket','Worker','setTimeout','setInterval',
                     'Array','Object','String','Number','Boolean','Function','Math','Date','RegExp',
                     'Promise','Symbol','Map','Set','WeakMap','Error','JSON'].includes(key)) continue;
                if (key.startsWith('__') || key.startsWith('on')) continue;
                try { findApi(obj[key], `${name}.${key}`, depth+1); } catch(e) {}
            }
        } catch(e) {}
    }

    findApi(win, 'window', 0);

    // 6. Check for __vueEventBus methods
    const vueBus = win.__vueEventBus;
    if (vueBus) {
        console.error(`\n=== Vue EventBus Methods ===`);
        const methods = Object.keys(vueBus).filter(k => typeof vueBus[k] === 'function');
        console.error(`  Methods: ${methods.join(', ')}`);
    }

    // 7. Scan Object.keys(win) for anything with "api" or "service"
    const winKeys = Object.keys(win);
    const apiKeys = winKeys.filter(k => /api|service|request|http|axios/i.test(k));
    console.error(`\n=== API-related window keys ===`);
    console.error(`  ${apiKeys.join(', ') || 'none'}`);

    // 8. XHR capture
    if (capturedReq) {
        console.error(`\n=== Captured XHR ===`);
        console.error(`  URL: ${capturedReq.url}`);
        console.error(`  Headers:`);
        for (const [k,v] of Object.entries(capturedReq.headers)) {
            console.error(`    ${k}: ${v}`);
        }
    }

    process.exit(0);
}, 8000);
