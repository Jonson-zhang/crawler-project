"""
中国空气质量在线监测分析平台 - 加密/解密工具模块
通过 js-reverse MCP 直接从浏览器运行时提取的 AES/DES/BASE64 实现

MCP 逆向来源（get_paused_info + evaluate_script）：
  1. AES.encrypt/decrypt 源码 → MD5(key)[16:32] 派生真实密钥
  2. DES.encrypt/decrypt 源码 → MD5(key)[0:8] 派生真实密钥（单 DES，8 字节密钥）
  3. BASE64 验证 → 标准 Base64 (与 btoa 一致)
  4. poPBVxzNuafY8Yu 源码 → 请求加密全流程
  5. dxvERkeEvHbS 源码 → 响应解密全流程: BASE64→DES→AES→BASE64

密钥来源（MCP get_paused_info frame 2 scope 变量）:
  acky6QolJSJi = "dLRSzDrm8xkryEyL"    # 请求 AES key
  acixHVhiNqmK  = "fex6AA4zRfVrSPmr"    # 请求 AES iv
  ask4u6FbhGV8  = "a0QHmC1Ova5958nC"    # 响应 AES key
  asi2hhkBUJbo  = "bMu71lHRX6bRmPxU"    # 响应 AES iv
  dskQCqpdBOGo  = "hEaIOlrX7tlhAOkz"    # 响应 DES key
  dsiqYiQHbZQp  = "xMBwDXG1HOubUV04"    # 响应 DES iv
"""

import base64
import hashlib
import json

from Crypto.Cipher import AES, DES
from Crypto.Util.Padding import pad, unpad

# ============================================================
# 密钥定义（全部来自 MCP get_paused_info → frame 2 → closure scope）
# ============================================================

# 请求载荷加密（AES-128-CBC）
_REQ_AES_KEY_RAW = "dLRSzDrm8xkryEyL"
_REQ_AES_IV_RAW = "fex6AA4zRfVrSPmr"

# 响应数据解密 — 第一层: DES-CBC（单 DES，8 字节密钥）
_RESP_DES_KEY_RAW = "hEaIOlrX7tlhAOkz"
_RESP_DES_IV_RAW = "xMBwDXG1HOubUV04"

# 响应数据解密 — 第二层: AES-128-CBC
_RESP_AES_KEY_RAW = "a0QHmC1Ova5958nC"
_RESP_AES_IV_RAW = "bMu71lHRX6bRmPxU"

# 请求 payload 中的 appId 和 clienttype（来自 poPBVxzNuafY8Yu.toString()）
_APP_ID = "3c9208efcfb2f5b843eec8d96de6d48a"
_CLIENT_TYPE = "WEB"


def _derive_aes_key_iv(key_raw: str, iv_raw: str) -> tuple[bytes, bytes]:
    """
    派生 AES 真实密钥和 IV（对应 JS AES.encrypt 内部逻辑）

    JS 源码（MCP evaluate_script 获取）:
      var secretkey = (CryptoJS.MD5(key).toString()).substr(16, 16);
      var secretiv = (CryptoJS.MD5(iv).toString()).substr(0, 16);
      secretkey = CryptoJS.enc.Utf8.parse(secretkey);
      secretiv = CryptoJS.enc.Utf8.parse(secretiv);

    含义: 对 key/iv 做 MD5 → 取 32 位 hex 字符串的特定 16 位子串 →
          将子串当作 UTF-8 字节作为真正的 AES-128 密钥/IV
    """
    key_md5 = hashlib.md5(key_raw.encode("utf-8")).hexdigest()
    iv_md5 = hashlib.md5(iv_raw.encode("utf-8")).hexdigest()
    return key_md5[16:32].encode("utf-8"), iv_md5[0:16].encode("utf-8")


def _derive_des_key_iv(key_raw: str, iv_raw: str) -> tuple[bytes, bytes]:
    """
    派生 DES 真实密钥和 IV（对应 JS DES.encrypt/decrypt 内部逻辑）

    JS 源码（MCP evaluate_script 获取）:
      var secretkey = (CryptoJS.MD5(key).toString()).substr(0, 16);
      var secretiv = (CryptoJS.MD5(iv).toString()).substr(24, 8);
      secretkey = CryptoJS.enc.Utf8.parse(secretkey);
      secretiv = CryptoJS.enc.Utf8.parse(secretiv);

    注意: JS 取了 MD5(key)[0:16]（16 字符），但实际运行中 CryptoJS.DES 将
    16 字节 key 截断为前 8 字节作为单 DES 密钥（DES-56）。
    因此 Python 直接取 MD5(key)[0:8]（8 字节）作为 DES 密钥。
    """
    key_md5 = hashlib.md5(key_raw.encode("utf-8")).hexdigest()
    iv_md5 = hashlib.md5(iv_raw.encode("utf-8")).hexdigest()
    return key_md5[0:8].encode("utf-8"), iv_md5[24:32].encode("utf-8")


# ─── 预计算密钥（避免每次调用重复计算）───────────────────────────

