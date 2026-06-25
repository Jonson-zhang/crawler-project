/**
 * sign.js — 小红书 XYS_ 离线签名
 *
 * 用法: node sign.js '<json_body>'
 * 例:   node sign.js '{"cursor_score":"","num":20,"refresh_type":1,"note_index":0}'
 *
 * 输出: {"X-s":"XYS_...","X-t":"1782348627791"}
 *
 * 依赖: env.js (浏览器环境) + ds_script.js (VMP 字节码, 创建 window.mnsv2)
 */

"use strict";

const CryptoJS = require("crypto-js");

// ===== 自定义 Base64 编码 =====
const BASE64_TABLE = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

let u = [];
for (let w = 0, C = BASE64_TABLE.length; w < C; ++w) u[w] = BASE64_TABLE[w];

function tripletToBase64(e) {
  return (
    u[(e >> 18) & 63] + u[(e >> 12) & 63] + u[(e >> 6) & 63] + u[63 & e]
  );
}

function encodeChunk(e, a, s) {
  let m = [];
  for (let w = a; w < s; w += 3) {
    let t =
      ((e[w] << 16) & 0xff0000) + ((e[w + 1] << 8) & 65280) + (255 & e[w + 2]);
    m.push(tripletToBase64(t));
  }
  return m.join("");
}

function b64Encode(e) {
  let s = e.length, m = s % 3, w = [];
  const C = 16383;
  for (let R = 0, P = s - m; R < P; R += C)
    w.push(encodeChunk(e, R, R + C > P ? P : R + C));

  if (m === 1) {
    let a = e[s - 1];
    w.push(u[a >> 2] + u[(a << 4) & 63] + "==");
  } else if (m === 2) {
    let a = (e[s - 2] << 8) + e[s - 1];
    w.push(u[a >> 10] + u[(a >> 4) & 63] + u[(a << 2) & 63] + "=");
  }
  return w.join("");
}

// ===== UTF-8 字节编码 =====
function encodeUtf8(e) {
  let a = encodeURIComponent(e), s = [];
  for (let u = 0; u < a.length; u++) {
    let m = a.charAt(u);
    if (m === "%") {
      let w = parseInt(a.charAt(u + 1) + a.charAt(u + 2), 16);
      s.push(w);
      u += 2;
    } else {
      s.push(m.charCodeAt(0));
    }
  }
  return s;
}

// ===== seccore_signv2 =====
function seccore_signv2(url, body) {
  let combined = url + JSON.stringify(body);
  let md5Combined = CryptoJS.MD5(combined).toString();
  let md5Url = CryptoJS.MD5(url).toString();
  let mnsv2Hash = window.mnsv2(combined, md5Combined, md5Url);

  let payload = {
    x0: "4.3.5",
    x1: "xhs-pc-web",
    x2: "Windows",
    x3: mnsv2Hash,
    x4: "object",
  };

  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify(payload)));
}

// ===== CLI =====
const API_URL = "/api/sns/web/v1/homefeed";
const bodyArg = process.argv[2];

if (!bodyArg) {
  console.error("用法: node sign.js '<json_body>'");
  process.exit(1);
}

// 静默加载期间的 VMP 字节码副作用输出
const origStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;

require("./env");
require("./ds_script");

// 恢复 stdout
process.stdout.write = origStdoutWrite;

if (typeof window.mnsv2 !== "function") {
  console.error("错误: window.mnsv2 不存在");
  process.exit(1);
}

let bodyObj;
try {
  bodyObj = JSON.parse(bodyArg);
} catch (e) {
  console.error("错误: body 不是有效 JSON");
  process.exit(1);
}

const x_s = seccore_signv2(API_URL, bodyObj);
const x_t = String(Date.now());

process.stdout.write(JSON.stringify({ "X-s": x_s, "X-t": x_t }) + "\n");
