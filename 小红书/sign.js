/**
 * sign.js — 小红书 XYS_ 离线签名
 *
 * 用法: node sign.js '<json_body>'
 * 输出: {"X-s":"XYS_...","X-t":"...","X-s-common":"..."}
 *
 * 依赖: env.js (补环境) + ds_script.js (扣下来的VMP代码)
 */

"use strict";

const CryptoJS = require("crypto-js");

// ===== 加载 VMP 环境 =====
const origStdout = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;

require("./env");
require("./ds_script");

process.stdout.write = origStdout;

if (typeof window.mnsv2 !== "function") {
  console.error("错误: window.mnsv2 不存在，ds_script.js 初始化可能失败");
  process.exit(1);
}

// ===== 自定义 Base64 (K.xE) =====
const B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
const _b64t = [];
for (let w = 0; w < B64.length; w++) _b64t[w] = B64[w];

function b64Encode(e) {
  const len = e.length, mod = len % 3, result = [];
  for (let i = 0, end = len - mod; i < end; i += 16383) {
    const limit = Math.min(i + 16383, end);
    for (let j = i; j < limit; j += 3) {
      const t = (e[j] << 16) + (e[j + 1] << 8) + e[j + 2];
      result.push(_b64t[(t >> 18) & 63] + _b64t[(t >> 12) & 63] + _b64t[(t >> 6) & 63] + _b64t[t & 63]);
    }
  }
  if (mod === 1) {
    const b = e[len - 1];
    result.push(_b64t[b >> 2] + _b64t[(b << 4) & 63] + "==");
  } else if (mod === 2) {
    const p = (e[len - 2] << 8) + e[len - 1];
    result.push(_b64t[p >> 10] + _b64t[(p >> 4) & 63] + _b64t[(p << 2) & 63] + "=");
  }
  return result.join("");
}

// ===== UTF-8 编码 (K.lz) =====
function encodeUtf8(str) {
  const encoded = encodeURIComponent(str), bytes = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === "%") {
      bytes.push(parseInt(encoded[i + 1] + encoded[i + 2], 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

// ===== seccore_signv2 =====
function seccore_signv2(url, body) {
  const combined = url + JSON.stringify(body),
    md5Combined = CryptoJS.MD5(combined).toString(),
    md5Url = CryptoJS.MD5(url).toString(),
    hash = window.mnsv2(combined, md5Combined, md5Url);
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({
    x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows", x3: hash,
    x4: body !== undefined && body !== null && body !== "" ? "object" : "",
  })));
}

// ===== CLI =====
const API_PATH = "/api/sns/web/v1/homefeed";
const bodyArg = process.argv[2];

if (!bodyArg) { console.error("用法: node sign.js '<json_body>'"); process.exit(1); }

let bodyObj;
try { bodyObj = JSON.parse(bodyArg); } catch (e) { console.error("错误: body 不是有效 JSON"); process.exit(1); }

const x_s = seccore_signv2(API_PATH, bodyObj);
const x_t = String(Date.now());

// x-s-common
const xsCommon = b64Encode(encodeUtf8(JSON.stringify({
  a1: "", x1: "4.3.5", x2: API_PATH, x3: "xhs-pc-web",
  x4: CryptoJS.MD5(API_PATH).toString(),
})));

process.stdout.write(JSON.stringify({ "X-s": x_s, "X-t": x_t, "X-s-common": xsCommon }) + "\n");
