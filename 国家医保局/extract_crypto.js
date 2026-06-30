/**
 * Extract encryption functions and keys from jsdom
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
win.TextEncoder = function() {};
win.TextEncoder.prototype.encode = function(str) { return Buffer.from(str, 'utf-8'); };

const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    // Find the sm-crypto module through the webpack module system
    // In webpack bundles, we can access the module registry

    // Try to find any object that has sm2/sm3/sm4 properties
    function searchForCryptoModule(obj, path, visited) {
        if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
        visited.add(obj);

        try {
            const keys = Object.keys(obj);
            // Check if this object looks like the sm-crypto module
            const hasSm2 = keys.includes('sm2');
            const hasSm3 = keys.includes('sm3');
            const hasSm4 = keys.includes('sm4');

            if (hasSm2 && hasSm3 && hasSm4) {
                process.stderr.write(`\n*** FOUND sm-crypto at: ${path}\n`);
                process.stderr.write(`  sm2 keys: ${Object.keys(obj.sm2).slice(0, 10).join(', ')}\n`);
                process.stderr.write(`  sm3 keys: ${Object.keys(obj.sm3).slice(0, 10).join(', ')}\n`);
                process.stderr.write(`  sm4 keys: ${Object.keys(obj.sm4).slice(0, 10).join(', ')}\n`);

                // Try to call generateKeyPair
                if (obj.sm2.generateKeyPairHex) {
                    const kp = obj.sm2.generateKeyPairHex();
                    process.stderr.write(`\n  generateKeyPairHex result: ${JSON.stringify(kp)}\n`);
                }

                // Try SM4 encrypt with known test
                if (obj.sm4.encrypt) {
                    const testEnc = obj.sm4.encrypt('test', '00000000000000000000000000000000', {
                        mode: 'cbc', iv: '00000000000000000000000000000000'
                    });
                    process.stderr.write(`  SM4 encrypt test: ${testEnc}\n`);
                }

                // Store reference
                win.__nhsa_crypto = obj;
                return true;
            }

            // Also check for generateKeyPairHex anywhere
            if (keys.includes('generateKeyPairHex') && keys.includes('doSignature')) {
                process.stderr.write(`\n*** FOUND sm2-like at: ${path}\n`);
                process.stderr.write(`  keys: ${keys.slice(0, 15).join(', ')}\n`);
            }

            // Don't go too deep
            if (path.split('.').length < 5) {
                for (const key of keys.slice(0, 30)) {
                    if (['window', 'self', 'top', 'parent', 'document', 'location'].includes(key)) continue;
                    try {
                        searchForCryptoModule(obj[key], `${path}.${key}`, visited);
                    } catch(e) {}
                }
            }
        } catch(e) {}
    }

    process.stderr.write('Searching for crypto module...\n');
    const visited = new Set();
    searchForCryptoModule(win, 'window', visited);

    if (!win.__nhsa_crypto) {
        process.stderr.write('\nCould not find crypto module via scanning.\n');
        process.stderr.write('Trying webpack module cache approach...\n');

        // Try to find webpack modules by scanning for the webpack module cache
        // Webpack stores modules in an array/object keyed by module ID
        for (const key of Object.keys(win)) {
            try {
                const val = win[key];
                if (val && typeof val === 'object' && val.m && typeof val.m === 'object') {
                    process.stderr.write(`\nFound webpack module cache at window.${key}.m\n`);
                    process.stderr.write(`Modules count: ${Object.keys(val.m).length}\n`);

                    // Look for the sm-crypto module
                    // Search each module for sm2/sm3/sm4
                    let found = 0;
                    for (const modId of Object.keys(val.m)) {
                        try {
                            const mod = val.m[modId];
                            if (mod && mod.exports) {
                                const exp = mod.exports;
                                if (typeof exp === 'object' && exp.sm2 && exp.sm3 && exp.sm4) {
                                    process.stderr.write(`  Module ${modId}: {sm2, sm3, sm4}\n`);
                                    win.__nhsa_crypto = exp;
                                    found++;
                                    if (found > 3) break;
                                }
                            }
                        } catch(e) {}
                    }
                    if (found > 0) break;
                }
            } catch(e) {}
        }
    }

    // Try the x-tif-signature hash computation
    if (win.__nhsa_crypto) {
        process.stderr.write('\nExtracting x-tif-signature function...\n');

        // Look for the signature computation function
        // It's typically in the same webpack module as the API service
    }

    // Dump what we know
    if (win.__nhsa_crypto) {
        const crypto = win.__nhsa_crypto;
        process.stderr.write(`\n=== Crypto Module ===\n`);
        process.stderr.write(`sm2 functions: ${Object.keys(crypto.sm2).filter(k => typeof crypto.sm2[k] === 'function').join(', ')}\n`);
        process.stderr.write(`sm4 functions: ${Object.keys(crypto.sm4).filter(k => typeof crypto.sm4[k] === 'function').join(', ')}\n`);
        process.stderr.write(`sm3 functions: ${Object.keys(crypto.sm3).filter(k => typeof crypto.sm3[k] === 'function').join(', ')}\n`);

        // Generate a keypair and try encrypting with known plaintext
        const kp = crypto.sm2.generateKeyPairHex();
        process.stderr.write(`\nSM2 KeyPair:\n  publicKey: ${kp.publicKey}\n  privateKey: ${kp.privateKey}\n`);
    }

    process.exit(0);
}, 5000);
