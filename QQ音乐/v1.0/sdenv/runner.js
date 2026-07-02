#!/usr/bin/env node
/**
 * QQ音乐 sdenv 签名器
 * ======================
 *
 * 使用 env_patch 创建浏览器环境，加载 webpack chunk，
 * 提供 sign/encrypt/decrypt 功能。
 *
 * 模块 8 的 VMP 解码需要：
 *   1. env_patch 的 window 原型链（EventTarget → Window）
 *   2. await 排空微任务队列，让 VMP 完成异步解码
 *
 * 用法:
 *   node runner.js sign '{"test":"hello"}'
 *   node runner.js encrypt '{"comm":{...}}'
 *   node runner.js decrypt '<base64>'
 *   node runner.js combined '{"comm":{...}}'   → sign + encrypt 一次调用
 *
 * 输出: {"success": true, result: "..."}
 */

const fs = require("fs");
const path = require("path");

const _process = process;
const _require = require;
const _Buffer = Buffer;

const HERE = __dirname;

// ── 1. env_patch 环境 ────────────────────────────────────
_require(path.join(HERE, "env_site.js"));

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
    // ── 2. 加载 webpack ──────────────────────────────────
    global.window.webpackJsonp = [];
    eval(fs.readFileSync(path.join(HERE, "runtime.js"), "utf-8"));

    // stub 模块
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

    // 加载 vendor chunk
    eval(fs.readFileSync(path.join(HERE, "vendor.chunk.js"), "utf-8"));

    // ── 3. 激活模块 ──────────────────────────────────────
    const wp = global.window.__webpack_require__;
    if (wp && wp.m) {
      Object.keys(wp.m).forEach(function (id) {
        if (wp.m[id]) { try { wp(id); } catch (_) {} }
      });
    }

    const getSecuritySign = global.window._getSecuritySign || global.window._getSecuritySign2;

    // ── 4. await 微任务排空 ──────────────────────────────
    // 模块 8 的 VMP 通过 Promise/setTimeout 异步解码 __cgiEncrypt
    await new Promise(function (resolve) { setTimeout(resolve, 100); });

    const cgiEncrypt = global.window.__cgiEncrypt;
    const cgiDecrypt = global.window.__cgiDecrypt;

    // ── 5. 主要逻辑 ─────────────────────────────────────
    let result;
    switch (action) {
      case "sign":
        if (!getSecuritySign) throw new Error("Sign function not available");
        result = getSecuritySign(input);
        break;

      case "encrypt":
        if (!cgiEncrypt) throw new Error("Encrypt function not available");
        result = await cgiEncrypt(input);
        break;

      case "decrypt":
        if (!cgiDecrypt) throw new Error("Decrypt function not available");
        {
          const binaryBuf = _Buffer.from(input.trim(), "base64");
          const uint8 = new Uint8Array(binaryBuf.buffer, binaryBuf.byteOffset, binaryBuf.byteLength);
          result = cgiDecrypt(uint8);
        }
        break;

      case "combined": {
        // 一次性完成 sign + encrypt
        const _input = JSON.parse(input);
        const _sign = getSecuritySign ? getSecuritySign(JSON.stringify(_input)) : null;
        const _encrypted = cgiEncrypt ? await cgiEncrypt(JSON.stringify(_input)) : null;
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
