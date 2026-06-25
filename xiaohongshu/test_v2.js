const fs = require("fs"), noop = function() {};

const MuOb = function() { this.observe = noop; this.disconnect = noop; this.takeRecords = function() { return []; }; };
const doc = {
    cookie: "", createElement: function() { return { style: {}, appendChild: noop }; },
    addEventListener: noop, getElementsByTagName: function() { return []; },
    head: {}, body: {}, documentElement: { style: {} },
};
const baseWin = {
    Object, Array, Function, String, Number, Boolean, Date, RegExp, Math, JSON,
    Error, TypeError, SyntaxError, ReferenceError, RangeError, URIError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, Uint8ClampedArray, ArrayBuffer, DataView,
    Promise, Symbol, Map, Set, WeakMap, WeakSet, Proxy,
    navigator: { userAgent: "Mozilla/5.0", platform: "Win32", language: "zh-CN", languages: ["zh-CN"], webdriver: false, cookieEnabled: true,
        plugins: { length: 5, item: function() { return null; }, namedItem: function() { return null; }, refresh: noop } },
    screen: { width: 1920, height: 1080, colorDepth: 24, availWidth: 1920, availHeight: 1040 },
    location: { href: "https://www.xiaohongshu.com/explore", origin: "https://www.xiaohongshu.com", host: "www.xiaohongshu.com", protocol: "https:", hostname: "www.xiaohongshu.com", pathname: "/explore", port: "", search: "", hash: "" },
    document: doc,
    localStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); }, get length() { return Object.keys(this._data).length; } },
    sessionStorage: { _data: {}, getItem(k) { return this._data[k] || null; }, setItem(k, v) { this._data[k] = String(v); } },
    performance: { now() { return Date.now(); }, timing: { navigationStart: Date.now() - 1000 }, getEntriesByType() { return []; }, mark: noop, measure: noop },
    console: { log: noop, error: noop, warn: noop, info: noop, debug: noop },
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; }, clearTimeout: noop,
    setInterval() { return 0; }, clearInterval: noop,
    atob(x) { return Buffer.from(x, "base64").toString("binary"); },
    btoa(x) { return Buffer.from(x, "binary").toString("base64"); },
    TextEncoder, TextDecoder, URL, URLSearchParams,
    crypto: require("crypto"),
    MutationObserver: MuOb,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    Event(t) { this.type = t; },
    eval(c) { return eval(c); },
    Image() { this.src = ""; this.complete = true; },
    WebSocket() { this.send = noop; this.close = noop; },
    XMLHttpRequest() { this.open = noop; this.send = noop; this.setRequestHeader = noop; this.readyState = 4; this.status = 200; },
    fetch() { return Promise.resolve({ json() { return Promise.resolve({}); }, text() { return Promise.resolve(""); } }); },
    external: {}, chrome: {},
    devicePixelRatio: 1, innerWidth: 1920, innerHeight: 1080, outerWidth: 1920, outerHeight: 1080,
    HTMLCanvasElement: function() {}, HTMLImageElement: function() {}, HTMLDivElement: function() {},
    HTMLSpanElement: function() {}, HTMLHeadElement: function() {}, HTMLBodyElement: function() {},
    HTMLInputElement: function() {}, HTMLScriptElement: function() {}, HTMLElement: function() {},
};
baseWin.self = baseWin; baseWin.window = baseWin; baseWin.globalThis = baseWin;
baseWin.parent = baseWin; baseWin.top = baseWin;
Object.defineProperty(global, "window", { value: baseWin, writable: true, configurable: true });

// Load ds_loader (may fail, doesn't matter for our purpose)
try { new Function("window", "global", "self", fs.readFileSync("h:/Crawler/xiaohongshu/ds_loader.js", "utf8"))(baseWin, global, baseWin); } catch (e) {}

// Load ds_api
try { new Function("window", "global", "self", fs.readFileSync("h:/Crawler/xiaohongshu/ds_api.js", "utf8"))(baseWin, global, baseWin); } catch (e) { console.log("api:", e.message.slice(0, 80)); }
console.log("After ds_api: __bc=" + (baseWin.__bc ? baseWin.__bc.length : "no"));

// PATCH ds_v2: replace env array with 30+ entries
let code3 = fs.readFileSync("h:/Crawler/xiaohongshu/ds_v2.js", "utf8");
const oldEnvEnd = ',typeof Object!=="undefined"?Object:undefined])';
const newEnvEnd =
    ',typeof Object!=="undefined"?Object:undefined' +
    ',typeof navigator!=="undefined"?navigator:undefined' +
    ',typeof window!=="undefined"?window:undefined' +
    ',typeof screen!=="undefined"?screen:undefined' +
    ',typeof Uint8Array!=="undefined"?Uint8Array:undefined' +
    ',typeof Image!=="undefined"?Image:undefined' +
    ',typeof XMLHttpRequest!=="undefined"?XMLHttpRequest:undefined' +
    ',typeof HTMLCanvasElement!=="undefined"?HTMLCanvasElement:undefined' +
    ',typeof HTMLDivElement!=="undefined"?HTMLDivElement:undefined' +
    ',typeof HTMLElement!=="undefined"?HTMLElement:undefined' +
    ',typeof HTMLInputElement!=="undefined"?HTMLInputElement:undefined' +
    ',,,,,,,,,,])';  // 10 extra undefined slots

if (code3.includes(oldEnvEnd)) {
    code3 = code3.replace(oldEnvEnd, newEnvEnd);
    console.log("Patched ds_v2 env: " + oldEnvEnd.length + " -> " + newEnvEnd.length);
} else {
    console.log("WARN: env end not found!");
    console.log("Looking for: " + oldEnvEnd);
}

try {
    new Function("window", "global", "self", code3)(baseWin, global, baseWin);
    console.log("ds_v2 OK!");
} catch (e) {
    console.log("ds_v2 ERR: " + (e.message || "").slice(0, 300));
}
console.log("mnsv2=" + typeof baseWin.mnsv2);
if (typeof baseWin.mnsv2 === "function") {
    const r = baseWin.mnsv2("hello", "world", "object");
    console.log("SUCCESS! prefix=" + String(r).slice(0, 40));
}
