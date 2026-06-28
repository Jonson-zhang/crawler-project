/**
 * env_site_new.js — 今日头条 新版 4-Module CDN SDK 环境
 *
 * 新 SDK 流程:
 *   runtime_bundler → document.writeln 加载 config/project/strategy
 *   → SDKRuntime 模块系统就绪 → bdms.js fetch 拦截链 → a_bogus
 *
 * 关键: document.writeln 在 Node.js 中注入本地已下载的模块文件。
 */

const _require = require;
const _fs = _require("fs");
const _path = _require("path");
const _vm = _require("vm");
const __dir = __dirname;

function globalEval(code) { _vm.runInThisContext(code); }

// ── 函数工具 ──
function safeFn(fn, name) {
  Object.defineProperty(fn, "toString", {
    value: () => "function " + (name || fn.name || "") + "() { [native code] }",
  });
  return fn;
}
function makeCtor(name) {
  const Ctor = function () {};
  safeFn(Ctor, name);
  return Ctor;
}
function defProps(obj, props) {
  for (const [k, v] of Object.entries(props)) {
    const d = typeof v === "function" ? { get: v } : { value: v, writable: true };
    Object.defineProperty(obj, k, Object.assign(d, { configurable: true }));
  }
}

// ═══════════════════════════════════════════════════════════════
// Browser objects
// ═══════════════════════════════════════════════════════════════

const Window = makeCtor("Window");
defProps(Window.prototype, {
  innerWidth: 1920, innerHeight: 1080,
  outerWidth: 1936, outerHeight: 1112,
  screenX: 0, screenY: 0,
  pageXOffset: 0, pageYOffset: 0,
  devicePixelRatio: 1.25,
});
Window.prototype.requestAnimationFrame = safeFn((cb) => setTimeout(() => cb(Date.now()), 16), "requestAnimationFrame");
Window.prototype.onwheelx = { _Ax: "0X21" };
Window.prototype._sdkGlueVersionMap = { sdkGlueVersion: "1.0.0.55", bdmsVersion: "1.0.1.7", captchaVersion: "4.0.2" };

const Storage = makeCtor("Storage");
const _storeData = new Map();
Storage.prototype.getItem = safeFn(function (k) { return _storeData.get(String(k)) || null; }, "getItem");
Storage.prototype.setItem = safeFn(function (k, v) { _storeData.set(String(k), String(v)); }, "setItem");
Storage.prototype.removeItem = safeFn(function (k) { _storeData.delete(String(k)); }, "removeItem");
Storage.prototype.clear = safeFn(function () { _storeData.clear(); }, "clear");
Object.defineProperty(Storage.prototype, "length", { get() { return _storeData.size; } });
Storage.prototype.key = safeFn(function (n) { return [..._storeData.keys()][n] || null; }, "key");
const ls = new Storage();
const ss = new Storage();

const HTMLDocument = makeCtor("HTMLDocument");
HTMLDocument.prototype[Symbol.toStringTag] = "HTMLDocument";
let _cookies = "";
defProps(HTMLDocument.prototype, {
  cookie() { return _cookies; },
});
Object.defineProperty(HTMLDocument.prototype, "cookie", {
  get() { return _cookies; },
  set(v) { if (v) _cookies = _cookies ? _cookies + "; " + v : v; },
  configurable: true,
});
HTMLDocument.prototype.createElement = safeFn((tag) => {
  const el = { tagName: tag.toUpperCase(), style: {}, attributes: {} };
  if (tag === "canvas") {
    el.getContext = function () { return null; };
    el.toDataURL = function () { return "data:image/png;base64,"; };
  }
  return el;
}, "createElement");
HTMLDocument.prototype.createEvent = safeFn(() => ({ initEvent() {} }), "createEvent");
HTMLDocument.prototype.documentElement = { tagName: "HTML", style: {} };
HTMLDocument.prototype.body = { tagName: "BODY", style: {} };
HTMLDocument.prototype.referrer = "";
// document.all
const _all = { length: 1, 0: { tagName: "HTML" } };
const _allCallable = safeFn(() => [], "all");
HTMLDocument.prototype.all = new Proxy(_allCallable, {
  get(_, p) { return p in _all ? _all[p] : (p in _allCallable ? _allCallable[p] : undefined); },
});
// document.currentScript — runtime_bundler 读 project-id
Object.defineProperty(HTMLDocument.prototype, "currentScript", {
  get: () => ({
    src: "https://lf-security.bytegoofy.com/obj/security-secsdk/runtime_bundler_52.js",
    getAttribute(name) { return name === "project-id" ? "24" : null; },
  }),
  configurable: true,
});
// document.writeln — 注入本地远程模块
const _modCache = {
  "config_24.js": _fs.readFileSync(_path.join(__dir, "config_24.js"), "utf-8"),
  "project_24.js": _fs.readFileSync(_path.join(__dir, "project_24.js"), "utf-8"),
  "strategy_24.js": _fs.readFileSync(_path.join(__dir, "strategy_24.js"), "utf-8"),
};
HTMLDocument.prototype.writeln = function (html) {
  // Parse <script src="..."> and inject local file
  const m = html.match(/src=["']([^"']+)["']/);
  if (m) {
    for (const [name, code] of Object.entries(_modCache)) {
      if (m[1].includes(name.replace(/\.js$/, "").replace(/_24$/, "")) || m[1].includes(name)) {
        globalEval(code);
        return;
      }
    }
  }
};

