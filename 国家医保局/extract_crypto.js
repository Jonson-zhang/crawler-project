/**
 * 国家医保局 - SM2/SM4 加密函数提取器
 *
 * 从 app.js 中提取加密相关的函数和密钥。
 *
 * 原理: 使用 Node.js vm 模块沙箱加载 app.js，
 * 在加载前注入拦截代码捕获 sm2/sm4 模块的导出。
 *
 * 用法: node extract_crypto.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP_JS = path.join(__dirname, 'config', 'app.js');
const SAMPLES = path.join(__dirname, 'config', 'samples.json');

// ============================================================
// 1. 读取文件
// ============================================================
const appCode = fs.readFileSync(APP_JS, 'utf-8');
const samples = JSON.parse(fs.readFileSync(SAMPLES, 'utf-8'));

console.log(`[extract] app.js loaded: ${(appCode.length / 1024 / 1024).toFixed(1)}MB`);

// ============================================================
// 2. 准备沙箱环境
// ============================================================
const sandbox = {
    // 基础环境
    window: {},
    self: {},
    global: {},

    // 浏览器 API（crypto-only，无需 DOM）
    navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        appVersion: '5.0',
        platform: 'Win32',
        language: 'zh-CN',
    },

    document: {
        cookie: '',
        createElement: () => ({ style: {}, setAttribute: () => {} }),
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        documentElement: { style: {} },
        body: { appendChild: () => {}, removeChild: () => {} },
    },

    location: {
        href: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
        host: 'fuwu.nhsa.gov.cn',
        hostname: 'fuwu.nhsa.gov.cn',
        protocol: 'https:',
        origin: 'https://fuwu.nhsa.gov.cn',
    },

    // Crypto API
    crypto: require('crypto'),

    // 编码函数
    btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
    atob: (str) => Buffer.from(str, 'base64').toString('binary'),

    // 基础类型
    ArrayBuffer: ArrayBuffer,
    Uint8Array: Uint8Array,
    Int8Array: Int8Array,
    Uint16Array: Uint16Array,
    Uint32Array: Uint32Array,
    DataView: DataView,

    // Promise / setTimeout
    Promise: Promise,
    setTimeout: setTimeout,
    setInterval: setInterval,
    clearTimeout: clearTimeout,
    clearInterval: clearInterval,

    // Console
    console: {
        log: (...args) => { /* silent */ },
        warn: (...args) => { /* silent */ },
        error: (...args) => { /* silent */ },
        info: (...args) => { /* silent */ },
    },

    // Node.js specific
    process: {
        env: { NODE_ENV: 'production' },
        version: 'v20.0.0',
    },
    Buffer: Buffer,

    // Web API stubs
    XMLHttpRequest: class {
        open() {}
        setRequestHeader() {}
        send() {}
    },
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
    WebSocket: class {},
    EventSource: class {},

    // 存储
    localStorage: {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = v; },
        removeItem(k) { delete this._data[k]; },
    },
    sessionStorage: {
        _data: {},
        getItem(k) { return this._data[k] || null; },
        setItem(k, v) { this._data[k] = v; },
        removeItem(k) { delete this._data[k]; },
    },

    // Error types
    Error: Error,
    TypeError: TypeError,
    RangeError: RangeError,
    SyntaxError: SyntaxError,
    ReferenceError: ReferenceError,
};

// 设置 window 上的全局属性
sandbox.window = new Proxy(sandbox, {
    get(target, prop) {
        if (prop in target) return target[prop];
        return undefined;
    }
});

// ============================================================
// 3. 注入拦截代码
// ============================================================

// 在 app.js 之前注入拦截模块系统的代码
const preloadCode = `
// 拦截模块导出
window.__sm_crypto = null;
window.__intercepted = [];

// 保存原始的 Object.defineProperty 以便检测模块注册
const _origDefineProperty = Object.defineProperty;
Object.defineProperty = function(obj, prop, desc) {
    // 检测 sm2/sm3/sm4 模块注册
    if (desc && desc.value && typeof desc.value === 'object') {
        const val = desc.value;
        if (val.sm2 && val.sm3 && val.sm4) {
            console.log('[INTERCEPT] SM crypto module detected!');
            window.__sm_crypto = val;
            window.__intercepted.push({ type: 'sm_crypto', exports: Object.keys(val) });
        }
    }
    return _origDefineProperty.call(Object, obj, prop, desc);
};

// 拦截 fetch/XHR 请求以捕获签名
const _origFetch = fetch;
let _fetchIntercepted = false;
`;

const postloadCode = `
// 导出拦截到的数据
if (window.__sm_crypto) {
    console.log('[EXPORT] SM crypto functions available:');
    console.log('  sm2:', typeof window.__sm_crypto.sm2);
    console.log('  sm3:', typeof window.__sm_crypto.sm3);
    console.log('  sm4:', typeof window.__sm_crypto.sm4);
}
`;

// ============================================================
// 4. 执行
// ============================================================

console.log('[extract] Executing in VM sandbox...');

try {
    const script = new vm.Script(`
        ${preloadCode}
        ${appCode}
        ${postloadCode}
    `);

    const context = vm.createContext(sandbox);
    script.runInContext(context, { timeout: 30000 });

    // 获取结果
    const smCrypto = sandbox.window.__sm_crypto;
    const intercepted = sandbox.window.__intercepted;

    console.log('\\n[RESULT] ================');
    if (smCrypto) {
        console.log('SM Crypto module found!');
        console.log('  sm2:', typeof smCrypto.sm2);
        console.log('  sm3:', typeof smCrypto.sm3);
        console.log('  sm4:', typeof smCrypto.sm4);

        if (smCrypto.sm4) {
            // 测试 SM4 加密
            const testData = 'test';
            try {
                // 尝试用从 appCode 作为密钥
                const keyHex = '1234567890abcdef1234567890abcdef'; // 测试密钥
                const encResult = smCrypto.sm4.encrypt(testData, keyHex);
                console.log('  SM4 encrypt test:', encResult);
            } catch (e) {
                console.log('  SM4 encrypt error:', e.message);
            }
        }
    } else {
        console.log('SM Crypto module NOT found in global scope');
        console.log('Intercepted:', JSON.stringify(intercepted));
    }

    // 输出 window 上的关键属性
    const keys = Object.keys(sandbox.window).filter(k =>
        typeof sandbox.window[k] === 'function' &&
        (k.toLowerCase().includes('sm') || k.toLowerCase().includes('encrypt') || k.toLowerCase().includes('sign'))
    );
    console.log('\\n  Key functions on window:', keys);

} catch (e) {
    console.error('[ERROR]', e.message);
    console.error(e.stack?.substring(0, 500));
}

console.log('[extract] Done');
