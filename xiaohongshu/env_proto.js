/**
 * env_proto.js — 小红书 VMP 签名：原型链补环境
 *
 * 核心原则：
 *   1. 每个浏览器对象都有正确原型链 (Navigator.prototype → Object.prototype)
 *   2. 所有属性用 Object.defineProperty + 正确 descriptor
 *   3. 所有函数的 toString 返回 "[native code]"
 *   4. typeof 检测必须和浏览器一致
 *
 * 脚本加载链：
 *   ds_loader.js → _BHjFmfUMEtxhI / _AUuXfEG27Xa3x (VMP 解释器)
 *   ds_api.js   → _BHjFmfUMEtxhI(__$c, [,,undef,Uint8Array,getdss]) → 创建 __bc + mns0201
 *   ds_v2.js    → _AUuXfEG27Xa3x(__$c, [,,Function,document,perf,MutationObserver,Object]) → mns0301
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const BASEDIR = __dirname;

// ────────────────────────── helpers ──────────────────────────

const noop = function noop() {};
const nativeCode = function() { return "function " + (this.name || "") + "() { [native code] }"; };

/** Set native toString on a function */
function markNative(fn, name) {
    Object.defineProperty(fn, "toString", {
        value: function() { return "function " + (name || fn.name || "") + "() { [native code] }"; },
        writable: true, configurable: true, enumerable: false,
    });
    Object.defineProperty(fn, Symbol.toStringTag, { value: "Function" });
    return fn;
}

/** Create a constructor with native toString */
function fakeCtor(name, bodyFn) {
    const fn = function() {
        if (!(this instanceof fn)) throw new TypeError("calling a builtin " + name + " constructor without new is forbidden");
        if (bodyFn) bodyFn.apply(this, arguments);
    };
    Object.defineProperty(fn, "name", { value: name });
    fn.prototype = Object.create(Object.prototype);
    fn.prototype.constructor = fn;
    markNative(fn, name);
    return fn;
}

/** Create a namespace object (like navigator, screen, etc.) with prototype chain */
function createProto(name, protoObj, instanceProps) {
    const obj = Object.create(protoObj || Object.prototype);
    if (instanceProps) {
        for (const [key, desc] of Object.entries(instanceProps)) {
            if (desc && typeof desc === "object" && ("value" in desc || "get" in desc)) {
                Object.defineProperty(obj, key, desc);
            } else {
                Object.defineProperty(obj, key, { value: desc, writable: true, configurable: true, enumerable: true });
            }
        }
    }
    // Symbol.toStringTag
    Object.defineProperty(obj, Symbol.toStringTag, { value: name, configurable: true });
    return obj;
}

// Prevent fs/etc from leaking into global scope
const safeGlobals = [
    "Object", "Array", "Function", "String", "Number", "Boolean", "Date", "RegExp", "Math", "JSON",
    "Error", "TypeError", "SyntaxError", "ReferenceError", "RangeError", "URIError", "EvalError",
    "parseInt", "parseFloat", "isNaN", "isFinite",
    "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
    "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array",
    "Float32Array", "Float64Array", "Uint8ClampedArray", "ArrayBuffer", "DataView",
    "BigInt64Array", "BigUint64Array",
    "Promise", "Symbol", "Map", "Set", "WeakMap", "WeakSet",
    "Proxy", "Reflect",
    "TextEncoder", "TextDecoder",
];

// ────────────────────────── Navigator ──────────────────────────

