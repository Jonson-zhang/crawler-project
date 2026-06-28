/**
 * env_site_new.js — 今日头条 新版 4-Module CDN SDK 环境补丁
 *
 * 新 SDK 架构: acrawler → sdk-glue → bdms(255KB) → runtime_bundler(52)
 * runtime_bundler 通过 document.writeln 动态加载 3 个远程模块:
 *   config_24.js / project_24.js / strategy_24.js
 *
 * 方案: 提前加载远程模块 → 它们调用 registToModule/registToGlobal 注册
 * → runtime_bundler 初始化时已有这些模块，跳过远程加载。
 *
 * 对齐旧版 mycode/01_env.js 的成功模式。
 */

const _require = require;
const _fs = _require("fs");
const _path = _require("path");
const __dir = __dirname;

// ═══════════════════════════════════════════════════════════════
// 1. 浏览器环境 (对齐旧版 mycode)
// ═══════════════════════════════════════════════════════════════

function safeFunction(fn, name) {
  Object.defineProperty(fn, "toString", {
    value: () => `function ${name || fn.name || ""}() { [native code] }`,
  });
  return fn;
}

// Window
function Window() {}
safeFunction(Window, "Window");
Object.defineProperties(Window.prototype, {
  innerWidth: { value: 1920, writable: true },
  innerHeight: { value: 1080, writable: true },
  outerWidth: { value: 1936, writable: true },
  outerHeight: { value: 1112, writable: true },
  screenX: { value: 0, writable: true },
  screenY: { value: 0, writable: true },
  pageXOffset: { value: 0, writable: true },
  pageYOffset: { value: 0, writable: true },
  devicePixelRatio: { value: 1.25, writable: true },
  clientWidth: { get: () => 1920, configurable: true },
  clientHeight: { get: () => 1080, configurable: true },
});

Window.prototype.requestAnimationFrame = safeFunction(
  (cb) => setTimeout(() => cb(Date.now()), 16),
  "requestAnimationFrame"
);

// Storage
function Storage() { this._data = {}; }
safeFunction(Storage, "Storage");
Storage.prototype.getItem = safeFunction(function (key) {
  return this._data[String(key)] !== undefined ? this._data[String(key)] : null;
}, "getItem");
Storage.prototype.setItem = safeFunction(function (key, value) {
  this._data[String(key)] = String(value);
}, "setItem");
Storage.prototype.removeItem = safeFunction(function (key) { delete this._data[String(key)]; }, "removeItem");
Storage.prototype.clear = safeFunction(function () { this._data = {}; }, "clear");
Object.defineProperty(Storage.prototype, "length", {
  get() { return Object.keys(this._data).length; },
});
Storage.prototype.key = safeFunction(function (n) { return Object.keys(this._data)[n] || null; }, "key");

// Document
function Document() {}
safeFunction(Document, "Document");
Document.prototype[Symbol.toStringTag] = "HTMLDocument";

let _cookieStore = "";
Object.defineProperty(Document.prototype, "cookie", {
  get() { return _cookieStore; },
  set(v) {
    v = String(v).trim();
    if (!v) return;
    _cookieStore = _cookieStore ? _cookieStore + "; " + v : v;
  },
  configurable: true,
});

Document.prototype.createElement = safeFunction(function (tag) {
  if (tag === "canvas") {
    return {
      tagName: "CANVAS",
      width: 300, height: 150,
      getContext() { return null; },
      toDataURL() { return "data:image/png;base64,"; },
      style: {}, attributes: {},
    };
  }
  return { tagName: tag.toUpperCase(), style: {}, attributes: {} };
}, "createElement");

Document.prototype.createEvent = safeFunction(function (type) {
  return { type, initEvent() {} };
}, "createEvent");

const _docEl = { tagName: "HTML", style: {}, attributes: {} };
const _body = { tagName: "BODY", style: {}, attributes: {}, clientWidth: 1920, clientHeight: 1080 };
Document.prototype.documentElement = _docEl;
Document.prototype.body = _body;
Document.prototype.referrer = "";

// document.all — callable proxy
function HTMLAllCollection() {}
safeFunction(HTMLAllCollection, "HTMLAllCollection");
const _all = new HTMLAllCollection();
_all[Symbol.toPrimitive] = function (hint) { return hint === "number" ? 0 : undefined; };
_all.length = 1;
_all[0] = { tagName: "HTML" };
Document.prototype.all = new Proxy(safeFunction(() => [], "all"), {
  get(_, prop) { return prop in _all ? _all[prop] : undefined; },
});

// document.currentScript — CRITICAL for runtime_bundler to read project-id
Object.defineProperty(Document.prototype, "currentScript", {
  get() {
    return {
      src: "https://lf-security.bytegoofy.com/obj/security-secsdk/runtime_bundler_52.js",
      getAttribute(name) {
        if (name === "project-id") return "24";
        if (name === "src") return this.src;
        return null;
      },
    };
  },
  configurable: true,
});