const Navigator = makeCtor("Navigator");
Navigator.prototype[Symbol.toStringTag] = "Navigator";
defProps(Navigator.prototype, {
  userAgent() { return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"; },
  platform: "Win32", vendor: "Google Inc.",
  language: "zh-CN", languages: ["zh-CN", "zh"],
  hardwareConcurrency: 8, maxTouchPoints: 0, webdriver: false,
  plugins: [{ name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" }],
  mimeTypes: [{ type: "application/pdf", suffixes: "pdf" }],
  userAgentData: { platform: "Windows", brands: [{ brand: "Chromium", version: "143" }], mobile: false },
  connection: { effectiveType: "4g", rtt: 50, downlink: 10, saveData: false },
});
Navigator.prototype.sendBeacon = function () { return true; };

const Screen = makeCtor("Screen");
Screen.prototype[Symbol.toStringTag] = "Screen";
defProps(Screen.prototype, {
  width: 1920, height: 1080,
  availWidth: 1920, availHeight: 1040,
  colorDepth: 24, pixelDepth: 24,
  orientation: { type: "landscape-primary", angle: 0 },
});

const Location = makeCtor("Location");
const _urlObj = new URL("https://www.toutiao.com/");
["href", "protocol", "host", "hostname", "pathname", "search", "hash"].forEach((p) => {
  Object.defineProperty(Location.prototype, p, {
    get() { return _urlObj[p]; },
    set(v) { try { _urlObj[p] = String(v); } catch (_) {} },
    configurable: true,
  });
});
Object.defineProperty(Location.prototype, "origin", { get() { return _urlObj.origin; }, configurable: true });
Location.prototype.toString = safeFn(function () { return _urlObj.href; }, "toString");

const History = makeCtor("History");
const EventSource = makeCtor("EventSource");

// XMLHttpRequest
const XMLHttpRequest = makeCtor("XMLHttpRequest");
XMLHttpRequest.prototype.open = safeFn(function () { this.readyState = 1; }, "open");
XMLHttpRequest.prototype.setRequestHeader = safeFn(function () {}, "setRequestHeader");
XMLHttpRequest.prototype.send = safeFn(function () { this.readyState = 4; this.status = 200; }, "send");

// ═══════════════════════════════════════════════════════════════
// 实例化 & 挂载
// ═══════════════════════════════════════════════════════════════
const win = global;
Object.setPrototypeOf(win, Window.prototype);

const nav = new Navigator();
const doc = new HTMLDocument();
const scr = new Screen();
const loc = new Location();
const hist = new History();

[
  ["window", win], ["self", win], ["top", win],
  ["document", doc], ["navigator", nav], ["screen", scr],
  ["location", loc], ["history", hist],
  ["XMLHttpRequest", XMLHttpRequest], ["EventSource", EventSource],
  ["Storage", Storage],
  ["localStorage", ls], ["sessionStorage", ss],
  ["Image", function () { this.width = 0; this.height = 0; }],
  ["Audio", function () { this.play = () => {}; }],
].forEach(([k, v]) => { win[k] = v; global[k] = v; });
doc.location = loc;

// 全局工具
global.chrome = {
  runtime: {}, app: { isInstalled: false }, webstore: {},
  csi: () => ({ startE: Date.now() }),
  loadTimes: () => ({ requestTime: Date.now() / 1000, navigationType: "Other" }),
};
global.Intl = { DateTimeFormat: function () { return { resolvedOptions: () => ({ locale: "zh-CN", timeZone: "Asia/Shanghai" }) }; } };

// Event helpers
global.addEventListener = function (evt, fn) { if (evt === "DOMContentLoaded") setTimeout(fn, 100); };
global.removeEventListener = function () {};
global.ProgressEvent = function () {};

// fetch — 真正 HTTP
const _https = _require("https");
global.fetch = function (url, init) {
  init = init || {};
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      _https.get({
        hostname: u.hostname, path: u.pathname + u.search,
        headers: Object.assign({ "User-Agent": "Mozilla/5.0", Referer: "https://www.toutiao.com/" }, init.headers || {}),
      }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({
          status: res.statusCode, ok: res.statusCode < 400,
          headers: res.headers,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data || "{}")),
        }));
      }).on("error", reject);
    } catch (e) { reject(e); }
  });
};

// 导出
module.exports = { globalEval };