const NavigatorProto = createProto("Navigator", Object.prototype, {
    userAgent: { value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0", writable: true, configurable: true, enumerable: true },
    platform: { value: "Win32", writable: true, configurable: true, enumerable: true },
    language: { value: "zh-CN", writable: true, configurable: true, enumerable: true },
    languages: { value: Object.freeze(["zh-CN", "zh"]), writable: true, configurable: true, enumerable: true },
    cookieEnabled: { value: true, writable: true, configurable: true, enumerable: true },
    webdriver: { value: false, writable: true, configurable: true, enumerable: true },
    onLine: { value: true, writable: true, configurable: true, enumerable: true },
    hardwareConcurrency: { value: 8, writable: true, configurable: true, enumerable: true },
    deviceMemory: { value: 8, writable: true, configurable: true, enumerable: true },
    maxTouchPoints: { value: 0, writable: true, configurable: true, enumerable: true },
    vendor: { value: "", writable: true, configurable: true, enumerable: true },
    vendorSub: { value: "", writable: true, configurable: true, enumerable: true },
    productSub: { value: "20030107", writable: true, configurable: true, enumerable: true },
    appName: { value: "Netscape", writable: true, configurable: true, enumerable: true },
    appVersion: { value: "5.0 (Windows)", writable: true, configurable: true, enumerable: true },
    appCodeName: { value: "Mozilla", writable: true, configurable: true, enumerable: true },
    doNotTrack: { value: null, writable: true, configurable: true, enumerable: true },
    pdfViewerEnabled: { value: true, writable: true, configurable: true, enumerable: true },
});

// PluginsPluginArray
const PluginArrayProto = createProto("PluginArray", Object.prototype, {
    length: { get: function() { return 5; }, configurable: true },
    item: { value: markNative(function(i) { return this[i] || null; }, "item"), writable: true },
    namedItem: { value: markNative(function(n) { return null; }, "namedItem"), writable: true },
    refresh: { value: markNative(noop, "refresh"), writable: true },
});
// Make it iterable
PluginArrayProto[Symbol.iterator] = { value: function*() { yield* []; }, configurable: true };
const plugins = Object.create(PluginArrayProto);
for (let i = 0; i < 5; i++) {
    const plugin = createProto("Plugin", Object.prototype, {
        name: { value: ["Chrome PDF Plugin", "Chrome PDF Viewer", "Native Client"][i] || "Plugin " + i, enumerable: true },
        filename: { value: ["internal-pdf-viewer", "mhjfbmdgcfjbbpaeojofohoefgiehjai", "internal-nacl-plugin"][i] || "", enumerable: true },
        description: { value: ["Portable Document Format", "", ""][i] || "", enumerable: true },
        length: { value: 1, enumerable: true },
    });
    Object.defineProperty(plugins, i, { value: plugin, enumerable: true, configurable: true });
}

Object.defineProperty(NavigatorProto, "plugins", { get: function() { return plugins; }, configurable: true, enumerable: true });

// MimeTypeArray
const MimeTypeArrayProto = createProto("MimeTypeArray", Object.prototype, {
    length: { get: function() { return 4; }, configurable: true },
    item: { value: markNative(function(i) { return this[i] || null; }, "item") },
    namedItem: { value: markNative(function(n) { return null; }, "namedItem") },
});
const mimeTypes = Object.create(MimeTypeArrayProto);
const pdfMime = createProto("MimeType", Object.prototype, {
    type: { value: "application/pdf", enumerable: true },
    suffixes: { value: "pdf", enumerable: true },
    description: { value: "Portable Document Format", enumerable: true },
});
Object.defineProperty(mimeTypes, 0, { value: pdfMime, enumerable: true, configurable: true });
Object.defineProperty(NavigatorProto, "mimeTypes", { get: function() { return mimeTypes; }, configurable: true });

const navigator = Object.create(NavigatorProto);

// ────────────────────────── Screen ──────────────────────────

const ScreenProto = createProto("Screen", Object.prototype, {
    width: { value: 1920, writable: true, configurable: true, enumerable: true },
    height: { value: 1080, writable: true, configurable: true, enumerable: true },
    availWidth: { value: 1920, writable: true, configurable: true, enumerable: true },
    availHeight: { value: 1040, writable: true, configurable: true, enumerable: true },
    colorDepth: { value: 24, writable: true, configurable: true, enumerable: true },
    pixelDepth: { value: 24, writable: true, configurable: true, enumerable: true },
    availLeft: { value: 0, writable: true, configurable: true, enumerable: true },
    availTop: { value: 0, writable: true, configurable: true, enumerable: true },
});
const screen = Object.create(ScreenProto);

// ────────────────────────── Location ──────────────────────────

const LocationProto = createProto("Location", Object.prototype, {
    href: { value: "https://www.xiaohongshu.com/explore", writable: true, configurable: true, enumerable: true },
    origin: { value: "https://www.xiaohongshu.com", configurable: true, enumerable: true },
    protocol: { value: "https:", configurable: true, enumerable: true },
    host: { value: "www.xiaohongshu.com", configurable: true, enumerable: true },
    hostname: { value: "www.xiaohongshu.com", configurable: true, enumerable: true },
    port: { value: "", configurable: true, enumerable: true },
    pathname: { value: "/explore", configurable: true, enumerable: true },
    search: { value: "", configurable: true, enumerable: true },
    hash: { value: "", configurable: true, enumerable: true },
    ancestorOrigins: { value: Object.create(null), configurable: true, enumerable: true },
    assign: { value: markNative(noop, "assign") },
    replace: { value: markNative(noop, "replace") },
    reload: { value: markNative(noop, "reload") },
});
const location = Object.create(LocationProto);

// ────────────────────────── Document ──────────────────────────

function createElement(tag) {
    const el = createProto("HTML" + (tag || "Unknown") + "Element", Object.prototype, {
        tagName: { value: (tag || "").toUpperCase(), enumerable: true },
        style: { value: {}, writable: true },
        children: { value: [], enumerable: true },
        childNodes: { value: [], enumerable: true },
        innerHTML: { value: "", writable: true },
        innerText: { value: "", writable: true },
        textContent: { value: "", writable: true },
        id: { value: "", writable: true },
        className: { value: "", writable: true },
        src: { value: "", writable: true },
        href: { value: "", writable: true },
        width: { value: 0, writable: true },
        height: { value: 0, writable: true },
        getAttribute: { value: markNative(function() { return null; }, "getAttribute") },
        setAttribute: { value: markNative(noop, "setAttribute") },
        removeAttribute: { value: markNative(noop, "removeAttribute") },
        hasAttribute: { value: markNative(function() { return false; }, "hasAttribute") },
        appendChild: { value: markNative(noop, "appendChild") },
        removeChild: { value: markNative(noop, "removeChild") },
        addEventListener: { value: markNative(noop, "addEventListener") },
        removeEventListener: { value: markNative(noop, "removeEventListener") },
        dispatchEvent: { value: markNative(noop, "dispatchEvent") },
        querySelector: { value: markNative(function() { return null; }, "querySelector") },
        querySelectorAll: { value: markNative(function() { return []; }, "querySelectorAll") },
        getElementsByTagName: { value: markNative(function() { return []; }, "getElementsByTagName") },
        getElementsByClassName: { value: markNative(function() { return []; }, "getElementsByClassName") },
        getBoundingClientRect: { value: markNative(function() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }, "getBoundingClientRect") },
        cloneNode: { value: markNative(function() { return createElement(tag); }, "cloneNode") },
    });

    if (tag === "canvas") {
        Object.defineProperties(el, {
            getContext: { value: markNative(function(type) {
                if (type === "2d") return createProto("CanvasRenderingContext2D", Object.prototype, {
                    fillStyle: { value: "#000000", writable: true },
                    strokeStyle: { value: "#000000", writable: true },
                    lineWidth: { value: 1, writable: true },
                    font: { value: "10px sans-serif", writable: true },
                    fillRect: { value: markNative(noop, "fillRect") },
                    clearRect: { value: markNative(noop, "clearRect") },
                    fillText: { value: markNative(noop, "fillText") },
                    strokeText: { value: markNative(noop, "strokeText") },
                    measureText: { value: markNative(function(t) { return { width: t ? t.length * 8 : 80 }; }, "measureText") },
                    beginPath: { value: markNative(noop, "beginPath") },
                    closePath: { value: markNative(noop, "closePath") },
                    moveTo: { value: markNative(noop, "moveTo") },
                    lineTo: { value: markNative(noop, "lineTo") },
                    stroke: { value: markNative(noop, "stroke") },
                    fill: { value: markNative(noop, "fill") },
                    save: { value: markNative(noop, "save") },
                    restore: { value: markNative(noop, "restore") },
                    scale: { value: markNative(noop, "scale") },
                    rotate: { value: markNative(noop, "rotate") },
                    translate: { value: markNative(noop, "translate") },
                    transform: { value: markNative(noop, "transform") },
                    drawImage: { value: markNative(noop, "drawImage") },
                    createLinearGradient: { value: markNative(function() { return { addColorStop: markNative(noop, "addColorStop") }; }, "createLinearGradient") },
                    getImageData: { value: markNative(function() { return { data: new Uint8ClampedArray(400), width: 10, height: 10 }; }, "getImageData") },
                    putImageData: { value: markNative(noop, "putImageData") },
                    toDataURL: { value: markNative(function() { return "data:image/png;base64,iVBORw0KGgo="; }, "toDataURL") },
                });
                if (type === "webgl" || type === "experimental-webgl") {
                    return createProto("WebGLRenderingContext", Object.prototype, {
                        getParameter: { value: markNative(function(p) {
                            const m = { 37445: "Google Inc.", 37446: "ANGLE", 7937: "WebGL 1.0", 7938: "WebGL GLSL ES 1.0", 33901: 4096, 33902: 4096, 34076: 16384, 3415: 0 };
                            return m[p] !== undefined ? m[p] : null;
                        }, "getParameter") },
                        getExtension: { value: markNative(function() { return null; }, "getExtension") },
                        getSupportedExtensions: { value: markNative(function() { return []; }, "getSupportedExtensions") },
                        createBuffer: { value: markNative(function() { return {}; }, "createBuffer") },
                        bindBuffer: { value: markNative(noop, "bindBuffer") },
                        bufferData: { value: markNative(noop, "bufferData") },
                    });
                }
                return null;
            }, "getContext") },
            toDataURL: { value: markNative(function() { return "data:image/png;base64,iVBORw0KGgo="; }, "toDataURL") },
        });
    }
    return el;
}

