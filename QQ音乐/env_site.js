/**
 * env_site.js — QQ音乐 浏览器环境补丁
 *
 * 基于 .claude/env-patch/env_patch.js 通用框架。
 * 站点的签名/加密逻辑在 qqmusic_api.js 中。
 */

const _require = require;
const { setupEnv } = _require("../.claude/env-patch/env_patch.js");

// ═══════════════════════════════════════════════════════════════
// 1. 通用环境
// ═══════════════════════════════════════════════════════════════
setupEnv({
  url: "https://y.qq.com/",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
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

  // QQ音乐字节码 VM 需要 window !== global 才能正确初始化
  windowToGlobal: false,
});

// ═══════════════════════════════════════════════════════════════
// 2. 站点特有覆盖
// ═══════════════════════════════════════════════════════════════

// 替换为 Node.js 原生 Web Crypto（加密/解密依赖真实 crypto）
const nodeWebCrypto = _require("crypto").webcrypto;
global.crypto = nodeWebCrypto;
global.window.crypto = nodeWebCrypto;

// 注入缺失的 webpack 模块 stub
// vendor.chunk.js 字节码解释器依赖 module 380/381/382（readable-stream）
// 缺失时模块 8 执行失败 → sign/encrypt/decrypt 全部不可用
global.window.webpackJsonp.push([
  [999],
  {
    380: function (e) {
      e.exports = { debuglog: function () { return function () {}; }, inspect: { colors: false } };
    },
    381: function (e) {
      e.exports = function () { this.head = null; this.tail = null; this.length = 0; };
      var p = e.exports.prototype;
      p.push = function (d) { var n = { data: d, next: null }; this.length > 0 ? (this.tail.next = n) : (this.head = n); this.tail = n; ++this.length; };
      p.unshift = function (d) { var n = { data: d, next: this.head }; 0 === this.length && (this.tail = n); this.head = n; ++this.length; };
      p.shift = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length && (this.head = this.tail = null), (this.head = this.head.next), --this.length, d; } };
    },
    382: function (e) {
      function n() { this.head = null; this.tail = null; this.length = 0; }
      var p = n.prototype;
      p.push = function (d) { var t = { data: d, next: null }; this.length > 0 ? (this.tail.next = t) : (this.head = t); this.tail = t; ++this.length; };
      p.unshift = function (d) { var t = { data: d, next: this.head }; 0 === this.length && (this.tail = t); this.head = t; ++this.length; };
      p.shift = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length && (this.head = this.tail = null), (this.head = this.head.next), --this.length, d; } };
      e.exports = n;
    },
  },
]);
