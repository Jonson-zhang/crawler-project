/**
 * env_site.js — 今日头条 浏览器环境补丁
 *
 * 基于 .claude/env-patch/env_patch.js 通用框架。
 * 加载 toutiao SDK (acrawler + sdk-glue + bdms) 以生成 a_bogus。
 *
 * ══ 二阶段补环境工作流 ══
 *
 *   阶段 1 — 发现:
 *     DEBUG_PROXY=true node sign.js
 *     → 退出时自动打印「📋 补丁代码」报告
 *
 *   阶段 2 — 补全:
 *     → 复制报告中的补丁代码 → 粘贴到下方 → 重跑验证
 *
 * ⚠️ 天花板判定:
 *   如果 3 轮补环境后签名仍错误，切 iv8 方案。
 *   详见 .claude/env-patch/README.md#env_patch-天花板
 */

const _process = process;
const _require = require;
const _fs = _require("fs");
const _path = _require("path");
const __dir = __dirname;

const { setupEnv, sn, mf, mc, watch } = _require(
  "../../.claude/env-patch/env_patch.js",
);

// ═══════════════════════════════════════════════════════════════
// 1. 站点配置
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://www.toutiao.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  platform: "Win32",
  languages: ["zh-CN", "zh"],
  screenWidth: 1920,
  screenHeight: 1080,
  title: "今日头条",
  cookie: "",

  canvas: true,
  webgl: true,        // bdms SDK 会访问 WebGL
  plugins: true,      // bdms SDK 检查 plugins/mimeTypes
  storage: true,      // bdms SDK 使用 localStorage 缓存
  extraConstructors: true,
  crypto: true,

  // ByteDance SDK 要求 window === global (SDKRuntime 注册到 window 上)
  windowToGlobal: true,
});

// 替换为 Node.js 原生 Web Crypto
global.crypto = _require("crypto").webcrypto;

// ═══════════════════════════════════════════════════════════════
// 2. 站点特有覆盖 — 头条 SDK 依赖的额外环境
// ═══════════════════════════════════════════════════════════════

// --- document.currentScript (SDK 读取自己的 script src) ---
Object.defineProperty(document, "currentScript", {
  get() {
    return {
      src: "https://lf-security.bytegoofy.com/obj/security-secsdk/runtime_bundler_52.js",
      getAttribute() { return null; },
    };
  },
  configurable: true,
  enumerable: true,
});

// --- Node.js specific: global.process might be checked ---
// env_patch already sets process = undefined for windowToGlobal: true,
// but some SDK code expects it to exist. Re-expose if needed.
// global.process = _process;

// --- document.writeln (used by runtime_bundler to inject scripts) ---
document.writeln = function (html) {
  // Extract script src from the HTML
  const match = html.match(/src="([^"]+)"/);
  if (match) {
    const src = match[1];
    // The SDK tries to load config/project/strategy modules dynamically.
    // We skip remote loading — the core a_bogus functionality is in bdms.js.
    console.log("[env_site] document.writeln skipped:", src.substring(0, 80));
  }
};

// --- Navigator.sendBeacon (SDK uses it for reporting) ---
navigator.sendBeacon = function () { return true; };

// --- PerformanceObserver ---
if (typeof global.PerformanceObserver === "undefined") {
  global.PerformanceObserver = function () {};
  global.PerformanceObserver.prototype = {
    observe() {},
    disconnect() {},
    takeRecords() { return []; },
  };
}

// --- Request / Response / Headers (SDK fetch hook checks these) ---
if (typeof global.Request === "undefined") {
  global.Request = function (input, init) {
    this.url = typeof input === "string" ? input : input.url;
    this.method = (init && init.method) || "GET";
    this.headers = init && init.headers ? init.headers : {};
    this.body = init && init.body ? init.body : null;
  };
}
if (typeof global.Response === "undefined") {
  global.Response = function (body, init) {
    this.body = body;
    this.status = (init && init.status) || 200;
    this.headers = init && init.headers ? init.headers : {};
    this.ok = this.status >= 200 && this.status < 300;
  };
  global.Response.prototype.json = function () {
    return Promise.resolve(JSON.parse(this.body));
  };
  global.Response.prototype.text = function () {
    return Promise.resolve(this.body);
  };
}
if (typeof global.Headers === "undefined") {
  global.Headers = function (init) {
    this._headers = {};
    if (init) {
      if (init instanceof global.Headers) {
        init.forEach((v, k) => (this._headers[k] = v));
      } else if (Array.isArray(init)) {
        init.forEach(([k, v]) => (this._headers[k] = v));
      } else {
        Object.assign(this._headers, init);
      }
    }
  };
  global.Headers.prototype.get = function (k) { return this._headers[k]; };
  global.Headers.prototype.set = function (k, v) { this._headers[k] = v; };
  global.Headers.prototype.forEach = function (cb) {
    Object.entries(this._headers).forEach(([k, v]) => cb(v, k));
  };
  global.Headers.prototype.entries = function () {
    return Object.entries(this._headers)[Symbol.iterator]();
  };
}

// --- MutationObserver (SDK observer hook) ---
if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = function (cb) { this._cb = cb; };
  global.MutationObserver.prototype = {
    observe() {},
    disconnect() {},
    takeRecords() { return []; },
  };
}

// --- 隐藏 Node.js 特征 (windowToGlobal:true 已做了大部分) ---
// 额外隐藏
delete global.queueMicrotask;

// ═══════════════════════════════════════════════════════════════
// 3. 导出
// ═══════════════════════════════════════════════════════════════
module.exports = {
  envReady: true,
};
