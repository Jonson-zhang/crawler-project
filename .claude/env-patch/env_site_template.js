/**
 * env_site.js — <站点名> 浏览器环境补丁
 *
 * 从 .claude/env-patch/env_site_template.js 复制 → 改两处即可用。
 * 不要改 env_patch.js，所有站点差异都写在这里。
 *
 * 用法: 在你的 sign.js / api.js 第一行 require("./env_site");
 *
 * 详细文档: .claude/env-patch/README.md
 */

const _require = require;
const { setupEnv, sn, mf, mc } = _require("../.claude/env-patch/env_patch.js");

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

// --- 常用: 覆盖 Navigator 属性 ---
// navigator.hardwareConcurrency = 8;
// navigator.deviceMemory = 8;

// --- 复杂覆盖: 放到独立文件 ---
// require("./env_tweaks");
