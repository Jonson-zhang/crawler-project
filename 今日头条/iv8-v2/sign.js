/**
 * sign.js — 今日头条 a_bogus 签名 (旧版 SDK 02_code.js)
 *
 * Node.js 直接运行。env_patch 约 200 行，02_code.js 605KB。
 * 暴露 window.bogus._u()，直接调用生成 a_bogus (168 chars)。
 *
 * 用法:
 *   node sign.js "url_encoded_params_string"
 *   输出: JSON { a_bogus: "...", length: 168 }
 */

const _process = process;
const _require = require;
const _fs = _require("fs");

// ═══════════════════════════════════════════════════════════════
// 浏览器环境 (对齐 mycode/01_env.js)
// ═══════════════════════════════════════════════════════════════

function safeFunction(fn, name) {
  Object.defineProperty(fn, "toString", {
    value: () => "function " + (name || fn.name || "") + "() { [native code] }",
  });
  return fn;
}

function Window() {}
safeFunction(Window, "Window");
Object.defineProperties(Window.prototype, {
  innerWidth: { value: 1920 }, innerHeight: { value: 1080 },
  outerWidth: { value: 1936 }, outerHeight: { value: 1112 },
  screenX: { value: 0 }, screenY: { value: 0 },
  pageXOffset: { value: 0 }, pageYOffset: { value: 0 },
  devicePixelRatio: { value: 1.25 },
  clientWidth: { get: () => 1920 }, clientHeight: { get: () => 1080 },
  sizeWidth: { get: () => 1920 }, sizeHeight: { get: () => 1080 },
});
Window.prototype.requestAnimationFrame = safeFunction((cb) =>
  setTimeout(() => cb(Date.now()), 16),
);

function Storage() { this._data = {}; }
safeFunction(Storage, "Storage");
Storage.prototype.getItem = safeFunction(function (k) {
  return this._data[String(k)] !== undefined ? this._data[String(k)] : null;
}, "getItem");
Storage.prototype.setItem = safeFunction(function (k, v) { this._data[String(k)] = String(v); }, "setItem");
Storage.prototype.removeItem = safeFunction(function (k) { delete this._data[String(k)]; }, "removeItem");
Storage.prototype.clear = safeFunction(function () { this._data = {}; }, "clear");
Object.defineProperty(Storage.prototype, "length", { get() { return Object.keys(this._data).length; } });
Storage.prototype.key = safeFunction(function (n) { return Object.keys(this._data)[n] || null; }, "key");

const _ls = new Storage();
const _ss = new Storage();

function Document() {}
safeFunction(Document, "Document");
Document.prototype[Symbol.toStringTag] = "HTMLDocument";
let _cookieStore = "";
Object.defineProperty(Document.prototype, "cookie", {
  get() { return _cookieStore; },
  set(v) { if (v) _cookieStore = _cookieStore ? _cookieStore + "; " + v : v; },
  configurable: true,
});
Document.prototype.createElement = safeFunction((tag) => {
  if (tag === "span") return { classList: [] };
  return { tagName: tag.toUpperCase(), style: {}, attributes: {} };
}, "createElement");
Document.prototype.createEvent = safeFunction((type) => ({
  type,
  initEvent: safeFunction((t, b, c) => { this.type = t; this.bubbles = !!b; this.cancelable = !!c; }, "initEvent"),
}), "createEvent");

// document.all — callable HTMLAllCollection
function HTMLAllCollection() {}
safeFunction(HTMLAllCollection, "HTMLAllCollection");
const _all = new HTMLAllCollection();
_all[Symbol.toPrimitive] = (hint) => hint === "number" ? 0 : undefined;
_all.length = 1;
_all[0] = { tagName: "HTML" };
Document.prototype.all = new Proxy(safeFunction((sel) => [], "all"), {
  get(_, prop) { return prop in _all ? _all[prop] : undefined; },
});

const _docEl = { tagName: "HTML", style: {} };
const _body = { tagName: "BODY", style: {}, clientWidth: 1920, clientHeight: 1080 };
Document.prototype.documentElement = _docEl;
Document.prototype.body = _body;
Document.prototype.referrer = "";

