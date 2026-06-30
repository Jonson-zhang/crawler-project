/**
 * Patch doSignature and SHA256 — then capture x-tif-sig input
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// All patches: { pattern, insert, before }
const patches = [];

// Patch 0: export all modules (must be first - has earliest position)
patches.push({
    pattern: '(_0x1210ab["l"] = !0x0),',
    insert: '(window["_m"+_0x518e77]=_0x1210ab["exports"]),',
});

// Patch 1: export crypto from 68b2
patches.push({
    pattern: '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
    insert: ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};',
});

// Patch 2: hook SM4 _0x32a5f1
patches.push({
    pattern: 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {',
    insert: 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;',
});

// Patch 3: hook doSignature _0x379870
// NOTE: We hook at the function DEFINITION, not the export
patches.push({
    pattern: 'function _0x379870(_0x114d61, _0x2fdcf9) {',
    insert: 'window.__ds_key=_0x2fdcf9;window.__ds_msg=_0x114d61;window.__ds_opts=arguments[2]?JSON.stringify(arguments[2]):\"{}\";',
});

// Sort by position, process
patches.sort((a, b) => src.indexOf(a.pattern) - src.indexOf(b.pattern));

let patched = src;
for (const p of patches) {
    const pos = patched.indexOf(p.pattern);
    if (pos < 0) { console.error('NOT FOUND:', p.pattern.substring(0, 60)); process.exit(1); }
    patched = patched.substring(0, pos + p.pattern.length) +
        p.insert + patched.substring(pos + p.pattern.length);
    console.error('[patch] ' + p.pattern.substring(0, 50) + ' @' + pos);
}

// ============================================================
// jsdom
// ============================================================
const dom = new JSDOM('<html><body></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
const crypto = require('crypto');
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
                url: u, headers: { ...h }, body: typeof b === 'string' ? b : '',
                // Also capture the doSignature parameters at the time of this XHR
                ds_key: win.__ds_key,
                ds_msg: win.__ds_msg,
                ds_opts: win.__ds_opts,
            };
        }
        os.call(this, b);
    };
    return x;
};

console.error('[patch] Loading...');
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
    console.error('\n=== CAPTURED ===');

    // doSignature hook
    if (win.__ds_key !== undefined) {
        console.error('doSignature called with:');
        console.error('  key: ' + win.__ds_key);
        console.error('  msg: ' + (win.__ds_msg || '').substring(0, 200));
        console.error('  opts: ' + win.__ds_opts);
    } else {
        console.error('doSignature NOT captured');
    }

    // SM4 key
    if (win.__k) {
        const khex = Array.from(win.__k).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
        console.error('SM4 key: ' + String.fromCharCode.apply(null, win.__k) + ' (hex: ' + khex + ')');
    }

    // XHR
    if (captured) {
        console.error('\n=== XHR ===');
        console.error('sig:  ' + captured.headers['x-tif-signature']);
        console.error('ts:   ' + captured.headers['x-tif-timestamp']);
        console.error('nonce:' + captured.headers['x-tif-nonce']);
        console.error('body: ' + captured.body.substring(0, 300));

        if (captured.ds_key !== undefined) {
            console.error('\ndoSignature was called with key: ' + captured.ds_key);

            // Verify: can we reproduce the signData?
            const bodyObj = JSON.parse(captured.body);
            const innerCopy = { ...bodyObj.data }; delete innerCopy.signData;
            const msg = JSON.stringify(innerCopy);

            // Use internal doSignature to verify
            const doSig = win._m4d09 ? win._m4d09.doSignature : null;
            if (doSig && captured.ds_key) {
                try {
                    const mySig = doSig(msg, captured.ds_key, { hash: true });
                    console.error('My sig (hash=true):  ' + mySig.substring(0, 40) + '...');
                    console.error('App sig:             ' + bodyObj.data.signData.substring(0, 40) + '...');
                    console.error('Match: ' + (mySig === bodyObj.data.signData));
                } catch (e) {
                    console.error('doSig error: ' + e.message);
                }
            }
        }

        // Test x-tif-signature with the captured doSignature key
        if (captured.ds_key !== undefined) {
            const SHA256 = (s) => {
                const m = win._m21bf;
                return m ? wa2hex(m.SHA256(s)) : crypto.createHash('sha256').update(s).digest('hex');
            };

            const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
            const sig = captured.headers['x-tif-signature'];
            const ts = captured.headers['x-tif-timestamp'];
            const nonce = captured.headers['x-tif-nonce'];
            const body = captured.body;

            // Try: SHA256(ds_key + ts + nonce + body)
            const tests = {};
            if (captured.ds_key) {
                tests['ds_key+ts+nonce+body'] = captured.ds_key + ts + nonce + body;
                tests['ds_key+AC+ts+nonce+body'] = captured.ds_key + AC + ts + nonce + body;
                tests['AC+ds_key+ts+nonce+body'] = AC + captured.ds_key + ts + nonce + body;
                // ds_key might be hex string, try normalized
                const keyNorm = captured.ds_key.toLowerCase();
                tests['key_norm+ts+nonce+body'] = keyNorm + ts + nonce + body;
            }

            for (const [name, val] of Object.entries(tests)) {
                const h = SHA256(val);
                if (h === sig) {
                    console.error('\n*** x-tif-signature FORMULA FOUND: ' + name + ' ***');
                    console.error('    Input: ' + val.substring(0, 300));
                }
            }
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
