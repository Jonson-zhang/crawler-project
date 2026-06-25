/**
 * env.js — 小红书 VMP 签名补环境
 *
 * 加载顺序: sdt_source_init.js → ds_loader.js → ds_api.js → ds_v2.js
 *   1. sdt_source_init.js + ds_loader.js 创建 VMP 引擎 + window.mnsv2 (mns0201)
 *   2. ds_api.js 调用 _BHjFmfUMEtxhI(__$c, env) 注入字节码
 *   3. ds_v2.js 调用 _AUuXfEG27Xa3x(__$c, env) 升级 mns0201 → mns0301
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============ 补环境核心 ============

const noop = () => {};
const nop = (...args) => {};

// Navigator 模拟
const navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    platform: "Win32",
    languages: ["zh-CN", "zh"],
    language: "zh-CN",
    cookieEnabled: true,
    webdriver: false,
    plugins: {
        length: 5,
        0: { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format" },
        1: { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "" },
        2: { name: "Native Client", filename: "internal-nacl-plugin", description: "" },
        item: () => null,
        namedItem: () => null,
        refresh: noop,
        [Symbol.iterator]: function* () { yield* []; },
    },
    mimeTypes: {
        length: 4,
        0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format" },
        item: () => null,
        namedItem: () => null,
        [Symbol.iterator]: function* () { yield* []; },
    },
    vendor: "Google Inc.",
    vendorSub: "",
    productSub: "20030107",
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    appName: "Netscape",
    appVersion: "5.0 (Windows)",
    appCodeName: "Mozilla",
    onLine: true,
    doNotTrack: null,
    getBattery: () => Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1 }),
    getGamepads: () => [],
    getUserMedia: noop,
    mediaDevices: { getUserMedia: noop, enumerateDevices: () => Promise.resolve([]) },
    serviceWorker: undefined,
    sendBeacon: noop,
    vibrate: noop,
    geolocation: undefined,
    connection: undefined,
};

// Screen 模拟
const screen = {
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1040,
    colorDepth: 24,
    pixelDepth: 24,
    availLeft: 0,
    availTop: 0,
};

// Location 模拟
const location = {
    href: "https://www.xiaohongshu.com/explore",
    origin: "https://www.xiaohongshu.com",
    protocol: "https:",
    host: "www.xiaohongshu.com",
    hostname: "www.xiaohongshu.com",
    port: "",
    pathname: "/explore",
    search: "",
    hash: "",
    ancestorOrigins: {},
    assign: noop,
    replace: noop,
    reload: noop,
};

// Document 模拟
const document = {
    cookie: "",
    createElement: (tag) => {
        const el = {
            tagName: tag.toUpperCase(),
            style: {},
            children: [],
            innerHTML: "",
            getAttribute: () => null,
            setAttribute: noop,
            appendChild: noop,
            addEventListener: noop,
            removeEventListener: noop,
            querySelector: () => null,
            querySelectorAll: () => [],
            getElementsByTagName: () => [],
            getElementsByClassName: () => [],
            getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
        };
        if (tag === "canvas") {
            el.getContext = (type) => {
                if (type === "2d") {
                    return {
                        fillStyle: "",
                        strokeStyle: "",
                        lineWidth: 1,
                        font: "",
                        textAlign: "start",
                        fillRect: noop,
                        strokeRect: noop,
                        clearRect: noop,
                        fillText: noop,
                        strokeText: noop,
                        measureText: () => ({ width: 100 }),
                        beginPath: noop,
                        moveTo: noop,
                        lineTo: noop,
                        closePath: noop,
                        stroke: noop,
                        fill: noop,
                        arc: noop,
                        rect: noop,
                        save: noop,
                        restore: noop,
                        scale: noop,
                        rotate: noop,
                        translate: noop,
                        transform: noop,
                        setTransform: noop,
                        drawImage: noop,
                        createLinearGradient: () => ({ addColorStop: noop }),
                        createRadialGradient: () => ({ addColorStop: noop }),
                        createPattern: () => ({}),
                        getImageData: () => ({ data: new Uint8ClampedArray(100), width: 10, height: 10 }),
                        putImageData: noop,
                        toDataURL: () => "data:image/png;base64,iVBORw0KGgo=",
                    };
                }
                if (type === "webgl" || type === "experimental-webgl") {
                    return {
                        getParameter: (p) => {
                            const params = {
                                37445: "Google Inc.",
                                37446: "ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0)",
                                7937: "WebGL 1.0",
                                7938: "WebGL GLSL ES 1.0",
                                33901: 4096,
                                33902: 4096,
                                34076: 16384,
                                3415: 0,
                            };
                            return params[p] || null;
                        },
                        getExtension: () => null,
                        getSupportedExtensions: () => [],
                        getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
                        getContextAttributes: () => ({ alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false }),
                        createBuffer: () => ({}),
                        bindBuffer: noop,
                        bufferData: noop,
                        createProgram: () => ({}),
                        createShader: () => ({}),
                        shaderSource: noop,
                        compileShader: noop,
                        attachShader: noop,
                        linkProgram: noop,
                        useProgram: noop,
                        getAttribLocation: () => 0,
                        getUniformLocation: () => ({}),
                        enableVertexAttribArray: noop,
                        vertexAttribPointer: noop,
                        drawArrays: noop,
                        clear: noop,
                        clearColor: noop,
                        viewport: noop,
                    };
                }
                return null;
            };
            el.toDataURL = () => "data:image/png;base64,iVBORw0KGgo=";
        }
        if (tag === "img") {
            el.src = "";
            el.width = 0;
            el.height = 0;
            el.naturalWidth = 0;
            el.naturalHeight = 0;
            el.complete = true;
            el.onload = null;
            el.onerror = null;
            el.alt = "";
        }
        return el;
    },
    createEvent: () => ({ initEvent: noop }),
    addEventListener: noop,
    removeEventListener: noop,
    getElementsByTagName: () => [],
    getElementsByClassName: () => [],
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    head: { appendChild: noop },
    body: { appendChild: noop },
    documentElement: { style: {}, clientWidth: 1920, clientHeight: 1080, scrollTop: 0, scrollLeft: 0 },
    title: "小红书",
    referrer: "",
    readyState: "complete",
    hidden: false,
    visibilityState: "visible",
};

// localStorage / sessionStorage
const storageImpl = {
    _data: {},
    getItem: (k) => storageImpl._data[k] || null,
    setItem: (k, v) => { storageImpl._data[k] = String(v); },
    removeItem: (k) => { delete storageImpl._data[k]; },
    clear: () => { storageImpl._data = {}; },
    get length() { return Object.keys(this._data).length; },
    key: (i) => Object.keys(storageImpl._data)[i] || null,
};

// History
const history = {
    length: 3,
    state: null,
    scrollRestoration: "auto",
    pushState: noop,
    replaceState: noop,
    back: noop,
    forward: noop,
    go: noop,
};

// Performance
const performance = {
    now: () => Date.now(),
    timing: {
        navigationStart: Date.now() - 1000,
        loadEventEnd: Date.now() - 500,
        domComplete: Date.now() - 200,
    },
    getEntriesByType: () => [],
    mark: noop,
    measure: noop,
    memory: { jsHeapSizeLimit: 4294967296, totalJSHeapSize: 10000000, usedJSHeapSize: 5000000 },
};

// 浏览器特有全局
const external = {};
const chrome = { loadTimes: noop, csi: noop, app: {} };

// WebSocket 桩
function WebSocket() {
    this.readyState = 3;
    this.send = noop;
    this.close = noop;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
}
WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

// Worker 桩
function Worker() { this.postMessage = noop; this.terminate = noop; }

// Image 构造函数
function Image(w, h) { this.width = w || 0; this.height = h || 0; this.src = ""; this.onload = null; this.onerror = null; this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; }

// MutationObserver 桩
function MutationObserver(cb) { this.observe = noop; this.disconnect = noop; this.takeRecords = () => []; }
MutationObserver.prototype = { observe: noop, disconnect: noop, takeRecords: () => [] };

// HTML 元素相关
const HTMLElement = function() {};
HTMLElement.prototype = { style: {}, getAttribute: () => null, setAttribute: noop, addEventListener: noop, removeEventListener: noop };
const HTMLCanvasElement = HTMLElement;
const HTMLImageElement = HTMLElement;
const HTMLScriptElement = HTMLElement;
const HTMLDivElement = HTMLElement;
const HTMLSpanElement = HTMLElement;
const HTMLInputElement = HTMLElement;

// ============ 构建全局对象 ============

// window/global/self 循环引用
const windowObj = {};
const globalObj = typeof global !== 'undefined' ? global : {};
const selfObj = {};

// 确保 global === window (VMP 检测用)
Object.defineProperty(global, 'window', { value: windowObj, writable: true, configurable: true });

// 填充 window
Object.assign(windowObj, {
    // 内置对象 (直接从 Node.js 获取)
    Object, Array, Function, String, Number, Boolean, Date, RegExp, Math, JSON,
    Error, TypeError, SyntaxError, ReferenceError, RangeError, URIError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    // 关键: Uint8Array, ArrayBuffer, DataView (VMP检测会用到)
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, Uint8ClampedArray,
    ArrayBuffer, DataView, BigInt64Array, BigUint64Array,
    // Node 原生
    Promise, Symbol, Map, Set, WeakMap, WeakSet, Proxy, Reflect,
    // 补丁
    navigator, screen, location, document, history,
    localStorage: storageImpl,
    sessionStorage: storageImpl,
    performance,
    console: {
        log: noop, error: noop, warn: noop, info: noop, debug: noop, table: noop,
        trace: noop, dir: noop, group: noop, groupEnd: noop, time: noop, timeEnd: noop,
    },
    // 定时器
    setTimeout: (fn, ms, ...args) => {
        if (typeof fn === 'string') fn = new Function(fn);
        fn(...args);
        return 0;
    },
    clearTimeout: noop,
    setInterval: () => 0,
    clearInterval: noop,
    requestAnimationFrame: (cb) => { cb(Date.now()); return 0; },
    cancelAnimationFrame: noop,
    // 网络
    fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve(""), ok: true, status: 200, headers: { get: () => null } }),
    XMLHttpRequest: function () {
        this.open = noop;
        this.setRequestHeader = noop;
        this.send = noop;
        this.readyState = 4;
        this.status = 200;
        this.responseText = "";
    },
    WebSocket, Worker, Image, MutationObserver,
    // 编码
    atob: (x) => Buffer.from(x, "base64").toString("binary"),
    btoa: (x) => Buffer.from(x, "binary").toString("base64"),
    TextEncoder, TextDecoder, URL, URLSearchParams,
    Blob: function(p) { this.parts = p || []; this.size = (this.parts || []).join('').length; },
    FileReader: function() { this.readAsDataURL = noop; this.readAsText = noop; this.readAsArrayBuffer = noop; },
    FormData: function() { this.append = noop; },
    // Crypto
    crypto: crypto.webcrypto || crypto,
    // 事件
    Event: function(type) { this.type = type; },
    CustomEvent: function(type, opts) { this.type = type; this.detail = (opts || {}).detail; },
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
    // 浏览器特有
    external, chrome,
    name: "",
    closed: false,
    opener: null,
    parent: windowObj,
    top: windowObj,
    frames: [],
    devicePixelRatio: 1,
    innerWidth: 1920,
    innerHeight: 1080,
    outerWidth: 1920,
    outerHeight: 1080,
    scrollX: 0,
    scrollY: 0,
    pageXOffset: 0,
    pageYOffset: 0,
    screenX: 0,
    screenLeft: 0,
    screenY: 0,
    screenTop: 0,
    // HTML 元素类
    HTMLElement, HTMLCanvasElement, HTMLImageElement, HTMLScriptElement, HTMLDivElement, HTMLSpanElement, HTMLInputElement,
    Node: HTMLElement,
    // eval override (VMP 需要)
    eval: (code) => {
        return eval(code);
    },
    // Function.prototype.toString 保护
    _raw_toString: Function.prototype.toString,
});

// self 和 window 循环引用
Object.assign(selfObj, windowObj);
windowObj.self = selfObj;
windowObj.window = windowObj;
windowObj.globalThis = windowObj;

// Don't assign to global directly (Node.js v24 has getter-only props)
// Scripts use: glb = typeof window === 'undefined' ? global : window
// window is already set on global via defineProperty

// ============ 路径 ============
const BASEDIR = path.join(__dirname);

// ============ 加载函数 ============
function loadScript(filePath) {
    const code = fs.readFileSync(path.join(BASEDIR, filePath), "utf8");
    try {
        // 在 global context 中执行
        const fn = new Function('window', 'global', 'self', code);
        fn(windowObj, globalObj, selfObj);
    } catch (e) {
        console.error(`[env] Error loading ${filePath}: ${e.message}`);
        console.error(`[env] Stack: ${e.stack ? e.stack.slice(0, 300) : 'none'}`);
    }
}

function loadScriptEval(filePath) {
    const code = fs.readFileSync(path.join(BASEDIR, filePath), "utf8");
    try {
        (0, eval)(code);
    } catch (e) {
        console.error(`[env] Error eval-loading ${filePath}: ${e.message}`);
    }
}

// ============ 主加载流程 ============

console.log("[env] Loading XHS DS scripts...");

// Step 1: sdt_source_init.js + ds_loader.js — 创建 VMP 引擎
console.log("[env] 1/4 Loading sdt_source_init.js...");
loadScript("sdt_source_init.js");

console.log("[env] 2/4 Loading ds_loader.js...");
loadScript("ds_loader.js");

// Step 2: ds_api.js — 注入字节码，创建 mns0201
console.log("[env] 3/4 Loading ds_api.js...");
loadScript("ds_api.js");

// Step 3: ds_v2.js — 升级 mns0201 → mns0301
console.log("[env] 4/4 Loading ds_v2.js...");
loadScript("ds_v2.js");

// ============ 检查结果 ============

if (typeof windowObj.mnsv2 === 'function') {
    console.log("[env] SUCCESS: window.mnsv2 found!");
    console.log("[env] Testing with empty input...");
    try {
        const result = windowObj.mnsv2("", "");
        const prefix = String(result).slice(0, 20);
        console.log(`[env] mnsv2 result prefix: ${prefix}`);
    } catch (e) {
        console.error(`[env] mnsv2 test error: ${e.message}`);
    }
} else {
    console.log(`[env] WARNING: window.mnsv2 is ${typeof windowObj.mnsv2}`);
    // Check for key intermediates
    console.log(`[env] _BHjFmfUMEtxhI: ${typeof windowObj['_BHjFmfUMEtxhI']}`);
    console.log(`[env] _AUuXfEG27Xa3x: ${typeof windowObj['_AUuXfEG27Xa3x']}`);
    console.log(`[env] __$c: ${typeof windowObj.__$c}, __bc: ${typeof windowObj.__bc}`);
    if (windowObj.__$c) console.log(`[env] __$c length: ${windowObj.__$c.length}`);
    if (windowObj.__bc) console.log(`[env] __bc length: ${windowObj.__bc.length}`);
}

module.exports = {
    window: windowObj,
    global: globalObj,
    self: selfObj,
};
