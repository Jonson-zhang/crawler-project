/**
 * 国家医保局 — 加密服务器 (sm-crypto npm)
 * ==========================================
 *
 * 纯 Node.js，使用 sm-crypto 库生成 SM2/SM4 加密请求。
 * SM2 keypair 每会话动态生成 (匹配 app.js 的 sm2.generateKeyPairHex)。
 * SM4 key = SM3(APP_CODE) bytes[:16]。
 */

const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;
const crypto = require('crypto');
const readline = require('readline');

const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const VERSION = '1.0.0';
const SM4_IV = '00000000000000000000000000000000';

function log(msg) { process.stderr.write(`[nhsa] ${msg}\n`); }

// 每会话密钥
let _keypair = null;
let _sm4Key = null;

function init() {
    if (_keypair) return;
    _keypair = sm2.generateKeyPairHex();
    const sm3Full = sm3(APP_CODE);
    _sm4Key = Buffer.from(sm3Full, 'hex').slice(0, 16).toString('hex');
    log(`Init: sm4Key=${_sm4Key}, pubKey=${_keypair.publicKey.substring(0,20)}...`);
}

function genNonce(len = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let r = '';
    for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
}

function encrypt(params) {
    init();
    const ts = Math.floor(Date.now() / 1000);
    const nonce = genNonce(8);
    const plainJson = JSON.stringify(params);

    // SM4-CBC 加密
    const encData = sm4.encrypt(plainJson, _sm4Key, { mode: 'cbc', iv: SM4_IV });

    const inner = {
        data: { encData },
        appCode: APP_CODE, version: VERSION,
        encType: 'SM4', signType: 'SM2', timestamp: ts,
    };

    // SM2 签名
    const signData = sm2.doSignature(JSON.stringify(inner), _keypair.privateKey, { hash: true });

    const body = {
        data: { ...inner, signData },
    };

    const bodyJson = JSON.stringify(body);
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
    };
}

// ═══════════════════════════════════════════════════════════════
// JSON-RPC
// ═══════════════════════════════════════════════════════════════

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
    let reqId = 0;
    try {
        const req = JSON.parse(line);
        reqId = req.id;
        const { method, params = {} } = req;
        if (method === 'encrypt') {
            respond(reqId, encrypt(params));
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

// CLI mode (node 加密服务器.js encrypt '{"keyword":"医院"}')
if (process.argv.length > 2) {
    const cmd = process.argv[2];
    const input = process.argv[3] || '{}';
    init();
    if (cmd === 'encrypt') {
        const result = encrypt(JSON.parse(input));
        respond(1, result);
    } else {
        respond(1, null, { message: 'Unknown CLI: ' + cmd });
    }
    process.exit(0);
}

// JSON-RPC stdin mode
init();
log('Ready');
respond(0, { status: 'ready' });
