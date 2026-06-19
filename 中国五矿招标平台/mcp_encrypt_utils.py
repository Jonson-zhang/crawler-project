"""
中国五矿招标平台 - RSA加密工具模块 (MCP 逆向版)
通过 js-reverse MCP 直接从浏览器运行时提取的加密函数源码

逆向来源：
  - index.js:2339-2360  → encryptLong（MCP save_script_source 获取）
  - vendors.js:209486-209498 → hex2b64 / p()（MCP Grep+Read 获取）
  - vendors.js:211051-211059 → RSA encrypt（MCP Grep+Read 获取）
  - 网络请求: reqid=115 → 确认了 /zbs/by-lx-page 端点和 param 格式（MCP break_on_xhr 拦截）

JSEncrypt.prototype.encryptLong 源码（直接来自 MCP get_script_source）:
  d["a"].prototype.encryptLong = function (A) {
    var e = this.getKey(),
      t = ((e.n.bitLength() + 7) >> 3) - 11;
    try {
      var n = "", r = "";
      if (A.length > t)
        return (
          (n = A.match(/.{1,50}/g)),         // ← 50字符分块
          n.forEach(function (A) {
            var t = e.encrypt(A);              // → hex (256 chars)
            r += t;
          }),
          w(r)                                 // → hex2b64
        );
      var a = e.encrypt(A), s = w(a);
      return s;
    } catch (i) {
      return i;
    }
  };

hex2b64 / p() 源码（直接来自 MCP）:
  function p(e) {
    var t, n, r = "";
    for (t = 0; t + 3 <= e.length; t += 3)
      ((n = parseInt(e.substring(t, t + 3), 16)),
       (r += f.charAt(n >> 6) + f.charAt(63 & n)));
    t + 1 == e.length
      ? ((n = parseInt(e.substring(t, t + 1), 16)), (r += f.charAt(n << 2)))
      : t + 2 == e.length &&
        ((n = parseInt(e.substring(t, t + 2), 16)),
         (r += f.charAt(n >> 2) + f.charAt((3 & n) << 4)));
    while ((3 & r.length) > 0) r += h;
    return r;
  }

RSA encrypt 源码（直接来自 MCP）:
  e.prototype.encrypt = function (e) {
    var t = (this.n.bitLength() + 7) >> 3,
      n = se(e, t);                        // PKCS1 padding
    if (null == n) return null;
    var r = this.doPublic(n);              // RSA 模幂运算
    if (null == r) return null;
    for (var o = r.toString(16), i = o.length, a = 0; a < 2 * t - i; a++)
      o = "0" + o;                          // 补齐到 256 字符
    return o;
  };
"""

import base64
import hashlib
import json

import requests
from Crypto.Cipher import PKCS1_v1_5
from Crypto.PublicKey import RSA

# ============================================================
# 以下全部基于 MCP 直接从浏览器运行时提取的源码逐行翻译
# ============================================================

_B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
_B64_PAD = "="

# 公钥 API 端点（MCP 从 reqid=114 的 XHR 请求中确认）
_PUBLIC_KEY_URL = "https://ecuat.minmetals.com.cn/open/homepage/public"

# MCP 从 reqid=115 的网络请求中确认的 Headers
_COMMON_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": "https://ecuat.minmetals.com.cn/open/home/purchase-info",
    "Origin": "https://ecuat.minmetals.com.cn",
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
}


def fetch_public_key(session: requests.Session | None = None) -> str:
    """请求公钥（MCP reqid=114 确认的端点: POST /open/homepage/public）"""
    requester = session if session else requests
    resp = requester.post(_PUBLIC_KEY_URL, headers=_COMMON_HEADERS)
    resp.raise_for_status()
    return resp.text.strip()