function Navigator() {}
safeFunction(Navigator, "Navigator");
Navigator.prototype[Symbol.toStringTag] = "Navigator";
Object.defineProperties(Navigator.prototype, {
  userAgent: { get: () => "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36" },
  platform: { value: "Win32" }, vendor: { value: "Google Inc." },
  language: { value: "zh-CN" }, languages: { value: ["zh-CN", "zh"] },
  hardwareConcurrency: { value: 8 }, deviceMemory: { value: 8 },
  maxTouchPoints: { value: 0 }, webdriver: { value: false },
  plugins: { value: [
    { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "Portable Document Format" },
    { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "Portable Document Format" },
    { name: "Native Client", filename: "internal-nacl-plugin" },
  ]},
  mimeTypes: { value: [{ type: "application/pdf", suffixes: "pdf" }] },
  userAgentData: { value: { platform: "Windows", brands: [{ brand: "Chromium", version: "143" }], mobile: false }, configurable: true },
  connection: { value: { effectiveType: "4g", rtt: 50, downlink: 10, saveData: false }, configurable: true },
});

function Screen() {}
safeFunction(Screen, "Screen");
Screen.prototype[Symbol.toStringTag] = "Screen";
Object.defineProperties(Screen.prototype, {
  width: { value: 1920 }, height: { value: 1080 },
  availWidth: { value: 1920 }, availHeight: { value: 1040 },
  colorDepth: { value: 24 }, pixelDepth: { value: 24 },
  orientation: { value: { type: "landscape-primary", angle: 0 } },
});

function Location() { this._url = new URL("https://www.toutiao.com/"); }
safeFunction(Location, "Location");
["href", "protocol", "host", "hostname", "pathname", "search", "hash"].forEach((p) => {
  Object.defineProperty(Location.prototype, p, {
    get() { return this._url[p]; },
    set(v) { try { this._url[p] = String(v); } catch (_) {} },
    configurable: true,
  });
});
Object.defineProperty(Location.prototype, "origin", { get() { return this._url.origin; }, configurable: true });
Location.prototype.toString = safeFunction(function () { return this.href; }, "toString");

function History() {}
safeFunction(History, "History");

function EventSource(url) { this.url = url; this.readyState = 0; setTimeout(() => { this.readyState = 1; }, 0); }
safeFunction(EventSource, "EventSource");

function XMLHttpRequest() { this.readyState = 0; this.status = 0; this.responseText = ""; this.onreadystatechange = null; }
safeFunction(XMLHttpRequest, "XMLHttpRequest");
XMLHttpRequest.prototype.open = safeFunction(function () { this.readyState = 1; }, "open");
XMLHttpRequest.prototype.send = safeFunction(function () { this.readyState = 4; this.status = 200; if (this.onreadystatechange) this.onreadystatechange(); }, "send");

// ═══════════════════════════════════════════════════════════════
// 实例化 & 挂载
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
  ["localStorage", _ls], ["sessionStorage", _ss],
  ["XMLHttpRequest", XMLHttpRequest], ["EventSource", EventSource],
].forEach(([k, v]) => { win[k] = v; global[k] = v; });
doc.location = loc;

global.chrome = { runtime: {}, app: { isInstalled: false }, loadTimes: () => ({ navigationType: "Other" }), csi: () => ({ startE: Date.now() }) };
global.Intl = { DateTimeFormat: function () { return { resolvedOptions: () => ({ locale: "zh-CN", timeZone: "Asia/Shanghai" }) }; } };

// ═══════════════════════════════════════════════════════════════
// 加载旧版 SDK
// ═══════════════════════════════════════════════════════════════
const vm = _require("vm");
vm.runInThisContext(_fs.readFileSync(__dirname + "/02_code.js", "utf-8"));

if (typeof global.bogus !== "function" || typeof global.bogus._u !== "function") {
  _process.stderr.write("ERROR: window.bogus._u not found\n");
  _process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// a_bogus 生成
// ═══════════════════════════════════════════════════════════════
function a_bogus(queryStr) {
  const r = global.bogus._v;
  const args = [0, 1, 8, queryStr, "", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"];
  return global.bogus._u(r[0], args, r[1], r[2], null);
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════
const queryStr = _process.argv[2] || "";
if (queryStr) {
  const ab = a_bogus(queryStr);
  _process.stdout.write(JSON.stringify({ a_bogus: ab, length: ab.length }) + "\n");
}
