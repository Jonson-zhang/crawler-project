/**
 * test_ruishu.js — 测试瑞数 JS 在 env_patch 环境中的执行
 *
 * 用法: cd h:/Crawler && node 欧冶/test_ruishu.js
 */

const path = require("path");
const fs = require("fs");

// ── 1. 加载补环境框架 ──
const { setupEnv, sn, mf, mc, watch } = require(
  path.join(__dirname, "../.claude/env-patch/env_patch.js")
);

// ── 2. 读取 202 挑战数据 ──
const html = fs.readFileSync(
  path.join(__dirname, "202_fresh.html"),
  "utf-8"
);

// 提取 nsd
const nsdMatch = html.match(/nsd=(\d+)/);
const nsd = nsdMatch ? parseInt(nsdMatch[1]) : 0;

// 提取 cd
const cdStart = html.indexOf('$_ts.cd="') + 9;
const cdEnd = html.indexOf('"', cdStart);
const cd = html.substring(cdStart, cdEnd);

console.log(`[INFO] nsd=${nsd}, cd.length=${cd.length}`);

// ── 3. 初始化浏览器环境 ──
setupEnv({
  url: "https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
  platform: "Win32",
  languages: ["zh-CN", "zh"],
  screenWidth: 1920,
  screenHeight: 1080,
  colorDepth: 24,
  devicePixelRatio: 1,
  hardwareConcurrency: 8,
  maxTouchPoints: 0,
  vendor: "",
  title: "搜全站-欧冶",
  canvas: true,
  webgl: false,
  plugins: true,
  storage: true,
  extraConstructors: true,
  crypto: true,
  windowToGlobal: true,
});

console.log("[INFO] env_patch 初始化完成");

// ── 4. Firefox 特有属性覆盖 ──
Object.defineProperty(Navigator.prototype, "vendor", {
  get: () => "",
  configurable: true,
  enumerable: true,
});

Object.defineProperty(Navigator.prototype, "oscpu", {
  get: () => "Windows NT 10.0; Win64; x64",
  configurable: true,
  enumerable: true,
});

Object.defineProperty(Navigator.prototype, "buildID", {
  get: () => "20250101000000",
  configurable: true,
  enumerable: true,
});

Object.defineProperty(Navigator.prototype, "doNotTrack", {
  get: () => "unspecified",
  configurable: true,
  enumerable: true,
});

Object.defineProperty(Navigator.prototype, "productSub", {
  get: () => "20100101",
  configurable: true,
  enumerable: true,
});

// document.cookie 劫持
const _cookies = {};
Object.defineProperty(document.constructor.prototype, "cookie", {
  get() {
    return Object.entries(_cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  },
  set(v) {
    if (!v || !v.includes("=")) return;
    const key = v.split("=")[0].trim();
    const val = v.split(";")[0].split("=").slice(1).join("=").trim();
    if (key && val) _cookies[key] = val;
    globalThis.__cookies = { ..._cookies };
  },
  configurable: true,
  enumerable: true,
});

// 捕获 XHR 请求（用于 callback 拦截）
const _capturedUrls = [];
const OrigOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function () {
  _capturedUrls.push({
    method: arguments[0],
    url: arguments[1],
    async: arguments[2] !== false,
    ts: Date.now(),
  });
  return OrigOpen.apply(this, arguments);
};

// ── 5. 初始化 $_ts ──
globalThis.$_ts = {
  cd: cd,
  nsd: nsd,
  scj: 0,
  aebi: 0,
};

// 劫持 $_ts.lcd setter
let _lcdFn = null;
let _challengeSolved = false;

Object.defineProperty(globalThis.$_ts, "lcd", {
  get() {
    return _lcdFn;
  },
  set(fn) {
    _lcdFn = fn;
    console.log("[HOOK] $_ts.lcd 已设置");
  },
  configurable: true,
  enumerable: true,
});

globalThis.__cookies = {};
globalThis.__challengeResult = null;

console.log("[INFO] $_ts 初始化完成");
console.log("[INFO] 开始执行瑞数 JS...");

// ── 6. 执行瑞数 JS ──
const ruishuJs = fs.readFileSync(
  path.join(__dirname, "ruishu_fresh.js"),
  "utf-8"
);

try {
  const startTime = Date.now();
  eval(ruishuJs);
  const elapsed = Date.now() - startTime;
  console.log(`[INFO] 瑞数 JS 执行完成 (${elapsed}ms)`);
  console.log(`[INFO] $_ts keys: ${Object.keys(globalThis.$_ts).join(", ")}`);
  console.log(`[INFO] Cookies: ${JSON.stringify(globalThis.__cookies)}`);
  console.log(
    `[INFO] Captured XHRs: ${JSON.stringify(_capturedUrls, null, 2)}`
  );
} catch (e) {
  console.log(`[ERROR] ${e.message}`);
  console.log(`[ERROR] Stack: ${(e.stack || "").split("\n").slice(0, 5).join("\n")}`);
  // Show what properties were being accessed
  if (e.message.includes("Cannot read properties of undefined")) {
    const match = e.message.match(/reading '(\w+)'/);
    if (match) {
      console.log(`[HELP] 缺少的属性: ${match[1]}`);
    }
  }
}