const HTMLDocumentProto = createProto("HTMLDocument", Object.prototype, {
    cookie: { value: "", writable: true, configurable: true, enumerable: true },
    createElement: { value: markNative(createElement, "createElement") },
    createEvent: { value: markNative(function() { return { initEvent: noop }; }, "createEvent") },
    addEventListener: { value: markNative(noop, "addEventListener") },
    removeEventListener: { value: markNative(noop, "removeEventListener") },
    dispatchEvent: { value: markNative(noop, "dispatchEvent") },
    getElementById: { value: markNative(function() { return null; }, "getElementById") },
    getElementsByTagName: { value: markNative(function() { return []; }, "getElementsByTagName") },
    getElementsByClassName: { value: markNative(function() { return []; }, "getElementsByClassName") },
    querySelector: { value: markNative(function() { return null; }, "querySelector") },
    querySelectorAll: { value: markNative(function() { return []; }, "querySelectorAll") },
    write: { value: markNative(noop, "write") },
    writeln: { value: markNative(noop, "writeln") },
    title: { value: "小红书", writable: true, enumerable: true },
    referrer: { value: "", enumerable: true },
    readyState: { value: "complete", enumerable: true },
    hidden: { value: false, enumerable: true },
    visibilityState: { value: "visible", enumerable: true },
    characterSet: { value: "UTF-8", enumerable: true },
    charset: { value: "UTF-8", enumerable: true },
    head: { value: createElement("head"), enumerable: true },
    body: { value: createElement("body"), enumerable: true },
    documentElement: { value: createElement("html"), enumerable: true },
    defaultView: { value: null, writable: true, enumerable: true },
});

