/**
 * sign.js — 欧冶钢材网 瑞数挑战求解器
 *
 * Python 唯一调用的 JS 文件。
 *
 * 功能:
 *   1. 接收 202 挑战数据（$_ts.cd + $_ts.nsd）
 *   2. 创建补环境
 *   3. 加载瑞数引擎 JS 执行挑战
 *   4. 返回生成的 Cookie
 *
 * 输入: stdin 接收 JSON（cd, nsd, meta, ruishuJsUrl）
 * 输出: stdout 输出 JSON（cookies, solved, error）
 *
 * 用法: echo '{"cd":"...","nsd":44721}' | node sign.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

// ── 加载补环境框架 ──
const { setupEnv } = require(
  path.join(__dirname, "../../.claude/env-patch/env_patch.js")
);

// ── 读取输入 ──
let input = { cd: "", nsd: 0, meta: "" };
try {
  const raw = fs.readFileSync("/dev/stdin", "utf-8").trim();
  if (raw) Object.assign(input, JSON.parse(raw));
} catch {
  // 非管道模式，使用 202_fresh.html
  try {
    const html = fs.readFileSync(
      path.join(__dirname, "202_fresh.html"),
      "utf-8"
    );
    const nsdMatch = html.match(/nsd=(\d+)/);
    input.nsd = nsdMatch ? parseInt(nsdMatch[1]) : 0;
    const cdStart = html.indexOf('$_ts.cd="') + 9;
    const cdEnd = html.indexOf('"', cdStart);
    input.cd = html.substring(cdStart, cdEnd);
  } catch (e) {
    console.error("无法读取输入:", e.message);
    process.exit(1);
  }
}

// ── 初始化补环境 ──
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

// ── Firefox 特有属性 ──
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

// ── 捕获 document.cookie ──
const _capturedCookies = {};
Object.defineProperty(document.constructor.prototype, "cookie", {
  get() {
    return Object.entries(_capturedCookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  },
  set(v) {
    if (!v || !v.includes("=")) return;
    const [key, ...rest] = v.split("=");
    const name = key.trim();
    const val = rest.join("=").split(";")[0].trim();
    if (name && val) _capturedCookies[name] = val;
  },
  configurable: true,
  enumerable: true,
});

// ── 捕获 XHR ──
const _capturedXhrs = [];
const OrigOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function () {
  _capturedXhrs.push({ method: arguments[0], url: arguments[1] });
  return OrigOpen.apply(this, arguments);
};

// ── 初始化 $_ts ──
globalThis.$_ts = {
  cd: input.cd,
  nsd: input.nsd,
  scj: 0,
  aebi: 0,
};

// ── 执行瑞数 JS ──
const results = {
  cookies: {},
  solved: false,
  xhrs: [],
  error: null,
  ts_cd: null,
  execution_time: 0,
};

try {
  const ruishuJsPath = path.join(__dirname, "ruishu_fresh.js");
  const ruishuJs = fs.readFileSync(ruishuJsPath, "utf-8");

  const startTime = Date.now();

  // 在全局上下文中执行（没有 vm 隔离，环境直接注入了 globalThis）
  eval(ruishuJs);

  results.execution_time = Date.now() - startTime;
  results.cookies = { ..._capturedCookies };
  results.xhrs = _capturedXhrs;
  results.solved = globalThis.__challengeSolved || false;
  results.ts_cd = globalThis.$_ts ? globalThis.$_ts.cd : null;
} catch (e) {
  results.error = `${e.message}\n${(e.stack || "").split("\n").slice(0, 5).join("\n")}`;
}

// ── 输出结果 ──
process.stdout.write(JSON.stringify(results, null, 2));
