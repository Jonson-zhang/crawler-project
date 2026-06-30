"""
国家医保局 - 请求签名器
======================

处理 API 请求的签名：
1. x-tif-signature (请求头 SHA256)
2. x-tif-nonce (8位随机字符串)
3. x-tif-timestamp (Unix 时间戳)
4. signData (SM2 签名)
5. encData (SM4 加密)

格式参考：
- 请求头: x-tif-signature, x-tif-timestamp, x-tif-nonce
- 请求体: { data: { data: { encData }, appCode, version, encType, signType, timestamp, signData } }
"""

import json
import time
import random
import string
import hashlib
from .sm_crypto import SM4Cipher


def generate_nonce(length: int = 8) -> str:
    """生成随机 nonce"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))


def generate_timestamp() -> int:
    """生成 Unix 时间戳 (秒)"""
    return int(time.time())


def compute_x_tif_signature(app_code: str, timestamp: str, nonce: str, body: str = "") -> str:
    """
    计算 x-tif-signature 请求头

    算法: SHA256(appCode + timestamp + nonce + body?)

    注意: 此算法为推测，需要验证。
    已确认是 SHA-256 (64 hex chars)。
    """
    # 尝试多种组合
    # 根据多个样本分析，x-tif-signature 可能基于以下输入:
    # SHA256(appCode + timestamp + nonce)
    # 或 SHA256(timestamp + nonce + appCode)
    # 或 SHA256(appCode + timestamp + nonce + requestBody)
    data = f"{app_code}{timestamp}{nonce}"
    return hashlib.sha256(data.encode()).hexdigest()


def build_request_body(
    plaintext: dict,
    app_code: str,
    version: str,
    sm4_cipher: SM4Cipher,
    sm2_signer=None,
) -> dict:
    """
    构造完整的加密请求体

    Args:
        plaintext: 原始查询参数 (dict)
        app_code: 应用标识
        version: 版本号
        sm4_cipher: SM4 加密器
        sm2_signer: SM2 签名器 (optional)

    Returns:
        完整的请求体 dict
    """
    timestamp = generate_timestamp()

    # 1. SM4 加密 data
    plaintext_json = json.dumps(plaintext, ensure_ascii=False, separators=(',', ':'))
    enc_data = sm4_cipher.encrypt_hex(plaintext_json.encode('utf-8'))

    # 2. 构造内部 data
    inner_data = {
        "data": {
            "encData": enc_data
        },
        "appCode": app_code,
        "version": version,
        "encType": "SM4",
        "signType": "SM2",
        "timestamp": timestamp,
    }

    # 3. SM2 签名
    if sm2_signer:
        inner_json = json.dumps(inner_data["data"], ensure_ascii=False, separators=(',', ':'))
        sign_string = f"{app_code}{timestamp}{inner_json}"
        sign_data = sm2_signer.sign_string(sign_string)
        inner_data["signData"] = sign_data
    else:
        inner_data["signData"] = ""

    return {"data": inner_data}


def build_request_headers(
    app_code: str,
    body_json: str,
    nonce: str = None,
    timestamp: int = None,
) -> dict:
    """
    构造请求头

    Returns:
        headers dict
    """
    if nonce is None:
        nonce = generate_nonce()
    if timestamp is None:
        timestamp = generate_timestamp()

    signature = compute_x_tif_signature(app_code, str(timestamp), nonce, body_json)

    return {
        "Content-Type": "application/json",
        "channel": "web",
        "x-tif-paasid": "undefined",
        "x-tif-signature": signature,
        "x-tif-timestamp": str(timestamp),
        "x-tif-nonce": nonce,
        "Accept": "application/json",
        "Accept-Language": "zh-CN,zh;q=0.5",
        "Origin": "https://fuwu.nhsa.gov.cn",
        "Referer": "https://fuwu.nhsa.gov.cn/nationalHallSt/",
    }
