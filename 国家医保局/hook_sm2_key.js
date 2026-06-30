/**
 * Hook SM2 generateKeyPairHex to capture dynamic keypair
 * Then test if publicKey is part of x-tif-signature input
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch 1: export crypto
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
const off1 = ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'.length;
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' +
    src.substring(i1 + p1.length);

// Patch 2: export modules
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + off1;
const ins2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"]),';
patched = patched.substring(0, i2 + p2.length) + ins2 + patched.substring(i2 + p2.length);

// Patch 3: hook generateKeyPairHex in module 4d09
// Find: generateKeyPairHex: _0x47af4d[_0x302d81(0x2650)],
// This references a function defined elsewhere in the module
// Let's instead hook at the module level by wrapping the exports

// Actually easier: after loading, wrap window._m4d09.generateKeyPairHex
// if _m4d09 has generateKeyPairHex via the default export

// ===========================================================
// jsdom
// ===========================================================
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

// Hook injection BEFORE loading
const HOOK = `
(function() {
    var _tid = setInterval(function() {
        // Hook SM2 generateKeyPairHex when it becomes available
        if (window._m4d09 && window._m4d09.generateKeyPairHex && !window._m4d09._hooked) {
            window._m4d09._hooked = true;
            clearInterval(_tid);
            var _orig = window._m4d09.generateKeyPairHex;
            window._m4d09.generateKeyPairHex = function() {
                var result = _orig.apply(this, arguments);
                window.__kp_hex = result;
                return result;
            };
        }
    }, 10);

    // Also: wrap SHA256 when available
    var _tid2 = setInterval(function() {
        if (window._m21bf && window._m21bf.SHA256 && !window._m21bf._hooked) {
            window._m21bf._hooked = true;
            clearInterval(_tid2);
            var _orig = window._m21bf.SHA256;
            window._m21bf.SHA256 = function(msg) {
                var result = _orig.apply(this, arguments);
                window.__sha_args = window.__sha_args || [];
                window.__sha_args.push({
                    msg_type: typeof msg,
                    msg_len: typeof msg === 'string' ? msg.length : (msg ? msg.sigBytes || msg.length : 0),
                    msg_str: typeof msg === 'string' ? msg : (msg && typeof msg.toString === 'function' ? String(msg).substring(0, 500) : ''),
                    result_hex_wa: (function(wa) {
                        if (typeof wa === 'string') return wa;
                        var w = wa.words, s = wa.sigBytes, h = '';
                        for (var i = 0; i < s; i++) h += ('0' + ((w[i>>>2]>>>(24-(i%4)*8))&0xff).toString(16)).slice(-2);
                        return h;
                    })(result),
                    result_type: typeof result,
                });
                return result;
            };
            // Also wrap HmacSHA256
            if (window._m21bf.HmacSHA256) {
                var _origH = window._m21bf.HmacSHA256;
                window._m21bf.HmacSHA256 = function(msg, key) {
                    var result = _origH.apply(this, arguments);
                    window.__hmac_args = window.__hmac_args || [];
                    window.__hmac_args.push({ msg: typeof msg === 'string' ? msg.substring(0,200) : 'bytes', key: typeof key === 'string' ? key.substring(0,100) : 'bytes' });
                    return result;
                };
            }
        }
    }, 5);
})();
`;

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

console.error('[hook] Loading...');
// Inject hook before app.js
const hookScript = win.document.createElement('script');
hookScript.textContent = HOOK;
win.document.body.appendChild(hookScript);

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    console.error('\n=== RESULTS ===');

    // SM2 keypair
    const kp = win.__kp_hex;
    if (kp) {
        console.error('SM2 generateKeyPairHex result:');
        console.error('  publicKey: ' + kp.publicKey);
        console.error('  privateKey: ' + (kp.privateKey || 'none'));
    } else {
        console.error('SM2 keypair NOT captured (module 4d09 may use default export)');

        // Try via __c module
        const c = win.__c;
        if (c && c.sm2) {
            const sm2Keys = Object.keys(c.sm2);
            console.error('__c.sm2 keys: ' + sm2Keys.join(', '));
            // Check for generateKeyPair in sub-modules
            const sm2Mod = win._m4d09;
            if (sm2Mod) {
                console.error('_m4d09 keys: ' + Object.keys(sm2Mod).join(', '));
                if (sm2Mod.default) {
                    console.error('_m4d09.default keys: ' + Object.keys(sm2Mod.default).join(', '));
                    if (sm2Mod.default.generateKeyPairHex) {
                        try {
                            const kp2 = sm2Mod.default.generateKeyPairHex();
                            console.error('_m4d09.default.generateKeyPairHex():');
                            console.error('  publicKey: ' + kp2.publicKey);
                            console.error('  privateKey: ' + kp2.privateKey);
                            win.__kp2 = kp2;
                        } catch (e) {
                            console.error('Error: ' + e.message);
                        }
                    }
                }
            }
        }
    }

    // SHA256 calls
    const shaArgs = win.__sha_args || [];
    console.error('\nSHA256 calls: ' + shaArgs.length);
    shaArgs.forEach((a, i) => {
        console.error('  [' + i + '] result=' + a.result_hex_wa + ' msg_len=' + a.msg_len);
        console.error('       msg=' + a.msg_str.substring(0, 300));
    });

    // HMAC calls
    const hmacArgs = win.__hmac_args || [];
    console.error('\nHMAC calls: ' + hmacArgs.length);

    // Captured request
    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        console.error('\n=== x-tif-signature: ' + sig + ' ===');

        // Match against SHA calls
        for (const a of shaArgs) {
            if (a.result_hex_wa === sig) {
                console.error('\n*** FOUND! SHA256 INPUT = ***');
                console.error(a.msg_str);
                break;
            }
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
