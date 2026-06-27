/**
 * env_site.js — 小红书 浏览器环境补丁
 *
 * env_patch 底座 + env.js 叠加。
 * env_patch 提供标准化的 Object.create 原型链基础环境，
 * env.js 补上小红书 VMP 特有的 watch Proxy / set_native / setter 拦截。
 */

const _require = require;
const { setupEnv } = _require("../../.claude/env-patch/env_patch.js");

// ═══════════════════════════════════════════════════════════════
// 1. 通用环境（env_patch 底座）
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://www.xiaohongshu.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  platform: "Win32",
  languages: ["zh-CN", "zh"],
  screenWidth: 1920,
  screenHeight: 1080,
  title: "小红书",
  canvas: true,
  webgl: false,
  plugins: false,
  storage: false,
  extraConstructors: true,
  crypto: true,
  windowToGlobal: true,
});

global.crypto = _require("crypto").webcrypto;

// ═══════════════════════════════════════════════════════════════
// 2. 小红书特有细节（叠加 env.js）
// ═══════════════════════════════════════════════════════════════
_require("./env");
