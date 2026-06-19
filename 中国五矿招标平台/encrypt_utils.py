"""
中国五矿招标平台 - RSA加密工具模块
实现 JSEncrypt.encryptLong 的 Python 等价代码

逆向自 ecuat.minmetals.com.cn 的前端 JavaScript 代码：
- chunk-vendors.js: JSEncrypt 库 (RSA 加密核心)
- index.js: encryptLong 自定义分块 + hex2b64 编码
"""

import base64
import hashlib
import json

import requests
from Crypto.Cipher import PKCS1_v1_5
from Crypto.PublicKey import RSA

# Base64 编码表（标准）
_B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
_B64_PAD = "="


def fetch_public_key(session: requests.Session | None = None) -> str:
    """
    请求 /open/homepage/public 获取 RSA 公钥（Base64 编码的 DER 格式）

    Args:
        session: 可选的 requests.Session，用于复用 cookie
    """
    url = "https://ecuat.minmetals.com.cn/open/homepage/public"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://ecuat.minmetals.com.cn/logonAction.do",
        "Origin": "https://ecuat.minmetals.com.cn",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
    }
    requester = session if session else requests
    resp = requester.post(url, headers=headers)
    resp.raise_for_status()
    return resp.text.strip()


def md5_hash(text: str) -> str:
    """计算字符串的 MD5 哈希值（32位小写十六进制）"""
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def _hex2b64(hex_str: str) -> str:
    """
    将十六进制字符串转换为 Base64（等同于 JSEncrypt 的 hex2b64）

    这是 JSEncrypt 库内置的编码函数，算法如下：
    - 每 3 个十六进制字符（12 bits）→ 2 个 Base64 字符
    - 剩余 1 个十六进制字符（4 bits）→ 1 个 Base64 字符 + 4 个零位
    - 剩余 2 个十六进制字符（8 bits）→ 1 个 Base64 字符 + 剩余 2 bits → 另一个 Base64 字符
    - 末尾用 "=" 补齐到 4 的倍数
    """
    result = ""
    i = 0
    while i + 3 <= len(hex_str):
        n = int(hex_str[i : i + 3], 16)
        result += _B64_ALPHABET[n >> 6] + _B64_ALPHABET[n & 63]
        i += 3

    # 处理剩余字符
    if i + 1 == len(hex_str):
        # 剩余 1 个 hex 字符
        n = int(hex_str[i : i + 1], 16)
        result += _B64_ALPHABET[n << 2]
    elif i + 2 == len(hex_str):
        # 剩余 2 个 hex 字符
        n = int(hex_str[i : i + 2], 16)
        result += _B64_ALPHABET[n >> 2] + _B64_ALPHABET[(n & 3) << 4]

    # 补齐到 4 的倍数
    while len(result) % 4:
        result += _B64_PAD

    return result


def encrypt_long(plaintext: str, public_key_b64: str) -> str:
    """
    使用 RSA 公钥加密长文本（等同于 JSEncrypt.encryptLong）

    逆向自 index.js 中的实际实现：
    ```javascript
    d["a"].prototype.encryptLong = function(A) {
        var e = this.getKey(),
            t = (e.n.bitLength() + 7 >> 3) - 11;  // 117 (1024-bit key)
        var n = "", r = "";
        if (A.length > t)
            return n = A.match(/.{1,50}/g),     // ← 关键：按 50 字符分块！
            n.forEach(function(A) {
                var t = e.encrypt(A);            // ← RSA 加密 → 定长 hex
                r += t                           // ← 拼接 hex
            }),
            w(r);                                // ← hex → base64
        var a = e.encrypt(A), s = w(a);
        return s;
    };
    ```

    内部 encrypt 返回固定长度 hex（2 * key_size 字符，如 1024-bit 密钥 → 256 字符）
    """
    # 解码 Base64 公钥（DER 格式），生成 RSA 密钥对象
    key_der = base64.b64decode(public_key_b64)
    rsa_key = RSA.import_key(key_der)

    key_size_bytes = rsa_key.size_in_bytes()  # 128 字节（1024-bit）
    threshold = key_size_bytes - 11           # 117 字符（判断是否分块）

    cipher = PKCS1_v1_5.new(rsa_key)
    combined_hex = ""

    if len(plaintext) > threshold:
        # 按 50 字符分块（匹配 JS 的 A.match(/.{1,50}/g)）
        chunk_size = 50
        for i in range(0, len(plaintext), chunk_size):
            chunk = plaintext[i : i + chunk_size]
            encrypted_bytes = cipher.encrypt(chunk.encode("utf-8"))
            # 补齐到固定长度 2 * key_size_bytes（模仿 JSEncrypt 内部 encrypt）
            hex_str = encrypted_bytes.hex().zfill(2 * key_size_bytes)
            combined_hex += hex_str
    else:
        encrypted_bytes = cipher.encrypt(plaintext.encode("utf-8"))
        combined_hex = encrypted_bytes.hex().zfill(2 * key_size_bytes)

    # 最后整体做 hex → base64
    return _hex2b64(combined_hex)


