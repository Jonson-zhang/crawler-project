/**
 * 东航 (ceair) WASM 加密模块 — Node.js 补环境方案
 *
 * === WASM 类型 ===
 * Emscripten wasm2js (C++ WASM → JavaScript 编译)
 * 不是 wasm-bindgen，无 wbg 导入。
 *
 * === WASM 导出（已验证，来自 asm.js export table）===
 * wbsk_AES_ecb_encrypt / wbsk_AES_ecb_decrypt  (ECB mode)
 * wbsk_AES_cbc_encrypt / wbsk_AES_cbc_decrypt  (CBC mode)
 * wbsk_skb_encrypt   / wbsk_skb_decrypt        (高层封装，未在本文件使用)
 *
 * === 函数签名（Emscripten cwrap，非猜测，来自 C 源码编译） ===
 * ECB: (input:Uint8Array, inlen:number, outadd:ptr, lenadd:ptr) → number
 * CBC: (input:Uint8Array, inlen:number, outadd:ptr, lenadd:ptr,
 *        iv:Uint8Array, ivlen:number) → number
 *
 * === 环境需求 ===
 * - Emscripten 运行时（内嵌在 wbsk_Wbox.js）
 * - global.Module 预置（Node 环境自动检测）
 * - IV 硬编码在 wbsk_skb.js（白盒 AES 固定 IV）
 *
 * 用法:
 *   node sign.js encrypt '{"routes":[...]}'   → 输出 {"req":"base64..."}
 *   node sign.js decrypt 'base64...'           → 输出解密后的 JSON
 *   node sign.js search '{"dep":"SHA","arr":"BJS","date":"20260622"}'
 *                                              → 搜索航班（需要有效 Cookie）
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

// ============================================================
// 环境补丁：Node.js 下运行 Emscripten wasm2js 模块
// ============================================================

// Emscripten wasm2js 在 Node.js 环境下通过 module.exports 返回 Module 对象
// 必须用 global.Module 接收，因为 wbsk_skb_orig.js 通过 vm.runInThisContext
// 在全局作用域中引用 Module
//
// 环境补丁分析：
//   - ENVIRONMENT_IS_NODE=true → 走 Node 路径
//   - 无需 self/window/document/crypto（Emscripten 非 wasm-bindgen）
//   - Module 通过 require 返回值获取
global.Module = require('./wbsk_Wbox.js');

// ============================================================
// 加载加密包装器（wbsk_skb.js 浏览器原始代码）
// 使用 vm.runInThisContext 在不修改任何代码的情况下执行
// ============================================================
const skbSrc = fs.readFileSync(path.join(__dirname, 'wbsk_skb_orig.js'), 'utf8');
vm.runInThisContext(skbSrc);

// ============================================================
// 常量
// ============================================================
const IV = [121, 96, 7, 103, 57, 95, 61, 124, 121, 96, 7, 103, 57, 95, 61, 124];
const BASE = 'https://m.ceair.com';

function genTxId() {
    return '05' + new Date().toISOString().replace(/[T\-:]/g, '').replace(/\.[\d]{3}Z/, '')
        + String(Math.ceil(10000 * Math.random()));
}

// ============================================================
// 加密/解密 API
// ============================================================

function encryptPayload(data) {
    const payload = Object.assign({}, data, {
        salesChannel: '7701',
        moduleX: 'mShopping',
        os: 'M',
        language: 'zh',
        appVersion: '99.0.0',
        transactionId: genTxId(),
    });
    return {
        req: wbsk_AES_cbc_encrypt_base64(JSON.stringify(payload), IV),
    };
}

function decryptPayload(b64) {
    return JSON.parse(wbsk_AES_cbc_decrypt_base64(b64, IV));
}

// ============================================================
// 网络层：Node.js 原生 HTTPS + Cookie 管理
// ============================================================

let sessionCookies = '';

/**
 * 访问首页获取 WAF cookies (acw_tc, SERVERID 等)
 */
