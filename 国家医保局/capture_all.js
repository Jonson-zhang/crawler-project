/**
 * Capture ALL: SM4 key + SHA256 input
 * Patches both SM4 and SHA256 modules
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto + hook SM4 _0x32a5f1
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let off = 0;
let patched = src.substring(0, i1 + p1.length) + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' + src.substring(i1 + p1.length);
off += ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// Patch 2: hook SM4 internal function — already done in capture_key.js
const p2 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + off;
patched = patched.substring(0, i2 + p2.length) + 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;window.__km=_0xc6a789;' + patched.substring(i2 + p2.length);

// Patch 3: hook SHA256 module (module "6c27")
// Instead of finding the exact export, hook at the CONSTANTS level
// The SHA256 module processes a string → bytes → hash
// Let's find where the string input enters the hash function

// Search for the string-to-bytes conversion in module "6c27"
// The module uses a function that takes the input message and converts it

// Actually, let's try a different approach: hook the TextEncoder or string conversion
// inside the SHA256 module by finding the function that prepares the input

// The SHA256 module's main entry function likely looks like:
// function sha256(message) { ... }
// And it's exported as: _0xXXXXX[_0xYYYYY] = { sha256: ..., ... };

// Let me find the export by searching for the last few lines of module "6c27"
// which ends at line ~77055

// Read the last section of module "6c27" to find the exported functions
// At line 77045: _0x480169[_0x44caa7(0x195a)] = _0x4f7158
// This exports _0x4f7158 (the sha256 object) to module.exports

// So _0x4f7158 is the hash object with sha256 methods
// Let me hook it by intercepting the export

// Find: _0x480169[_0x44caa7(0x195a)] = _0x4f7158
const p3 = '_0x480169[_0x44caa7(0x195a)] = _0x4f7158';
const i3raw = src.indexOf(p3);
if (i3raw < 0) {
    console.error('SHA256 export pattern not found');
    process.exit(1);
}
// Need to recalculate offset after patches 1 and 2
const off2 = 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;window.__km=_0xc6a789;'.length;
const offTotal = off + off2;
const i3 = i3raw < i1 ? i3raw : (i3raw < i2raw ? i3raw + off : i3raw + offTotal);

// After this line, export sha256 to window and hook it
const shaPatch = ';window.__sha=_0x4f7158;' +
    '(function(){var oh=window.__sha;for(var k in oh){if(typeof oh[k]==="function"){' +
    'var orig=oh[k];oh[k]=function(m){window.__sha_last_fn=k;window.__sha_last_input=m;window.__sha_last_result=orig.apply(this,arguments);return window.__sha_last_result;};' +
    '}}})();';

patched = patched.substring(0, i3 + p3.length) + shaPatch + patched.substring(i3 + p3.length);

console.error('Patched with SM4 + SHA256 hooks');

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

// Capture XHR
let capt = null;
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const x = new OX(); const oo=x.open, os=x.send, osr=x.setRequestHeader;
    let u='',h={};
    x.open = function(m,url){u=url;return oo.apply(this,arguments);};
    x.setRequestHeader = function(k,v){h[k]=v;return osr.apply(this,arguments);};
    x.send = function(b){if(u.includes('selectByKeys'))capt={url:u,headers:{...h},body:b};os.call(this,b);};
    return x;
};

console.error('Loading...');
const s = win.document.createElement('script');
s.textContent = patched;
try { win.document.body.appendChild(s); } catch(e) {}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    // SM4
    if (win.__k) {
        const khex = Array.from(win.__k).map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('');
        console.error('SM4 key: ' + khex);
    }

    // SHA256
    console.error('SHA256 last fn: ' + win.__sha_last_fn);
    console.error('SHA256 last input: ' + (win.__sha_last_input || 'null'));
    if (win.__sha_last_input) {
        const inp = win.__sha_last_input;
        console.error('SHA256 input type: ' + typeof inp);
        if (typeof inp === 'string') {
            console.error('SHA256 input length: ' + inp.length);
            console.error('SHA256 input: ' + inp.substring(0, 500));

            // Verify
            const hash = require('crypto').createHash('sha256').update(inp,'utf8').digest('hex');
            console.error('Computed SHA256: ' + hash);

            if (capt) {
                const sig = capt.headers['x-tif-signature'];
                console.error('Expected sig:   ' + sig);
                console.error('MATCH: ' + (hash === sig));
                if (hash === sig) {
                    console.error('\n*** x-tif-signature ALGORITHM FOUND! ***');
                    console.error('Input: ' + inp);
                }
            }
        }
    }

    console.error('SHA256 last result: ' + (win.__sha_last_result || 'null'));

    // List SHA functions
    if (win.__sha) {
        console.error('\nSHA module keys: ' + Object.keys(win.__sha).join(', '));
    }

    // Captured request
    if (capt) {
        console.error('\nCaptured:');
        console.error('  sig:  ' + capt.headers['x-tif-signature']);
        console.error('  ts:   ' + capt.headers['x-tif-timestamp']);
        console.error('  body: ' + capt.body.substring(0, 300));
    }

    process.exit(0);
}, 10000);

setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 35000);
