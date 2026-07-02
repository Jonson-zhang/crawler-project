/**
 * env_site.js — QQ音乐 sdenv 环境补丁
 *
 * 加载 env_patch 框架的 safeFunction 机制，覆盖 Function.prototype.toString
 * 使所有浏览器 API 函数的 toString() 返回 [native code]，
 * VMP 模块通过此检测环境真实性。
 */

const _require = require;
const { setupEnv } = _require("../../../.claude/env-patch/env_patch.js");

setupEnv({
  url: "https://y.qq.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  platform: "Win32",
  screenWidth: 1920,
  screenHeight: 1080,
  colorDepth: 24,
  title: "QQ音乐",
  cookie: "",
  hardwareConcurrency: 16,

  canvas: true,
  webgl: false,
  plugins: false,
  storage: false,
  extraConstructors: true,
  crypto: true,

  // sdenv 提供 window，env_patch 补 safeFunction 即可
  windowToGlobal: false,
});

// 替换为 Node.js 原生 Web Crypto（加解密需要真实实现）
const nodeWebCrypto = _require("crypto").webcrypto;
global.crypto = nodeWebCrypto;
global.window.crypto = nodeWebCrypto;
