/**
 * Capture SM4 key by patching the internal _0x32a5f1 function
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let source = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto module from "68b2"
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = source.indexOf(p1);
if (i1 < 0) { console.error('p1 not found'); process.exit(1); }
let patched = source.substring(0, i1 + p1.length) + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' + source.substring(i1 + p1.length);
// Adjust offsets after insertion
const offset1 = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// Patch 2: inside SM4 module, hook _0x32a5f1 to capture key
// Pattern: function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {
// Insert after opening brace: window.__k=_0x1a6c05;window.__kp=_0x2e1290;
const p2 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {';
const i2raw = source.indexOf(p2);
if (i2raw < 0) { console.error('p2 not found'); process.exit(1); }
const i2 = i2raw < i1 ? i2raw : i2raw + offset1;
const insert2 = 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;window.__km=_0xc6a789;';
patched = patched.substring(0, i2 + p2.length) + insert2 + patched.substring(i2 + p2.length);

console.error('Patched!');

// jsdom
const dom = new JSDOM('<html><body></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { for(let i=0;i<a.length;i++)a[i]=i%256; return a; }, subtle:{} };
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');
win.TextEncoder = function(){};
win.TextEncoder.prototype.encode = function(s){ return Buffer.from(s,'utf-8'); };

// XHR capture
let captured = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const x = new OX();
    const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function(m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function(k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function(b) {
        if (u.includes('selectByKeys')) captured = { url: u, headers: {...h}, body: b };
        os.call(this, b);
    };
    return x;
};

console.error('Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

setTimeout(() => {
    // Check captured data
    console.error('SM4 key: ' + win.__k);
    console.error('SM4 plaintext: ' + win.__kp);
    console.error('SM4 mode flag: ' + win.__km);

    if (win.__kp && typeof win.__kp === 'object' && win.__kp.length) {
        const phex = Array.from(win.__kp).map(b => ('0'+(b&0xFF).toString(16)).slice(-2)).join('');
        const pstr = String.fromCharCode.apply(null, win.__kp);
        console.error('SM4 plaintext hex: ' + phex);
        console.error('SM4 plaintext str: "' + pstr.replace(/[^ -~]/g,'.') + '"');
        console.error('SM4 plaintext len: ' + win.__kp.length);
    }

    // Key format analysis
    if (win.__k) {
        console.error('\nKey type: ' + typeof win.__k);
        if (typeof win.__k === 'string') {
            console.error('Key as string: ' + win.__k);
            console.error('Key length: ' + win.__k.length);
        }
        if (typeof win.__k === 'object' && win.__k && win.__k.length) {
            const khex = Array.from(win.__k).map(b => ('0'+(b&0xFF).toString(16)).slice(-2)).join('');
            console.error('Key as array hex: ' + khex);
        }
    }

    // Captured request
    if (captured) {
        console.error('\nCaptured request:');
        console.error('  sig: ' + captured.headers['x-tif-signature']);
        console.error('  ts: ' + captured.headers['x-tif-timestamp']);
        console.error('  nonce: ' + captured.headers['x-tif-nonce']);
        console.error('  body: ' + captured.body.substring(0, 300));

        // Also dump full headers for brute-force
        console.error('\n=== FULL REQUEST ===');
        console.error(JSON.stringify({
            signature: captured.headers['x-tif-signature'],
            timestamp: captured.headers['x-tif-timestamp'],
            nonce: captured.headers['x-tif-nonce'],
            body: captured.body,
            sm4_key: Array.from(win.__k || []).map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join(''),
            sm4_plaintext: Array.from(win.__kp || []).map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join(''),
        }));

        // Verify: encrypt the plaintext with the key, should match encData
        const encData = JSON.parse(captured.body).data.data.encData;
        console.error('  encData: ' + encData);

        // Use internal encrypt to verify
        const encrypt = win.__c.sm4.encrypt;
        try {
            const arr = typeof win.__kp === 'string' ? win.__kp.split('').map(c => c.charCodeAt(0)) : Array.from(win.__kp || []);
            const enc = encrypt(arr, win.__k);
            const ehex = Array.from(enc).map(b => ('0'+(b&0xFF).toString(16)).slice(-2)).join('');
            console.error('  Verify encrypt: ' + ehex);
            console.error('  Match: ' + (ehex.toUpperCase() === encData.toUpperCase()));
        } catch(e) {
            console.error('  Verify error: ' + e.message);
        }
    }

    process.exit(0);
}, 10000);

setTimeout(() => { process.exit(1); }, 35000);