// document.writeln — 拦截远程模块加载，注入本地文件
const _vm = _require("vm");
const _localModules = {
  config_24: _fs.readFileSync(_path.join(__dir, "config_24.js"), "utf-8"),
  project_24: _fs.readFileSync(_path.join(__dir, "project_24.js"), "utf-8"),
  strategy_24: _fs.readFileSync(_path.join(__dir, "strategy_24.js"), "utf-8"),
};
function globalEval(code) { _vm.runInThisContext(code); }

Document.prototype.writeln = function (html) {
  const srcMatch = html.match(/src="([^"]+)"/);
  if (srcMatch) {
    const src = srcMatch[1];
    let name = "";
    if (src.includes("config_")) name = "config_24";
    else if (src.includes("project_")) name = "project_24";
    else if (src.includes("strategy_")) name = "strategy_24";
    // Also handle the sg variants
    if (!name) {
      name = src.match(/(config_\d+|project_\d+|strategy_\d+)/);
      name = name ? name[1] : "";
    }
    if (name && _localModules[name]) {
      globalEval(_localModules[name]);
    } else if (name) {
      // Try without _24 suffix
      const baseName = name.replace(/_\d+$/, "_24");
      if (_localModules[baseName]) {
        globalEval(_localModules[baseName]);
      }
    }
  }
};

// Navigator
function Navigator() {}
safeFunction(Navigator, "Navigator");
Navigator.prototype[Symbol.toStringTag] = "Navigator";
Object.defineProperties(Navigator.prototype, {
  userAgent: { get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36" },
  platform: { value: "Win32" },
  vendor: { value: "Google Inc." },
  language: { value: "zh-CN" },
  languages: { value: ["zh-CN", "zh"] },
  hardwareConcurrency: { value: 8 },
  maxTouchPoints: { value: 0 },
  webdriver: { value: false },
  plugins: { value: [{ name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" }] },
  mimeTypes: { value: [{ type: "application/pdf", suffixes: "pdf" }] },
  userAgentData: { value: { platform: "Windows", brands: [{ brand: "Chromium", version: "143" }], mobile: false }, configurable: true },
  connection: { value: { effectiveType: "4g", rtt: 50, downlink: 10, saveData: false }, configurable: true },
});
navigator.sendBeacon = function () { return true; };

// Screen
function Screen() {}
safeFunction(Screen, "Screen");
Screen.prototype[Symbol.toStringTag] = "Screen";
Object.defineProperties(Screen.prototype, {
  width: { value: 1920 }, height: { value: 1080 },
  availWidth: { value: 1920 }, availHeight: { value: 1040 },
  colorDepth: { value: 24 }, pixelDepth: { value: 24 },
  orientation: { value: { type: "landscape-primary", angle: 0 } },
});

// Location
function Location() { this._url = new URL("https://www.toutiao.com/"); }
safeFunction(Location, "Location");
["href", "protocol", "host", "hostname", "pathname", "search", "hash"].forEach((p) => {
  Object.defineProperty(Location.prototype, p, {
    get() { return this._url[p]; },
    set(v) { try { this._url[p] = String(v); } catch (_) {} },
    configurable: true,
  });
});
Location.prototype.origin = "https://www.toutiao.com";
Location.prototype.toString = safeFunction(function () { return this.href; }, "toString");

// History
function History() {}
safeFunction(History, "History");

// EventSource
function EventSource(url) {
  this.url = url; this.readyState = 0;
  setTimeout(() => { this.readyState = 1; }, 0);
}
safeFunction(EventSource, "EventSource");

// XMLHttpRequest
function XMLHttpRequest() {
  this.readyState = 0; this.status = 0; this.responseText = "";
  this.onreadystatechange = null;
}
safeFunction(XMLHttpRequest, "XMLHttpRequest");
XMLHttpRequest.prototype.open = safeFunction(function (m, u) {
  this.readyState = 0;
  const xhr = this;
  // Simulate async open for SDK hooks
  setTimeout(() => {
    xhr.readyState = 1;
    if (xhr.onreadystatechange) xhr.onreadystatechange();
  }, 0);
}, "open");
XMLHttpRequest.prototype.setRequestHeader = safeFunction(function () {}, "setRequestHeader");
XMLHttpRequest.prototype.send = safeFunction(function () {
  const xhr = this;
  setTimeout(() => {
    xhr.readyState = 4; xhr.status = 200;
    if (xhr.onreadystatechange) xhr.onreadystatechange();
  }, 0);
}, "send");

// Request/Response/Headers
function Request(input) { this.url = typeof input === "string" ? input : (input && input.url); }
function Response(body) { this.body = body; this.status = 200; this.ok = true; }
Response.prototype.text = function () { return Promise.resolve(this.body || ""); };
Response.prototype.json = function () { return Promise.resolve(JSON.parse(this.body || "{}")); };
function Headers(init) { this._h = {}; if (init) Object.assign(this._h, init); }
Headers.prototype.get = function (k) { return this._h[k]; };
Headers.prototype.set = function (k, v) { this._h[k] = v; };

// MutationObserver / PerformanceObserver
function MutationObserver() { this.observe = function () {}; this.disconnect = function () {}; }
function PerformanceObserver() { this.observe = function () {}; this.disconnect = function () {}; }

// chrome / Intl
const _chrome = {
  runtime: {}, app: { isInstalled: false }, webstore: {},
  csi: () => ({ startE: Date.now() }),
  loadTimes: () => ({ requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000, commitLoadTime: Date.now() / 1000, finishDocumentLoadTime: Date.now() / 1000, finishLoadTime: Date.now() / 1000, navigationType: "Other" }),
};
const _Intl = { DateTimeFormat: function () { return { resolvedOptions: () => ({ locale: "zh-CN", calendar: "gregory", numberingSystem: "latn", timeZone: "Asia/Shanghai" }) }; } };

// ═══════════════════════════════════════════════════════════════
// 2. 实例化
// ═══════════════════════════════════════════════════════════════
const win = global;
Object.setPrototypeOf(win, Window.prototype);

const nav = new Navigator();
const doc = new Document();
const scr = new Screen();
const loc = new Location();
const hist = new History();

[
  ["window", win], ["self", win], ["top", win],
  ["document", doc], ["navigator", nav], ["screen", scr],
  ["location", loc], ["history", hist],
  ["XMLHttpRequest", XMLHttpRequest], ["EventSource", EventSource],
  ["Storage", Storage], ["Request", Request], ["Response", Response],
  ["Headers", Headers], ["MutationObserver", MutationObserver],
  ["PerformanceObserver", PerformanceObserver],
  ["localStorage", new Storage()], ["sessionStorage", new Storage()],
].forEach(([k, v]) => {
  win[k] = v;
  global[k] = v;
});
doc.location = loc;

global.chrome = _chrome;
global.Intl = _Intl;

// ═══════════════════════════════════════════════════════════════
// 3. 导出辅助函数 + fetch hook
// ═══════════════════════════════════════════════════════════════

// fetch hook — 用真实 HTTPS (SDK 拦截链需要真实的 fetch)
const _https = _require("https");
const realFetch = function (url, init) {
  init = init || {};
  const method = init.method || "GET";
  const headers = init.headers || {};
  return new Promise((resolve, reject) => {
    try {
      const u = typeof url === "string" ? new URL(url) : new URL(url.url || "about:blank");
      _https.get({
        hostname: u.hostname, path: u.pathname + u.search, method,
        headers: Object.assign({ "User-Agent": "Mozilla/5.0", Referer: "https://www.toutiao.com/" }, headers),
      }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({
          status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data || "{}")),
        }));
      }).on("error", reject);
    } catch (e) { reject(e); }
  });
};
// ═══════════════════════════════════════════════════════════════
// 3. 全局 Event / 函数补丁
// ═══════════════════════════════════════════════════════════════

