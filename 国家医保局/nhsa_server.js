/**
 * 国家医保局 — 完整加密服务器
 * ============================
 *
 * 基于从 app.js 中实际捕获的加密参数:
 *   SM4 Key: "C3AE5873D08418DA" (16字节 ASCII → hex: 43334145353837334430383431384441)
 *   SM2 Key: APP_CODE bytes as hex
 *   x-tif-signature: SHA256(?) — 待确认
 *
 * 用法:
 *   node nhsa_server.js encrypt '{"keyword":"医院","pageNum":1,"pageSize":10}'
 *   node nhsa_server.js serve
 */

const crypto = require('crypto');
const readline = require('readline');

// ===========================================================
// 加密密钥 (从 app.js 运行时捕获)
// ===========================================================

const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const VERSION = '1.0.0';

// SM4 key: captured from _0x32a5f1 function call
// Format: Uint8Array [67,51,65,69,53,56,55,51,68,48,56,52,49,56,68,65]
// As ASCII hex string: "C3AE5873D08418DA"
const SM4_KEY_HEX = Buffer.from('C3AE5873D08418DA', 'ascii').toString('hex');
// = '43334145353837334430383431384441'

// SM2 private key: APP_CODE → bytes → hex (64 hex chars)
const SM2_KEY_HEX = Buffer.from(APP_CODE, 'ascii').toString('hex');
// = '543938485043474e355a5656514253384c5a514e4f4145585649394759484b51'

// SM4 IV: all zeros (CBC mode)
const SM4_IV = '00000000000000000000000000000000';

function log(msg) { process.stderr.write('[nhsa] ' + msg + '\n'); }

// ===========================================================
// SM4 加密 (使用 sm-crypto npm 兼容的密钥格式)
// ===========================================================

function sm4Encrypt(plaintext, keyHex) {
    // The app's internal SM4 uses CBC mode with IV=0
    // keyHex is the SM4 key as a hex string (32 chars = 16 bytes)
    const sm4 = require('sm-crypto').sm4;
    return sm4.encrypt(plaintext, keyHex, { mode: 'cbc', iv: SM4_IV });
}

function sm4Decrypt(cipherHex, keyHex) {
    const sm4 = require('sm-crypto').sm4;
    return sm4.decrypt(cipherHex, keyHex, { mode: 'cbc', iv: SM4_IV });
}

// ===========================================================
// SM2 签名
// ===========================================================

function sm2Sign(message, privateKeyHex) {
    const sm2 = require('sm-crypto').sm2;
    return sm2.doSignature(message, privateKeyHex, { hash: true });
}

// ===========================================================
// 辅助函数
// ===========================================================

function genNonce(len = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let r = '';
    for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
}

// ===========================================================
// 核心加密函数
// ===========================================================

function encrypt(params) {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = genNonce(8);
    const plainJson = JSON.stringify(params);

    // Step 1: SM4-CBC 加密查询参数
    const encData = sm4Encrypt(plainJson, SM4_KEY_HEX);

    // Step 2: 构建内部对象
    const inner = {
        data: { encData },
        appCode: APP_CODE,
        version: VERSION,
        encType: 'SM4',
        signType: 'SM2',
        timestamp: ts,
    };

    // Step 3: SM2 签名
    const innerJson = JSON.stringify(inner);
    const signData = sm2Sign(innerJson, SM2_KEY_HEX);

    // Step 4: 构建完整 body
    const body = {
        data: {
            data: { encData },
            appCode: APP_CODE,
            version: VERSION,
            encType: 'SM4',
            signType: 'SM2',
            timestamp: ts,
            signData,
        }
    };

    const bodyJson = JSON.stringify(body);

    // Step 5: x-tif-signature (SHA256)
    // 算法待确认 — 尝试最可能的公式
    // 之前捕获的 charCodeAt 输入是 URL query string 格式:
    // appCode=T98...&data={}&encType=SM4&signType=SM2&timestamp=...&version=1.0.0&key=NMV...
    // 但 SHA256 不匹配 — 可能需要使用实际的 SM2 公钥

    // 尝试公式: SHA256(appCode + ts + nonce + bodyJson)
    const xTifSig = crypto.createHash('sha256')
        .update(APP_CODE + ts + nonce + bodyJson)
        .digest('hex');

    return {
        headers: {
            'Content-Type': 'application/json',
            'channel': 'web',
            'x-tif-paasid': 'undefined',
            'x-tif-signature': xTifSig,
            'x-tif-timestamp': String(ts),
            'x-tif-nonce': nonce,
            'Accept': 'application/json',
            'Origin': 'https://fuwu.nhsa.gov.cn',
            'Referer': 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body,
    };
}

// ===========================================================
// 验证: 对比已知的 selectByKeys 请求
// ===========================================================

function verify() {
    log('=== Verifying SM4 key against selectByKeys ===');

    // Known: selectByKeys plaintext = '{"keys":""}'
    // Known: encData = '4A8E4673BB18D86FE780DACC31C49FE3'
    const plaintext = '{"keys":""}';
    const expectedEnc = '4A8E4673BB18D86FE780DACC31C49FE3';

    const myEnc = sm4Encrypt(plaintext, SM4_KEY_HEX);
    const match = myEnc.toUpperCase() === expectedEnc.toUpperCase();

    log('Plaintext: ' + plaintext);
    log('Expected:  ' + expectedEnc);
    log('Got:       ' + myEnc);
    log('Match:     ' + match);

    if (!match) {
        // The internal SM4 uses a different implementation
        // Let's try with the internal function via jsdom
        log('WARNING: Standard sm-crypto SM4 does NOT match!');
        log('The internal SM4 implementation may differ from sm-crypto npm.');
        log('Need to use the patched app.js SM4 for correct encryption.');
    }

    return match;
}

// ===========================================================
// JSON-RPC Server
// ===========================================================

function serve() {
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
            } else if (method === 'verify') {
                respond(reqId, { verified: verify() });
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

    log('Ready');
    respond(0, { status: 'ready' });
}

// ===========================================================
// CLI
// ===========================================================

if (process.argv.length > 2) {
    const cmd = process.argv[2];
    const input = process.argv[3] || '{}';

    if (cmd === 'encrypt') {
        const result = encrypt(JSON.parse(input));
        process.stdout.write(JSON.stringify({ id: 1, result }, null, 2) + '\n');
    } else if (cmd === 'verify') {
        verify();
    } else if (cmd === 'serve') {
        serve();
    } else {
        log('Usage: node nhsa_server.js encrypt|verify|serve');
    }
    process.exit(0);
}

serve();
