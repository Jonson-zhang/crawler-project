/**
 * 专门捕获 x-tif-signature — Hook SHA256 模块
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
let off = 0;
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' +
    src.substring(i1 + p1.length);
off += ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;

// Patch 2: hook SM4
const p2 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + off;
const ins2 = 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;';
patched = patched.substring(0, i2 + p2.length) + ins2 + patched.substring(i2 + p2.length);
off += ins2.length;

// Patch 3: hook SHA256
// Module "6c27" ends right before "6c37":
// Line 77055: })[...].call(...);
// Line 77056:     },
// Line 77057:     "6c37": function (...) {
//
// We need to insert: window.__sha = _0x4f7158;
// right BEFORE the closing }, of module "6c27"

// Find "6c37" in original source
const p3 = '    "6c37": function';
const i3raw = src.indexOf(p3);
if (i3raw < 0) { console.error('p3 not found'); process.exit(1); }

// Insert RIGHT BEFORE the "6c37" line (inside module 6c27)
// Module 6c27 closes with }, right before "6c37"
// We insert: window.__sha = _0x4f7158;\n before the closing }
// Pattern: \n    },\n    "6c37": → insert between },\n and "6c37":
// So insert after the newline before "6c37"

// Find the newline right before "6c37"
const insertPos = i3raw; // Insert RIGHT BEFORE '    "6c37": function'
// Add a new line: window.__sha=_0x4f7158;\n    },\n
// Wait, we can't insert a closing },, it's already there.
// Let's insert: \nwindow.__sha=_0x4f7158;
// BEFORE the \n    }, that closes 6c27

// Actually find the }, line before p3
// Search backwards from i3raw for '\n    },'
const pre = src.substring(i3raw - 200, i3raw);
const lastComma = pre.lastIndexOf(',\n');
const closeBrace = src.substring(i3raw - 200, i3raw).lastIndexOf('    },\n');
// The exact index in the full source
const closeLineStart = i3raw - 200 + closeBrace;
if (closeBrace < 0 || closeLineStart < 0) {
    console.error('Cannot find closing brace. pre=' + JSON.stringify(pre.substring(pre.length-100)));
    process.exit(1);
}

// Insert BEFORE the closing }, line
// _0x4f7158 should be in scope (var-declared in the module function)
const ins3 = 'window.__sha=_0x4f7158;';
patched = patched.substring(0, closeLineStart) + ins3 + '\n' + patched.substring(closeLineStart);

console.error('[capture] Patches applied');
console.error('[capture] Patch 1 (crypto): ' + (i1 > 0 ? 'ok' : 'FAIL'));
console.error('[capture] Patch 2 (SM4): ' + (i2raw > 0 ? 'ok' : 'FAIL'));
console.error('[capture] Patch 3 (SHA256) at orig ' + closePos + ': ok');

// ===========================================================
// jsdom
// ===========================================================
const dom = new JSDOM('<html><body></body></html>>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { for(let i=0;i<a.length;i++)a[i]=i%256; return a; }, subtle:{} };
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');
win.TextEncoder = function(){};
win.TextEncoder.prototype.encode = function(s){ return Buffer.from(s,'utf-8'); }

// Hook: wrap SHA functions as soon as they're exported
// Use a setInterval to detect __sha being set
const hookCode = `
(function() {
    var tid = setInterval(function() {
        if (window.__sha && !window.__sha.__hooked) {
            window.__sha.__hooked = true;
            // Wrap all functions
            for (var k in window.__sha) {
                if (typeof window.__sha[k] === 'function') {
                    var orig = window.__sha[k];
                    window.__sha[k] = function() {
                        window.__sha_last_call = {
                            fn: k,
                            input_type: typeof arguments[0],
                            input_len: arguments[0] ? arguments[0].length : 0,
                            input_preview: typeof arguments[0] === 'string' ? arguments[0].substring(0, 500) : String(arguments[0]).substring(0, 200),
                            all_args: Array.from(arguments).map(function(a){return typeof a;}).join(','),
                        };
                        return orig.apply(this, arguments);
                    };
                }
            }
            clearInterval(tid);
        }
    }, 10);
})();
`;

// XHR intercept
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

console.error('[capture] Loading...');
const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch(e) {}

// Inject hook
const hookScript = win.document.createElement('script');
hookScript.textContent = hookCode;
try { win.document.body.appendChild(hookScript); } catch(e) {}

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    // SM4
    if (win.__k) {
        const khex = Array.from(win.__k).map(b=>('0'+(b&0xFF).toString(16)).slice(-2)).join('');
        console.error('SM4 key: ' + win.__k.join(','));
        console.error('SM4 key hex: ' + khex);
    }

    // SHA256
    console.error('__sha exists: ' + !!win.__sha);
    if (win.__sha) {
        const keys = Object.keys(win.__sha).filter(k => typeof win.__sha[k] === 'function');
        console.error('SHA functions: ' + keys.join(', '));
    }
    const shaCall = win.__sha_last_call;
    if (shaCall) {
        console.error('SHA last call:');
        console.error('  fn: ' + shaCall.fn);
        console.error('  input_len: ' + shaCall.input_len);
        console.error('  input_type: ' + shaCall.input_type);
        console.error('  all_args: ' + shaCall.all_args);
        console.error('  input: ' + shaCall.input_preview);
    }

    // Captured request
    if (capt) {
        const sig = capt.headers['x-tif-signature'];
        console.error('\nCaptured:');
        console.error('  sig: ' + sig);
        console.error('  ts: ' + capt.headers['x-tif-timestamp']);
        console.error('  nonce: ' + capt.headers['x-tif-nonce']);

        // If SHA256 input was captured, verify
        if (shaCall && shaCall.fn && shaCall.input_type === 'string') {
            const hash = require('crypto').createHash('sha256').update(shaCall.input_preview, 'utf8').digest('hex');
            console.error('  computed SHA256: ' + hash);
            console.error('  MATCH: ' + (hash === sig));
            if (hash === sig) {
                console.error('\n*** x-tif-signature FORMULA FOUND! ***');
                console.error('Input: ' + shaCall.input_preview);
            }
        }
    }

    process.exit(0);
}, 10000);

setTimeout(() => { process.exit(1); }, 35000);