function fetchHomePage() {
    return new Promise((resolve, reject) => {
        const req = https.get(BASE + '/mapp/Home', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    + ' (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
        }, (res) => {
            const setCookies = res.headers['set-cookie'] || [];
            setCookies.forEach(c => {
                const kv = c.split(';')[0];
                sessionCookies += kv + '; ';
            });
            res.resume();
            res.on('end', () => {
                console.error('[session] 首页: HTTP ' + res.statusCode
                    + ' cookies:' + setCookies.length + '条');
                resolve(sessionCookies);
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    });
}

/**
 * 发送加密请求到 shoppingv2
 */
function searchFlights(params) {
    const { dep, arr, date, depName, arrName, cookies: extraCookies } = params;

    // 如果传入了额外 cookies，合并
    if (extraCookies) {
        sessionCookies = extraCookies + '; ' + sessionCookies;
    }

    return new Promise((resolve, reject) => {
        const fullPayload = {
            currentQueryType: 'FLIGHT_LIST',
            currentSegIndex: 0,
            language: 'zh',
            selectedRoutes: [],
            productType: 'CASH',
            routes: [{
                arrCode: arr, depCode: dep,
                flightDate: date,
                arrCodeType: '1', depCodeType: '1',
                depCityName: depName || getCityName(dep),
                arrCityName: arrName || getCityName(arr),
                segIndex: 0, leftInner: '', rightInner: '',
            }],
            tripType: 'OW',
            cabinGrade: '',
        };

        const { req: encrypted } = encryptPayload(fullPayload);
        const body = JSON.stringify({ req: encrypted });

        const url = new URL('/m-base/sale/shoppingv2', BASE);
        const req = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Host': 'm.ceair.com',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Origin': BASE,
                'Referer': BASE + '/mapp/reserve/flightList',
                'M-CEAIR-ENCRYPTED': 'true',
                'X-CEAIR-OS': 'M',
                'transactionId': genTxId(),
                'ceair-ecuser-token': 'null',
                'Cookie': sessionCookies.trimEnd(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    + ' (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            },
        }, (res) => {
            let chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString();
                const ct = res.headers['content-type'] || '';

                // 更新 cookies
                const setCookies = res.headers['set-cookie'] || [];
                setCookies.forEach(c => {
                    sessionCookies += c.split(';')[0] + '; ';
                });

                // WAF 拦截检测
                if (ct.includes('text/html') || raw.includes('aliyun_waf')) {
                    reject(new Error('WAF blocked: 需要有效的 ssxmod_itna Cookie'));
                    return;
                }

                try {
                    const data = JSON.parse(raw);
                    if (data.res) {
                        const decrypted = decryptPayload(data.res);
                        resolve(JSON.parse(decrypted));
                    } else {
                        resolve(data);
                    }
                } catch (e) {
                    reject(new Error('JSON parse failed: ' + raw.substring(0, 200)));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body);
        req.end();
    });
}

function getCityName(code) {
    const map = {
        SHA: '上海', BJS: '北京', PEK: '北京', PKX: '北京',
        CAN: '广州', SZX: '深圳', CTU: '成都', CKG: '重庆',
        XIY: '西安', KMG: '昆明', HGH: '杭州', NKG: '南京',
        WUH: '武汉', CSX: '长沙', TAO: '青岛', DLC: '大连',
        XMN: '厦门', FOC: '福州', HAK: '海口', SYX: '三亚',
    };
    return map[code] || code;
}

// ============================================================
// CLI 入口
// ============================================================

function main() {
    const cmd = process.argv[2];

    if (cmd === 'encrypt') {
        let chunks = [];
        process.stdin.on('data', c => chunks.push(c));
        process.stdin.on('end', () => {
            const input = Buffer.concat(chunks).toString().trim();
            const data = JSON.parse(input);
            console.log(JSON.stringify(encryptPayload(data)));
        });

    } else if (cmd === 'decrypt') {
        let chunks = [];
        process.stdin.on('data', c => chunks.push(c));
        process.stdin.on('end', () => {
            const input = Buffer.concat(chunks).toString().trim();
            console.log(JSON.stringify(decryptPayload(input)));
        });

    } else if (cmd === 'search') {
        let chunks = [];
        process.stdin.on('data', c => chunks.push(c));
        process.stdin.on('end', async () => {
            try {
                const params = JSON.parse(Buffer.concat(chunks).toString().trim());
                const { dep = 'SHA', arr = 'BJS', date = '20260622',
                        depName, arrName, cookies } = params;

                console.error('[1/2] 获取 session...');
                await fetchHomePage();

                console.error('[2/2] 搜索: ' + dep + '→' + arr + ' ' + date);
                const result = await searchFlights({ dep, arr, date, depName, arrName, cookies });
                console.log(JSON.stringify(result, null, 2));
            } catch (e) {
                console.error('[FAIL]', e.message);
                process.exit(1);
            }
        });

    } else {
        console.error('Usage: node sign.js encrypt|decrypt|search');
        console.error('  echo \'{"routes":[...]}\' | node sign.js encrypt');
        console.error('  echo \'base64...\'           | node sign.js decrypt');
        console.error('  echo \'{"dep":"SHA","arr":"BJS","date":"20260622","cookies":"k1=v1; k2=v2"}\' | node sign.js search');
        process.exit(1);
    }
}

main();

// ============================================================
// 模块导出（供 crawler.py 子进程调用已不需要，但保留兼容）
// ============================================================
module.exports = { encryptPayload, decryptPayload, fetchHomePage, searchFlights, IV, BASE };
