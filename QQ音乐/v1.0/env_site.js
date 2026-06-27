/**
 * env_site.js — QQ音乐 浏览器环境补丁
 *
 * 基于 .claude/env-patch/env_patch.js 通用框架。
 */

const _require = require;
const { setupEnv } = _require("../../.claude/env-patch/env_patch.js");

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

  // 字节码 VM 要求 window !== global
  windowToGlobal: false,
});

// 替换为 Node.js 原生 Web Crypto（加解密需要真实实现）
const nodeWebCrypto = _require("crypto").webcrypto;
global.crypto = nodeWebCrypto;
global.window.crypto = nodeWebCrypto;