const document = Object.create(HTMLDocumentProto);
// Fix documentElement defaults
document.documentElement.clientWidth = 1920;
document.documentElement.clientHeight = 1080;
document.documentElement.scrollTop = 0;
document.documentElement.scrollLeft = 0;

// ────────────────────────── Storage ──────────────────────────

function createStorage(name) {
    const data = {};
    return createProto(name, Object.prototype, {
        getItem: { value: markNative(function(k) { return data[String(k)] !== undefined ? String(data[String(k)]) : null; }, "getItem") },
        setItem: { value: markNative(function(k, v) { data[String(k)] = String(v); }, "setItem") },
        removeItem: { value: markNative(function(k) { delete data[String(k)]; }, "removeItem") },
        clear: { value: markNative(function() { for (const k in data) delete data[k]; }, "clear") },
        key: { value: markNative(function(i) { const keys = Object.keys(data); return keys[i] || null; }, "key") },
        length: { get: function() { return Object.keys(data).length; }, configurable: true },
    });
}

const localStorage = createStorage("Storage");
const sessionStorage = createStorage("Storage");

// ────────────────────────── History ──────────────────────────

const HistoryProto = createProto("History", Object.prototype, {
    length: { value: 3, writable: true, enumerable: true },
    state: { value: null, enumerable: true },
    scrollRestoration: { value: "auto", writable: true, enumerable: true },
    back: { value: markNative(noop, "back") },
    forward: { value: markNative(noop, "forward") },
    go: { value: markNative(noop, "go") },
    pushState: { value: markNative(noop, "pushState") },
    replaceState: { value: markNative(noop, "replaceState") },
});
const history = Object.create(HistoryProto);