# ─── API 端点路由 ────────────────────────────────────────────────
# 不同 LX 代码使用不同的后端接口：
#   ZB* / ZG* → /open/homepage/zbs/by-lx-page   (招标相关)
#   CG* / XJC* → /open/homepage/cgxj/by-lx-page  (采购相关)
#   JP*        → /open/homepage/jps/by-lx-page   (竞价相关)

_BASE = "https://ecuat.minmetals.com.cn"

_LX_API_MAP: dict[str, str] = {
    "ZBGG": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "CQGG": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "ZBZZGG": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "ZGYSCQ": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "ZGYS": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "ZBJG": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "ZBGS": f"{_BASE}/open/homepage/zbs/by-lx-page",
    "CGGG": f"{_BASE}/open/homepage/cgxj/by-lx-page",
    "XJCQGG": f"{_BASE}/open/homepage/cgxj/by-lx-page",
    "CGJG": f"{_BASE}/open/homepage/cgxj/by-lx-page",
    "JPGG": f"{_BASE}/open/homepage/jps/by-lx-page",
    "JPCQ": f"{_BASE}/open/homepage/jps/by-lx-page",
    "JPJG": f"{_BASE}/open/homepage/jps/by-lx-page",
}

# 通用的请求头（所有 API 共用）
_COMMON_HEADERS: dict[str, str] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Referer": f"{_BASE}/open/home/purchase-info?tabIndex=0",
    "Origin": _BASE,
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
}


def get_api_url(lx: str) -> str:
    """根据 LX 代码返回对应的 API 端点 URL"""
    if url := _LX_API_MAP.get(lx):
        return url
    raise ValueError(f"未知的 LX 代码: {lx}")


def build_params(
    lx: str = "ZBGG",
    page_index: int = 1,
    invite_method: str = "",
    business_classfication: str = "",
    mc: str = "",
    dwmc: str = "",
) -> dict:
    """
    构建请求参数对象

    参数说明：
    - lx: 类型代码，见 _LX_API_MAP 中定义的全部代码
    - page_index: 页码
    - mc: 模糊搜索关键词
    - dwmc: 单位名称
    """
    return {
        "inviteMethod": invite_method,
        "businessClassfication": business_classfication,
        "mc": mc,
        "lx": lx,
        "dwmc": dwmc,
        "pageIndex": page_index,
    }


def build_encrypted_param(base_params: dict, public_key_b64: str) -> str:
    """
    构建加密后的请求参数（完整流程）

    流程：
    1. 对 base_params 的 JSON 字符串做 MD5 → sign
    2. 加入 timeStamp（当前毫秒时间戳）
    3. 用 RSA 公钥加密整个 JSON
    """
    import time

    # 生成 sign：对 base_params 的 JSON 做 MD5
    sign = md5_hash(json.dumps(base_params, ensure_ascii=False, separators=(",", ":")))

    # 合并参数
    full_params = {
        **base_params,
        "sign": sign,
        "timeStamp": int(time.time() * 1000),
    }

    # JSON 序列化（与前端一致：无空格，逗号冒号分隔）
    plaintext = json.dumps(full_params, ensure_ascii=False, separators=(",", ":"))

    # RSA 加密
    encrypted = encrypt_long(plaintext, public_key_b64)

    return encrypted
