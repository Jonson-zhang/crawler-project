/**
 * Extract crypto module by hooking Object.defineProperty
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
    beforeParse(window) {
        // Hook Object.defineProperty BEFORE app.js loads
        const origDP = Object.defineProperty;
        Object.defineProperty = function(obj, prop, desc) {
            if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null) {
                if (desc.value.sm2 && desc.value.sm3 && desc.value.sm4) {
                    window.__nhsa_sm_crypto = desc.value;
                    process.stderr.write(`\n[HOOK] Captured sm-crypto at prop: ${String(prop)}\n`);
                    process.stderr.write(`[HOOK] sm2 keys: ${Object.keys(desc.value.sm2).slice(0,15).join(',')}\n`);
                    process.stderr.write(`[HOOK] sm3 keys: ${Object.keys(desc.value.sm3).slice(0,15).join(',')}\n`);
                    process.stderr.write(`[HOOK] sm4 keys: ${Object.keys(desc.value.sm4).slice(0,15).join(',')}\n`);
                }
                // Also look for any object with generateKeyPairHex
                if (desc.value.generateKeyPairHex && desc.value.doSignature) {
                    window.__nhsa_sm2_module = { name: String(prop), value: desc.value };
                    process.stderr.write(`[HOOK] Found sm2-like module: ${String(prop)}\n`);
                }
                if (desc.value.encrypt && desc.value.decrypt) {
                    window.__nhsa_sm4_module = { name: String(prop), value: desc.value };
                    process.stderr.write(`[HOOK] Found sm4-like module: ${String(prop)}\n`);
                }
            }
            // Also capture functions that look like the request handler
            if (desc.value && typeof desc.value === 'function') {
                const fnStr = desc.value.toString();
                if (fnStr.includes('x-tif-signature') && fnStr.includes('x-tif-timestamp')) {
                    window.__nhsa_sig_handler = { name: String(prop), fn: desc.value };
                    process.stderr.write(`[HOOK] Found sig handler: ${String(prop)}\n`);
                    process.stderr.write(`[HOOK] Func preview: ${fnStr.substring(0, 300)}\n`);
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

const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    const crypto = win.__nhsa_sm_crypto;
    if (crypto) {
        process.stderr.write(`\n=== SM Crypto Module Found ===\n`);

        // Test encryption
        try {
            const kp = crypto.sm2.generateKeyPairHex();
            process.stderr.write(`SM2 generateKeyPairHex: ${JSON.stringify(kp)}\n`);

            const testEnc = crypto.sm4.encrypt('test12345678901', '00000000000000000000000000000000', {
                mode: 'cbc', iv: '00000000000000000000000000000000'
            });
            process.stderr.write(`SM4 encrypt('test12345678901'): ${testEnc}\n`);
            process.stderr.write(`SM4 encrypt length: ${testEnc.length} hex chars\n`);

            // Compare with selectByKeys encData
            // If same key, encrypt(selectByKeys_plaintext) should equal 4A8E4673BB18D86FE780DACC31C49FE3

            // Try to find the API request module
            // The key material should be in the same module as the encryption
        } catch(e) {
            process.stderr.write(`Crypto test error: ${e.message}\n`);
        }
    }

    // Check captured modules
    process.stderr.write(`\n=== Captured ===\n`);
    process.stderr.write(`sm-crypto: ${!!win.__nhsa_sm_crypto}\n`);
    process.stderr.write(`sm2-module: ${!!win.__nhsa_sm2_module}\n`);
    process.stderr.write(`sm4-module: ${!!win.__nhsa_sm4_module}\n`);
    process.stderr.write(`sig-handler: ${!!win.__nhsa_sig_handler}\n`);

    // Also check for the webpack require function
    // In webpack bundles, each module can call require() to get other modules
    // The require function is typically passed as a parameter to each module function

    process.exit(0);
}, 8000);