// ────────────────────────── Performance ──────────────────────────

const PerformanceProto = createProto("Performance", Object.prototype, {
    now: { value: markNative(function() { return Date.now() - startTime; }, "now") },
    timing: { value: createProto("PerformanceTiming", Object.prototype, {
        navigationStart: { value: Date.now() - 2000, enumerable: true },
        loadEventEnd: { value: Date.now() - 500, enumerable: true },
        domComplete: { value: Date.now() - 200, enumerable: true },
    }), enumerable: true },
    getEntriesByType: { value: markNative(function() { return []; }, "getEntriesByType") },
    getEntries: { value: markNative(function() { return []; }, "getEntries") },
    mark: { value: markNative(noop, "mark") },
    measure: { value: markNative(noop, "measure") },
    clearMarks: { value: markNative(noop, "clearMarks") },
    clearMeasures: { value: markNative(noop, "clearMeasures") },
});
const startTime = Date.now();
const performance = Object.create(PerformanceProto);

// ────────────────────────── Constructors ──────────────────────────

const MutationObserverCtor = fakeCtor("MutationObserver", function(cb) {
    this._cb = cb;
});
Object.defineProperties(MutationObserverCtor.prototype, {
    observe: { value: markNative(noop, "observe") },
    disconnect: { value: markNative(noop, "disconnect") },
    takeRecords: { value: markNative(function() { return []; }, "takeRecords") },
});

const ImageCtor = fakeCtor("Image", function(w, h) {
    this.width = w || 0;
    this.height = h || 0;
    this.src = "";
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.complete = false;
    this.onload = null;
    this.onerror = null;
});

const WebSocketCtor = fakeCtor("WebSocket", function() {
    this.readyState = 3;
    this.url = "";
    this.bufferedAmount = 0;
    this.extensions = "";
    this.protocol = "";
});
Object.defineProperties(WebSocketCtor.prototype, {
    send: { value: markNative(noop, "send") },
    close: { value: markNative(noop, "close") },
});
WebSocketCtor.CONNECTING = 0;
WebSocketCtor.OPEN = 1;
WebSocketCtor.CLOSING = 2;
WebSocketCtor.CLOSED = 3;

const WorkerCtor = fakeCtor("Worker", function() {});
Object.defineProperties(WorkerCtor.prototype, {
    postMessage: { value: markNative(noop, "postMessage") },
    terminate: { value: markNative(noop, "terminate") },
    addEventListener: { value: markNative(noop, "addEventListener") },
});

