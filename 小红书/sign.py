#!/usr/bin/env python3
"""
小红书 X-s 纯算签名 (Python)
基于 CSDN 文章: https://blog.csdn.net/2401_87132899/article/details/161775174

mnsv2 核心算法:
  mns0201: 89 字节 payload → XXTEA(key=e6483ca2a1eed5e3, delta=0x3C6EF373) → 自定义 Base64
  mns0301: 135 字节 payload → RC4(预置 S-box) → 自定义 Base64
"""
import hashlib
import json
import struct
import time
import random
import os
import sys
from pathlib import Path

# ═══ 自定义 Base64 字母表 ═══
XHS_B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"
MNS0201_B64 = "MfgqrsbcyzPQRStuvC7mn501HIJBo2DEFTKdeNOwxWXYZap89+/A4UVLhijkl63G"

def custom_base64_encode(data: bytes, alphabet: str = XHS_B64) -> str:
    """自定义 Base64 编码"""
    result = []
    for i in range(0, len(data), 3):
        b1 = data[i]
        b2 = data[i + 1] if i + 1 < len(data) else 0
        b3 = data[i + 2] if i + 2 < len(data) else 0
        result.append(alphabet[b1 >> 2])
        result.append(alphabet[((b1 & 3) << 4) | (b2 >> 4)])
        result.append(alphabet[((b2 & 15) << 2) | (b3 >> 6)] if i + 1 < len(data) else alphabet[0])
        result.append(alphabet[b3 & 63] if i + 2 < len(data) else alphabet[0])
    return ''.join(result)


# ═══ XXTEA 加密 ═══
XXTEA_KEY = b"e6483ca2a1eed5e3"  # 16 字节
XXTEA_DELTA = 0x3C6EF373

def _xxtea_mx(z, y, total, key, p, e):
    return (((z >> 5) ^ (y << 2)) + ((y >> 3) ^ (z << 4))) ^ ((total ^ y) + (key[(p & 3) ^ e] ^ z))

def xxtea_encrypt(data: bytes, key: bytes = XXTEA_KEY) -> bytes:
    """XXTEA 加密 (修正版 delta=0x3C6EF373)"""
    if not data:
        return data

    n = (len(data) + 3) // 4  # ceil(len/4)
    if n < 2:
        n = 2

    # Pad data to n*4 bytes with zeros
    v = list(data.ljust(n * 4, b'\x00'))

    # Convert to uint32 LE array
    v32 = []
    for i in range(0, len(v), 4):
        v32.append(struct.unpack('<I', bytes(v[i:i+4]))[0])

    # Parse key
    k = []
    for i in range(0, 16, 4):
        k.append(struct.unpack('<I', key[i:i+4])[0])

    # XXTEA encrypt
    rounds = 6 + 52 // n
    total = 0
    z = v32[n - 1]

    for _ in range(rounds):
        total = (total + XXTEA_DELTA) & 0xFFFFFFFF
        e = (total >> 2) & 3

        for p in range(n - 1):
            y = v32[p + 1]
            v32[p] = (v32[p] + _xxtea_mx(z, y, total, k, p, e)) & 0xFFFFFFFF
            z = v32[p]

        y = v32[0]
        v32[n - 1] = (v32[n - 1] + _xxtea_mx(z, y, total, k, n - 1, e)) & 0xFFFFFFFF
        z = v32[n - 1]

    # Convert back to bytes
    result = b''
    for val in v32:
        result += struct.pack('<I', val)

    return result


# ═══ RC4 (mns0301) ═══
# S-box 需要从 VMP eval 代码中提取，目前使用占位
# 实际 S-box 是 256 字节的置换表
RC4_SBOX = None  # TODO: 从 VMP 字节码中提取


# ═══ mnsv2 签名 ═══
def mnsv2_sign(combined: str, hash_combined: str, hash_url: str,
               a1_cookie: str = "", page_load_ts: int = 0,
               click_count: int = 0, mouseenter_count: int = 0) -> str:
    """
    生成 mns0301 签名 (RC4 版本)

    当前使用 XXTEA fallback (mns0201)
    """
    if RC4_SBOX is not None:
        return _mns0301_sign(combined, hash_combined, hash_url, a1_cookie, page_load_ts, click_count, mouseenter_count)
    else:
        return _mns0201_sign(combined, hash_combined, hash_url)


