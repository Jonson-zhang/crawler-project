#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

// ═══ 补环境 ═══
const noop = () => {};

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

const ctx = vm.createContext(s);

// ═══ 加载 JS ═══
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

const wp = s.__wp;
if (!wp) {
  process.stdout.write(JSON.stringify({ error: "init" }));
  process.exit(1);
}

// ═══ 签名函数 ═══
const nT = wp(93823).nT;  // factory: source → { encrypt, version }
const mR = wp(18543).mR;  // URL encoder
const zse93 = "101_3_3.0";

function sign(url, dc0) {
  let encUrl;
  try {
    encUrl = mR(url);
  } catch (e) {
    encUrl = encodeURIComponent(url).replace(/%2F/g, "/");
  }

  const src = [zse93, encUrl, dc0 || ""].filter(Boolean).join("+");
  const { encrypt } = nT(src);
  let sig;
  try {
    sig = encrypt(src);
  } catch (e) {}

  if (!sig) {
    sig = crypto.createHash("md5").update(src).digest("hex");
  }

  return {
    "x-zse-96": "2.0_" + sig,
    "x-zst-81": "3_2.0aR_sn77yn6O92wOB8hPZnQr0EMYxc4f18wNBUgpTQ6nxERFZf_" + sig,
  };
}

// ═══ 输出 ═══
function run(req) {
  const r = sign(
    req.url || req.path || "/api/v3/feed/topstory/recommend?action=down&page_number=1",
    req.d_c0 || req.dc0 || "",
  );
  process.stdout.write(JSON.stringify(r));
  process.exit(0);
}

if (!process.stdin.isTTY) {
  let d = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try { run(JSON.parse(d)); } catch (e) { run({}); }
  });
  setTimeout(() => run({}), 5000);
} else {
  run({ url: process.argv[2] || "", d_c0: process.argv[3] || "" });
}