const XMLHttpRequestCtor = fakeCtor("XMLHttpRequest", function() {
    this.readyState = 4;
    this.status = 200;
    this.statusText = "OK";
    this.responseText = "";
    this.response = "";
    this.responseType = "";
    this.responseURL = "";
    this.timeout = 0;
    this.withCredentials = false;
    this.upload = {};
});
Object.defineProperties(XMLHttpRequestCtor.prototype, {
    open: { value: markNative(noop, "open") },
    send: { value: markNative(noop, "send") },
    setRequestHeader: { value: markNative(noop, "setRequestHeader") },
    getResponseHeader: { value: markNative(function() { return null; }, "getResponseHeader") },
    getAllResponseHeaders: { value: markNative(function() { return ""; }, "getAllResponseHeaders") },
    abort: { value: markNative(noop, "abort") },
    addEventListener: { value: markNative(noop, "addEventListener") },
});
XMLHttpRequestCtor.UNSENT = 0;
XMLHttpRequestCtor.OPENED = 1;
XMLHttpRequestCtor.HEADERS_RECEIVED = 2;
XMLHttpRequestCtor.LOADING = 3;
XMLHttpRequestCtor.DONE = 4;

const EventCtor = fakeCtor("Event", function(type, opts) {
    this.type = type || "";
    this.bubbles = (opts || {}).bubbles || false;
    this.cancelable = (opts || {}).cancelable || false;
});
Object.defineProperties(EventCtor.prototype, {
    preventDefault: { value: markNative(noop, "preventDefault") },
    stopPropagation: { value: markNative(noop, "stopPropagation") },
    stopImmediatePropagation: { value: markNative(noop, "stopImmediatePropagation") },
});

const CustomEventCtor = fakeCtor("CustomEvent", function(type, opts) {
    EventCtor.call(this, type, opts);
    this.detail = (opts || {}).detail;
});

const BlobCtor = fakeCtor("Blob", function(parts, opts) {
    this._parts = parts || [];
    this.type = (opts || {}).type || "";
});
Object.defineProperties(BlobCtor.prototype, {
    size: { get: function() { return this._parts.join("").length; }, configurable: true },
    text: { value: markNative(function() { return Promise.resolve(this._parts.join("")); }, "text") },
    arrayBuffer: { value: markNative(function() { return Promise.resolve(new ArrayBuffer(0)); }, "arrayBuffer") },
});

const FileReaderCtor = fakeCtor("FileReader", function() {
    this.result = null;
    this.readyState = 2;
    this.error = null;
});
FileReaderCtor.EMPTY = 0; FileReaderCtor.LOADING = 1; FileReaderCtor.DONE = 2;
Object.defineProperties(FileReaderCtor.prototype, {
    readAsDataURL: { value: markNative(noop, "readAsDataURL") },
    readAsText: { value: markNative(noop, "readAsText") },
    readAsArrayBuffer: { value: markNative(noop, "readAsArrayBuffer") },
});

const FormDataCtor = fakeCtor("FormData", function() {});
Object.defineProperties(FormDataCtor.prototype, {
    append: { value: markNative(noop, "append") },
    delete: { value: markNative(noop, "delete") },
    get: { value: markNative(function() { return null; }, "get") },
    has: { value: markNative(function() { return false; }, "has") },
});

const HeadersCtor = fakeCtor("Headers", function() {});
Object.defineProperties(HeadersCtor.prototype, {
    get: { value: markNative(function() { return null; }, "get") },
    set: { value: markNative(noop, "set") },
    has: { value: markNative(function() { return false; }, "has") },
    forEach: { value: markNative(noop, "forEach") },
});

const ResponseCtor = fakeCtor("Response", function(body, opts) {
    this._body = body || "";
    this.ok = true;
    this.status = 200;
    this.statusText = "OK";
    this.headers = new HeadersCtor();
});
Object.defineProperties(ResponseCtor.prototype, {
    json: { value: markNative(function() { return Promise.resolve({}); }, "json") },
    text: { value: markNative(function() { return Promise.resolve(""); }, "text") },
    arrayBuffer: { value: markNative(function() { return Promise.resolve(new ArrayBuffer(0)); }, "arrayBuffer") },
});

const RequestCtor = fakeCtor("Request", function(url, opts) {
    this.url = url || "";
    this.method = (opts || {}).method || "GET";
    this.headers = new HeadersCtor();
});

// ────────────────────────── Window prototype ──────────────────────────

