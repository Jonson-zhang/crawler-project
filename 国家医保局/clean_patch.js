/**
 * 干净 patch: 一个函数处理所有插入，正确追踪偏移量
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Patch helper: inserts at position in ORIGINAL source, returns {offset, length}
// All positions are in the ORIGINAL source before any patches
const patches = [];

function addPatch(pattern, insertCode) {
    const pos = src.indexOf(pattern);
    if (pos < 0) throw new Error('Pattern not found: ' + pattern.substring(0, 50));
    patches.push({ pos, insert: insertCode, pattern });
    return pos;
}

// Add all patches (order doesn't matter for positions)
addPatch('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
    'window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";');

addPatch('(_0x1210ab["l"] = !0x0),',
    '(window["_m"+_0x518e77]=_0x1210ab["exports"]),');

// Insert BEFORE \n      _0x7c17d3... statement (use pos, not pos+pattern.length)
addPatch('\n      _0x7c17d3[_0x16487d(0x254e)] = {',
    '\n      var _nsa_gkh=_0x13a32a;_0x13a32a=function(){var r=_nsa_gkh();window.__kp=r;return r;};var _nsa_ds=_0x379870;_0x379870=function(m,k,o){window.__ds_msg=m;window.__ds_key=k;window.__ds_opts=JSON.stringify(o);var r=_nsa_ds.apply(this,arguments);window.__ds_result=r;return r;};window.__sm2_ec=_0x7c17d3;');
// Mark this patch as "insert before pattern"
patches[patches.length - 1].insertBefore = true;

// Sort by position ascending
patches.sort((a, b) => a.pos - b.pos);

// Build patched string with offset tracking
let patched = src;
let cumulativeOffset = 0;
const appliedPositions = [];

for (const p of patches) {
    const actualPos = p.pos + cumulativeOffset;
    if (p.insertBefore) {
        // Insert BEFORE the pattern
        patched = patched.substring(0, actualPos) + p.insert + patched.substring(actualPos);
    } else {
        // Insert AFTER the pattern
        patched = patched.substring(0, actualPos + p.pattern.length) +
            p.insert + patched.substring(actualPos + p.pattern.length);
    }
    cumulativeOffset += p.insert.length;
    appliedPositions.push({ pattern: p.pattern.substring(0, 40), pos: p.pos, actualPos, before: !!p.insertBefore });
}

console.error('[patch] Applied ' + patches.length + ' patches:');
appliedPositions.forEach(p => console.error('  ' + p.pattern + ' @' + p.pos));

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
    console.error('\n=== RESULTS ===');

    // Check keypair
    const kp = win.__kp;
    if (kp) {
        console.error('Captured keypair:');
        console.error('  pub: ' + kp.publicKey);
        console.error('  priv: ' + (kp.privateKey || 'none'));
    }

    // Check doSignature call
    if (win.__ds_msg) {
        console.error('\nApp doSignature call captured!');
        console.error('  msg: ' + win.__ds_msg.substring(0, 200));
        console.error('  key: ' + win.__ds_key);
        console.error('  opts: ' + win.__ds_opts);
        console.error('  result: ' + (win.__ds_result ? win.__ds_result.substring(0, 60) + '...' : 'none'));
    }

    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        console.error('\nCaptured x-tif-signature: ' + sig);

        const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
        const SHA256 = (s) => wa2hex(win._m21bf.SHA256(s));

        // Test with pubkey
        if (kp) {
            const pk = kp.publicKey;
            const body = captured.body;
            const ts = captured.headers['x-tif-timestamp'];
            const nonce = captured.headers['x-tif-nonce'];

            const tests = [
                ['pk+ts+nonce+body', pk + ts + nonce + body],
                ['pk+AC+ts+nonce+body', pk + AC + ts + nonce + body],
                ['AC+pk+ts+nonce+body', AC + pk + ts + nonce + body],
                ['ts+nonce+pk+body', ts + nonce + pk + body],
            ];
            for (const [n, v] of tests) {
                const h = SHA256(v);
                if (h === sig) console.error('\n*** MATCH: ' + n + ' ***');
            }
        }

        // Verify signData with internal doSignature
        const bodyObj = JSON.parse(captured.body);
        const appSignData = bodyObj.data.signData;
        const innerCopy = { ...bodyObj.data }; delete innerCopy.signData;
        const msg = JSON.stringify(innerCopy);

        const doSig = win._m4d09.doSignature;
        if (doSig && kp && kp.privateKey) {
            console.error('\nInternal doSignature test:');
            const mySig = doSig(msg, kp.privateKey, { hash: true });
            console.error('  hash=true:  ' + mySig.substring(0, 40) + '... match=' + (mySig === appSignData));
            const mySig2 = doSig(msg, kp.privateKey, { hash: false });
            console.error('  hash=false: ' + mySig2.substring(0, 40) + '... match=' + (mySig2 === appSignData));

            // AC as key
            const acHex = Buffer.from(AC, 'ascii').toString('hex');
            const mySig3 = doSig(msg, acHex, { hash: true });
            console.error('  AC key:     ' + mySig3.substring(0, 40) + '... match=' + (mySig3 === appSignData));
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
