/**
 * QQ音乐 API 签名/加解密工具
 *
 * 用法:
 *   node qqmusic_api.js sign <json>
 *   node qqmusic_api.js encrypt <json>
 *   node qqmusic_api.js decrypt <base64>
 *
 * 输出: JSON { success: true, result: "..." }
 */

const fs = require("fs");
const path = require("path");

// ── 保存原生引用 ─────────────────────────────────────────
const _process = process;
const _require = require;
const _Buffer = Buffer;
const _setTimeout = setTimeout;
const _clearTimeout = clearTimeout;

// ── 1. 浏览器环境（env_patch 通用框架） ──────────────────
_require(path.join(__dirname, "../env-patch/env_site.js"));

// ── 2. 加载 webpack 运行时 ──────────────────────────────
global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(__dirname, "../env-patch/runtime.js"), "utf-8"));

// ── 3. 注入缺失模块 stub（vendor.chunk.js 字节码 VM 依赖） ──
global.window.webpackJsonp.push([
  [999],
  {
    380: function (e) {
      e.exports = { debuglog: function () { return function () {}; }, inspect: { colors: false } };
    },
    381: function (e) {
      e.exports = function () { this.head = null; this.tail = null; this.length = 0; };
      var p = e.exports.prototype;
      p.push    = function (d) { var n = { data: d, next: null }; this.length > 0 ? (this.tail.next = n) : (this.head = n); this.tail = n; ++this.length; };
      p.unshift = function (d) { var n = { data: d, next: this.head }; 0 === this.length && (this.tail = n); this.head = n; ++this.length; };
      p.shift   = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length && (this.head = this.tail = null), (this.head = this.head.next), --this.length, d; } };
    },
    382: function (e) {
      function n() { this.head = null; this.tail = null; this.length = 0; }
      var p = n.prototype;
      p.push    = function (d) { var t = { data: d, next: null }; this.length > 0 ? (this.tail.next = t) : (this.head = t); this.tail = t; ++this.length; };
      p.unshift = function (d) { var t = { data: d, next: this.head }; 0 === this.length && (this.tail = t); this.head = t; ++this.length; };
      p.shift   = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length && (this.head = this.tail = null), (this.head = this.head.next), --this.length, d; } };
      e.exports = n;
    },
  },
]);

// ── 4. 加载业务 JS ──────────────────────────────────────
eval(fs.readFileSync(path.join(__dirname, "../env-patch/vendor.chunk.js"), "utf-8"));

// ── 5. 激活所有模块 → sign/encrypt/decrypt 挂载到 window ──
const wp = global.window.__webpack_require__;
if (wp && wp.m) {
  Object.keys(wp.m).forEach(function (id) { try { wp(id); } catch (_) {} });
}

const getSecuritySign = global.window._getSecuritySign || global.window._getSecuritySign2;
const cgiEncrypt = global.window.__cgiEncrypt;
const cgiDecrypt = global.window.__cgiDecrypt;

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════
async function main() {
  const action = _process.argv[2];
  let input = _process.argv[3];

  if (input === "--file" && _process.argv[4]) {
    input = fs.readFileSync(_process.argv[4], "utf-8");
  }
  if (input === "-" || (input === undefined && _process.argv.length <= 3)) {
    input = fs.readFileSync(0, "utf-8");
  }

  if (!action || !input) {
    _process.stderr.write(JSON.stringify({
      success: false, error: "Usage: node qqmusic_api.js <sign|encrypt|decrypt> <data>",
    }) + "\n");
    _process.exit(1);
  }

  const timeout = _setTimeout(function () {
    _process.stderr.write(JSON.stringify({ success: false, error: "Operation timed out" }) + "\n");
    _process.exit(1);
  }, 30000);

  try {
    let result;
    switch (action) {
      case "sign":
        if (!getSecuritySign) throw new Error("Sign function not available");
        result = getSecuritySign(typeof input === "string" ? input : JSON.stringify(input));
        break;
      case "encrypt":
        if (!cgiEncrypt) throw new Error("Encrypt function not available");
        result = await cgiEncrypt(typeof input === "string" ? input : JSON.stringify(input));
        break;
      case "decrypt":
        if (!cgiDecrypt) throw new Error("Decrypt function not available");
        {
          const binaryBuf = _Buffer.from(input.trim(), "base64");
          const uint8 = new Uint8Array(binaryBuf.buffer, binaryBuf.byteOffset, binaryBuf.byteLength);
          result = cgiDecrypt(uint8);
        }
        break;
      default:
        throw new Error("Unknown action: " + action);
    }
    _clearTimeout(timeout);
    _process.stdout.write(JSON.stringify({ success: true, result: result }) + "\n");
  } catch (e) {
    _clearTimeout(timeout);
    _process.stderr.write(JSON.stringify({ success: false, error: e.message }) + "\n");
    _process.exit(1);
  }
}

main();
