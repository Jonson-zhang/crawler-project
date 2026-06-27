/**
 * env_site.js — 小红书 浏览器环境补丁
 *
 * 纯 env_patch 底座，无额外 env.js 覆盖。
 * 小红书 VMP 唯一需要的是 window 对象上的 Proxy 包装。
 */

const _require = require;
const { setupEnv, watch } = _require("../../.claude/env-patch/env_patch.js");

// ═══════════════════════════════════════════════════════════════
// 通用环境
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://www.xiaohongshu.com/",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  platform: "Win32",
  languages: ["zh-CN", "zh", "en"],
  screenWidth: 1920,
  screenHeight: 1080,
  title: "小红书",
  cookie:
    "abRequestId=bc87e19f-1473-5802-857f-aa14072c42f5; a1=197c660cf2d0j0l1bdwbkv2cyce6csd6n3v6nths750000683082; webId=c09b78e6b3cb4b550c9d51b97c057cd0; gid=yjWSKK8f0jIdyjWSKK8Siq9xJf8V81yDfEDThMWhJSvSdK28KSMfKI888KYq8YJ88SyyYWqJ; xsecappid=xhs-pc-web; websectiga=7750c37de43b7be9de8ed9ff8ea0e576519e8cd2157322eb972ecb429a7735d4; sec_poison_id=4e4a9eab-d586-4ce8-ab46-4095b5cf9e04",
  canvas: true,
  webgl: false,
  plugins: false,
  storage: true,
  extraConstructors: true,
  crypto: true,
  windowToGlobal: true,
});

global.crypto = _require("crypto").webcrypto;

// ═══════════════════════════════════════════════════════════════
// 小红书特有：window 需要 Proxy 包装
// VMP 字节码解释器在运行时检测 window 上的 Proxy 陷阱
// ═══════════════════════════════════════════════════════════════
global.window = watch(global.window, "window");
