"""
中国观鸟中心 - 加密/解密工具函数
接口: https://api.birdreport.cn/front/activity/search

加密体系:
  请求签名: MD5(json数据 + requestId + timestamp)
  请求载荷: RSA-1024 + PKCS1v1.5 分段加密 + Base64
  响应解密: AES-256-CBC / PKCS7

AES key/IV 由混淆后的 hex 字符串推导:
  key_src → hex_decode → "C8EB5514AF5ADDB94B2207B08C66601C" (UTF-8 32 bytes → AES-256)
  iv_src  → hex_decode → "55DD79C6F04E1A67"            (UTF-8 16 bytes)
"""

import hashlib
import base64

from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5, AES
from Crypto.Util.Padding import unpad

# ====== 常量 ======
RSA_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCvxXa98E1uWXnBzXkS2yHU
fnBM6n3PCwLdfIox03T91joBvjtoDqiQ5x3tTOfpHs3LtiqMMEafls6b0YWt
gB1dse1W5m+FpeusVkCOkQxB4SZDH6tuerIknnmB/Hsq5wgEkIvO5Pff9bii
g6AyoAkdWpSek/1/B7zYIepYY0lxKQIDAQAB
-----END PUBLIC KEY-----"""

# AES key/IV source hex strings (从 JS 中逆向提取)
_AES_KEY_SRC = "6756696653534952657053656868665752665050485566485667545454484967"
_AES_IV_SRC = "53536868555767547048526949655455"


def _hex_decode(s: str) -> str:
    """模拟 JS 中的 hex 解码: 每2位hex作为一个 decimal 值转 ASCII 字符"""
    result = ""
    for i in range(0, len(s), 2):
        result += chr(int(s[i : i + 2]))
    return result


# 推导 AES key/IV (UTF-8 bytes)
_AES_KEY = _hex_decode(_AES_KEY_SRC).encode("utf-8")  # 32 bytes → AES-256
_AES_IV = _hex_decode(_AES_IV_SRC).encode("utf-8")  # 16 bytes


def sort_ascii(obj: dict) -> dict:
    """按键名 ASCII 排序"""
    return dict(sorted(obj.items()))


def rsa_encrypt_long(plaintext: str) -> str:
    """RSA 分段加密 (1024-bit key, 每段最长 117 bytes)

    对应 JS: JSEncrypt.prototype.encryptLong
    """
    key = RSA.import_key(RSA_PUBLIC_KEY)
    cipher = PKCS1_v1_5.new(key)
    data = plaintext.encode("utf-8")
    max_len = 117  # 128 - 11 for PKCS1 v1.5 padding

    result = b""
    for i in range(0, len(data), max_len):
        chunk = data[i : i + max_len]
        result += cipher.encrypt(chunk)
    return base64.b64encode(result).decode()


def aes_decrypt(encrypted_data: str) -> str:
    """AES-256-CBC 解密响应数据

    对应 JS: BIRDREPORT_APIJS.decode
    """
    cipher = AES.new(_AES_KEY, AES.MODE_CBC, iv=_AES_IV)
    raw = base64.b64decode(encrypted_data)
    decrypted = cipher.decrypt(raw)
    return unpad(decrypted, AES.block_size).decode("utf-8")


def build_sign(data: str, request_id: str, timestamp: int) -> str:
    """生成请求签名: MD5(data + requestId + timestamp)

    对应 JS 中 beforeSend 逻辑
    """
    return hashlib.md5((data + request_id + str(timestamp)).encode()).hexdigest()
