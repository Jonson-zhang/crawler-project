/**
 * 国家医保局 — 密钥推导脚本
 * ============================
 *
 * 在 jsdom 中运行 app.js，通过"已知明文攻击"找出 SM4 密钥。
 *
 * 原理:
 *   1. jsdom 加载 app.js → Vue 应用初始化 → 发起 selectByKeys 请求
 *   2. 拦截 XHR，捕获 encData (密文)
 *   3. 用 sm-crypto npm 尝试各种密钥解密
 *   4. 已知 selectByKeys 的明文 = 某种短 JSON
 *   5. 匹配成功 → 得到 SM4 密钥
 *
 * 用法: node find_key.js
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;
const crypto = require('crypto');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';

// ═══════════════════════════════════════════════════════════════
// 1. jsdom 环境 + 拦截
// ═══════════════════════════════════════════════════════════════

const dom = new JSDOM('<html><body><div id="app"></div></body></html>', {
    url: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
    pretendToBeVisual: true, runScripts: 'dangerously', resources: 'usable',
});
const win = dom.window;

win.crypto = {
    getRandomValues(arr) { for(let i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256); return arr; },
    subtle: {},
};
win.btoa = s => Buffer.from(s,'binary').toString('base64');
win.atob = s => Buffer.from(s,'base64').toString('binary');

// 拦截 XHR
let capturedBody = null;
const OrigXHR = win.XMLHttpRequest;
win.XMLHttpRequest = function() {
    const xhr = new OrigXHR();
    const oo = xhr.open, os = xhr.send, osr = xhr.setRequestHeader;
    let url = '', headers = {};

    xhr.open = function(m,u) { url=u; return oo.apply(this,arguments); };
    xhr.setRequestHeader = function(k,v) { headers[k]=v; return osr.apply(this,arguments); };
    xhr.send = function(body) {
        if (url.includes('selectByKeys')) {
            capturedBody = { url, body: typeof body === 'string' ? body : '', headers };
        }
        os.call(this, body);
    };
    return xhr;
};

// 加载 app.js
const script = win.document.createElement('script');
script.textContent = fs.readFileSync(APP_JS, 'utf-8');
try { win.document.body.appendChild(script); } catch(e) {}

// ═══════════════════════════════════════════════════════════════
// 2. 等待 app 初始化，捕获密文
// ═══════════════════════════════════════════════════════════════

setTimeout(() => {
    if (!capturedBody) {
        console.log(JSON.stringify({ error: 'No request captured' }));
        process.exit(1);
    }

    const encData = JSON.parse(capturedBody.body).data.data.encData;
    console.error(`[captured] encData = ${encData}`);
    console.error(`[captured] length = ${encData.length} hex chars`);

    // ═══════════════════════════════════════════════════════════
    // 3. 已知明文攻击 — 尝试各种密钥
    // ═══════════════════════════════════════════════════════════

    // selectByKeys 的请求明文很可能是以下之一:
    const possiblePlains = [
        JSON.stringify({ keys: [] }),
        JSON.stringify({ keys: [''] }),
        JSON.stringify({ dictType: '' }),
        JSON.stringify({ type: '' }),
        JSON.stringify({ code: '' }),
        JSON.stringify({ groupCode: '' }),
        JSON.stringify({ keys: 'all' }),
        JSON.stringify({ dictCode: '' }),
        // 从浏览器抓包中观察到的其他 API 参数格式
        JSON.stringify({ data: { keys: [] } }),
        JSON.stringify({ data: { dictType: '' } }),
    ];

    // 密钥候选
    const keyCandidates = [];

    // 从 XOR 解码的字符串表值
    keyCandidates.push(['a_val_16B', Buffer.from('NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P','ascii').slice(0,16)]);
    keyCandidates.push(['d_val_0_16', Buffer.from('AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC','base64').slice(0,16)]);
    keyCandidates.push(['d_val_1_16', Buffer.from('AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC','base64').slice(1,17)]);
    keyCandidates.push(['d_val_17_33', Buffer.from('AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC','base64').slice(17,33)]);

    // Hash derivations
    keyCandidates.push(['sm3_appCode_16', Buffer.from(sm3(APP_CODE),'hex').slice(0,16)]);
    keyCandidates.push(['sha256_appCode_16', crypto.createHash('sha256').update(APP_CODE).digest().slice(0,16)]);
    keyCandidates.push(['md5_appCode', crypto.createHash('md5').update(APP_CODE).digest()]);

    // appCode as ASCII bytes
    keyCandidates.push(['appCode_ASCII_16', Buffer.from(APP_CODE,'ascii').slice(0,16)]);

    // String table hex values
    keyCandidates.push(['hex_2578', Buffer.from('19E179E5DC29C05E65B90CDE57A1C7E5','hex')]);
    keyCandidates.push(['hex_492_16', Buffer.from('7380166f4914b2b9172442d7da8a0600','hex')]);

    const results = [];
    const IV = Buffer.alloc(16, 0);

    for (const [keyName, keyBytes] of keyCandidates) {
        const keyHex = keyBytes.toString('hex');
        for (const plaintext of possiblePlains) {
            try {
                // SM4-CBC encrypt
                const enc = sm4.encrypt(plaintext, keyHex, { mode: 'cbc', iv: '00000000000000000000000000000000' });
                if (enc.toUpperCase() === encData.toUpperCase()) {
                    results.push({
                        MATCH: true,
                        keyName,
                        keyHex,
                        plaintext,
                        encData: enc.toUpperCase(),
                    });
                }
            } catch(e) {}
        }
        // Also try ECB
        for (const plaintext of possiblePlains.slice(0, 3)) {
            try {
                const enc = sm4.encrypt(plaintext, keyHex, { mode: 'ecb' });
                if (enc.toUpperCase() === encData.toUpperCase()) {
                    results.push({ MATCH_ECB: true, keyName, keyHex, plaintext });
                }
            } catch(e) {}
        }
    }

    if (results.length > 0) {
        console.log(JSON.stringify({ found: results }, null, 2));
    } else {
        // Try smaller plaintexts — maybe it's just a single key string
        const microPlains = ['{}', '[]', '""', 'null', '1', '0', 'true', 'false', '""',
            JSON.stringify({}), JSON.stringify([]),
        ];
        for (const [keyName, keyBytes] of keyCandidates) {
            const keyHex = keyBytes.toString('hex');
            for (const pt of microPlains) {
                try {
                    const enc = sm4.encrypt(pt, keyHex, { mode: 'cbc', iv: '00000000000000000000000000000000' });
                    if (enc.toUpperCase() === encData.toUpperCase()) {
                        results.push({ MATCH: true, keyName, keyHex, plaintext: pt });
                    }
                } catch(e) {}
            }
        }

        console.log(JSON.stringify({
            noMatch: true,
            encData,
            encDataLen: encData.length,
            keysTested: keyCandidates.length,
            plainsTested: possiblePlains.length + microPlains.length,
            partialResults: results,
            note: 'Try more key candidates or check if encryption uses non-standard mode'
        }, null, 2));
    }

    process.exit(0);
}, 5000);
