/**
 * Internal: DEBUG_PROXY 指纹扫描器
 * 运行: DEBUG_PROXY=true node 今日头条/v1.0/_debug_scan.js
 */
const _require = require, _fs = _require("fs"), _path = _require("path"), _vm = _require("vm"), _process = process;
const __dir = __dirname;
function globalEval(c) { _vm.runInThisContext(c); }

// ── Custom collector ──
const _seen = new Set(), _undef = new Set(), _values = {};
const skip = new Set(["prototype", "constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "toJSON", "toLocaleString", "isPrototypeOf", "propertyIsEnumerable", "call", "apply", "bind", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__", "inspect", "customInspect"]);

function createHandler(objName) {
  return {
    get(target, prop, receiver) {
      if (typeof prop === "symbol") return Reflect.get(target, prop, receiver);
      if (skip.has(prop)) return Reflect.get(target, prop, receiver);
      const value = Reflect.get(target, prop, receiver);
      const fullKey = objName + "." + prop;
      _seen.add(fullKey);
      if (value === undefined) _undef.add(fullKey);
      else if (typeof value !== "function") _values[fullKey] = typeof value === "object" ? JSON.stringify(value).substring(0, 120) : String(value).substring(0, 120);
      if (objName === "window" && typeof value === "function" && !(value.prototype && value.prototype.constructor === value)) return value.bind(target);
      return value;
    },
    set(target, prop, value) {
      if (typeof prop !== "symbol") _seen.add(objName + "." + prop + " (set)");
      return Reflect.set(target, prop, value);
    },
  };
}
function watch(obj, name) {
  if (typeof obj !== "object" && typeof obj !== "function") return obj;
  return new Proxy(obj, createHandler(name));
}

// ── Load env_patch ──
const { setupEnv } = _require("../../.claude/env-patch/env_patch.js");
setupEnv({
  url: "https://www.toutiao.com/",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  platform: "Win32", languages: ["zh-CN", "zh"], screenWidth: 1920, screenHeight: 1080,
  canvas: true, webgl: true, plugins: true, storage: true, extraConstructors: true, crypto: true,
  windowToGlobal: true,
});
global.crypto = _require("crypto").webcrypto;

// ── Toutiao-specific env stubs ──
Object.defineProperty(document, "currentScript", { get: function () { return { src: "https://lf-security.bytegoofy.com/obj/security-secsdk/runtime_bundler_52.js", getAttribute: function () { return null; } }; }, configurable: true });
document.writeln = function () {};
navigator.sendBeacon = function () { return true; };
if (typeof global.PerformanceObserver === "undefined") { global.PerformanceObserver = function () {}; global.PerformanceObserver.prototype = { observe: function () {}, disconnect: function () {}, takeRecords: function () { return []; } }; }
if (typeof global.Request === "undefined") { global.Request = function (i, init) { this.url = typeof i === "string" ? i : i.url; this.method = (init && init.method) || "GET"; this.headers = init && init.headers ? init.headers : {}; this.body = init && init.body ? init.body : null; }; }
if (typeof global.Response === "undefined") { global.Response = function (b, init) { this.body = b; this.status = (init && init.status) || 200; }; global.Response.prototype.json = function () { return Promise.resolve(JSON.parse(this.body)); }; global.Response.prototype.text = function () { return Promise.resolve(this.body); }; }
if (typeof global.Headers === "undefined") { global.Headers = function (init) { this._h = {}; if (init) Object.assign(this._h, init); }; global.Headers.prototype.get = function (k) { return this._h[k]; }; global.Headers.prototype.set = function (k, v) { this._h[k] = v; }; }
if (typeof global.MutationObserver === "undefined") { global.MutationObserver = function () {}; global.MutationObserver.prototype = { observe: function () {}, disconnect: function () {} }; }

// ── Wrap ──
global.window = watch(global.window, "window");
global.document = watch(global.document, "document");
global.navigator = watch(global.navigator, "navigator");
global.location = watch(global.location, "location");
global.screen = watch(global.screen, "screen");

// ── SDK interceptor ──
let _bogus = null;
global.fetch = function (url) {
  if (typeof url === "string") { const m = url.match(/a_bogus=([^&#]+)/); if (m) _bogus = decodeURIComponent(m[1]); }
  return Promise.resolve({ status: 200, ok: true, headers: new Map(), text: function () { return Promise.resolve("{}"); }, json: function () { return Promise.resolve({}); } });
};

// ── Load SDK ──
_process.stderr.write("[scan] Loading SDK...\n");
globalEval(_fs.readFileSync(_path.join(__dir, "acrawler.js"), "utf-8"));
window.byted_acrawler.init({ aid: 24, dfp: true });
globalEval(_fs.readFileSync(_path.join(__dir, "sdk-glue.js"), "utf-8"));
globalEval(_fs.readFileSync(_path.join(__dir, "bdms.js"), "utf-8"));
window._SdkGlueInit({ self: { aid: 24, pageId: 6457 }, bdms: { aid: 24, pageId: 6457, paths: ["/api/pc/list/feed", "/api/pc/list/user/feed"] } });
globalEval(_fs.readFileSync(_path.join(__dir, "runtime_bundler.js"), "utf-8"));

// ── Trigger ──
global.fetch("https://www.toutiao.com/api/pc/list/feed?channel_id=3189398972&max_behot_time=0&category=pc_profile_channel&aid=24&app_name=toutiao_web", { method: "GET" });

// ── Report ──
console.log("\n=== FINGERPRINT REPORT ===");
console.log("A_BOGUS:", _bogus ? _bogus.substring(0, 50) + "..." : "NONE");
console.log("TOTAL ACCESSED:", _seen.size, "UNDEFINED:", _undef.size);
console.log("\n--- UNDEFINED ---");
Array.from(_undef).sort().forEach(function (k) { console.log("  " + k); });
console.log("\n--- CAPTURED VALUES ---");
Object.entries(_values).sort().forEach(function (e) { console.log("  " + e[0] + " = " + e[1]); });
console.log("\n--- ALL ACCESSED ---");
Array.from(_seen).sort().forEach(function (k) { console.log("  " + k); });
