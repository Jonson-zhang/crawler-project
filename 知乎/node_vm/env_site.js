/**
 * env_site.js — 知乎 浏览器环境补丁
 *
 * 纯 env_patch 底座。知乎无 VMP，无原型链检测，最轻量。
 * 替代原 env.js 的 vm.createContext + 手动 POJO 沙箱。
 */

const _require = require;
const fs = _require("fs");
const path = _require("path");
const { setupEnv } = _require("../../.claude/env-patch/env_patch.js");

// ═══════════════════════════════════════════════════════════════
// 通用环境
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://www.zhihu.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  platform: "Win32",
  languages: ["zh-CN"],
  screenWidth: 1920,
  screenHeight: 1080,
  title: "知乎",
  canvas: false,  // 知乎 encrypt 对 canvas 做黑盒操作，需返回 POJO
  webgl: false,
  plugins: false,
  storage: false,
  extraConstructors: false,
  crypto: true,
  windowToGlobal: true,
});

global.crypto = _require("crypto").webcrypto;

// ═══════════════════════════════════════════════════════════════
// 加载 webpack chunk
// ═══════════════════════════════════════════════════════════════

// self 指向 global（runtime.js 用 self.webpackChunkheifetz）
global.self = global;

// 1. runtime.js — 打补丁暴露 __wp
let rt = fs.readFileSync(path.join(__dirname, "runtime.js"), "utf-8");
rt = rt.replace(
  /u\.push=s\.bind\(null,u\.push\.bind\(u\)\)\}/,
  'u.push=s.bind(null,u.push.bind(u));globalThis.__wp=p}',
);
eval(rt);

// 2. vendor.js
eval(fs.readFileSync(path.join(__dirname, "vendor.js"), "utf-8"));

// 3. 479.js（含模块 93823 nT 和 18543 mR）
eval(fs.readFileSync(path.join(__dirname, "479.js"), "utf-8"));

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════
const wp = global.__wp;
if (!wp) {
  console.error("[env_site] __wp 未找到，webpack chunk 可能加载失败");
}

module.exports = { wp };
