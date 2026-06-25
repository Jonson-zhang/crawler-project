/**
 * env3.js — with apply trap to identify missing environment
 */
"use strict";

var fs = require("fs");
var path = require("path");
var noop = function() {};

// Trap apply to see what's undefined
var origApply = Function.prototype.apply;
var trapCount = 0;
Function.prototype.apply = function(thisArg, args) {
    if (this === undefined || this === null) {
        trapCount++;
        if (trapCount <= 5) {
            console.log("[TRAP] apply called on " + this + ", args=" + JSON.stringify(Array.isArray(args) ? args.slice(0,5) : String(args).slice(0,200)));
            console.log("  Stack: " + new Error().stack.split('\n').slice(2,6).join(' | '));
        }
    }
    return origApply.call(this, thisArg, args);
};

var nav = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    platform: "Win32", language: "zh-CN", languages: ["zh-CN","zh"],
    webdriver: false, cookieEnabled: true,
    plugins: { length: 5, item: function(){return null;}, namedItem: function(){return null;}, refresh: noop },
};
var scr = { width: 1920, height: 1080, colorDepth: 24 };
var loc = { href: "https://www.xiaohongshu.com/explore", origin: "https://www.xiaohongshu.com", host: "www.xiaohongshu.com", protocol: "https:" };
var doc = {
    cookie: "",
    createElement: function() { return { style: {}, appendChild: noop, getContext: function(){return null;} }; },
    addEventListener: noop, getElementsByTagName: function(){return [];},
    head: {}, body: {}, documentElement: { style: {} },
};
function MutationObserver() { this.observe = noop; this.disconnect = noop; this.takeRecords = function(){return [];}; }
var storage = { _data:{}, getItem:function(k){return this._data[k]||null;}, setItem:function(k,v){this._data[k]=String(v);}, removeItem:function(k){delete this._data[k];}, clear:function(){this._data={};}, get length(){return Object.keys(this._data).length;}, key:function(i){return Object.keys(this._data)[i]||null;} };

var win = {};
Object.assign(win, {
    Object, Array, Function, String, Number, Boolean, Date, RegExp, Math, JSON,
    Error, TypeError, SyntaxError, ReferenceError, RangeError, URIError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
    Float32Array, Float64Array, Uint8ClampedArray, ArrayBuffer, DataView,
    BigInt64Array, BigUint64Array,
    Promise, Symbol, Map, Set, WeakMap, WeakSet, Proxy, Reflect,
    navigator: nav, screen: scr, location: loc, document: doc,
    localStorage: storage, sessionStorage: storage,
    performance: {
        now: function() { return Date.now(); },
        timing: { navigationStart: Date.now()-1000, loadEventEnd: Date.now()-500, domComplete: Date.now()-200 },
        getEntriesByType: function() { return []; },
        mark: noop, measure: noop,
    },
    console: { log: noop, error: noop, warn: noop, info: noop, debug: noop },
    setTimeout: function(fn) { if (typeof fn==='function') fn(); return 0; },
    clearTimeout: noop, setInterval: function(){return 0;}, clearInterval: noop,
    requestAnimationFrame: function(cb) { cb(Date.now()); return 0; },
    atob: function(x) { return Buffer.from(x,"base64").toString("binary"); },
    btoa: function(x) { return Buffer.from(x,"binary").toString("base64"); },
    TextEncoder, TextDecoder, URL, URLSearchParams,
    Blob: function(p) { this.parts = p||[]; },
    crypto: require("crypto").webcrypto || require("crypto"),
    MutationObserver,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    eval: function(code) { return eval(code); },
    Image: function() { this.src = ""; },
    WebSocket: function() { this.send = noop; this.close = noop; },
    Worker: function() { this.postMessage = noop; },
    XMLHttpRequest: function() { this.open = noop; this.send = noop; this.setRequestHeader = noop; this.readyState = 4; this.status = 200; },
    fetch: function() { return Promise.resolve({ json: function(){return Promise.resolve({});}, text: function(){return Promise.resolve("");} }); },
    external: {}, chrome: {},
    HTMLCanvasElement: function(){},
    HTMLImageElement: function(){},
    HTMLScriptElement: function(){},
    devicePixelRatio: 1, innerWidth: 1920, innerHeight: 1080,
});

win.self = win;
win.window = win;
win.globalThis = win;
Object.defineProperty(global, 'window', { value: win, writable: true, configurable: true });

var BASEDIR = __dirname;

function load(fn) {
    var code = fs.readFileSync(path.join(BASEDIR, fn), "utf8");
    console.log("[env3] Loading " + fn + "...");
    try {
        var f = new Function('window', 'global', 'self', code);
        f(win, global, win);
        console.log("[env3] " + fn + " OK");
    } catch (e) {
        console.error("[env3] " + fn + " ERROR: " + e.message);
    }
}

load("sdt_source_init.js");
console.log("  __$c=" + typeof win.__$c + " __bc=" + typeof win.__bc);
console.log("  mnsv2=" + typeof win.mnsv2);

load("ds_loader.js");
console.log("  __$c=" + typeof win.__$c + " __bc=" + (win.__bc ? win.__bc.length + " chars" : typeof win.__bc));
console.log("  mnsv2=" + typeof win.mnsv2);

load("ds_api.js");
console.log("  __$c=" + typeof win.__$c + " mnsv2=" + typeof win.mnsv2);

load("ds_v2.js");
console.log("  mnsv2=" + typeof win.mnsv2);

if (typeof win.mnsv2 === 'function') {
    console.log("\nSUCCESS! Testing mnsv2...");
    try {
        var r = win.mnsv2("hello", "world", "object");
        console.log("Result prefix: " + String(r).slice(0, 50));
    } catch(e) {
        console.log("Test error: " + e.message);
    }
}
