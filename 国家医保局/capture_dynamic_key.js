/**
 * 捕获动态SM2密钥 + 测试签名公式
 * 核心假设: x-tif-signature 包含 sm2.generateKeyPairHex() 产生的公钥
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto from 68b2
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' +
    src.substring(i1 + p1.length);
const off1 = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// Patch 2: export all modules
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + off1;
const ins2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"]),';
patched = patched.substring(0, i2 + p2.length) + ins2 + patched.substring(i2 + p2.length);

const dom = new JSDOM('<html><body></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { crypto.randomFillSync(a); return a; }, subtle: {} };
win.btoa = s => Buffer.from(s, 'binary').toString('base64');
win.atob = s => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function () { };
win.TextEncoder.prototype.encode = s => Buffer.from(s, 'utf-8');

// XHR intercept
let captured = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function (b) {
        if (u.includes('selectByKeys')) captured = { url: u, headers: { ...h }, body: b };
        os.call(this, b);
    };
    return x;
};

console.error('[capture] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

// Helper: wordArray to hex
function wa2hex(wa) {
    if (typeof wa === 'string') return wa;
    const w = wa.words, s = wa.sigBytes;
    let h = '';
    for (let i = 0; i < s; i++) h += ('0' + ((w[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff).toString(16)).slice(-2);
    return h;
}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

    // Step 1: generate SM2 keypair using internal module
    // Module 4d09 has default.generateKeyPairHex
    let kp = null;
    const sm2mod = win._m4d09;
    if (sm2mod && sm2mod.default && sm2mod.default.generateKeyPairHex) {
        kp = sm2mod.default.generateKeyPairHex();
        console.error('Generated keypair:');
        console.error('  publicKey: ' + kp.publicKey);
        console.error('  privateKey: ' + (kp.privateKey || 'none'));
    } else {
        console.error('Cannot generate keypair via _m4d09.default');
        // Try other approaches
        if (sm2mod && sm2mod.generateKeyPairHex) {
            kp = sm2mod.generateKeyPairHex();
            console.error('  via _m4d09 directly: ' + JSON.stringify(kp).substring(0, 100));
        }
    }

    // Check captured request
    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        const ts = captured.headers['x-tif-timestamp'];
        const nonce = captured.headers['x-tif-nonce'];
        const body = captured.body;

        console.error('\nCaptured:');
        console.error('  sig: ' + sig);
        console.error('  ts: ' + ts);
        console.error('  nonce: ' + nonce);
        console.error('  body: ' + body.substring(0, 300));

        const SHA256 = (s) => {
            const mod = win._m21bf;
            return mod ? wa2hex(mod.SHA256(s)) : crypto.createHash('sha256').update(s).digest('hex');
        };

        // Test: does the signature contain the public key?
        if (kp) {
            // Try pubkey in various positions
            const tests = [
                ['AC+pubkey+ts+nonce+body', AC + kp.publicKey + ts + nonce + body],
                ['pubkey+ts+nonce+body', kp.publicKey + ts + nonce + body],
                ['AC+pubkey+ts+nonce', AC + kp.publicKey + ts + nonce],
                ['pubkey+AC+ts+nonce+body', kp.publicKey + AC + ts + nonce + body],
                ['ts+nonce+pubkey+body', ts + nonce + kp.publicKey + body],
                ['AC+ts+nonce+pubkey+body', AC + ts + nonce + kp.publicKey + body],
            ];

            for (const [name, val] of tests) {
                const h = SHA256(val);
                if (h === sig) {
                    console.error('\n*** MATCH: ' + name + ' ***');
                    console.error('    Input: ' + val.substring(0, 300));
                }
            }

            // Also try SM3
            const sm3 = win.__c.sm3;
            if (sm3 && sm3.default) {
                const sm3Hash = s => sm3.default(s);
                for (const [name, val] of tests) {
                    const h = sm3Hash(val);
                    if (h === sig) {
                        console.error('\n*** SM3 MATCH: ' + name + ' ***');
                    }
                }
            }
        }

        // Check: does the app actually use generateKeyPairHex?
        // We can find out by checking if the signData was signed with appCode or with a generated key
        // The signData base64 signature length tells us which key was used
        const bodyObj = JSON.parse(body);
        const signData64 = bodyObj.data.signData;
        const signDataBytes = Buffer.from(signData64, 'base64');
        console.error('\nsignData length: ' + signDataBytes.length + ' bytes');

        // Verify SM2 signature: does it verify with APP_CODE as public key?
        // SM2 signature: 64 bytes for r||s
        // But the signData is 70 bytes because it includes DER encoding overhead
        const sm2 = require('sm-crypto').sm2;
        const inner = bodyObj.data;
        const innerNoSignData = { ...inner };
        delete innerNoSignData.signData;
        const msg = JSON.stringify(innerNoSignData);
        const sm2PrivHex = Buffer.from(AC, 'ascii').toString('hex');

        // Get public key from private key
        try {
            // sm-crypto might not have getPublicKeyFromPrivateKey in npm version
            // But we can verify by signing the same message and comparing
            const mySig = sm2.doSignature(msg, sm2PrivHex, { hash: true });
            const mySigBytes = Buffer.from(mySig, 'base64');
            console.error('My sign length: ' + mySigBytes.length + ' bytes');
            console.error('App sign length: ' + signDataBytes.length + ' bytes');

            // If lengths differ, app uses a different SM2 key!
            if (mySigBytes.length === signDataBytes.length) {
                console.error('Signature lengths match! (same key?)');
            } else {
                console.error('Signature lengths DIFFER → App uses different SM2 key!');
                // The actual SM2 key might be from generateKeyPairHex
            }
        } catch (e) {
            console.error('SM2 verify error: ' + e.message);
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
