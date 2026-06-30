/**
 * 国家医保局 — 加密服务器 (纯 sm-crypto npm)
 * ============================================
 *
 * 使用 sm-crypto 库 + 从 app.js 字符串表解码的密钥直接构造请求。
 * 不需要 jsdom。
 *
 * 密钥来源: app.js OB 字符串表 XOR 解码
 */

const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;
const crypto = require('crypto');
const readline = require('readline');

const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const VERSION = '1.0.0';
const SM4_IV = '00000000000000000000000000000000';

// 从 XOR 解码得到的密钥材料:
// a = NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P (疑似 base32 公钥)
// c = base64 SM2 私钥 (65 bytes = 04 + private)
// d = base64 SM4 key 材料 (33 bytes)
// e = APP_CODE

// 尝试多种 SM4 密钥派生方式
function deriveSm4Key() {
    const candidates = [];

    // d_val base64 → bytes
    const dB64 = 'AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC';
    const dBytes = Buffer.from(dB64, 'base64');
    candidates.push({ name: 'd[0:16]', key: dBytes.slice(0, 16) });
    candidates.push({ name: 'd[1:17]', key: dBytes.slice(1, 17) });
    candidates.push({ name: 'd[17:33]', key: dBytes.slice(17, 33) });

    // SM3(appCode)[:16] as bytes
    const sm3Bytes = Buffer.from(sm3(APP_CODE), 'hex');
    candidates.push({ name: 'sm3(appCode)[0:16]', key: sm3Bytes.slice(0, 16) });

    // MD5(appCode) as bytes
    candidates.push({ name: 'md5(appCode)', key: crypto.createHash('md5').update(APP_CODE).digest() });

    // SHA256(appCode)[0:16]
    candidates.push({ name: 'sha256(appCode)[0:16]', key: crypto.createHash('sha256').update(APP_CODE).digest().slice(0, 16) });

    return candidates;
}

const SM4_KEY = deriveSm4Key()[2].key; // d[17:33]
const SM4_KEY_HEX = SM4_KEY.toString('hex');

// SM2 keypair (from decoded c_val = private key)
const C_B64 = 'BEKaw3Qtc31LG/hTPHFPlriKuAn/nzTWl8LiRxLw4iQiSUIyuglptFxNkdCiNXcXvkqTH79Rh/A2sEFU6hjeK3k=';
const C_RAW = Buffer.from(C_B64, 'base64');
const PRIVATE_KEY = C_RAW.slice(1, 33).toString('hex');

function genNonce(len = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let r = '';
    for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
}

/**
 * 加密查询参数并构造完整请求
 */
function encrypt(params) {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = genNonce(8);

    // 1. 构造查询明文
    const plainJson = JSON.stringify(params);

    // 2. SM4-CBC 加密
    let encData;
    try {
        encData = sm4.encrypt(plainJson, SM4_KEY_HEX, {
            mode: 'cbc', iv: SM4_IV
        });
    } catch (e) {
        return { error: 'SM4 encrypt failed: ' + e.message };
    }

    // 3. 构造内层数据
    const inner = {
        data: { encData },
        appCode: APP_CODE, version: VERSION,
        encType: 'SM4', signType: 'SM2', timestamp: ts
    };
    const innerJson = JSON.stringify(inner);

    // 4. SM2 签名
    let signData;
    try {
        signData = sm2.doSignature(innerJson, PRIVATE_KEY, { hash: true });
    } catch (e) {
        return { error: 'SM2 sign failed: ' + e.message };
    }

    // 5. 完整请求体
    const body = {
        data: {
            data: { encData },
            appCode: APP_CODE, version: VERSION,
            encType: 'SM4', signType: 'SM2',
            timestamp: ts, signData,
        }
    };
    const bodyJson = JSON.stringify(body);

    // 6. x-tif-signature
    const xTifSig = crypto.createHash('sha256')
        .update(APP_CODE + ts + nonce + bodyJson).digest('hex');

    return {
        headers: {
            'Content-Type': 'application/json', channel: 'web',
            'x-tif-paasid': 'undefined',
            'x-tif-signature': xTifSig,
            'x-tif-timestamp': String(ts),
            'x-tif-nonce': nonce,
            Accept: 'application/json',
            Origin: 'https://fuwu.nhsa.gov.cn',
            Referer: 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
        },
        body,
        _debug: {
            sm4Key: SM4_KEY_HEX,
            sm4Len: SM4_KEY.length,
            privateKey: PRIVATE_KEY,
        },
    };
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC
// ═══════════════════════════════════════════════════════════════

function log(msg) { process.stderr.write(`[nhsa] ${msg}\n`); }

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
    let reqId = 0;
    try {
        const req = JSON.parse(line);
        reqId = req.id;
        const { method, params = {} } = req;

        if (method === 'encrypt') {
            const result = encrypt(params);
            respond(reqId, result);
        } else if (method === 'ping') {
            respond(reqId, { pong: true });
        } else {
            respond(reqId, null, { message: 'Unknown: ' + method });
        }
    } catch (e) {
        respond(reqId, null, { message: e.message });
    }
});

function respond(id, result, error) {
    const resp = { id };
    if (error) resp.error = error;
    else resp.result = result;
    process.stdout.write(JSON.stringify(resp) + '\n');
}

// Self-test
async function selfTest() {
    const r = encrypt({ keyword: '', pageNum: 1, pageSize: 10 });
    log(`Self-test: encData=${r.body?.data?.data?.encData?.substring(0, 40) || 'FAILED'}`);
    log(`Sign: ${r.body?.data?.signData?.substring(0, 20) || 'FAILED'}`);
    log(`Keys: sm4=${SM4_KEY_HEX}, priv=${PRIVATE_KEY.substring(0,16)}...`);
}

selfTest();
log('Ready');
respond(0, { status: 'ready' });
