/**
 * 终极Hook: 捕获 doSignature 的 r,s 值，验证 x-tif-signature 公式
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');

// Hook DER return: replace _0x46db85(...) with wrapped version
const derPattern = '_0x46db85(_0x490871, _0x270628)';
const posDer = src.indexOf(derPattern);
patches.push({
    pos: posDer,
    plen: derPattern.length,  // REPLACE the pattern
    insert: '(window.__ds_r=_0x490871.toString(16),window.__ds_s=_0x270628.toString(16),_0x46db85(_0x490871,_0x270628))',
});
// Hook RAW return: wrap the expression after :
// The raw expression starts with _0x47af4d[...leftPad...]
// We need to locate the FULL raw return part and wrap it
// After ':' in the ternary, the raw return is on two lines:
// _0x47af4d[_0x1bc45c(0x22b)](_0x490871[_0x1bc45c(0x762)](0x10), 0x40) +\n              _0x47af4d[_0x1bc45c(0x22b)](_0x270628[_0x1bc45c(0x762)](0x10), 0x40);
// We just need to capture before the raw return starts.
// Since we already capture in the DER branch, and only ONE branch executes,
// we need to capture in the RAW branch too.
// Replace the start of raw expression with wrapped version
const rawStart = '_0x47af4d[_0x1bc45c(0x22b)](_0x490871[_0x1bc45c(0x762)](0x10), 0x40) +';
const posRaw = src.indexOf(rawStart);
if (posRaw >= 0) {
    patches.push({
        pos: posRaw,
        plen: 0,  // Insert before
        insert: '(window.__ds_r=_0x490871.toString(16),window.__ds_s=_0x270628.toString(16),',
    });
    // Need to close the parens after the FULL raw expression ends
    // The raw expression ends with: _0x270628[_0x1bc45c(0x762)](0x10), 0x40);
    const rawEnd = '_0x270628[_0x1bc45c(0x762)](0x10), 0x40);';
    const posRawEnd = src.indexOf(rawEnd);
    if (posRawEnd >= 0) {
        patches.push({
            pos: posRawEnd + rawEnd.length,  // Insert AFTER the semicolon (after the ))
            plen: 0,
            insert: ')',  // Close the wrapping parens
        });
    }
}

// Sort by position
patches.sort((a, b) => a.pos - b.pos);

// Apply
let patched = src;
let off = 0;
for (const p of patches) {
    const ap = p.pos + off;
    if (p.plen > 0) {
        // Insert AFTER pattern
        patched = patched.substring(0, ap + p.plen) + p.insert + patched.substring(ap + p.plen);
    } else {
        // Insert BEFORE position
        patched = patched.substring(0, ap) + p.insert + patched.substring(ap);
    }
    off += p.insert.length;
}

console.error('[hook] Applied ' + patches.length + ' patches');

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
        if (u.includes('selectByKeys')) captured = {
            url: u, headers: { ...h }, body: b,
            ds_r: win.__ds_r, ds_s: win.__ds_s,
            ds_key: win.__ds_key, ds_msg: win.__ds_msg,
        };
        os.call(this, b);
    };
    return x;
};

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    console.error('\n=== FINAL VERIFICATION ===');

    if (captured) {
        const sig = captured.headers['x-tif-signature'];
        console.error('x-tif-signature: ' + sig);
        console.error('ds_r captured: ' + (captured.ds_r ? 'YES' : 'NO'));
        console.error('ds_s captured: ' + (captured.ds_s ? 'YES' : 'NO'));

        if (captured.ds_r) {
            // The r value from doSignature (before leftPad)
            const rRaw = captured.ds_r;
            // Pad to 64 hex chars
            const rPadded = rRaw.length < 64 ? '0'.repeat(64 - rRaw.length) + rRaw : rRaw;
            console.error('r value (raw):  ' + rRaw);
            console.error('r value (pad64):' + rPadded.substring(0, 64));
            console.error('sig:            ' + sig);
            console.error('r==sig? ' + (rPadded.substring(0, 64) === sig));

            // Also: maybe the sig = SHA256(r||s)?
            if (captured.ds_s) {
                const fullHex = rPadded.substring(0, 64) + (captured.ds_s.length < 64 ? '0'.repeat(64 - captured.ds_s.length) + captured.ds_s : captured.ds_s);
                const sha = crypto.createHash('sha256').update(fullHex).digest('hex');
                console.error('\nSHA256(r||s):   ' + sha + ' match=' + (sha === sig));
            }

            // Maybe sig = SHA256(r)?
            const shaR = crypto.createHash('sha256').update(rPadded.substring(0, 64)).digest('hex');
            console.error('SHA256(r):      ' + shaR + ' match=' + (shaR === sig));
        } else {
            console.error('r/s NOT CAPTURED — patch failed');
        }

        // Also show the body signData for reference
        const bodyObj = JSON.parse(captured.body);
        console.error('\nBody signData: ' + bodyObj.data.signData.substring(0, 40) + '...');
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 25000);
