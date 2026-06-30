/**
 * 国家医保局 — 在 jsdom 中加载 app.js 提取加密模块
 * ===================================================
 *
 * 用法: node extract_crypto_node.js
 *
 * 输出 JSON: { sm2Keys: [...], sm4Keys: [...], functions: [...] }
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');

console.error('[extract] Reading app.js...');
const appCode = fs.readFileSync(APP_JS, 'utf-8');
console.error(`[extract] app.js: ${(appCode.length / 1024 / 1024).toFixed(1)}MB`);

// ═══════════════════════════════════════════════════════════════
// 1. 创建 jsdom 环境
// ═══════════════════════════════════════════════════════════════

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
    resources: 'usable',
});

const win = dom.window;
const doc = win.document;

// ═══════════════════════════════════════════════════════════════
// 2. 环境补丁
// ═══════════════════════════════════════════════════════════════

// Crypto
if (!win.crypto || !win.crypto.getRandomValues) {
    const nodeCrypto = require('crypto');
    win.crypto = {
        getRandomValues: function(arr) {
            const bytes = nodeCrypto.randomBytes(arr.length);
            for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
            return arr;
        },
        subtle: {},
        randomUUID: () => nodeCrypto.randomUUID(),
    };
}

// btoa/atob
if (!win.btoa) {
    win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
    win.atob = (s) => Buffer.from(s, 'base64').toString('binary');
}

// 额外全局
win.innerWidth = 1920;
win.innerHeight = 1080;
win.outerWidth = 1920;
win.outerHeight = 1080;
win.screenX = 0;
win.screenY = 0;
win.pageXOffset = 0;
win.pageYOffset = 0;

// ═══════════════════════════════════════════════════════════════
// 3. 模块拦截
// ═══════════════════════════════════════════════════════════════

const captured = {};

const origDP = Object.defineProperty;
let interceptCount = 0;
Object.defineProperty = function(obj, prop, desc) {
    if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null) {
        const v = desc.value;
        if (v.sm2 && v.sm3 && v.sm4) {
            captured.smCrypto = { obj: prop, keys: Object.keys(v) };
            win.__nhsa_sm = v;
            console.error(`[CAPTURE] sm2/sm3/sm4 module found as "${prop}"`);
        }
        if (v.generateKeyPairHex && v.doSignature) {
            captured.sm2Module = { obj: prop, keys: Object.keys(v) };
            console.error(`[CAPTURE] SM2 module found as "${prop}"`);
        }
        interceptCount++;
    }
    return origDP.call(Object, obj, prop, desc);
};

// Also intercept module exports pattern: exports.sm2 = ...
const origSet = Object.prototype.__defineSetter__ || (() => {});
// Watch for require/exports pattern too
const _moduleDefine = {};
const origAssign = Object.assign;
Object.assign = function(target, ...sources) {
    for (const src of sources) {
        if (src && typeof src === 'object' && (src.sm2 || src.generateKeyPairHex)) {
            if (src.sm2 && src.sm3 && src.sm4) {
                captured.assign_sm = Object.keys(src);
                win.__nhsa_sm = src;
                console.error(`[CAPTURE] sm module via Object.assign`);
            }
        }
    }
    return origAssign.call(Object, target, ...sources);
};

// ═══════════════════════════════════════════════════════════════
// 4. 加载 app.js
// ═══════════════════════════════════════════════════════════════

console.error('[extract] Evaluating app.js in jsdom...');
try {
    const script = doc.createElement('script');
    script.textContent = appCode;
    doc.body.appendChild(script);
} catch (e) {
    console.error(`[extract] app.js threw: ${e.message}`);
}

// Drain any pending operations
setTimeout(() => {
    // 恢复 Object.defineProperty
    Object.defineProperty = origDP;
    Object.assign = origAssign;

    // ═══════════════════════════════════════════════════════════
    // 5. 深度搜索加密模块
    // ═══════════════════════════════════════════════════════════

    const results = {
        captured: captured,
        foundInWindow: [],
        foundInGlobal: [],
        interceptCount: interceptCount,
    };

    // 搜索 window 上的所有对象
    for (const key of Object.getOwnPropertyNames(win)) {
        try {
            const v = win[key];
            if (typeof v === 'object' && v !== null && v !== win && v !== win.document) {
                const ks = Object.keys(v);
                if (ks.includes('generateKeyPairHex') || ks.includes('doSignature')) {
                    results.foundInWindow.push({ key, keys: ks.slice(0, 15) });
                }
            }
        } catch (e) {}
    }

    // 搜索全局 (Node.js global)
    for (const key of Object.getOwnPropertyNames(global)) {
        try {
            const v = global[key];
            if (typeof v === 'object' && v !== null && v !== global) {
                const ks = Object.keys(v);
                if (ks.includes('generateKeyPairHex') || ks.includes('doSignature')) {
                    results.foundInGlobal.push({ key, keys: ks.slice(0, 15) });
                }
            }
        } catch (e) {}
    }

    // 如果在 win.__nhsa_sm 中找到模块，测试它
    if (win.__nhsa_sm) {
        const sm = win.__nhsa_sm;
        results.smFunctions = {
            sm2Type: typeof sm.sm2,
            sm3Type: typeof sm.sm3,
            sm4Type: typeof sm.sm4,
        };

        // 测试 generateKeyPairHex
        if (sm.sm2 && typeof sm.sm2.generateKeyPairHex === 'function') {
            try {
                const kp = sm.sm2.generateKeyPairHex();
                results.testKeypair = {
                    publicKey: kp.publicKey ? kp.publicKey.substring(0, 30) : 'no publicKey',
                    privateKey: kp.privateKey ? kp.privateKey.substring(0, 30) : 'no privateKey',
                };
            } catch (e) {
                results.testKeypairError = e.message;
            }
        }

        // 测试 SM4 加密
        if (sm.sm4 && typeof sm.sm4.encrypt === 'function') {
            try {
                const key = '0123456789abcdeffedcba9876543210';
                const enc = sm.sm4.encrypt('hello', key);
                results.testSm4 = {
                    encryptResult: enc ? enc.substring(0, 20) : 'null',
                };
            } catch (e) {
                results.testSm4Error = e.message;
            }
        }
    }

    console.log(JSON.stringify(results, null, 2));
    process.exit(0);

}, 1000);
