/**
 * Find SM4 key by brute-forcing with the exported crypto module
 *
 * We know:
 * - encData "4A8E4673BB18D86FE780DACC31C49FE3" for selectByKeys
 * - The encrypted plaintext is short (1-15 bytes for 1-block CBC)
 * - sm3.default is available for hashing
 * - sm4.encrypt is available
 */
const fs = require('fs');
const path = require('path');

const APP_JS = path.join(__dirname, 'config', 'app.js');
let source = fs.readFileSync(APP_JS, 'utf-8');

// Simple patch: just export sm-crypto
const pattern = `_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };`;
const idx = source.indexOf(pattern);
if (idx < 0) { console.error('Pattern not found'); process.exit(1); }

const insert = `;window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};`;
const patched = source.substring(0, idx + pattern.length) + insert + source.substring(idx + pattern.length);

console.error(`[patch] Done, size: ${(patched.length/1024/1024).toFixed(1)}MB`);

// jsdom
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
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

console.error('[test] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    const crypto = win.__c;
    if (!crypto) { console.error('NO CRYPTO'); process.exit(1); }

    console.error('Crypto exported!');

    const sm3 = crypto.sm3.default;
    const sm4encrypt = crypto.sm4.encrypt;
    const sm4decrypt = crypto.sm4.decrypt;

    // Test basic functionality
    console.error(`sm3("test") = ${sm3("test")}`);
    console.error(`sm3("test") should be 55e12e91650d2fec56ec74e1d3e4ddbfce2ef3a65890c2a19ecf88a307e76a23`);
    console.error(`Match: ${sm3("test") === '55e12e91650d2fec56ec74e1d3e4ddbfce2ef3a65890c2a19ecf88a307e76a23'}`);

    // Test SM4 with a known test vector
    try {
        const enc = sm4encrypt('test', '00000000000000000000000000000000', { mode: 'cbc', iv: '00000000000000000000000000000000' });
        console.error(`\nsm4.encrypt("test", zeros): "${enc}"`);
    } catch(e) {
        console.error(`sm4 encrypt err: ${e.message}`);
    }

    // The captured encData for selectByKeys
    const TARGET = '4A8E4673BB18D86FE780DACC31C49FE3';

    // Try to decrypt with various keys
    const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

    // Key candidates
    const candidates = [];

    // From KEY MATERIAL in string table
    const field_a = 'NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P';
    const field_d_b64 = 'AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC';
    const d_bytes = Buffer.from(field_d_b64, 'base64');

    // d_bytes: 33 bytes, try all 16-byte windows
    for (let i = 0; i <= 17; i++) {
        candidates.push({name: `d[${i}:${i+16}]`, key: d_bytes.slice(i, i+16).toString('hex')});
    }

    // SM3 derivations
    candidates.push({name: 'sm3(appCode)[:16]', key: Buffer.from(sm3(APP_CODE), 'hex').slice(0,16).toString('hex')});
    candidates.push({name: 'sm3(appCode)[16:32]', key: Buffer.from(sm3(APP_CODE), 'hex').slice(16,32).toString('hex')});

    // AppCode as hex
    const acHex = Buffer.from(APP_CODE, 'ascii').toString('hex');
    candidates.push({name: 'ac_hex[:16]', key: acHex.substring(0,32)});
    candidates.push({name: 'ac_hex[16:32]', key: acHex.substring(32,64)});
    candidates.push({name: 'ac_ascii[:16]', key: Buffer.from(APP_CODE).slice(0,16).toString('hex')});

    // SHA256
    const sha256 = require('crypto').createHash('sha256').update(APP_CODE).digest('hex');
    candidates.push({name: 'sha256(ac)[:16]', key: sha256.substring(0,32)});

    // Zero key
    candidates.push({name: 'zeros', key: '00000000000000000000000000000000'});

    // Try decrypting with each key
    console.error(`\n=== Testing ${candidates.length} keys for decryption ===`);
    console.error(`Target encData: ${TARGET}\n`);

    const IV = '00000000000000000000000000000000';
    const plaintextCandidates = [
        '{}', '""', '[]', JSON.stringify({keys:'all'}), JSON.stringify({data:{}}),
        JSON.stringify({transferFlag:''}), JSON.stringify({type:'all'}),
        '1', '0', 'null', '',
        APP_CODE.substring(0,15),
    ];

    let found = false;

    for (const {name, key} of candidates) {
        // Try decryption
        try {
            const dec = sm4decrypt(TARGET, key, { mode: 'cbc', iv: IV });
            if (dec && dec.length > 0 && dec.length < 100) {
                // Check if it looks valid
                const ascii = Buffer.from(dec, 'hex').toString('utf-8');
                const printable = ascii.replace(/[^\x20-\x7e]/g, '.');
                if (ascii.match(/^[ -~]*$/) || ascii.startsWith('{') || ascii.startsWith('[')) {
                    console.error(`[DEC] ${name}: "${ascii}" (${dec.length/2}B)`);
                }
            }
        } catch(e) {}

        // Try encryption with known plaintext
        for (const pt of plaintextCandidates) {
            try {
                const enc = sm4encrypt(pt, key, { mode: 'cbc', iv: IV });
                if (enc.toUpperCase() === TARGET.toUpperCase()) {
                    console.error(`\n*** MATCH! key=${name} plaintext="${pt}"`);
                    console.error(`    key_hex=${key}`);
                    console.error(`    plaintext=${pt}`);
                    found = true;
                    break;
                }
            } catch(e) {}
        }
        if (found) break;
    }

    if (!found) {
        console.error('\n=== No direct match. Trying decrypt + check... ===');

        // The sm4.decrypt might return hex string
        // Let's try to interpret decrypt results
        for (const {name, key} of candidates) {
            try {
                const dec = sm4decrypt(TARGET, key, { mode: 'cbc', iv: IV });
                if (dec && dec.length > 0) {
                    const hex = Buffer.from(dec, 'hex').toString('utf-8');
                    if (hex.startsWith('{') || hex.startsWith('[')) {
                        console.error(`DECRYPT [${name}]: "${hex.substring(0,50)}"`);
                    }
                }
            } catch(e) {}
        }

        // Try different modes
        console.error('\n=== Trying ECB mode ===');
        for (const {name, key} of candidates) {
            try {
                const enc = sm4encrypt('{}', key, { mode: 'ecb' });
                if (enc.toUpperCase() === TARGET.toUpperCase()) {
                    console.error(`*** ECB MATCH! key=${name} pt="{}"`);
                    found = true;
                    break;
                }
            } catch(e) {}
        }
    }

    if (!found) {
        console.error('\nSM4 key not found with current candidates.');
        console.error('The key may be derived differently (e.g., from a different function).');
    }

    process.exit(0);
}, 10000);

setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 35000);
