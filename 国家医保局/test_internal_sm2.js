/**
 * Test internal SM2 doSignature vs app's signData
 * Uses the patched app.js's own SM2 functions
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' +
    src.substring(i1 + p1.length);
let off = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// Patch 2: export modules
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
patched = patched.substring(0, i2raw + p2.length) +
    '(window["_m"+_0x518e77]=_0x1210ab["exports"]),' +
    patched.substring(i2raw + p2.length);

// Patch 3: capture generateKeyPairHex + hook doSignature
const p3 = '_0x7c17d3[_0x16487d(0x254e)] = {';
const i3raw = src.indexOf(p3);
const ins3 = 'window.__sm2_ec=_0x7c17d3;' +
    'var _nhsa_gkh=_0x13a32a;_0x13a32a=function(){var r=_nhsa_gkh();window.__kp=r;return r;};' +
    'var _nhsa_ds=_0x379870;_0x379870=function(m,k,o){window.__ds_msg=m;window.__ds_key=k;window.__ds_opts=JSON.stringify(o);var r=_nhsa_ds.apply(this,arguments);window.__ds_result=r;return r;};';
patched = patched.substring(0, i3raw) + ins3 + patched.substring(i3raw);

console.error('[test] Patches applied');

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

console.error('[test] Loading...');
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
    console.error('\n=== INTERNAL SM2 TEST ===');

    // App's signData
    if (captured) {
        const body = JSON.parse(captured.body);
        const inner = body.data;
        const appSignData = inner.signData;
        const innerCopy = { ...inner }; delete innerCopy.signData;
        const msg = JSON.stringify(innerCopy);

        console.error('App signData: ' + appSignData.substring(0, 40) + '...');
        console.error('Message: ' + msg.substring(0, 200));
        console.error('Message length: ' + msg.length);

        // Test internal doSignature with different keys
        const doSig = win._m4d09.doSignature;
        if (!doSig) {
            console.error('Internal doSignature NOT available');
            process.exit(0);
        }

        const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
        const keys = [
            { name: 'kp.privateKey', key: win.__kp ? win.__kp.privateKey : null },
            { name: 'AC hex', key: Buffer.from(AC, 'ascii').toString('hex') },
            { name: 'AC', key: AC },
            { name: 'sm3(AC)', key: (() => { try { return win.__c.sm3.default(AC); } catch (e) { return null; } })() },
        ];

        for (const kt of keys) {
            if (!kt.key) continue;
            try {
                const sig = doSig(msg, kt.key, { hash: true });
                console.error('\n  ' + kt.name + ' hash=true:');
                console.error('    ' + sig.substring(0, 40) + '...');
                console.error('    Match: ' + (sig === appSignData));

                const sig2 = doSig(msg, kt.key, { hash: false });
                console.error('  ' + kt.name + ' hash=false:');
                console.error('    ' + sig2.substring(0, 40) + '...');
                console.error('    Match: ' + (sig2 === appSignData));
            } catch (e) {
                console.error('  ' + kt.name + ' ERROR: ' + e.message);
            }
        }

        // Also check what the app actually called doSignature with
        if (win.__ds_msg) {
            console.error('\nApp called doSignature with:');
            console.error('  key: ' + win.__ds_key);
            console.error('  opts: ' + win.__ds_opts);
            console.error('  msg: ' + win.__ds_msg.substring(0, 200));
            console.error('  result: ' + (win.__ds_result || 'none'));
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
