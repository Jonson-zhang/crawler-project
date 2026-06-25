/**
 * sign.js — 小红书 XYS_ 签名入口
 *
 * 用法:
 *   node sign.js '<json_body>'
 *   例: node sign.js '{"cursor_score":"","num":20,"refresh_type":1,"note_index":0}'
 *
 * 签名链:
 *   url + body → MD5×2 → window.mnsv2() → payload → JSON → UTF-8 → custom base64 → XYS_
 *
 * 代码来源:
 *   - base64/utf8 编码: vendor.js webpack module 40055 (浏览器 DevTools 提取)
 *   - mnsv2: DS v2 端点 VMP 字节码 (env.js + ds_script.js 初始化后注册到 window)
 */

"use strict";

require("./env");
require("./ds_script");

const crypto = require("crypto");

// ==============================
// 自定义 Base64 (K.xE from module 40055)
// 码表: ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5
// ==============================
const BASE64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

function b64Encode(bytes) {
  const len = bytes.length;
  const mod = len % 3;
  const result = [];
  const CHUNK = 16383;

  for (let i = 0, end = len - mod; i < end; i += CHUNK) {
    const limit = Math.min(i + CHUNK, end);
    for (let j = i; j < limit; j += 3) {
      const t = (bytes[j] << 16) + (bytes[j + 1] << 8) + bytes[j + 2];
      result.push(
        BASE64[(t >> 18) & 63] +
          BASE64[(t >> 12) & 63] +
          BASE64[(t >> 6) & 63] +
          BASE64[t & 63]
      );
    }
  }

  if (mod === 1) {
    const b = bytes[len - 1];
    result.push(BASE64[b >> 2] + BASE64[(b << 4) & 63] + "==");
  } else if (mod === 2) {
    const pair = (bytes[len - 2] << 8) + bytes[len - 1];
    result.push(
      BASE64[pair >> 10] +
        BASE64[(pair >> 4) & 63] +
        BASE64[(pair << 2) & 63] +
        "="
    );
  }

  return result.join("");
}

// ==============================
// UTF-8 字节编码 (K.lz from module 40055)
// ==============================
function encodeUtf8(str) {
  const encoded = encodeURIComponent(str);
  const bytes = [];
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

// ==============================
// MD5 (K.Pu)
// ==============================
function md5(s) {
  return crypto.createHash("md5").update(s, "utf8").digest("hex");
}

// ==============================
// seccore_signv2
//
// 对应 vendor.js 中的:
//   function seccore_signv2(e, a) {
//     var u = e;
//     ... → JSON.stringify(a) → u += a
//     var m = K.Pu([u].join(""))  // MD5(u)
//     var w = K.Pu(e)             // MD5(url)
//     var C = window.mnsv2(u,m,w)
//     var P = {x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:C, x4:...}
//     return "XYS_" + K.xE(K.lz(JSON.stringify(P)))
//   }
// ==============================
function seccore_signv2(url, body) {
  let combined = url;
  let dataType = "";

  if (body !== undefined && body !== null && body !== "") {
    if (typeof body === "string") {
      combined += body;
      dataType = "string";
    } else {
      combined += JSON.stringify(body);
      dataType = "object";
    }
  }

  const md5Combined = md5(combined);
  const md5Url = md5(url);
  const mnsv2Hash = window.mnsv2(combined, md5Combined, md5Url);

  const payload = {
    x0: "4.3.5",
    x1: "xhs-pc-web",
    x2: "Windows",
    x3: mnsv2Hash,
    x4: dataType,
  };

  const jsonStr = JSON.stringify(payload);
  const utf8Bytes = encodeUtf8(jsonStr);
  return "XYS_" + b64Encode(utf8Bytes);
}

// ==============================
// 命令行入口
// ==============================
const API_URL = "/api/sns/web/v1/homefeed";
const body = process.argv[2];

if (!body) {
  console.error("用法: node sign.js '<json_body>'");
  process.exit(1);
}

// 验证 mnsv2 已就绪
if (typeof window.mnsv2 !== "function") {
  console.error("错误: window.mnsv2 不存在");
  console.error("ds_script.js 中的 VMP 初始化可能失败了，请检查 env.js 环境");
  process.exit(1);
}

let bodyObj;
try {
  bodyObj = JSON.parse(body);
} catch (e) {
  bodyObj = body;
}

const x_s = seccore_signv2(API_URL, bodyObj);
const x_t = String(Date.now());

console.log(JSON.stringify({ "X-s": x_s, "X-t": x_t }));
