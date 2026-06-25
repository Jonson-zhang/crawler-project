/**
 * v0.2 sign.js — 小红书 XYS_ 离线签名 (纯在线方案)
 *
 * 架构:
 *   env.js           — 浏览器环境（1.md 可复用框架）
 *   data/bf7d4e.js + ds_api.js + ds_v2.js + fp.js — 在线 DS 脚本（原始，未修改）
 *   sign.js          — 编码链 + 签名入口
 *
 * 当前状态: 编码链就绪，mnsv2 待攻克（在线 DS 在 Node.js 中执行时 VMP 内部状态不匹配）
 *
 * 用法: node sign.js '<json_body>'  （待 mnsv2 攻克后可用）
 */

"use strict";
const fs = require("fs"), path = require("path"), CryptoJS = require("crypto-js");

// ── 静默加载 ──
const _s = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;

require("./env");

// 加载 4 个在线 DS 脚本（原始 raw，未经任何修改）
var oB = Function.prototype.bind;
Function.prototype.bind = function (ctx) {
  if (typeof this !== "function") return function () {};
  try { return oB.apply(this, arguments); } catch (e) { return function () {}; }
};

// 浏览器加载顺序: bf7d4e → ds_api → ds_v2 → fp
eval(fs.readFileSync(path.join(__dirname, "data", "bf7d4e.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "data", "ds_api.js"), "utf8"));

// Hook _AUuXfEG27Xa3x — 自动填充 env 数组缺失元素（VMP 字节码可能访问高索引）
var _ra, _origAu = global._AUuXfEG27Xa3x;
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _origAu; },
  set: function (fn) {
    if (typeof fn === "function") {
      _ra = function (bc, env) {
        for (var i = 0; i < 300; i++) {
          if (env[i] === undefined) { var s = function () {}; s.prototype = {}; env[i] = s; }
        }
        return fn.call(window, bc, env);
      };
    }
  }, configurable: true, enumerable: true,
});

eval(fs.readFileSync(path.join(__dirname, "data", "ds_v2.js"), "utf8"));
eval(fs.readFileSync(path.join(__dirname, "data", "fp.js"), "utf8"));

Function.prototype.bind = oB;
process.stdout.write = _s;

// ── 编码链 = K.xE (自定义 Base64) + K.lz (UTF-8) + K.Pu (MD5, via CryptoJS) ──
// 来源: vendor.js webpack module 40055 + browser DevTools

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

// ── seccore_signv2（来自 vendor.js） ──
function seccore_signv2(url, body) {
  var c = url + JSON.stringify(body);
  var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({
    x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: h, x4: body ? "object" : "",
  })));
}

// ── CLI ──
var API = "/api/sns/web/v1/homefeed", arg = process.argv[2];

if (!arg) { console.error("用法: node sign.js '<json_body>'"); process.exit(1); }

if (typeof window.mnsv2 !== "function") {
  console.error("mnsv2 尚未攻克 — 在线 DS 脚本在 Node.js 中 VMP 内部状态不匹配");
  process.exit(1);
}

var bodyObj;
try { bodyObj = JSON.parse(arg); } catch (e) { console.error("body 不是有效 JSON"); process.exit(1); }

var xs = seccore_signv2(API, bodyObj), xt = String(Date.now());
var xsc = b64Encode(encodeUtf8(JSON.stringify({
  a1: "", x1: "4.3.5", x2: API, x3: "xhs-pc-web", x4: CryptoJS.MD5(API).toString(),
})));

process.stdout.write(JSON.stringify({ "X-s": xs, "X-t": xt, "X-s-common": xsc }) + "\n");
