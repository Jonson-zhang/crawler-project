/**
 * env_site.js — <站点名> 浏览器环境补丁
 *
 * 从 .claude/env-patch/env_site_template.js 复制 → 改两处即可用。
 * 不要改 env_patch.js，所有站点差异都写在这里。
 *
 * 用法: 在你的 sign.js / api.js 第一行 require("./env_site");
 *
 * 详细文档: .claude/env-patch/README.md
 *
 * ══ 二阶段补环境工作流 ══
 *
 *   阶段 1 — 发现:
 *     DEBUG_PROXY=true node your_script.js
 *     → 运行时实时日志（get / set / undefined 警告）
 *     → 退出时自动打印「📋 补丁代码」报告
 *
 *   阶段 2 — 补全:
 *     → 复制报告中的补丁代码
 *     → 粘贴到下方「站点特有覆盖」区域
 *     → 重跑验证
 *     → 重复直到签名成功 + 🔴 未知属性清零
 */

const _require = require;
const { setupEnv, sn, mf, mc, watch } = _require("../.claude/env-patch/env_patch.js");

// ═══════════════════════════════════════════════════════════════
// 1. 站点配置
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://www.example.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  platform: "Win32",
  languages: ["zh-CN", "zh"],
  screenWidth: 1920,
  screenHeight: 1080,
  title: "站点标题",

  // 按需开关
  canvas: true,
  webgl: false,
  plugins: false,
  storage: false,
  extraConstructors: true,
  crypto: true,

  // window !== global 时字节码 VM 类型检测更宽松
  // 如果 VMP 签名结果为 undefined，试试切换这个值
  windowToGlobal: false,
});

// ═══════════════════════════════════════════════════════════════
// 2. 站点特有覆盖
// ═══════════════════════════════════════════════════════════════

// --- 调试: Proxy 监控（环境属性缺失排查用）---
// 当站点 JS 报 "xxx is not defined" 或签名结果为 undefined 时，
// 开启此项可拦截所有环境对象 get/set 并输出日志。
// 启用: set DEBUG_PROXY=true   (Windows CMD)
//       $env:DEBUG_PROXY="true" (PowerShell)
//       DEBUG_PROXY=true node ... (Linux/Mac/Git Bash)
//
// const { watch: dbgWatch } = require("../../.claude/env-patch/debug-proxy.js");
// global.window    = dbgWatch(global.window,    "window");
// global.document  = dbgWatch(global.document,  "document");
// global.navigator = dbgWatch(global.navigator, "navigator");
// global.location  = dbgWatch(global.location,  "location");
// global.screen    = dbgWatch(global.screen,    "screen");
// global.history   = dbgWatch(global.history,   "history");

// --- 常用: 替换 crypto 为 Node.js 原生 Web Crypto ---
const nodeWebCrypto = _require("crypto").webcrypto;
global.crypto = nodeWebCrypto;
global.window.crypto = nodeWebCrypto;

// --- 常用: 补 document.cookie ---
// Object.defineProperty(document.constructor.prototype, "cookie", {
//   get() { return "key1=val1; key2=val2;"; },
//   set(v) {},
//   configurable: true, enumerable: true,
// });

// --- VMP 签名结果为 undefined 时，给 window 加 Proxy 包装 ---
// global.window = watch(global.window, "window");

// --- 常用: 覆盖 Navigator 属性 ---
// navigator.hardwareConcurrency = 8;
// navigator.deviceMemory = 8;

// --- 复杂覆盖: 放到独立文件 ---
// require("./env_tweaks");
