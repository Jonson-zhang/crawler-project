/**
 * 国家医保局 API 客户端 - Node.js 版本
 * ========================================
 *
 * 使用 sm-crypto 库实现 SM2/SM4 加密和签名。
 * 通过 axios 发送加密请求，解密响应数据。
 *
 * 用法: node main.js [关键词]
 *
 * 依赖: npm install sm-crypto axios
 */

const crypto = require('crypto');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
    appCode: 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ',
    version: '1.0.0',
    apiUrl: 'https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital',
    sm4Key: null,      // 16字节 hex (需配置)
    sm4Iv: '00000000000000000000000000000000',
};

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function generateNonce(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * SM4 加密 (使用 sm-crypto 库)
 */
function sm4Encrypt(plaintext, keyHex, ivHex) {
    const sm4 = require('sm-crypto').sm4;
    // sm-crypto 的 sm4.encrypt 默认使用 CBC 模式
    const ciphertext = sm4.encrypt(plaintext, keyHex, {
        mode: 'cbc',
        iv: ivHex,
    });
    return ciphertext.toUpperCase();
}

/**
 * SM4 解密
 */
function sm4Decrypt(ciphertextHex, keyHex, ivHex) {
    const sm4 = require('sm-crypto').sm4;
    return sm4.decrypt(ciphertextHex, keyHex, {
        mode: 'cbc',
        iv: ivHex,
    });
}

/**
 * SM2 签名
 */
function sm2Sign(data, privateKeyHex) {
    const sm2 = require('sm-crypto').sm2;
    // sm2.doSignature 返回 base64 编码的签名
    const signData = sm2.doSignature(data, privateKeyHex, {
        hash: true,  // 自动进行 SM3 哈希
    });
    return signData;
}

/**
 * 计算 x-tif-signature
 * 算法: SHA256(appCode + timestamp + nonce + body)
 */
function computeXTifSignature(appCode, timestamp, nonce, body) {
    const input = `${appCode}${timestamp}${nonce}${body}`;
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

// ═══════════════════════════════════════════════════════════════
// 主逻辑
// ═══════════════════════════════════════════════════════════════

async function searchMedical(keyword = '', pageNum = 1, pageSize = 10, filters = {}) {
    if (!CONFIG.sm4Key) {
        throw new Error(
            'SM4 密钥未配置！\n' +
            '请设置 CONFIG.sm4Key (16字节 hex 字符串 = 32字符)\n' +
            '获取方法: 见 README.md'
        );
    }

    const { appCode, version, apiUrl, sm4Key, sm4Iv } = CONFIG;
    const timestamp = generateTimestamp();
    const nonce = generateNonce();

    // 1. 构造查询参数
    const queryParams = {
        keyword,
        pageNum,
        pageSize,
        ...filters,
    };
    const plaintext = JSON.stringify(queryParams);

    // 2. SM4 加密
    const encData = sm4Encrypt(plaintext, sm4Key, sm4Iv);

    // 3. 构造请求体
    const innerData = {
        data: { encData },
        appCode,
        version,
        encType: 'SM4',
        signType: 'SM2',
        timestamp,
    };

    // 4. SM2 签名 (如已配置 SM2 密钥)
    const bodyStr = JSON.stringify(innerData);
    // TODO: signData 需要 SM2 签名

    const requestBody = JSON.stringify({
        data: {
            ...innerData,
            signData: '',  // SM2 签名
        }
    });

    // 5. 计算请求头签名
    const xTifSignature = computeXTifSignature(appCode, timestamp.toString(), nonce, requestBody);

    // 6. 发送请求
    const headers = {
        'Content-Type': 'application/json',
        'channel': 'web',
        'x-tif-paasid': 'undefined',
        'x-tif-signature': xTifSignature,
        'x-tif-timestamp': timestamp.toString(),
        'x-tif-nonce': nonce,
        'Accept': 'application/json',
        'Origin': 'https://fuwu.nhsa.gov.cn',
        'Referer': 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    };

    console.log(`[请求] ${apiUrl}`);
    console.log(`[参数] keyword=${keyword}, page=${pageNum}`);
    console.log(`[Nonce] ${nonce}`);

    const response = await axios.post(apiUrl, requestBody, {
        headers,
        timeout: 30000,
    });

    if (response.data.code === 0) {
        // 7. 解密响应
        const encResponseData = response.data.data.data.encData;
        const decrypted = sm4Decrypt(encResponseData, sm4Key, sm4Iv);
        const data = JSON.parse(decrypted);

        return {
            success: true,
            code: response.data.code,
            message: response.data.message,
            data: data,
        };
    }

    return {
        success: false,
        code: response.data.code || -1,
        message: response.data.message || 'Unknown error',
    };
}

// ═══════════════════════════════════════════════════════════════
// 入口
// ═══════════════════════════════════════════════════════════════

async function main() {
    const keyword = process.argv[2] || '北京协和医院';

    if (!CONFIG.sm4Key) {
        console.log('[!] SM4 key not configured.');
        console.log('[!] Please set CONFIG.sm4Key in main.js');
        console.log('[!] See README.md for key extraction instructions.');
        process.exit(1);
    }

    try {
        const result = await searchMedical(keyword);
        if (result.success && result.data) {
            const records = result.data.list || result.data.records || [];
            console.log(`\n查询结果 (共 ${result.data.total || records.length} 条):`);

            records.forEach((item, i) => {
                const name = (item.medName || item.name || '').substring(0, 30);
                const addr = (item.addr || item.address || '').substring(0, 30);
                console.log(`  ${i + 1}. ${name} - ${addr}`);
            });
        } else {
            console.log(`查询失败: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        console.error(`错误: ${error.message}`);
    }
}

main();
