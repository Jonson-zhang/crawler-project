/**
 * 搜索所有 webpack 模块源码，找到计算 x-tif-signature 的模块
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const APP_JS = path.join(__dirname, 'config', 'app.js');
let src = fs.readFileSync(APP_JS, 'utf-8');

// Patch 1: export crypto
const p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };';
const i1 = src.indexOf(p1);
const off1 = 90;
let patched = src.substring(0, i1 + p1.length) +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";' +
    src.substring(i1 + p1.length);

// Patch 2: save BOTH exports AND source for each module
const p2 = '(_0x1210ab["l"] = !0x0),';
const i2raw = src.indexOf(p2);
const i2 = i2raw < i1 ? i2raw : i2raw + off1;
// After module loads, save: window["_m"+id] = exports; window["_s"+id] = module_source;
const insert2 = '(window["_m"+_0x518e77]=_0x1210ab["exports"],window["_s"+_0x518e77]=_0xe330b8[_0x518e77]&&_0xe330b8[_0x518e77].toString?String(_0xe330b8[_0x518e77]).substring(0,5000):""),';
patched = patched.substring(0, i2 + p2.length) + insert2 + patched.substring(i2 + p2.length);

console.error('[find] Patched');

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

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    console.error('\n=== Searching module sources for x-tif-signature ===\n');

    const results = [];
    for (const k of Object.keys(win)) {
        if (!k.startsWith('_s')) continue; // Only source keys
        const modId = k.substring(2);
        const source = win[k];
        if (typeof source !== 'string' || source.length < 50) continue;

        let score = 0;
        const reasons = [];

        if (source.includes('x-tif-signature') || source.includes('x-tif-timestamp') || source.includes('x-tif-nonce')) {
            score += 50; reasons.push('x-tif-headers');
        }
        if (source.includes('signData') || source.includes('signType')) {
            score += 20; reasons.push('signData/SignType');
        }
        if (source.includes('encData') || source.includes('encType')) {
            score += 20; reasons.push('encData/encType');
        }
        if (source.includes('sha256') || source.includes('SHA256') || source.includes('SHA256')) {
            score += 15; reasons.push('sha256');
        }
        if (source.includes('appCode') || source.includes('APP_CODE')) {
            score += 10; reasons.push('appCode');
        }
        if (source.includes('generateKeyPair') || source.includes('doSignature')) {
            score += 10; reasons.push('crypto');
        }
        if (source.includes('nonce') || source.includes('timestamp')) {
            score += 5; reasons.push('nonce/timestamp');
        }
        if (source.includes('headers') && source.includes('request')) {
            score += 5; reasons.push('headers+request');
        }

        if (score > 0) {
            results.push({ id: modId, score, reasons: reasons.join(','), preview: source.substring(0, 300) });
        }
    }

    results.sort((a, b) => b.score - a.score);

    // Show top results
    results.slice(0, 20).forEach((r, i) => {
        console.error(`\n[${i + 1}] Module ${r.id} (score=${r.score})`);
        console.error(`    Reasons: ${r.reasons}`);
        console.error(`    Preview: ${r.preview.substring(0, 200)}`);
    });

    // Count modules with source saved
    const srcKeys = Object.keys(win).filter(k => k.startsWith('_s'));
    console.error(`\nTotal source snippets saved: ${srcKeys.length}`);

    // Check specific modules
    const check = ['b50d', '2444', '21bf', '4d09', '68b2', 'e04e', '6c27'];
    console.error('\n=== Specific module sources ===');
    for (const id of check) {
        const src = win['_s' + id];
        if (src) {
            console.error(`\n  [${id}] (${src.length} chars):`);
            console.error(`    ${src.substring(0, 300)}`);
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 30000);
