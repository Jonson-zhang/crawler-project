"use strict";

// ═══════════════════════════════════════════════════════════════
//  env.js — 知乎补环境 + 加载 webpack chunk
//  产出: module.exports = { ctx, wp, s }
//  被 sign.js require 引入
// ═══════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

// ── 工具 ────────────────────────────────────────────────────────
const noop = () => {};

// ── 补环境 sandbox ──────────────────────────────────────────────
const s = {
  // 全局引用
  window: {},
  self: {},

  // Location
  location: {
    href: "https://www.zhihu.com/",
    host: "www.zhihu.com",
    hostname: "www.zhihu.com",
    protocol: "https:",
    origin: "https://www.zhihu.com",
    pathname: "/",
  },

  // Document
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
  },

  // Navigator
  navigator: {
    userAgent: "Mozilla/5.0",
    platform: "Win32",
    webdriver: false,
    plugins: [],
    languages: ["zh-CN"],
  },

  // Screen
  screen: { width: 1920, height: 1080 },

  // History
  history: {
    length: 1,
    state: null,
    pushState: noop,
    replaceState: noop,
  },

  // Console
  console: {
    log: noop, error: noop, warn: noop, info: noop, debug: noop, table: noop,
  },

  // Performance / Timers
  performance: { now: () => Date.now() },
  setTimeout: () => 0,
  clearTimeout: noop,
  setInterval: () => 0,
  clearInterval: noop,

  // 编码 / 网络
  TextEncoder, TextDecoder, URL, URLSearchParams,
  Blob: class {
    constructor(p) { this.parts = p; }
  },
  fetch: () => Promise.resolve({
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
  }),
  atob: x => Buffer.from(x, "base64").toString("binary"),
  btoa: x => Buffer.from(x, "binary").toString("base64"),
  XMLHttpRequest: function () {
    this.open = noop;
    this.setRequestHeader = noop;
    this.send = noop;
    this.readyState = 4;
    this.status = 200;
    this.responseText = "{}";
  },
  crypto: crypto.webcrypto,
  encodeURIComponent, decodeURIComponent,

  // JS 内置对象
  Math, Date, Object, Array, String, Number, Boolean,
  RegExp, Map, Set, WeakMap, WeakSet,
  Uint8Array, ArrayBuffer, DataView,
  Promise, Proxy, Reflect, Symbol,
  parseInt, parseFloat, isNaN, isFinite,
};

// 循环引用
s.self = s;
s.window = s;
s.document.location = s.location;

// ── 创建 VM 沙箱 ────────────────────────────────────────────────
const ctx = vm.createContext(s);

// ── 加载知乎 webpack chunk ──────────────────────────────────────
let rt = fs.readFileSync(path.join(__dirname, "runtime.js"), "utf-8");
rt = rt.replace(
  /u\.push=s\.bind\(null,u\.push\.bind\(u\)\)\}/,
  "u.push=s.bind(null,u.push.bind(u));globalThis.__wp=p}",
);
vm.runInContext(rt, ctx, { filename: "runtime.js", timeout: 30000 });

vm.runInContext(
  fs.readFileSync(path.join(__dirname, "vendor.js"), "utf-8"),
  ctx,
  { filename: "vendor.js", timeout: 30000 },
);

vm.runInContext(
  fs.readFileSync(path.join(__dirname, "479.js"), "utf-8"),
  ctx,
  { filename: "479.js", timeout: 120000 },
);

// ── 导出 ────────────────────────────────────────────────────────
module.exports = { ctx, wp: s.__wp, s };

if (!s.__wp) {
  console.error("[env] __wp 未找到，webpack chunk 可能加载失败");
}
