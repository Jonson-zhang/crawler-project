/**
 * 完整 API 测试 — 在 jsdom 中加载全部模块，触发 queryFixedHospital
 * 策略: 也加载 ServiceSearchModule.js，让 Vue 完整渲染
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const SERVICE_JS = path.join(__dirname, 'config', 'ServiceSearchModule.js');

// ============================================================
// Init
// ============================================================
let src = fs.readFileSync(APP_JS, 'utf-8');
const patches = [
    { p: '(_0x1210ab["l"] = !0x0),', i: '(window["_m" + _0x518e77] = _0x1210ab["exports"]),' },
    { p: '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };', i: ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' },
    { p: 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {', i: 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;' },
];
patches.sort((a, b) => src.indexOf(a.p) - src.indexOf(b.p));
let patched = src;
for (const p of patches) { const pos = patched.indexOf(p.p); patched = patched.substring(0, pos + p.p.length) + p.i + patched.substring(pos + p.p.length); }

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;
win.crypto = { getRandomValues(a) { crypto.randomFillSync(a); return a; }, subtle: {} };
win.btoa = s => Buffer.from(s, 'binary').toString('base64');
win.atob = s => Buffer.from(s, 'base64').toString('binary');
win.TextEncoder = function () { };
win.TextEncoder.prototype.encode = s => Buffer.from(s, 'utf-8');

// XHR intercept — DON'T forward real HTTP
let allReqs = [];
const OX = win.XMLHttpRequest;
win.XMLHttpRequest = function () {
    const x = new OX(); const oo = x.open, os = x.send, osr = x.setRequestHeader;
    let u = '', h = {};
    x.open = function (m, url) { u = url; return oo.apply(this, arguments); };
    x.setRequestHeader = function (k, v) { h[k] = v; return osr.apply(this, arguments); };
    x.send = function (b) {
        if (u.includes('/api/')) {
            allReqs.push({ url: u, headers: { ...h }, body: typeof b === 'string' ? b : '', time: Date.now() });
            // Return empty success to avoid real HTTP
            setTimeout(() => {
                Object.defineProperty(x, 'readyState', { get: () => 4 });
                Object.defineProperty(x, 'status', { get: () => 200 });
                if (x.onreadystatechange) {
                    try { x.onreadystatechange(); } catch (e) { }
                }
            }, 10);
            return; // Don't os.call()
        }
        try { os.call(this, b); } catch (e) { }
    };
    return x;
};

// Load app.js
console.error('[test] Loading app.js...');
const script1 = win.document.createElement('script');
script1.textContent = patched;
try { win.document.body.appendChild(script1); } catch (e) { }

// Load ServiceSearchModule.js too
console.error('[test] Loading ServiceSearchModule.js...');
const script2 = win.document.createElement('script');
script2.textContent = fs.readFileSync(SERVICE_JS, 'utf-8');
try { win.document.body.appendChild(script2); } catch (e) { }

setTimeout(() => {
    console.error('\n=== RESULTS ===');
    console.error('All XHR captured: ' + allReqs.length);
    allReqs.forEach((r, i) => {
        console.error('  [' + i + '] ' + r.url.split('/').pop() + ' sig=' + r.headers['x-tif-signature']);
    });

    // Check if queryFixedHospital was triggered
    const qfh = allReqs.filter(r => r.url.includes('queryFixedHospital'));
    console.error('\nqueryFixedHospital requests: ' + qfh.length);
    if (qfh.length > 0) {
        const r = qfh[0];
        console.error('  FULL HEADERS:');
        for (const [k, v] of Object.entries(r.headers)) {
            console.error('    ' + k + ': ' + v);
        }
        console.error('  BODY: ' + r.body.substring(0, 500));

        // Try to verify signData vs internal SM2
        const bodyObj = JSON.parse(r.body);
        const appSignData = bodyObj.data.signData;
        console.error('\n  App signData: ' + appSignData.substring(0, 40) + '... (' + Buffer.from(appSignData, 'base64').length + 'B)');

        // Now test with the REAL signature from the browser
        // Save this request for comparing with manually generated ones
        fs.writeFileSync(path.join(__dirname, 'config', 'captured_qfh.json'), JSON.stringify(r, null, 2));
        console.error('  Saved to config/captured_qfh.json');
    }

    // Scan for the API service
    for (const k of Object.keys(win)) {
        if (!k.startsWith('_m')) continue;
        const exp = win[k];
        if (!exp || typeof exp !== 'object') continue;
        const keys = Object.keys(exp);
        // Check if request method exists
        if (typeof exp.request === 'function' || (typeof exp.get === 'function' && typeof exp.post === 'function')) {
            console.error('\nFound API-like module [' + k.substring(2) + ']: keys=' + keys.slice(0, 10).join(','));
        }
    }

    process.exit(0);
}, 10000);
setTimeout(() => process.exit(1), 25000);
