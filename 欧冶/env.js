/**
 * env.js — 欧冶钢材网 补环境模块
 *
 * 基于 .claude/env-patch/env_patch.js 框架构建。
 * 用于在 Node.js vm 沙箱中模拟浏览器环境，执行瑞数 JS。
 *
 * 架构:
 *   env.js       — 补环境配置
 *   sign.js      — 瑞数挑战求解（Python 唯一调用的 JS 文件）
 *   main.py      — Python 入口（HTTP + 子进程调度）
 *
 * 工作流:
 *   main.py → HTTP 获取 202 挑战 → 提取 $_ts.cd / $_ts.nsd / meta
 *          → subprocess sign.js → 补环境执行瑞数 JS
 *          → 获取 Cookie → HTTP 验证 → HTTP API 查询
 */

const path = require("path");

// ── 加载通用补环境框架 ──
const _require = require;
const { setupEnv, sn, mf, mc, watch } = _require(
  _require("path").join(__dirname, "../../.claude/env-patch/env_patch.js")
);

/**
 * 初始化补环境
 *
 * @param {Object} options
 * @param {string} options.url        - 页面 URL
 * @param {string} options.userAgent  - User-Agent
 * @param {string} options.platform   - navigator.platform
 * @param {number} options.nsd        - $_ts.nsd 值（从 202 响应中提取）
 * @param {string} options.cd         - $_ts.cd 值（从 202 响应中提取）
 * @param {string} options.meta       - <meta content> 值（从 202 响应中提取）
 * @returns {Object} 创建的浏览器对象引用
 */
function initEnv(options = {}) {
  const {
    url = "https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50",
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    platform = "Win32",
    nsd = 0,
    cd = "",
    meta = "",
  } = options;

  // ── 1. 基础配置 ──
  setupEnv({
    url,
    userAgent,
    platform,
    languages: ["zh-CN", "zh"],
    screenWidth: 1920,
    screenHeight: 1080,
    colorDepth: 24,
    devicePixelRatio: 1,
    hardwareConcurrency: 8,
    maxTouchPoints: 0,
    vendor: "",           // Firefox 的 vendor 是空字符串
    cookie: "",
    title: "搜全站-欧冶",
    canvas: true,
    webgl: false,
    plugins: true,
    storage: true,
    extraConstructors: true,
    crypto: true,
    windowToGlobal: true,  // 瑞数需要 window === global
  });

  // ── 2. 站点特有覆盖 ──

  // Firefox 特有: navigator.vendor = ""
  Object.defineProperty(Navigator.prototype, "vendor", {
    get: () => "",
    configurable: true,
    enumerable: true,
  });

  // Firefox 特有: navigator.oscpu
  Object.defineProperty(Navigator.prototype, "oscpu", {
    get: () => "Windows NT 10.0; Win64; x64",
    configurable: true,
    enumerable: true,
  });

  // Firefox 特有: navigator.buildID
  Object.defineProperty(Navigator.prototype, "buildID", {
    get: () => "20250101000000",
    configurable: true,
    enumerable: true,
  });

  // Firefox 特有: navigator.doNotTrack
  Object.defineProperty(Navigator.prototype, "doNotTrack", {
    get: () => "unspecified",
    configurable: true,
    enumerable: true,
  });

  // Firefox 特有: navigator.productSub
  Object.defineProperty(Navigator.prototype, "productSub", {
    get: () => "20100101",
    configurable: true,
    enumerable: true,
  });

  // document.cookie 劫持（捕获瑞数设置的 cookie）
  const _cookies = {};
  Object.defineProperty(document.constructor.prototype, "cookie", {
    get() {
      return Object.entries(_cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    set(v) {
      if (!v || !v.includes("=")) return;
      const [name, ...rest] = v.split("=");
      const key = name.trim();
      const val = rest.join("=").split(";")[0].trim();
      if (key && val) _cookies[key] = val;
      // 同时也保存到全局
      if (typeof globalThis.__capturedCookies === "undefined") {
        globalThis.__capturedCookies = {};
      }
      globalThis.__capturedCookies[key] = val;
    },
    configurable: true,
    enumerable: true,
  });

  // ── 3. $_ts 初始化（瑞数全局对象）──
  if (cd) {
    globalThis.$_ts = {
      cd: cd,
      nsd: nsd,
      scj: 0,
      aebi: 0,
    };

    // 劫持 lcd 回调（瑞数挑战完成时触发）
    // 当 RuiShu 设置 $_ts.lcd = function(){...} 时，
    // 我们替换它来捕获 challenge 完成信号
    Object.defineProperty(globalThis.$_ts, "lcd", {
      get() {
        return globalThis.__$_lcd;
      },
      set(fn) {
        globalThis.__$_lcd = fn;
        globalThis.__challengeSolved = false;
        // 包装原始函数，在调用时标记完成
        if (typeof fn === "function") {
          const orig = fn;
          globalThis.__$_lcd = function () {
            try {
              return orig.apply(this, arguments);
            } finally {
              globalThis.__challengeSolved = true;
            }
          };
        }
      },
      configurable: true,
      enumerable: true,
    });
  }

  // ── 4. 捕获 XHR/Fetch（瑞数用它们做回调）──
  const _capturedRequests = [];

  // 劫持 XMLHttpRequest
  const OrigXHR = globalThis.XMLHttpRequest || XMLHttpRequest;
  globalThis.__xhrRequests = [];

  // 劫持 fetch
  globalThis.__fetchRequests = [];

  // ── 5. Cookie 存储（python 侧通过此变量读取）──
  globalThis.__capturedCookies = {};
  globalThis.__ruishuSolved = false;

  // 返回环境对象引用
  return {
    window: globalThis,
    document,
    navigator,
    location,
    screen,
    history,
    $_ts: globalThis.$_ts,
    capturedCookies: globalThis.__capturedCookies,
  };
}

/**
 * 在补环境中运行瑞数 JS
 *
 * @param {string} ruishuJsCode  - 瑞数 JS 源码
 * @param {Object} env           - initEnv 返回的环境对象
 * @param {number} timeoutMs     - 超时时间（毫秒）
 * @returns {Object} 执行结果 { cookies, solved, error }
 */
function runRuishu(ruishuJsCode, env, timeoutMs = 10000) {
  // 清空之前的捕获
  globalThis.__capturedCookies = {};
  globalThis.__ruishuSolved = false;

  try {
    // 在全局上下文中执行瑞数 JS
    const runCode = `
      (function() {
        try {
          ${ruishuJsCode}
          return { success: true, error: null };
        } catch(e) {
          return { success: false, error: e.message || String(e) };
        }
      })()
    `;

    const result = eval(runCode);

    return {
      cookies: { ...(globalThis.__capturedCookies || {}) },
      solved: globalThis.__ruishuSolved === true,
      ts_cd: globalThis.$_ts ? globalThis.$_ts.cd : null,
      result,
    };
  } catch (e) {
    return {
      cookies: { ...(globalThis.__capturedCookies || {}) },
      solved: false,
      error: e.message || String(e),
    };
  }
}

module.exports = {
  initEnv,
  runRuishu,
};
