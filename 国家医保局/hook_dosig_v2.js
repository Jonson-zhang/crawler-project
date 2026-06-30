/**
 * Hook doSignature return to capture r,s values
 * Insert capture code RIGHT BEFORE the return statement
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

const patches = [
    // Export all modules
    {p:'(_0x1210ab["l"] = !0x0),', i:'(window["_m"+_0x518e77]=_0x1210ab["exports"]),'},
    // Export crypto
    {p:'_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };', i:';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'},
    // Hook SM4
    {p:'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {', i:'window.__k=_0x1a6c05;window.__kp=_0x2e1290;'},
    // Hook doSignature entry
    {p:'function _0x379870(_0x114d61, _0x2fdcf9) {', i:'window.__ds_key=_0x2fdcf9;window.__ds_msg=_0x114d61;'},
    // Hook doSignature: capture r,s before return
    // The while loop condition before return is unique
    {p:'_0x270628[_0x1bc45c(0x377)](_0x3ea968[_0x1bc45c(0x2240)]));',
     i:'\n        window.__ds_r=_0x490871.toString(16);window.__ds_s=_0x270628.toString(16);'},
];

// Sort by position and apply
const withPos = patches.map(p => ({...p, pos: src.indexOf(p.p)}));
withPos.sort((a, b) => a.pos - b.pos);

for (const p of withPos) {
    if (p.pos < 0) { console.error('NOT FOUND: ' + p.p.substring(0, 60)); process.exit(1); }
}
console.error('All ' + withPos.length + ' patterns found');

let patched = src;
let off = 0;
for (const p of withPos) {
    const ap = p.pos + off;
    patched = patched.substring(0, ap + p.p.length) +
        p.i + patched.substring(ap + p.p.length);
    off += p.i.length;
}

// jsdom
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

let captured = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function (b) {
        if (u.includes('selectByKeys')) {
            captured = {
                url: u, headers: { ...h }, body: b,
                ds_r: win.__ds_r, ds_s: win.__ds_s,
                ds_key: win.__ds_key, ds_msg: win.__ds_msg,
            };
        }
        os.call(this, b);
    };
    return x;
};

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    console.error('\n=== RESULTS ===');
    if (!captured) { console.error('No XHR captured'); process.exit(0); }

    const sig = captured.headers['x-tif-signature'];
    console.error('x-tif-signature: ' + sig);
    console.error('ds_r: ' + (captured.ds_r || 'NOT CAPTURED'));
    console.error('ds_s: ' + (captured.ds_s || 'NOT CAPTURED'));

    if (captured.ds_r) {
        const rPad = ('0'.repeat(64) + captured.ds_r).slice(-64);
        console.error('r padded(64):   ' + rPad);
        console.error('x-tif-sig:      ' + sig);
        console.error('MATCH (r==sig): ' + (rPad === sig));

        if (captured.ds_s) {
            const sPad = ('0'.repeat(64) + captured.ds_s).slice(-64);
            const fullHex = rPad + sPad;
            console.error('\nFull SM2 sig (r||s, 128 hex): ' + fullHex.substring(0,80) + '...');

            // Convert to base64 for body signData comparison
            const sigBytes = Buffer.from(fullHex, 'hex');
            const sigB64 = sigBytes.toString('base64');
            console.error('As base64: ' + sigB64.substring(0, 50) + '...');

            const bodyObj = JSON.parse(captured.body);
            console.error('App signData:  ' + bodyObj.data.signData.substring(0, 50) + '...');
            console.error('signData match: ' + (sigB64 === bodyObj.data.signData));
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 25000);