_REQ_AES_KEY, _REQ_AES_IV = _derive_aes_key_iv(_REQ_AES_KEY_RAW, _REQ_AES_IV_RAW)
_RESP_AES_KEY, _RESP_AES_IV = _derive_aes_key_iv(_RESP_AES_KEY_RAW, _RESP_AES_IV_RAW)
_RESP_DES_KEY, _RESP_DES_IV = _derive_des_key_iv(_RESP_DES_KEY_RAW, _RESP_DES_IV_RAW)


# ============================================================
# AES 加密/解密
# ============================================================

def aes_encrypt(plaintext: str, key: bytes, iv: bytes) -> str:
    """AES-128-CBC 加密，PKCS7 填充，输出 Base64"""
    cipher = AES.new(key, AES.MODE_CBC, iv)
    ct = cipher.encrypt(pad(plaintext.encode("utf-8"), AES.block_size))
    return base64.b64encode(ct).decode("utf-8")


def aes_decrypt(ciphertext_b64: str, key: bytes, iv: bytes) -> str:
    """AES-128-CBC 解密，Base64 输入 → UTF-8 输出"""
    ct = base64.b64decode(ciphertext_b64)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    pt = unpad(cipher.decrypt(ct), AES.block_size)
    return pt.decode("utf-8")


# ============================================================
# DES 解密（单 DES，8 字节密钥，CBC，PKCS7）
# ============================================================

def des_decrypt(ciphertext_b64: str, key: bytes, iv: bytes) -> str:
    """DES-CBC 解密，Base64 输入 → UTF-8 输出"""
    ct = base64.b64decode(ciphertext_b64)
    cipher = DES.new(key, DES.MODE_CBC, iv)
    pt = unpad(cipher.decrypt(ct), DES.block_size)
    return pt.decode("utf-8")


# ============================================================
# 请求载荷构建
# ============================================================

def _sort_object(obj: dict) -> dict:
    """模拟 osZ34YC04S: 对 object 的 key 排序"""
    return dict(sorted(obj.items()))


def build_encrypted_payload(method: str, obj: dict) -> str:
    """
    构建加密请求参数 (hA4Nse2cT 的值)

    JS 源码 (poPBVxzNuafY8Yu.toString(), MCP evaluate_script 获取):
      var pKmSFk8 = {
        appId: "3c9208efcfb2f5b843eec8d96de6d48a",
        method: m0fhOhhGL,
        timestamp: t5GECZQ,
        clienttype: "WEB",
        object: oNLhNQ,
        secret: hex_md5(appId + method + timestamp + clienttype + JSON.stringify(osZ34YC04S(oNLhNQ)))
      };
      pKmSFk8 = BASE64.encrypt(JSON.stringify(pKmSFk8));
      pKmSFk8 = AES.encrypt(pKmSFk8, acky6QolJSJi, acixHVhiNqmK);
      return pKmSFk8;
    """
    import time

    timestamp = int(time.time() * 1000)
    sorted_obj = _sort_object(obj)
    obj_json = json.dumps(sorted_obj, ensure_ascii=False, separators=(",", ":"))

    secret = hashlib.md5(
        (_APP_ID + method + str(timestamp) + _CLIENT_TYPE + obj_json).encode("utf-8")
    ).hexdigest()

    payload = {
        "appId": _APP_ID,
        "method": method,
        "timestamp": timestamp,
        "clienttype": _CLIENT_TYPE,
        "object": obj,
        "secret": secret,
    }
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    # BASE64.encrypt (标准 Base64)
    b64_encoded = base64.b64encode(payload_json.encode("utf-8")).decode("utf-8")

    # AES.encrypt
    return aes_encrypt(b64_encoded, _REQ_AES_KEY, _REQ_AES_IV)


def decrypt_response(encrypted_data: str) -> str:
    """
    解密 API 响应数据

    JS 源码 (dxvERkeEvHbS.toString(), MCP evaluate_script 获取):
      function dxvERkeEvHbS(data) {
        data = BASE64.decrypt(data);                              // step 1: base64 → DES 输出(也是base64)
        data = DES.decrypt(data, dskQCqpdBOGo, dsiqYiQHbZQp);    // step 2: DES → AES 输出(base64)
        data = AES.decrypt(data, ask4u6FbhGV8, asi2hhkBUJbo);     // step 3: AES → base64 字符串
        data = BASE64.decrypt(data);                              // step 4: base64 → final JSON
        return data;
      }
    """
    # Step 1: BASE64 decode → DES.encrypt 的输出 (base64 字符串)
    step1 = base64.b64decode(encrypted_data).decode("ascii")

    # Step 2: DES (单DES) 解密 → AES.encrypt 的输出 (base64 字符串)
    step2 = des_decrypt(step1, _RESP_DES_KEY, _RESP_DES_IV)

    # Step 3: AES 解密 → base64 编码的数据
    step3 = aes_decrypt(step2, _RESP_AES_KEY, _RESP_AES_IV)

    # Step 4: BASE64 decode → 最终 JSON 字符串
    return base64.b64decode(step3).decode("utf-8")
