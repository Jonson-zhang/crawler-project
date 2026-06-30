/**
 * 对比 iv8 内部 SM2 与浏览器 signData
 * 用同一消息+同一密钥生成签名对比
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');
// 3 patches
let patched = src;
patched = patched.substring(0, patched.indexOf('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };') +
    '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };'.length +
    ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};');
patched = patched.substring(0, patched.indexOf('(_0x1210ab["l"] = !0x0),') + '(_0x1210ab["l"] = !0x0),'.length +
    '(window["_m"+_0x518e77]=_0x1210ab["exports"]),');
patched = patched.substring(0, patched.indexOf('function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {') +
    'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {'.length +
    'window.__k=_0x1a6c05;window.__kp=_0x2e1290;');

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
    const doSig = win._m4d09 ? win._m4d09.doSignature : null;
    if (!doSig) { console.error('No doSig'); process.exit(1); }

    // Browser's exact message from reqid=173
    const browserInner = '{"data":{"encData":"3DFBCA4667B978F639BB23B95DCE4CC74CE34C33DC32F1068E9E23CA546C9EA8464E107F1E6350E50C7A229C736A86FDBF64832EBDC059B33148C3526A59CA868675A50809FAA2FA5A8EFFF71350319DFCFF07038EB5322908C6D2B1944D3A7D07AAD072869C7D72291A7A46B2A954973615DDC7EC9742385429CE9FF386B2AD4BB0A4306075B0A5725AEB4E9B057CBAD4D5E34C878887B40CA28B305578D4ABB93F5EED2EC4A1C787FBA85AB4445BEF133936B7363B8830D32FAFA1F4085908"},"appCode":"T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ","version":"1.0.0","encType":"SM4","signType":"SM2","timestamp":1782832179}';
    const SM2_KEY = '009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42';

    // Internal SM2 sign
    const ourHex = doSig(browserInner, SM2_KEY, { hash: true });
    const ourBytes = Buffer.from(ourHex, 'hex');
    const ourB64 = ourBytes.toString('base64');

    // Browser's signData
    const appB64 = 'dnKVgaRunbDGTpqVxlWgzICv2jS/gRUDYLIP+9cq9Ex1neEBwpJVDyK2+YI6TnLpRkFUETn9w2k635NbJpfKjg==';

    console.error('Browser signData: ' + appB64.substring(0, 50) + '... (' + Buffer.from(appB64, 'base64').length + ' bytes)');
    console.error('Our signData:     ' + ourB64.substring(0, 50) + '... (' + ourBytes.length + ' bytes)');
    console.error('Browser hex:      ' + Buffer.from(appB64, 'base64').toString('hex').substring(0, 64) + '...');
    console.error('Our hex:          ' + ourHex.substring(0, 64) + '...');
    console.error('MATCH: ' + (ourB64 === appB64));
    console.error('Our full hex:     ' + ourHex);

    // Also try different keys
    const keys = [
        { name: 'FIELD_D full hex', key: '009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42' },
        { name: 'FIELD_D skip 00', key: '9c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42' },
        { name: 'AC hex', key: Buffer.from('T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ', 'ascii').toString('hex') },
    ];
    for (const kt of keys) {
        const h = doSig(browserInner, kt.key, { hash: true });
        const b = Buffer.from(h, 'hex').toString('base64');
        if (b === appB64) {
            console.error('\n*** MATCH with key: ' + kt.name + ' ***');
        }
    }

    process.exit(0);
}, 10000);