const WindowProto = createProto("Window", Object.prototype);

// Mark all standard globals with native toString
function safeGlobal(name, val) {
    if (typeof val === "function") {
        markNative(val, name);
    }
    return val;
}

// ────────────────────────── Build window ──────────────────────────

const win = Object.create(WindowProto);

// 1. Safe globals from Node.js
for (const name of safeGlobals) {
    if (name in globalThis) {
        Object.defineProperty(win, name, {
            value: safeGlobal(name, globalThis[name]),
            writable: true, configurable: true, enumerable: true,
        });
    }
}

// 2. Browser-builtins
Object.defineProperties(win, {
    navigator: { value: navigator, writable: true, configurable: true, enumerable: true },
    screen: { value: screen, writable: true, configurable: true, enumerable: true },
    location: { value: location, writable: true, configurable: false, enumerable: true },
    document: { value: document, writable: true, configurable: true, enumerable: true },
    history: { value: history, writable: true, configurable: true, enumerable: true },
    localStorage: { value: localStorage, writable: true, configurable: true, enumerable: true },
    sessionStorage: { value: sessionStorage, writable: true, configurable: true, enumerable: true },
    performance: { value: performance, writable: true, configurable: true, enumerable: true },

    // Console
    console: { value: {
        log: noop, error: noop, warn: noop, info: noop, debug: noop,
        table: noop, trace: noop, dir: noop, group: noop, groupEnd: noop,
        time: noop, timeEnd: noop, clear: noop,
    }, writable: true, configurable: true, enumerable: true },

    // Timers
    setTimeout: { value: markNative(function(fn, ms) { if (typeof fn === "function") fn(); return 0; }, "setTimeout") },
    clearTimeout: { value: markNative(noop, "clearTimeout") },
    setInterval: { value: markNative(function() { return 0; }, "setInterval") },
    clearInterval: { value: markNative(noop, "clearInterval") },
    requestAnimationFrame: { value: markNative(function(cb) { cb(Date.now()); return 0; }, "requestAnimationFrame") },

    // Encoding
    atob: { value: markNative(function(x) { return Buffer.from(x, "base64").toString("binary"); }, "atob") },
    btoa: { value: markNative(function(x) { return Buffer.from(x, "binary").toString("base64"); }, "btoa") },

    // Crypto
    crypto: { value: require("crypto").webcrypto || require("crypto"), writable: true, configurable: true, enumerable: true },

    // Network
    fetch: { value: markNative(function() { return Promise.resolve(new ResponseCtor()); }, "fetch") },

    // Constructors exposed on window
    MutationObserver: { value: MutationObserverCtor },
    Image: { value: ImageCtor },
    WebSocket: { value: WebSocketCtor },
    Worker: { value: WorkerCtor },
    XMLHttpRequest: { value: XMLHttpRequestCtor },
    Event: { value: EventCtor },
    CustomEvent: { value: CustomEventCtor },
    Blob: { value: BlobCtor },
    FileReader: { value: FileReaderCtor },
    FormData: { value: FormDataCtor },
    Headers: { value: HeadersCtor },
    Response: { value: ResponseCtor },
    Request: { value: RequestCtor },

    // HTMLElement classes
    HTMLElement: { value: fakeCtor("HTMLElement") },
    HTMLCanvasElement: { value: fakeCtor("HTMLCanvasElement") },
    HTMLImageElement: { value: fakeCtor("HTMLImageElement") },
    HTMLScriptElement: { value: fakeCtor("HTMLScriptElement") },
    HTMLDivElement: { value: fakeCtor("HTMLDivElement") },
    HTMLSpanElement: { value: fakeCtor("HTMLSpanElement") },
    HTMLInputElement: { value: fakeCtor("HTMLInputElement") },
    HTMLHeadElement: { value: fakeCtor("HTMLHeadElement") },
    HTMLBodyElement: { value: fakeCtor("HTMLBodyElement") },

    // Events
    addEventListener: { value: markNative(noop, "addEventListener") },
    removeEventListener: { value: markNative(noop, "removeEventListener") },
    dispatchEvent: { value: markNative(noop, "dispatchEvent") },

    // Eval (VMP needs it)
    eval: { value: function(code) { return eval(code); } },

    // Misc browser globals
    external: { value: Object.create(null) },
    chrome: { value: createProto("", Object.prototype, { loadTimes: { value: markNative(noop, "loadTimes") }, csi: { value: markNative(noop, "csi") }, app: { value: {} } }) },
    name: { value: "", writable: true },
    closed: { value: false },
    opener: { value: null },
    parent: { value: null, writable: true },
    top: { value: null, writable: true },
    devicePixelRatio: { value: 1 },
    innerWidth: { value: 1920 },
    innerHeight: { value: 1080 },
    outerWidth: { value: 1920 },
    outerHeight: { value: 1080 },
    scrollX: { value: 0 },
    scrollY: { value: 0 },
    pageXOffset: { value: 0 },
    pageYOffset: { value: 0 },
    screenX: { value: 0 },
    screenY: { value: 0 },
    screenLeft: { value: 0 },
    screenTop: { value: 0 },
});

