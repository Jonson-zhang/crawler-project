#!/usr/bin/env node
/**
 * QQ音乐 sdenv 签名器
 * ======================
 *
 * 使用 sdenv (C++ V8 Addon + jsdom) 加载 webpack chunk,
 * 提供 sign/encrypt/decrypt 三个功能，通过 stdout JSON 返回。
 *
 * 用法:
 *   node runner.js sign '{"test":"hello"}'
 *   node runner.js encrypt '{"comm":{...}}'
 *   node runner.js decrypt '<base64>'
 *
 * 输出: {"success": true, "result": "..."}
 */

const fs = require("fs");
const path = require("path");

const _process = process;
const _require = require;
const _Buffer = Buffer;
const _setTimeout = setTimeout;

const HERE = __dirname;
const V1 = path.resolve(HERE, "..");  // QQ音乐/v1.0/

// ── 1. 加载 jsdom（DOM 环境） ────────────────────────────
const { JSDOM } = _require("jsdom");

async function main() {
  const action = _process.argv[2];
  let input = _process.argv[3];
  if (input === "--file" && _process.argv[4]) {
    input = fs.readFileSync(_process.argv[4], "utf-8");
  }
  if (!action || !input) {
    _process.stderr.write(JSON.stringify({ success: false, error: "Usage: node runner.js <sign|encrypt|decrypt> <data>" }));
    _process.exit(1);
  }

  const timeout = _setTimeout(function () {
    _process.stderr.write(JSON.stringify({ success: false, error: "Timeout" }));
    _process.exit(1);
  }, 30000);

  try {
    // ── 2. 创建 jsdom 环境 ────────────────────────────────
    const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      url: "https://y.qq.com/",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      runScripts: "dangerously",
      resources: "usable",
    });

    const window = dom.window;
    const document = window.document;
    global.window = window;
    global.document = document;
    global.navigator = window.navigator;
    global.location = window.location;
    global.self = window;

    // 提供 crypto（Node.js 原生 Web Crypto）
    const nodeCrypto = _require("crypto").webcrypto;
    window.crypto = nodeCrypto;
    global.crypto = nodeCrypto;

    // ── 3. 加载 webpack 运行时 ────────────────────────────
    eval(fs.readFileSync(path.join(V1, "runtime.js"), "utf-8"));

    // ── 4. 注入缺失模块 stub ─────────────────────────────
    window.webpackJsonp = [];
    window.webpackJsonp.push([
      [999],
      {
        380: function (e) {
          e.exports = { debuglog: function () { return function () {}; }, inspect: { colors: false } };
        },
        381: function (e) {
          e.exports = function () { this.head = null; this.tail = null; this.length = 0; };
          var p = e.exports.prototype;
          p.push = function (d) { var n = { data: d, next: null }; this.length > 0 ? (this.tail.next = n) : (this.head = n); this.tail = n; ++this.length; };
          p.shift = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length ? (this.head = this.tail = null) : (this.head = this.head.next), --this.length, d; } };
        },
        382: function (e) { e.exports = e(381); },
      },
    ]);

    // ── 5. 加载 vendor chunk ──────────────────────────────
    eval(fs.readFileSync(path.join(V1, "vendor.chunk.js"), "utf-8"));

    // ── 6. 激活模块 ──────────────────────────────────────
    const wp = window.__webpack_require__;
    if (wp && wp.m) {
      Object.keys(wp.m).forEach(function (id) { try { wp(id); } catch (_) {} });
    }

    const getSecuritySign = window._getSecuritySign || window._getSecuritySign2;
    const cgiEncrypt = window.__cgiEncrypt;
    const cgiDecrypt = window.__cgiDecrypt;

    let result;
    switch (action) {
      case "sign":
        if (!getSecuritySign) throw new Error("Sign function not available");
        result = getSecuritySign(input);
        break;
      case "encrypt":
        if (cgiEncrypt) {
          result = await cgiEncrypt(input);
        } else {
          // 回退到原始 qqmusic_api.js（同 iv8 方案）
          const { execSync } = _require("child_process");
          const r = execSync(`node "${path.join(V1, "qqmusic_api.js")}" encrypt "${input.replace(/"/g, '\\"')}"`, { encoding: "utf-8", timeout: 30000 });
          const j = JSON.parse(r);
          if (!j.success) throw new Error(j.error);
          result = j.result;
        }
        break;
      case "decrypt":
        if (cgiDecrypt) {
          const binaryBuf = _Buffer.from(input.trim(), "base64");
          const uint8 = new Uint8Array(binaryBuf.buffer, binaryBuf.byteOffset, binaryBuf.byteLength);
          result = cgiDecrypt(uint8);
        } else {
          // 回退到原始 qqmusic_api.js
          const { execSync } = _require("child_process");
          const r = execSync(`node "${path.join(V1, "qqmusic_api.js")}" decrypt "${input}"`, { encoding: "utf-8", timeout: 30000 });
          const j = JSON.parse(r);
          if (!j.success) throw new Error(j.error);
          result = j.result;
        }
        break;
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