def md5_hash(text: str) -> str:
    """MD5 → 32 位小写十六进制（MCP 从笔记确认 B() 函数即 MD5 hex）"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def hex2b64(hex_str: str) -> str:
    """
    MCP 从 vendors.js:209486-209498 提取的 p() 函数的 Python 等价实现

    JS 源码:
      function p(e) {
        var t, n, r = "";
        for (t = 0; t + 3 <= e.length; t += 3)
          ((n = parseInt(e.substring(t, t + 3), 16)),
           (r += f.charAt(n >> 6) + f.charAt(63 & n)));
        t + 1 == e.length
          ? ((n = parseInt(e.substring(t, t + 1), 16)), (r += f.charAt(n << 2)))
          : t + 2 == e.length &&
            ((n = parseInt(e.substring(t, t + 2), 16)),
             (r += f.charAt(n >> 2) + f.charAt((3 & n) << 4)));
        while ((3 & r.length) > 0) r += h;
        return r;
      }
    """
    result = ""
    i = 0
    while i + 3 <= len(hex_str):
        n = int(hex_str[i : i + 3], 16)
        result += _B64_ALPHABET[n >> 6] + _B64_ALPHABET[n & 63]
        i += 3

    if i + 1 == len(hex_str):
        n = int(hex_str[i : i + 1], 16)
        result += _B64_ALPHABET[n << 2]
    elif i + 2 == len(hex_str):
        n = int(hex_str[i : i + 2], 16)
        result += _B64_ALPHABET[n >> 2] + _B64_ALPHABET[(n & 3) << 4]

    while len(result) % 4:
        result += _B64_PAD
    return result


def encrypt_long(plaintext: str, public_key_b64: str) -> str:
    """
    MCP 从 index.js:2339-2360 提取的 encryptLong 的 Python 等价实现

    关键差异（MCP 直接从源码确认，避免了猜测）：
    1. 分块大小: 50 字符（/.{1,50}/g），不是 117 字节
    2. 每块加密后: hex 补齐到 2*keySize（256 字符）
    3. 最后: hex2b64 编码
    """
    key_der = base64.b64decode(public_key_b64)
    rsa_key = RSA.import_key(key_der)
    key_size_bytes = rsa_key.size_in_bytes()  # 128 for 1024-bit
    threshold = key_size_bytes - 11  # 117 — 来自 JS: ((bitLength + 7) >> 3) - 11

    cipher = PKCS1_v1_5.new(rsa_key)
    combined_hex = ""

    if len(plaintext) > threshold:
        # 对应 JS: A.match(/.{1,50}/g)
        CHUNK = 50
        for start in range(0, len(plaintext), CHUNK):
            chunk = plaintext[start : start + CHUNK]
            encrypted = cipher.encrypt(chunk.encode("utf-8"))
            # 对应 JS: for(var a=0;a<2*t-i;a++)o="0"+o;
            combined_hex += encrypted.hex().zfill(2 * key_size_bytes)
    else:
        encrypted = cipher.encrypt(plaintext.encode("utf-8"))
        combined_hex = encrypted.hex().zfill(2 * key_size_bytes)

    # 对应 JS: w(r)  — 即 p() / hex2b64
    return hex2b64(combined_hex)


def build_params(lx: str = "ZBGG", page_index: int = 1) -> dict:
    """
    构建请求参数（MCP 从浏览器调用栈中确认的字段名）
    """
    return {
        "inviteMethod": "",
        "businessClassfication": "",
        "mc": "",
        "lx": lx,
        "dwmc": "",
        "pageIndex": page_index,
    }


def build_encrypted_param(base_params: dict, public_key_b64: str) -> str:
    """
    完整加密流程（MCP 从 XHR 断点拦截中确认: param 为 684 位 base64 字符串）
    """
    import time

    sign = md5_hash(json.dumps(base_params, ensure_ascii=False, separators=(",", ":")))
    full_params = {
        **base_params,
        "sign": sign,
        "timeStamp": int(time.time() * 1000),
    }
    plaintext = json.dumps(full_params, ensure_ascii=False, separators=(",", ":"))
    return encrypt_long(plaintext, public_key_b64)