// addEventListener (runtime_bundler 在 DOMContentLoaded 时调用)
const _eventListeners = {};
global.addEventListener = function (event, handler) {
  if (!_eventListeners[event]) _eventListeners[event] = [];
  _eventListeners[event].push(handler);
  // Auto-trigger DOMContentLoaded
  if (event === "DOMContentLoaded") {
    setTimeout(() => handler({ type: "DOMContentLoaded" }), 100);
  }
};
global.removeEventListener = function () {};

// ProgressEvent (runtime_bundler uses it)
global.ProgressEvent = function (type) { this.type = type; };

// fetch — 用真实 HTTPS
const _https = _require("https");
const realFetch = function (url, init) {
  init = init || {};
  const method = init.method || "GET";
  const headers = init.headers || {};
  return new Promise((resolve, reject) => {
    try {
      const u = typeof url === "string" ? new URL(url) : new URL(url.url || "about:blank");
      _https.get({
        hostname: u.hostname, path: u.pathname + u.search, method,
        headers: Object.assign({ "User-Agent": "Mozilla/5.0", Referer: "https://www.toutiao.com/" }, headers),
      }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({
          status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data || "{}")),
        }));
      }).on("error", reject);
    } catch (e) { reject(e); }
  });
};
global.fetch = realFetch;

// setTimeout — 可能被 env_patch 隐藏，重新暴露
if (typeof global.setTimeout !== "function") {
  global.setTimeout = setTimeout;
}

module.exports = { globalEval };
