/**
 * 国家医保局 — iv8/Node.js 桥接脚本
 * ====================================
 *
 * 加载 app.js 并导出 SM2/SM4 加密模块供 Python/cdp_bridge 使用。
 *
 * 此脚本运行在 iv8 (C++ V8) 或 Node.js 中，
 * 对 app.js 进行环境补丁，使其加密模块可被外部调用。
 *
 * 用法:
 *   Node.js: node nhsa_bridge.js
 *   iv8:     ctx.eval(script) → ctx.eval("nhsa_sign({...})")
 */

// ═══════════════════════════════════════════════════════════════
// 环境补丁（app.js 初始化需要的最小浏览器环境）
// ═══════════════════════════════════════════════════════════════

// 以下变量在 iv8 环境中自动存在；Node.js 需要手动补
if (typeof window === 'undefined') {
    global.window = global;
    global.self = global;
    global.document = {
        cookie: '',
        createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        documentElement: { style: {} },
        body: { appendChild: () => {}, removeChild: () => {} },
        createElementNS: () => ({ setAttribute: () => {} }),
        head: { appendChild: () => {} },
    };
    global.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        appVersion: '5.0',
        platform: 'Win32',
        language: 'zh-CN',
    };
    global.location = {
        href: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
        host: 'fuwu.nhsa.gov.cn',
        hostname: 'fuwu.nhsa.gov.cn',
        protocol: 'https:',
        origin: 'https://fuwu.nhsa.gov.cn',
    };
    global.XMLHttpRequest = function() {};
    global.XMLHttpRequest.prototype.open = function() {};
    global.XMLHttpRequest.prototype.setRequestHeader = function() {};
    global.XMLHttpRequest.prototype.send = function() {};
    global.XMLHttpRequest.prototype.addEventListener = function() {};
    if (!global.crypto) {
        try { global.crypto = require('crypto'); } catch(e) {}
    }
    global.console = {
        log: () => {}, warn: () => {}, error: () => {}, info: () => {},
        debug: () => {}, trace: () => {},
    };
    global.setTimeout = (fn, ms) => { if (typeof fn === 'function') fn(); return 0; };
    global.setInterval = () => 0;
    global.clearTimeout = () => {};
    global.clearInterval = () => {};
    global.Promise = Promise;
}

// ═══════════════════════════════════════════════════════════════
// 模块拦截 — 捕获 app.js 初始化时导出的 sm2/sm3/sm4
// ═══════════════════════════════════════════════════════════════

window.__nhsa_sm_crypto = null;
window.__nhsa_encrypt_fn = null;
window.__nhsa_sign_fn = null;
window.__nhsa_keys = {};

// 拦截模块注册 — app.js 将 sm2/sm3/sm4 设为某个模块的导出
const _origDefineProperty = Object.defineProperty;
Object.defineProperty = function(obj, prop, desc) {
    if (desc && desc.get && typeof desc.get === 'function') {
        try {
            const val = desc.get();
            if (val && typeof val === 'object' && val.generateKeyPairHex && val.doSignature) {
                window.__nhsa_sm_crypto = val;
                // No console in iv8, use __nhsa_keys to store result
            }
        } catch(e) {}
    }
    if (desc && desc.value && typeof desc.value === 'object' && desc.value.sm2 && desc.value.sm3 && desc.value.sm4) {
        window.__nhsa_sm_crypto = desc.value;
    }
    return _origDefineProperty.call(Object, obj, prop, desc);
};

// 拦截 WebSocket/其他可能的外部调用
const _origWebSocket = global.WebSocket;
global.WebSocket = function() {
    const ws = {};
    ws.readyState = 0;
    ws.send = () => {};
    ws.close = () => {};
    setTimeout(() => { ws.readyState = 1; if (ws.onopen) ws.onopen(); }, 0);
    return ws;
};
global.WebSocket.prototype = _origWebSocket ? _origWebSocket.prototype : {};
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;

// 拦截 fetch
global.fetch = () => Promise.resolve({
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
    headers: { get: () => null },
});

// ═══════════════════════════════════════════════════════════════
// 加载 app.js（在 iv8/Node.js 主脚本中由 fs.readFileSync 完成）
// ═══════════════════════════════════════════════════════════════

// 导出函数：由主控脚本调用
window.nhsa_bridge_loaded = true;