def _mns0201_sign(combined: str, hash_combined: str, hash_url: str) -> str:
    """mns0201: XXTEA 加密版本"""
    # 构建 89 字节 payload
    # 格式: magic(4) + random(4) + ts(8) + flags(4) + md5_xor(32) + extra
    payload = bytearray(89)

    now_ts = int(time.time() * 1000)

    # [0-3] 魔数
    payload[0:4] = b'xh\\)'

    # [4-7] 随机数
    rand = random.randint(0, 0xFFFFFFFF)
    struct.pack_into('<I', payload, 4, rand)

    # [8-15] 时间戳 ms (little-endian 64-bit)
    struct.pack_into('<Q', payload, 8, now_ts)

    # [16-19] 标志位
    struct.pack_into('<I', payload, 16, 15)

    # [20-51] XOR 编码的 MD5 哈希
    hc_bytes = bytes.fromhex(hash_combined)  # 16 bytes
    hu_bytes = bytes.fromhex(hash_url)  # 16 bytes
    for i in range(16):
        payload[20 + i] = hc_bytes[i] ^ 0x5A
        payload[36 + i] = hu_bytes[i] ^ 0xA5

    # [52-55] URL 长度
    struct.pack_into('<I', payload, 52, len(combined))

    # [56-88] 零填充 (临时)
    for i in range(56, 89):
        payload[i] = 0

    # XXTEA 加密
    encrypted = xxtea_encrypt(bytes(payload))

    # 自定义 Base64
    encoded = custom_base64_encode(encrypted, MNS0201_B64)

    return f"mns0201_{encoded}"


def _mns0301_sign(combined: str, hash_combined: str, hash_url: str,
                   a1_cookie: str = "", page_load_ts: int = 0,
                   click_count: int = 0, mouseenter_count: int = 0) -> str:
    """mns0301: RC4 加密版本"""
    # TODO: 实现 135 字节 payload + RC4
    pass


# ═══ seccore_signv2 ═══
def _load_cookies():
    cf = Path(__file__).parent / "data" / "cookies.json"
    if cf.exists():
        return json.loads(cf.read_text())
    return {}

def sign(url: str, data) -> dict:
    """小红书 X-s 签名"""
    cookies = _load_cookies()
    body_str = data if isinstance(data, str) else json.dumps(data, separators=(',', ':'))
    combined = url + body_str

    md5 = lambda s: hashlib.md5(s.encode()).hexdigest()
    hc = md5(combined)
    hu = md5(url)

    x3 = mnsv2_sign(combined, hc, hu)

    payload = json.dumps({
        "x0": "4.3.5",
        "x1": "xhs-pc-web",
        "x2": "Windows",
        "x3": x3,
        "x4": "string" if isinstance(data, str) else "object",
    }, separators=(',', ':'))

    # x-s-common: 静态设备指纹 JSON
    a1 = cookies.get("a1", "")
    xsc = {
        "s0": 5,
        "s1": "",
        "x0": "1",
        "x1": "4.3.5",
        "x2": "Windows",
        "x3": "xhs-pc-web",
        "x4": "6.23.0",
        "x5": a1,
        "x6": "",
        "x7": "",
        "x8": "",
        "x9": -1867254643,
        "x10": 0,
        "x11": "normal",
        "x12": f"{int(time.time()*1000)};1780544914310",
    }

    return {
        "x-s": "XYS_" + custom_base64_encode(payload.encode('utf-8')),
        "x-t": str(int(time.time() * 1000)),
        "x-s-common": custom_base64_encode(json.dumps(xsc, separators=(',', ':')).encode('utf-8')),
    }


# ═══ CLI ═══
if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "/api/sns/web/v1/homefeed"
    body = sys.argv[2] if len(sys.argv) > 2 else '{"cursor_score":"","num":20}'
    try:
        body = json.loads(body)
    except json.JSONDecodeError:
        pass

    result = sign(url, body)
    print(json.dumps(result))
