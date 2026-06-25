/**
 * sign.js — 小红书 XYS_ 离线签名入口（占位）
 *
 * 当前状态: env.js 可复用，DS 脚本待从线上抓取并攻克离线化
 * 用法: node sign.js '<json_body>'  （待 mnsv2 攻克后可用）
 */

"use strict";

require("./env");

// TODO: 加载在线 DS 脚本，创建 window.mnsv2
// 待浏览器断点溯源确定 mnsv2 创建路径后实现

if (typeof window.mnsv2 !== "function") {
  console.error("mnsv2 尚未攻克");
  process.exit(1);
}

const CryptoJS = require("crypto-js");

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

function seccore_signv2(url, body) {
  var c = url + JSON.stringify(body);
  var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({
    x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: h, x4: body ? "object" : "",
  })));
}

var API = "/api/sns/web/v1/homefeed";
var arg = process.argv[2];
if (!arg) { console.error("用法: node sign.js '<json_body>'"); process.exit(1); }
var bodyObj;
try { bodyObj = JSON.parse(arg); } catch (e) { console.error("body 不是有效 JSON"); process.exit(1); }
var xs = seccore_signv2(API, bodyObj);
var xt = String(Date.now());
var xsc = b64Encode(encodeUtf8(JSON.stringify({
  a1: "", x1: "4.3.5", x2: API, x3: "xhs-pc-web", x4: CryptoJS.MD5(API).toString(),
})));
process.stdout.write(JSON.stringify({ "X-s": xs, "X-t": xt, "X-s-common": xsc }) + "\n");
