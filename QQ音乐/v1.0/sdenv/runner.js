#!/usr/bin/env node
/**
 * QQ音乐 sdenv 签名器
 * ======================
 *
 * sign → env_patch 环境直接执行（VMP 模块解码成功）
 * encrypt/decrypt → 回退到 qqmusic_api.js（VMP 在特定执行上下文才解码）
 *
 * 用法:
 *   node runner.js sign '{"test":"hello"}'
 *   node runner.js encrypt '{"comm":{...}}'   → 回退 qqmusic_api.js
 *   node runner.js decrypt '<base64>'          → 回退 qqmusic_api.js
 *   node runner.js combined '{"comm":{...}}'   → sign + encrypt 一次调用
 *
 * 输出: {"success": true, result: "..."}
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const _process = process;
const _require = require;
const _Buffer = Buffer;

const HERE = __dirname;

// ── env_patch 环境 ───────────────────────────────────────
_require("./env_site");

// ── 加载 webpack ────────────────────────────────────────
global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(HERE, "runtime.js"), "utf-8"));

global.window.webpackJsonp.push([
  [999],
  {
    380: function (e) { e.exports = { debuglog: function () { return function () {}; }, inspect: { colors: false } }; },
    381: function (e) {
      e.exports = function () { this.head = null; this.tail = null; this.length = 0; };
      var p = e.exports.prototype;
      p.push = function (d) { var n = { data: d, next: null }; this.length > 0 ? (this.tail.next = n) : (this.head = n); this.tail = n; ++this.length; };
      p.shift = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length ? (this.head = this.tail = null) : (this.head = this.head.next), --this.length, d; } };
    },
    382: function (e) { e.exports = e(381); },
  },
]);

eval(fs.readFileSync(path.join(HERE, "vendor.chunk.js"), "utf-8"));

// ── 激活模块 ────────────────────────────────────────────
const wp = global.window.__webpack_require__;
if (wp && wp.m) {
  Object.keys(wp.m).forEach(function (id) {
    if (wp.m[id]) { try { wp(id); } catch (_) {} }
  });
}

const getSecuritySign = global.window._getSecuritySign || global.window._getSecuritySign2;

// ── encrypt/decrypt 回退路径 ────────────────────────────
const _fallbackScript = path.join(HERE, "..", "env-patch", "qqmusic_api.js");

function fallback(action, input) {
  const tmpFile = path.join(HERE, "_tmp_input.txt");
  fs.writeFileSync(tmpFile, input, "utf-8");
  try {
    const r = execSync(`node "${_fallbackScript}" ${action} --file "${tmpFile}"`, {
      encoding: "utf-8", timeout: 30000,
    });
    const j = JSON.parse(r);
    if (!j.success) throw new Error(j.error);
    return j.result;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// ═══════════════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════════════

async function main() {
  const action = _process.argv[2];
  let input = _process.argv[3];
  if (input === "--file" && _process.argv[4]) {
    input = fs.readFileSync(_process.argv[4], "utf-8");
  }
  if (!action || !input) {
    _process.stderr.write(JSON.stringify({ success: false, error: "Usage: node runner.js <sign|encrypt|decrypt|combined> <data>" }) + "\n");
    _process.exit(1);
  }

  const timeout = setTimeout(function () {
    _process.stderr.write(JSON.stringify({ success: false, error: "Timeout" }) + "\n");
    _process.exit(1);
  }, 60000);

  try {
    let result;
    switch (action) {
      case "sign":
        if (!getSecuritySign) throw new Error("Sign function not available");
        result = getSecuritySign(input);
        break;

      case "encrypt":
        result = fallback("encrypt", input);
        break;

      case "decrypt":
        result = fallback("decrypt", input);
        break;

      case "combined": {
        const _input = JSON.parse(input);
        const _sign = getSecuritySign ? getSecuritySign(JSON.stringify(_input)) : null;
        const _encrypted = fallback("encrypt", JSON.stringify(_input));
        result = JSON.stringify({ sign: _sign, encrypted: _encrypted });
        break;
      }

      default:
        throw new Error("Unknown action: " + action);
    }

    clearTimeout(timeout);
    _process.stdout.write(JSON.stringify({ success: true, result: result }) + "\n");
  } catch (e) {
    clearTimeout(timeout);
    _process.stderr.write(JSON.stringify({ success: false, error: e.message }) + "\n");
    _process.exit(1);
  }
}

main();