// Fix circular references
win.parent = win;
win.top = win;
win.self = win;
win.window = win;
win.globalThis = win;
document.defaultView = win;

// Mark core functions as native
markNative(win.eval, "eval");

// Expose window on global (scripts check typeof window === 'undefined' ? global : window)
Object.defineProperty(global, "window", { value: win, writable: true, configurable: true });

// ────────────────────────── Load scripts ──────────────────────────

function loadScript(fn) {
    const code = fs.readFileSync(path.join(BASEDIR, fn), "utf8");
    console.log("[env] Loading " + fn + " (" + code.length + " chars)...");
    try {
        const f = new Function("window", "global", "self", "arguments", code);
        f(win, global, win);
        console.log("[env] " + fn + " OK");
    } catch (e) {
        console.log("[env] " + fn + " ERR: " + (e.message || "").slice(0, 300));
        if (e.stack) console.log("  " + e.stack.split("\n").slice(0, 4).join("\n  "));
    }
    console.log("  mnsv2=" + typeof win.mnsv2 + " __bc=" + (win.__bc ? "len=" + win.__bc.length : "no") + " __$c=" + typeof win.__$c);
}

// Load sdt_source_init first (skipped if it fails - it's optional for initial VMP setup)
// loadScript("sdt_source_init.js");

// ds_loader creates the VMP interpreter + _BHjFmfUMEtxhI / _AUuXfEG27Xa3x
loadScript("ds_loader.js");

// ds_api calls _BHjFmfUMEtxhI to create __bc bytecode and mns0201 baseline
loadScript("ds_api.js");

// ds_v2 calls _AUuXfEG27Xa3x to upgrade to mns0301
loadScript("ds_v2.js");

console.log("\n[env] === Final ===");
console.log("mnsv2: " + typeof win.mnsv2);
console.log("_BHjFmfUMEtxhI: " + typeof win._BHjFmfUMEtxhI);
console.log("_AUuXfEG27Xa3x: " + typeof win._AUuXfEG27Xa3x);
console.log("__bc: " + (win.__bc ? win.__bc.length + " chars" : "not defined"));
console.log("__$c: " + typeof win.__$c);

if (typeof win.mnsv2 === "function") {
    try {
        const r = win.mnsv2("test_url", "test_md5", "object");
        console.log("mnsv2 result prefix: " + String(r).slice(0, 40));
        console.log("SUCCESS!");
    } catch(e) {
        console.log("mnsv2 test error: " + e.message);
    }
} else {
    // Try manual call
    if (typeof win._AUuXfEG27Xa3x === "function" && win.__bc) {
        console.log("\nTrying manual _AUuXfEG27Xa3x call...");
        try {
            win._AUuXfEG27Xa3x(win.__$c || win.__bc, [
                undefined, undefined, Function, document, performance, MutationObserverCtor, Object
            ]);
            console.log("After manual call: mnsv2=" + typeof win.mnsv2);
        } catch(e) {
            console.log("ERR: " + e.message.slice(0, 300));
        }
    }
}
