/**
 * sign.js - 小红书 XYS_ 离线签名 (mns0301)
 *
 * 用法: node sign.js '<json_body>'
 * 输出: {"X-s":"XYS_...","X-t":"..."}
 *
 * 初始化链:
 *   1.md env → 1.md ds → mns0201 baseline
 *   → online ds_api + ds_v2 overlay → mns0201 → mns0301 升级
 */

"use strict";

const fs = require("fs");
const path = require("path");
const CryptoJS = require("crypto-js");

// ===== 静默初始化 =====
const origStdout = process.stdout.write.bind(process.stdout);
process.stdout.write = () => true;

// Step 1: 1.md env + ds → mns0201 baseline
require("./env");
require("./ds_script");

// Step 2: 补充 MutationObserver (VMP bytecode 需要)
if (typeof MutationObserver === "undefined") {
  global.MutationObserver = function (cb) {
    this.observe = function () {};
    this.disconnect = function () {};
  };
}

// Step 3: 加载在线 ds_api (提供 _BHjFmfUMEtxhI 环境)
eval(fs.readFileSync(path.join(__dirname, "data", "ds_api_raw.js"), "utf8"));

// Step 4: Hook _AUuXfEG27Xa3x, 拦截在线解释器 + 自动填充 env 数组
var _ra, _origAu = global._AUuXfEG27Xa3x;
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _origAu; },
  set: function (fn) {
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        for (var i = 0; i < 200; i++) {
          if (env[i] === undefined) {
            var stub = function () {};
            stub.prototype = {};
            env[i] = stub;
          }
        }
        return fn.call(window, bc, env);
      };
    } else {
      _ra = fn;
    }
  },
  configurable: true,
  enumerable: true,
});

// Step 5: 加载在线 ds_v2 — 覆盖升级 mns0201 → mns0301
eval(fs.readFileSync(path.join(__dirname, "data", "ds_v2_6545c_online.js"), "utf8"));

// 恢复 stdout
process.stdout.write = origStdout;

// ===== 自定义 Base64 编码 =====
const BASE64_TABLE = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";
const u = [];
for (let w = 0; w < BASE64_TABLE.length; w++) u[w] = BASE64_TABLE[w];

function b64Encode(e) {
  const len = e.length;
  const mod = len % 3;
  const result = [];
  const CHUNK = 16383;
  for (let i = 0, end = len - mod; i < end; i += CHUNK) {
    const limit = Math.min(i + CHUNK, end);
    for (let j = i; j < limit; j += 3) {
      const t = (e[j] << 16) + (e[j + 1] << 8) + e[j + 2];
      result.push(
        u[(t >> 18) & 63] + u[(t >> 12) & 63] + u[(t >> 6) & 63] + u[t & 63]
      );
    }
  }
  if (mod === 1) {
    const b = e[len - 1];
    result.push(u[b >> 2] + u[(b << 4) & 63] + "==");
  } else if (mod === 2) {
    const p = (e[len - 2] << 8) + e[len - 1];
    result.push(u[p >> 10] + u[(p >> 4) & 63] + u[(p << 2) & 63] + "=");
  }
  return result.join("");
}

// ===== UTF-8 字节编码 =====
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

// ===== seccore_signv2 =====
function seccore_signv2(url, body) {
  const combined = url + JSON.stringify(body);
  const md5Combined = CryptoJS.MD5(combined).toString();
  const md5Url = CryptoJS.MD5(url).toString();
  const mnsv2Hash = window.mnsv2(combined, md5Combined, md5Url);

  const payload = {
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

// x-s-common
const xsCommonPayload = { a1: "", x1: "4.3.5", x2: API_URL, x3: "xhs-pc-web", x4: CryptoJS.MD5(API_URL).toString() };
const x_s_common = b64Encode(encodeUtf8(JSON.stringify(xsCommonPayload)));

process.stdout.write(JSON.stringify({ "X-s": x_s, "X-t": x_t, "X-s-common": x_s_common }) + "\n");
