/**
 * XHS XYS_ 签名完整实现
 *
 * 签名流程:
 *   1. MD5(url + body) → hex string
 *   2. MD5(url) → hex string
 *   3. mnsv2(url+body, MD5(url+body), MD5(url)) → "mns0301_<base64hash>"
 *   4. Build payload: { x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3: mnsv2_hash, x4: datatype }
 *   5. JSON.stringify(payload) → encodeUtf8 → b64Encode → prepend "XYS_"
 *
 * 用法:
 *   node sign_xys.js --url "/api/sns/web/v1/homefeed" --body '{"num":20}' --mnsv2-callback
 *
 * mnsv2 需要浏览器 VMP 运行时。离线方案需要修复 VMP env 数组。
 */

const crypto = require('crypto');

// ===== 自定义 Base64 编码 (K.xE) =====
const BASE64_ALPHABET = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5";

function b64Encode(bytes) {
  const len = bytes.length;
  const mod = len % 3;
  const result = [];
  const CHUNK = 16383;

  for (let i = 0, end = len - mod; i < end; i += CHUNK) {
    const limit = Math.min(i + CHUNK, end);
    for (let j = i; j < limit; j += 3) {
      const triplet = (bytes[j] << 16) + (bytes[j + 1] << 8) + bytes[j + 2];
      result.push(
        BASE64_ALPHABET[(triplet >> 18) & 63] +
        BASE64_ALPHABET[(triplet >> 12) & 63] +
        BASE64_ALPHABET[(triplet >> 6) & 63] +
        BASE64_ALPHABET[triplet & 63]
      );
    }
  }

  if (mod === 1) {
    const b = bytes[len - 1];
    result.push(
      BASE64_ALPHABET[b >> 2] +
      BASE64_ALPHABET[(b << 4) & 63] +
      "=="
    );
  } else if (mod === 2) {
    const pair = (bytes[len - 2] << 8) + bytes[len - 1];
    result.push(
      BASE64_ALPHABET[pair >> 10] +
      BASE64_ALPHABET[(pair >> 4) & 63] +
      BASE64_ALPHABET[(pair << 2) & 63] +
      "="
    );
  }

  return result.join("");
}

// ===== UTF-8 字节编码 (K.lz) =====
function encodeUtf8(str) {
  const encoded = encodeURIComponent(str);
  const bytes = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') {
      bytes.push(parseInt(encoded[i + 1] + encoded[i + 2], 16));
      i += 2;
    } else {
      bytes.push(encoded.charCodeAt(i));
    }
  }
  return bytes;
}

// ===== MD5 (K.Pu) =====
function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ===== K.lz 序列化 payload 为自定义 JSON =====
// 在 seccore_signv2 中，K.lz 是 encodeUtf8，应用于 JSON.stringify 的结果
function lzSerialize(obj) {
  return encodeUtf8(JSON.stringify(obj));
}

// ===== 获取 body 数据类型 =====
function getDataType(body) {
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return "string";
  if (typeof body === "object") return "object";
  return typeof body;
}

/**
 * 构建 XYS_ 签名
 * @param {string} url - 请求 URL 路径 (如 "/api/sns/web/v1/homefeed")
 * @param {string|object} body - 请求体 (GET 请求传空字符串 "")
 * @param {function} mnsv2Callback - mnsv2(u, m, w) 函数，需在浏览器 VMP 环境中调用
 * @param {object} opts - 可选参数
 * @returns {object} { "X-s": "XYS_...", "X-t": timestamp }
 */
async function buildXysSignature(url, body, mnsv2Callback, opts = {}) {
  const {
    version = "4.3.5",
    platform = "xhs-pc-web",
    os = "Windows"
  } = opts;

  // 处理 body
  let bodyStr = "";
  let dataType = "";
  if (body !== undefined && body !== null && body !== "") {
    if (typeof body === "string") {
      bodyStr = body;
      dataType = "string";
    } else {
      bodyStr = JSON.stringify(body);
      dataType = "object";
    }
  }

  // Step 1: combine
  const combined = url + bodyStr;

  // Step 2: MD5 hashes
  const md5Combined = md5(combined);
  const md5Url = md5(url);

  // Step 3: mnsv2 VMP hash
  const mnsv2Hash = await mnsv2Callback(combined, md5Combined, md5Url);

  // Step 4: Build payload
  const payload = {
    x0: version,
    x1: platform,
    x2: os,
    x3: mnsv2Hash,
    x4: dataType
  };

  // Step 5: Serialize + encode
  const jsonStr = JSON.stringify(payload);
  const utf8Bytes = encodeUtf8(jsonStr);
  const encoded = b64Encode(utf8Bytes);

  const x_s = "XYS_" + encoded;
  const x_t = Date.now().toString();

  return {
    "X-s": x_s,
    "X-t": x_t,
    "X-s-common": buildXsCommon(url, md5Url)  // optional
  };
}

/**
 * 构建 x-s-common 头（通用签名头）
 */
function buildXsCommon(url, md5Url) {
  const payload = {
    a1: "",
    x1: "4.3.5",
    x2: url,
    x3: "xhs-pc-web",
    x4: md5Url || md5(url)
  };
  const jsonStr = JSON.stringify(payload);
  const utf8Bytes = encodeUtf8(jsonStr);
  return b64Encode(utf8Bytes);
}

// Export for both Node.js and browser usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildXysSignature,
    buildXsCommon,
    b64Encode,
    encodeUtf8,
    lzSerialize,
    md5,
    getDataType,
    BASE64_ALPHABET
  };
}
