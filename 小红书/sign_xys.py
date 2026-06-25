"""
XHS XYS_ 签名 — Python 桥接模块

完整签名链:
  1. MD5(url + body) + MD5(url)  — Python 侧 (hashlib)
  2. mnsv2(combined, md5_1, md5_2)  — 浏览器 VMP 侧 (MCP evaluate_js)
  3. build payload → JSON → UTF-8 → custom base64 → XYS_  — Python 侧

用法:
  from sign_xys import Signer
  signer = Signer(evaluate_js_callback)  # evaluate_js 来自 MCP
  headers = await signer.sign("/api/sns/web/v1/homefeed", '{"num":20}')
"""

import hashlib
import json
import time
from urllib.parse import quote

# 自定义 Base64 表 (K.xE)
_BASE64_ALPHABET = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"

def b64_encode(data: bytes) -> str:
    """K.xE — 自定义 base64 编码"""
    result = []
    chunk_size = 16383
    n = len(data)
    mod = n % 3

    i = 0
    end = n - mod
    while i < end:
        limit = min(i + chunk_size, end)
        j = i
        while j < limit:
            triplet = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            result.append(
                _BASE64_ALPHABET[(triplet >> 18) & 63]
                + _BASE64_ALPHABET[(triplet >> 12) & 63]
                + _BASE64_ALPHABET[(triplet >> 6) & 63]
                + _BASE64_ALPHABET[triplet & 63]
            )
            j += 3
        i = limit

    if mod == 1:
        b = data[n - 1]
        result.append(
            _BASE64_ALPHABET[b >> 2] + _BASE64_ALPHABET[(b << 4) & 63] + "=="
        )
    elif mod == 2:
        pair = (data[n - 2] << 8) + data[n - 1]
        result.append(
            _BASE64_ALPHABET[pair >> 10]
            + _BASE64_ALPHABET[(pair >> 4) & 63]
            + _BASE64_ALPHABET[(pair << 2) & 63]
            + "="
        )

    return "".join(result)


def encode_utf8(s: str) -> bytes:
    """K.lz — UTF-8 编码 (模拟 encodeURIComponent 的字节输出)"""
    result = []
    encoded = quote(s, safe="~()*!.'")  # 近似 encodeURIComponent
    i = 0
    while i < len(encoded):
        ch = encoded[i]
        if ch == "%":
            result.append(int(encoded[i + 1 : i + 3], 16))
            i += 3
        else:
            result.append(ord(ch))
            i += 1
    return bytes(result)


def md5(s: str) -> str:
    """K.Pu — 标准 MD5"""
    return hashlib.md5(s.encode()).hexdigest()


class Signer:
    """XHS XYS_ 签名器"""

    def __init__(self, evaluate_js_callback, version="4.3.5", platform="xhs-pc-web", os_name="Windows"):
        """
        Args:
            evaluate_js_callback: async 函数, 接受 JS 表达式字符串, 返回 result dict
            version: x0 字段
            platform: x1 字段
            os_name: x2 字段
        """
        self.evaluate_js = evaluate_js_callback
        self.version = version
        self.platform = platform
        self.os = os_name

    async def _mnsv2(self, combined: str, md5_combined: str, md5_url: str) -> str:
        """通过浏览器 VMP 调用 mnsv2"""
        js = (
            f'try {{ var r = window.mnsv2({json.dumps(combined)}, {json.dumps(md5_combined)},'
            f' {json.dumps(md5_url)}); JSON.stringify({{ok:true, v:r}}) }} catch(e) {{'
            f' JSON.stringify({{ok:false, err:e.message}}) }}'
        )
        result = await self.evaluate_js(js)
        # result 是 JSON 字符串
        data = json.loads(result) if isinstance(result, str) else result
        if not data.get("ok"):
            raise RuntimeError(f"mnsv2 failed: {data.get('err', 'unknown')}")
        return data["v"]

    async def sign(self, url: str, body=None) -> dict:
        """
        对请求签名

        Args:
            url: API 路径 (如 "/api/sns/web/v1/homefeed")
            body: 请求体, dict/str/None

        Returns:
            {"X-s": "XYS_...", "X-t": "1234567890"}
        """
        # 处理 body
        if body is None:
            body_str = ""
            data_type = ""
        elif isinstance(body, str):
            body_str = body
            data_type = "string"
        else:
            body_str = json.dumps(body, separators=(",", ":"))
            data_type = "object"

        # Step 1: combine
        combined = url + body_str

        # Step 2: MD5
        md5_combined = md5(combined)
        md5_url = md5(url)

        # Step 3: mnsv2
        mnsv2_hash = await self._mnsv2(combined, md5_combined, md5_url)

        # Step 4: build payload
        payload = {
            "x0": self.version,
            "x1": self.platform,
            "x2": self.os,
            "x3": mnsv2_hash,
            "x4": data_type,
        }

        # Step 5: encode
        json_str = json.dumps(payload, separators=(",", ":"))
        utf8_bytes = encode_utf8(json_str)
        encoded = b64_encode(utf8_bytes)

        x_s = "XYS_" + encoded
        x_t = str(int(time.time() * 1000))

        return {"X-s": x_s, "X-t": x_t}

    @staticmethod
    def build_xs_common(url: str, md5_url: str = None) -> str:
        """构建 x-s-common 头"""
        if md5_url is None:
            md5_url = md5(url)
        payload = {
            "a1": "",
            "x1": "4.3.5",
            "x2": url,
            "x3": "xhs-pc-web",
            "x4": md5_url,
        }
        json_str = json.dumps(payload, separators=(",", ":"))
        utf8_bytes = encode_utf8(json_str)
        return b64_encode(utf8_bytes)
