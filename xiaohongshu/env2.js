/**
 * env2.js — 小红书 VMP 签名补环境最小测试
 * 加载顺序: sdt_source_init → ds_loader → ds_api → ds_v2
 */
"use strict";

var fs = require("fs");
var path = require("path");
var noop = function() {};

// === 最小环境 ===
var nav = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    platform: "Win32", language: "zh-CN", languages: ["zh-CN","zh"],
    webdriver: false, cookieEnabled: true,
    plugins: { length: 5, item: function() { return null; }, namedItem: function() { return null; }, refresh: noop },
    mimeTypes: { length: 4, item: function() { return null; }, namedItem: function() { return null; } },
};
var scr = { width: 1920, height: 1080, colorDepth: 24 };
var loc = { href: "https://www.xiaohongshu.com/explore", origin: "https://www.xiaohongshu.com", host: "www.xiaohongshu.com", protocol: "https:" };
var doc = {
    cookie: "",
    createElement: function() { return { style: {}, appendChild: noop, getContext: function() { return null; } }; },
    addEventListener: noop, getElementsByTagName: function() { return []; },
    head: {}, body: {}, documentElement: { style: {} },
};

function MutationObserver() { this.observe = noop; this.disconnect = noop; this.takeRecords = function() { return []; }; }

var storage = {
    _data: {},
    getItem: function(k) { return this._data[k] || null; },
    setItem: function(k,v) { this._data[k] = String(v); },
    removeItem: function(k) { delete this._data[k]; },
    clear: function() { this._data = {}; },
    get length() { return Object.keys(this._data).length; },
    key: function(i) { return Object.keys(this._data)[i] || null; },
};

var win = {};
Object.assign(win, {
    Object: Object, Array: Array, Function: Function, String: String, Number: Number, Boolean: Boolean,
    Date: Date, RegExp: RegExp, Math: Math, JSON: JSON,
    Error: Error, TypeError: TypeError, SyntaxError: SyntaxError, ReferenceError: ReferenceError,
    parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    encodeURI: encodeURI, decodeURI: decodeURI,
    Uint8Array: Uint8Array, Uint16Array: Uint16Array, Uint32Array: Uint32Array,
    Int8Array: Int8Array, Int16Array: Int16Array, Int32Array: Int32Array,
    Float32Array: Float32Array, Float64Array: Float64Array,
    ArrayBuffer: ArrayBuffer, DataView: DataView,
    Promise: Promise, Symbol: Symbol, Map: Map, Set: Set, WeakMap: WeakMap, WeakSet: WeakSet,
    navigator: nav, screen: scr, location: loc, document: doc,
    localStorage: storage, sessionStorage: storage,
    performance: { now: function() { return Date.now(); }, timing: { navigationStart: Date.now()-1000 } },
    console: { log: noop, error: noop, warn: noop, info: noop, debug: noop },
    setTimeout: function(fn) { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout: noop, setInterval: function() { return 0; }, clearInterval: noop,
    atob: function(x) { return Buffer.from(x, "base64").toString("binary"); },
    btoa: function(x) { return Buffer.from(x, "binary").toString("base64"); },
    TextEncoder: TextEncoder, TextDecoder: TextDecoder, URL: URL, URLSearchParams: URLSearchParams,
    crypto: require("crypto"),
    MutationObserver: MutationObserver,
    addEventListener: noop, removeEventListener: noop,
    eval: function(code) { return eval(code); },
    Image: function() { this.src = ""; },
    WebSocket: function() { this.send = noop; this.close = noop; },
    Worker: function() { this.postMessage = noop; },
    XMLHttpRequest: function() { this.open = noop; this.send = noop; this.setRequestHeader = noop; this.readyState = 4; this.status = 200; },
    fetch: function() { return Promise.resolve({ json: function() { return Promise.resolve({}); }, text: function() { return Promise.resolve(""); } }); },
    external: {}, chrome: {},
    Function: Function,
    Proxy: typeof Proxy !== 'undefined' ? Proxy : undefined,
    Reflect: typeof Reflect !== 'undefined' ? Reflect : undefined,
});

win.self = win;
win.window = win;
win.globalThis = win;
Object.defineProperty(global, 'window', { value: win, writable: true, configurable: true });

var BASEDIR = __dirname;

function load(fn) {
    var code = fs.readFileSync(path.join(BASEDIR, fn), "utf8");
    console.log("[env2] Loading " + fn + " (" + code.length + " chars)...");
    try {
        var f = new Function('window', 'global', 'self', 'arguments', code);
        f(win, global, win);
    } catch (e) {
        console.error("[env2] ERROR " + fn + ": " + e.message);
        if (e.stack) console.error(e.stack.slice(0, 500));
    }
    console.log("[env2] After " + fn + ": mnsv2=" + typeof win.mnsv2 + ", __bc=" + typeof win.__bc + ", __$c=" + typeof win.__$c);
}

// Step 1: VMP interpreter foundation
load("sdt_source_init.js");

// Step 2: VMP loader (creates __bc bytecode)
load("ds_loader.js");

console.log("[env2] __bc = " + (win.__bc ? win.__bc.length + " chars" : "not defined"));

// Step 3: ds_api (creates mns0201 via _BHjFmfUMEtxhI)
load("ds_api.js");

// Step 4: ds_v2 (upgrades mns0201 -> mns0301 via _AUuXfEG27Xa3x)
load("ds_v2.js");

console.log("\n[env2] === Final state ===");
console.log("  mnsv2: " + typeof win.mnsv2);
console.log("  _BHjFmfUMEtxhI: " + typeof win._BHjFmfUMEtxhI);
console.log("  _AUuXfEG27Xa3x: " + typeof win._AUuXfEG27Xa3x);

if (typeof win.mnsv2 === 'function') {
    try {
        var r = win.mnsv2("test_url", "test_body", "object");
        console.log("  test result prefix: " + String(r).slice(0, 30));
    } catch(e) {
        console.log("  test error: " + e.message);
    }
}
