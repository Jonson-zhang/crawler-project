/**
 * 小红书补环境 + 加载安全 SDK + webpack bundle
 * 产出: module.exports = { getSignedHeaders }
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA_DIR = path.join(__dirname, "data");

// ── 浏览器环境 stub ─────────────────────────────────────────────
const noop = () => {};

const sandbox = {
  window: {},
  self: {},
  global: {},
  document: {
    cookie: "",
    createElement: () => ({}),
    querySelector: () => null,
    getElementsByTagName: () => [],
    addEventListener: noop,
    removeEventListener: noop,
    head: { appendChild: noop },
    body: { appendChild: noop },
    documentElement: { style: {} },
    scripts: [],
  },
  location: {
    href: "https://www.xiaohongshu.com/explore",
    host: "www.xiaohongshu.com",
    hostname: "www.xiaohongshu.com",
    protocol: "https:",
    origin: "https://www.xiaohongshu.com",
    pathname: "/explore",
  },
  navigator: {
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    platform: "Win32",
    webdriver: false,
    plugins: [],
    languages: ["zh-CN"],
    language: "zh-CN",
  },
  screen: { width: 1920, height: 1080 },
  history: { length: 1, state: null, pushState: noop, replaceState: noop },
  console: { log: noop, error: noop, warn: noop, info: noop, debug: noop },
  performance: { now: () => Date.now(), timing: { navigationStart: Date.now() - 1000 } },
  setTimeout: (fn, ms, ...args) => { fn(...args); return 0; },
  setInterval: () => 0,
  clearTimeout: noop,
  clearInterval: noop,

  // 编码
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  atob: (x) => Buffer.from(x, "base64").toString("binary"),
  btoa: (x) => Buffer.from(x, "binary").toString("base64"),
  encodeURIComponent,
  decodeURIComponent,

  // 请求
  Blob: class {
    constructor(p) { this.parts = p; }
  },
  fetch: () => Promise.resolve({ json: () => Promise.resolve({}), text: () => Promise.resolve("") }),
  Headers: class {
    constructor(h) { this._h = h || {}; }
    set(k, v) { this._h[k] = v; }
    get(k) { return this._h[k]; }
  },

  // XHR - 先不拦截，让 SDK 拦截
  XMLHttpRequest: (() => {
    function XHR() {
      this.readyState = 0;
      this.status = 0;
      this.responseText = "";
    }
    XHR.prototype.open = function (method, url) {
      this._method = method;
      this._url = url;
      this.readyState = 1;
    };
    XHR.prototype.setRequestHeader = function (key, value) {};
    XHR.prototype.send = function (body) {
      this.readyState = 4;
      this.status = 200;
      this.responseText = "{}";
      if (this.onreadystatechange) this.onreadystatechange();
    };
    return XHR;
  })(),

  // Crypto
  crypto: require("crypto").webcrypto,

  // JS 内置
  Math, Date, Object, Array, String, Number, Boolean,
  RegExp, Map, Set, WeakMap, WeakSet,
  Uint8Array, Uint16Array, Uint32Array,
  Int8Array, Int16Array, Int32Array,
  Float32Array, Float64Array,
  ArrayBuffer, DataView,
  Promise, Proxy, Reflect, Symbol,
  parseInt, parseFloat, isNaN, isFinite,
  JSON,
  Error, TypeError, RangeError, SyntaxError, ReferenceError,
};

// 循环引用
sandbox.self = sandbox;
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.document.location = sandbox.location;

// ── 创建 VM 上下文 ────────────────────────────────────────────────
const ctx = vm.createContext(sandbox);

// ── 注入 require（加载本地 JS） ──────────────────────────────────
sandbox.require = function (id) {
  if (id === "@lwjjike/xbsdom") return undefined;
  return require(id);
};

// ── 加载安全 SDK 和 webpack bundle ────────────────────────────────
function loadScript(filename) {
  const code = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
  try {
    vm.runInContext(code, ctx, { filename, timeout: 120000 });
    console.log(`  [OK] ${filename}`);
  } catch (e) {
    console.log(`  [ERR] ${filename}: ${e.message.slice(0, 100)}`);
  }
}

console.log("[env] 加载脚本...");
loadScript("ds_api.js");
loadScript("ds_6545c.js");
loadScript("signer_04b29.js");

// 检查关键对象
console.log(`[env] _BHjFmfUMEtxhI = ${typeof sandbox._BHjFmfUMEtxhI}`);
console.log(`[env] xsecappid = ${sandbox.xsecappid}`);
console.log(`[env] anti_hp_sign_config = ${typeof sandbox.anti_hp_sign_config}`);

// ── 导出 ────────────────────────────────────────────────────────
module.exports = { ctx, sandbox };
