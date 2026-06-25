/**
 * v0.1 sign.js — mns0301 离线签名 (覆盖升级方案)
 * 用法: node sign.js '<json_body>'
 * 已验证可用: 签名 HTTP 200, API 翻页成功
 */

"use strict";
const fs = require("fs"), path = require("path"), CryptoJS = require("crypto-js");

// 静默加载
const _s = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;

require("./env");
require("./ds_script");
global.MutationObserver = function () { this.observe = function () {}; this.disconnect = function () {}; };

// 在线 ds_api
eval(fs.readFileSync(path.join(__dirname, "data", "ds_api.js"), "utf8"));

// 覆盖升级 mns0201 → mns0301
var _ra, _oa = global._AUuXfEG27Xa3x;
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _oa; },
  set: function (fn) {
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        for (var i = 0; i < 200; i++) {
          if (env[i] === undefined) { var s = function () {}; s.prototype = {}; env[i] = s; }
        }
        return fn.call(window, bc, env);
      };
    }
  }, configurable: true, enumerable: true,
});
eval(fs.readFileSync(path.join(__dirname, "data", "ds_v2.js"), "utf8"));

process.stdout.write = _s;

if (typeof window.mnsv2 !== "function") { console.error("mnsv2 不存在"); process.exit(1); }

const U = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5".split("");
function b64Encode(e) {
  const n = e.length, m = n % 3, r = [];
  for (var i = 0, P = n - m; i < P; i += 16383) { var end = Math.min(i + 16383, P); for (var j = i; j < end; j += 3) { var t = (e[j] << 16) + (e[j + 1] << 8) + e[j + 2]; r.push(U[(t >> 18) & 63] + U[(t >> 12) & 63] + U[(t >> 6) & 63] + U[t & 63]); } }
  if (m === 1) { var b = e[n - 1]; r.push(U[b >> 2] + U[(b << 4) & 63] + "=="); } else if (m === 2) { var p = (e[n - 2] << 8) + e[n - 1]; r.push(U[p >> 10] + U[(p >> 4) & 63] + U[(p << 2) & 63] + "="); }
  return r.join("");
}
function encodeUtf8(s) {
  var e = encodeURIComponent(s), b = [];
  for (var i = 0; i < e.length; i++) { if (e[i] === "%") { b.push(parseInt(e[i + 1] + e[i + 2], 16)); i += 2; } else { b.push(e.charCodeAt(i)); } }
  return b;
}
function seccore_signv2(url, body) {
  var c = url + JSON.stringify(body);
  var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({ x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: h, x4: body ? "object" : "" })));
}

var API = process.argv[2] || "/api/sns/web/v1/homefeed";
var arg = process.argv[3];
if (!arg) { console.error("用法: node sign.js [api_path] '<json_body>'"); process.exit(1); }
var bodyObj;
try { bodyObj = JSON.parse(arg); } catch (e) { console.error("body 不是有效 JSON"); process.exit(1); }
var xs = seccore_signv2(API, bodyObj), xt = String(Date.now());
var xsc = b64Encode(encodeUtf8(JSON.stringify({ a1: "", x1: "4.3.5", x2: API, x3: "xhs-pc-web", x4: CryptoJS.MD5(API).toString() })));
process.stdout.write(JSON.stringify({ "X-s": xs, "X-t": xt, "X-s-common": xsc }) + "\n");
