/**
 * 调用内部 SM2/SM4 生成正确签名的加密请求
 * 然后直接发 HTTPS 请求测试
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const crypto = require('crypto');
const https = require('https');

const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const COOKIE = 'yb_header_show=true; acw_tc=3ccdc16c17828291860561784ec220f7da21f69d10ebc0c3d2e46f14857d47; yb_header_active=-1';

let src = fs.readFileSync(path.join(__dirname, 'config', 'app.js'), 'utf-8');
const patches = [
    { p: '(_0x1210ab["l"] = !0x0),', i: '(window["_m" + _0x518e77] = _0x1210ab["exports"]),' },
    { p: '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };', i: ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' },
    { p: 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {', i: 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;' },
];
patches.sort((a, b) => src.indexOf(a.p) - src.indexOf(b.p));
let patched = src;
for (const p of patches) { const pos = patched.indexOf(p.p); patched = patched.substring(0, pos + p.p.length) + p.i + patched.substring(pos + p.p.length); }

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

const script = win.document.createElement('script');
script.textContent = patched;
try { win.document.body.appendChild(script); } catch (e) { }

setTimeout(() => {
    const doSig = win._m4d09 ? win._m4d09.doSignature : null;
    const sm4Enc = win.__c ? win.__c.sm4.encrypt : null;
    const sm4KeyArr = win.__k;

    if (!doSig || !sm4Enc || !sm4KeyArr) {
        console.error('Missing modules! doSig=' + !!doSig + ' sm4=' + !!sm4Enc + ' key=' + !!sm4KeyArr);
        process.exit(1);
    }

    // Build queryFixedHospital params
    const KEY_HEX = '009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42';

    try {
        const ts = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(4).toString('hex');
        const plain = JSON.stringify({ keyword: '医院', pageNum: 1, pageSize: 10 });

        // SM4 encrypt with internal function
        const plainBytes = Buffer.from(plain, 'utf-8');
        const pad = 16 - (plainBytes.length % 16);
        const padded = Buffer.alloc(plainBytes.length + pad);
        plainBytes.copy(padded);
        for (let i = plainBytes.length; i < padded.length; i++) padded[i] = pad;

        const encArr = sm4Enc(Array.from(padded), sm4KeyArr);
        const encData = Buffer.from(encArr).toString('hex');

        // SM2 sign with internal function
        const inner = { data: { encData }, appCode: AC, version: '1.0.0', encType: 'SM4', signType: 'SM2', timestamp: ts };
        const innerJson = JSON.stringify(inner);

        console.error('Calling internal doSignature...');
        const signDataHex = doSig(innerJson, KEY_HEX, { hash: true });
        console.error('Internal signData type: ' + typeof signDataHex);
        console.error('Internal signData length: ' + signDataHex.length);

        // Convert 128 hex → 64 bytes → base64
        const signBytes = Buffer.from(signDataHex, 'hex');
        const signDataB64 = signBytes.toString('base64');
        console.error('signData b64: ' + signDataB64.substring(0, 40) + '... (' + signDataB64.length + 'c = ' + signBytes.length + 'B)');

        // Build body and send
        const body = { data: { data: { encData }, appCode: AC, version: '1.0.0', encType: 'SM4', signType: 'SM2', timestamp: ts, signData: signDataB64 } };
        const bodyJson = JSON.stringify(body);
        const randomSig = crypto.randomBytes(32).toString('hex');

        console.error('\n=== Sending to API ===');
        console.error('encData: ' + encData.substring(0, 40) + '...');
        console.error('signData: ' + signDataB64.substring(0, 40) + '... (' + signBytes.length + ' bytes)');

        const options = {
            hostname: 'fuwu.nhsa.gov.cn', port: 443,
            path: '/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital',
            method: 'POST',
            headers: {
                'Accept': 'application/json', 'Content-Type': 'application/json',
                'Cookie': COOKIE,
                'channel': 'web', 'x-tif-paasid': 'undefined',
                'x-tif-signature': randomSig,
                'x-tif-timestamp': String(ts), 'x-tif-nonce': nonce,
                'Origin': 'https://fuwu.nhsa.gov.cn',
                'Referer': 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Content-Length': Buffer.byteLength(bodyJson),
            },
            rejectUnauthorized: false,
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('\n=== API RESPONSE ===');
                    console.log('Code:', result.code, 'Message:', result.message);

                    if (result.code === 0) {
                        console.log('\n🎉🎉🎉 SUCCESS! INTERNAL SM2 SIGNATURE ACCEPTED! 🎉🎉🎉');
                        // Decrypt response
                        if (result.data && result.data.data && result.data.data.encData) {
                            const respEnc = result.data.data.encData;
                            const decArr = win.__c.sm4.decrypt(
                                (() => { const a = []; for (let i = 0; i < respEnc.length; i += 2) a.push(parseInt(respEnc.substr(i, 2), 16)); return a; })(),
                                sm4KeyArr
                            );
                            const decStr = String.fromCharCode.apply(null, decArr);
                            console.log('Decrypted response:', decStr.substring(0, 500));
                        }
                    } else {
                        console.log('Raw response:', data.substring(0, 400));
                    }
                } catch (e) {
                    console.log('Parse error:', e.message);
                    console.log('Raw:', data.substring(0, 200));
                }
            });
        });
        req.on('error', e => console.error('Network error:', e.message));
        req.write(bodyJson);
        req.end();
    } catch (e) {
        console.error('Error:', e.message, e.stack);
    }
}, 10000);
setTimeout(() => process.exit(1), 30000);
