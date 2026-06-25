/**
 * v0.2 sign.js — 小红书 XYS_ 离线签名（纯在线方案）
 *
 * 架构:
 *   env.js   — 浏览器环境（1.md 可复用框架）
 *   data/ds_api.js + ds_v2.js — 在线 DS 原始脚本（当前 v0.2 使用 ds_api + ds_v2）
 *   sign.js  — 编码链 + mnsv2 初始化 + 签名入口
 *
 * 用法: node sign.js '<json_body>'
 */

"use strict";
const fs = require("fs"), path = require("path"), CryptoJS = require("crypto-js");

// ── 1. 静默加载环境 ──
const _s = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;
require("./env");
process.stdout.write = _s;

// ── 2. 加载在线 DS 脚本 ──
// 浏览器加载顺序: bf7d4e → ds_api → ds_v2
eval(fs.readFileSync(path.join(__dirname, "data", "ds_api.js"), "utf8"));

// Hook _AUuXfEG27Xa3x — 拦截在线解释器 + 递归 Proxy 填充 env 缺失元素
var _ra, _origAu = global._AUuXfEG27Xa3x;
function makeVmpStub() {
  // 递归 Proxy：任何属性访问都返回一个新的 Proxy，永不返回 undefined
  return new Proxy(function () {}, {
    get: function (t, p, r) {
      if (p === "prototype") return {};
      if (typeof p === "symbol") return undefined;
      return makeVmpStub(); // 递归——消化一切属性链路
    },
    set: function (t, p, v) { return true; },
    has: function (t, p) { return true; },
    construct: function (t, args) { return makeVmpStub(); },
    apply: function (t, ctx, args) { return makeVmpStub(); },
    deleteProperty: function () { return true; },
    defineProperty: function () { return true; },
    getOwnPropertyDescriptor: function () { return { configurable: true, enumerable: true, writable: true, value: makeVmpStub() }; },
    ownKeys: function () { return []; },
  });
}

Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _origAu; },
  set: function (fn) {
    if (typeof fn === "function") {
      _ra = function (bc, env) {
        for (var i = 0; i < 300; i++) {
          if (env[i] === undefined) env[i] = makeVmpStub();
        }
        return fn.call(window, bc, env);
      };
    }
  },
  configurable: true, enumerable: true,
});

// 加载在线 ds_v2
eval(fs.readFileSync(path.join(__dirname, "data", "ds_v2.js"), "utf8"));

// ── 3. 检查 mnsv2 ──
if (typeof window.mnsv2 !== "function") {
  console.error("mnsv2 尚未攻克 — VMP 内部状态不匹配");
  process.exit(1);
}

// ── 4. 编码链 (K.xE / K.lz / K.Pu) ──
const U = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5".split("");

function b64Encode(e) {
  const n = e.length, m = n % 3, r = [];
  for (var i = 0, P = n - m; i < P; i += 16383) {
    var end = Math.min(i + 16383, P);
    for (var j = i; j < end; j += 3) {
      var t = (e[j] << 16) + (e[j + 1] << 8) + e[j + 2];
      r.push(U[(t >> 18) & 63] + U[(t >> 12) & 63] + U[(t >> 6) & 63] + U[t & 63]);
    }
  }
  if (m === 1) { var b = e[n - 1]; r.push(U[b >> 2] + U[(b << 4) & 63] + "=="); }
  else if (m === 2) { var p = (e[n - 2] << 8) + e[n - 1]; r.push(U[p >> 10] + U[(p >> 4) & 63] + U[(p << 2) & 63] + "="); }
  return r.join("");
}

function encodeUtf8(s) {
  var e = encodeURIComponent(s), b = [];
  for (var i = 0; i < e.length; i++) {
    if (e[i] === "%") { b.push(parseInt(e[i + 1] + e[i + 2], 16)); i += 2; }
    else { b.push(e.charCodeAt(i)); }
  }
  return b;
}

// ── 5. seccore_signv2（来自 vendor.js） ──
function seccore_signv2(url, body) {
  var c = url + JSON.stringify(body);
  var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({
    x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: h, x4: body ? "object" : "",
  })));
}

// ── 6. CLI ──
var API = "/api/sns/web/v1/homefeed", arg = process.argv[2];
if (!arg) { console.error("用法: node sign.js '<json_body>'"); process.exit(1); }
var bodyObj;
try { bodyObj = JSON.parse(arg); } catch (e) { console.error("body 不是有效 JSON"); process.exit(1); }
var xs = seccore_signv2(API, bodyObj), xt = String(Date.now());
var xsc = b64Encode(encodeUtf8(JSON.stringify({
  a1: "", x1: "4.3.5", x2: API, x3: "xhs-pc-web", x4: CryptoJS.MD5(API).toString(),
})));
process.stdout.write(JSON.stringify({ "X-s": xs, "X-t": xt, "X-s-common": xsc }) + "\n");
