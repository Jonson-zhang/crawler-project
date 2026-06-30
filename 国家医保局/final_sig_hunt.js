/**
 * 终极签名追踪: patch generateKeyPairHex + export all + test formulas
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// ============================================================
// Patch 1: export crypto from 68b2
// ============================================================
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";' +
    src.substring(i1 + p1.length);
let baseOff = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";'.length;

// ============================================================
// Patch 2: export all modules
// ============================================================
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + baseOff;
const ins2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"]),';
patched = patched.substring(0, i2 + p2.length) + ins2 + patched.substring(i2 + p2.length);
baseOff += ins2.length;

// ============================================================
// Patch 3: capture generateKeyPairHex result (the REAL app keypair)
// Line 97619: _0x7c17d3[_0x16487d(0x254e)] = { ... generateKeyPairHex: _0x13a32a ... };
// _0x13a32a defined at line 97476
// Patch: at the RETURN statement of _0x13a32a, save to window
// Actually simpler: wrap the export object to intercept generateKeyPairHex
// ============================================================
// Find: _0x7c17d3[_0x16487d(0x254e)] = {
const p3 = '_0x7c17d3[_0x16487d(0x254e)] = {';
const i3raw = src.indexOf(p3);
if (i3raw > 0) {
    // After this line, the next line has generateKeyPairHex: _0x13a32a,
    // We insert a wrapper
    // Before the export, save reference and wrap
    const ins3 = 'window.__sm2_ec=_0x7c17d3;var _nhsa_orig_gkh=_0x13a32a;' +
        '_0x13a32a=function(){var r=_nhsa_orig_gkh();window.__real_kp=r;window.__real_kp_ts=Date.now();return r;};';
    const i3 = i3raw < i1 ? i3raw : (i3raw < i2raw ? i3raw + baseOff : i3raw + baseOff);
    patched = patched.substring(0, i3) + ins3 + patched.substring(i3);
    console.error('[patch] generateKeyPairHex hook inserted at ' + i3raw);
} else {
    console.error('[patch] generateKeyPairHex export NOT found');
}

// ============================================================
// jsdom
// ============================================================
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
        if (u.includes('selectByKeys') || u.includes('queryFixedHospital')) {
            captured = {
                url: u,
                headers: { ...h },
                body: b,
                // Also capture the KEYPAIR that was generated BEFORE this request
                kp: win.__real_kp ? {
                    publicKey: win.__real_kp.publicKey,
                    privateKey: win.__real_kp.privateKey,
                } : null,
            };
        }
        os.call(this, b);
    };
    return x;
};

console.error('[hunt] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

function wa2hex(wa) {
    if (typeof wa === 'string') return wa;
    const w = wa.words, s = wa.sigBytes;
    let h = '';
    for (let i = 0; i < s; i++) h += ('0' + ((w[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff).toString(16)).slice(-2);
    return h;
}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    const realKp = win.__real_kp;
    if (realKp) {
        console.error('*** REAL APP KEYPAIR CAPTURED! ***');
        console.error('publicKey: ' + realKp.publicKey);
        console.error('privateKey: ' + (realKp.privateKey || 'none'));
        console.error('privateKey hex: ' + (realKp.privateKey ? realKp.privateKey.substring(0, 64) + '...' : 'none'));
    } else {
        console.error('Keypair NOT captured — hook may have failed');
    }

    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        const ts = captured.headers['x-tif-timestamp'];
        const nonce = captured.headers['x-tif-nonce'];
        const body = captured.body;
        const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

        console.error('\nCaptured request:');
        console.error('  sig: ' + sig);
        console.error('  ts: ' + ts);
        console.error('  nonce: ' + nonce);

        const SHA256 = (s) => wa2hex(win._m21bf.SHA256(s));

        // Test: SHA256(pubkey + ts + nonce + body)
        if (realKp) {
            const pk = realKp.publicKey;
            const tests = {
                'pk+ts+nonce+body': pk + ts + nonce + body,
                'pk+AC+ts+nonce+body': pk + AC + ts + nonce + body,
                'AC+ts+nonce+pk+body': AC + ts + nonce + pk + body,
                'pk+ts+nonce': pk + ts + nonce,
                'AC+pk+ts+nonce+body': AC + pk + ts + nonce + body,
                'ts+nonce+pk+body': ts + nonce + pk + body,
                'pk+body': pk + body,
                'pk+ts+body': pk + ts + body,
            };

            for (const [name, val] of Object.entries(tests)) {
                const h = SHA256(val);
                if (h === sig) {
                    console.error('\n*** MATCH: ' + name + ' ***');
                    console.error('    Input: ' + val.substring(0, 300));
                }
            }

            // Also try WITHOUT the body (signature might be computed before body finalization)
            // The body has signData which is computed AFTER encryption but BEFORE x-tif-signature?
            // Wait, x-tif-signature is a REQUEST header — it can't include the body's signData
            // if signData is computed based on something that includes x-tif-signature (circular)
            // Actually, looking at the request flow:
            // 1. SM4 encrypt params → encData
            // 2. Build inner object with encData
            // 3. SM2 sign inner object → signData
            // 4. Build full body with signData
            // 5. Compute x-tif-signature from (some input including body)
            // 6. Send request with headers + body

            // So signData IS in the body when x-tif-signature is computed.

            // What if signature is SM3 instead of SHA256?
            const sm3mod = win.__c.sm3;
            if (sm3mod && sm3mod.default) {
                const SM3 = (s) => sm3mod.default(s);
                for (const [name, val] of Object.entries(tests)) {
                    const h = SM3(val);
                    if (h === sig) {
                        console.error('\n*** SM3 MATCH: ' + name + ' ***');
                        console.error('    Input: ' + val.substring(0, 300));
                    }
                }
            }
        }

        // Also test: the pubkey might come from a DIFFERENT source
        // The charCodeAt capture showed: &key=NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P
        // This "key" field might actually be the raw bytes of some derived value
    }

    // Verify: does the captured signData verify with the captured public key?
    if (realKp && captured) {
        const bodyObj = JSON.parse(captured.body);
        const inner = bodyObj.data;
        const innerCopy = { ...inner };
        delete innerCopy.signData;
        const msg = JSON.stringify(innerCopy);

        try {
            const sm2 = require('sm-crypto').sm2;
            const verified = sm2.doVerifySignature(msg, inner.signData, realKp.publicKey, { hash: true });
            console.error('\nsignData verified with captured pubkey (hash:true): ' + verified);

            const verified2 = sm2.doVerifySignature(msg, inner.signData, realKp.publicKey, { hash: false });
            console.error('signData verified with captured pubkey (hash:false): ' + verified2);

            // Also test: sign with captured private key
            const mySig = sm2.doSignature(msg, realKp.privateKey, { hash: true });
            console.error('My sign (hash:true): ' + mySig.substring(0, 40) + '...');
            console.error('App sign:          ' + inner.signData.substring(0, 40) + '...');
            console.error('Match: ' + (mySig === inner.signData));
        } catch (e) {
            console.error('Verify error: ' + e.message);
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
