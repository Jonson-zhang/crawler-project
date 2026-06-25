#!/usr/bin/env python3
"""
request.py — 小红书首页推荐流抓取 (混合签名方案)

签名链:
  Python: MD5×2 + Base64 + UTF8 编码
  浏览器: mnsv2(combined, MD5(combined), MD5(url))  ← js-reverse MCP
  Python: 组装 XYS_ → HTTP POST

用法:
  python request.py [--pages 3]
  前提: js-reverse MCP 浏览器已打开 xiaohongshu.com
"""

import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests
from curl_cffi import requests as curl_requests

BASE_DIR = Path(__file__).parent
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
API_PATH = "/api/sns/web/v1/homefeed"

BASE64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)

# ==== 自定义 Base64 编码 ====
def b64_encode(data: bytes) -> str:
    result = []
    n = len(data)
    mod = n % 3
    i = 0
    end = n - mod
    while i < end:
        limit = min(i + 16383, end)
        j = i
        while j < limit:
            triplet = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            result.append(
                BASE64[(triplet >> 18) & 63]
                + BASE64[(triplet >> 12) & 63]
                + BASE64[(triplet >> 6) & 63]
                + BASE64[triplet & 63]
            )
            j += 3
        i = limit
    if mod == 1:
        b = data[n - 1]
        result.append(BASE64[b >> 2] + BASE64[(b << 4) & 63] + "==")
    elif mod == 2:
        pair = (data[n - 2] << 8) + data[n - 1]
        result.append(
            BASE64[pair >> 10]
            + BASE64[(pair >> 4) & 63]
            + BASE64[(pair << 2) & 63]
            + "="
        )
    return "".join(result)


# ==== UTF-8 字节编码 ====
def encode_utf8(s: str) -> bytes:
    encoded = quote(s, safe="~()*!.'")
    result = bytearray()
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


# ==== MD5 ====
def md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


# ==== 通过 js-reverse MCP 调用 mnsv2 ====
# 这个 callback 由外部的 Claude Code 循环提供
_mnsv2_callback = None


def set_mnsv2_callback(cb):
    """设置 mnsv2 调用回调"""
    global _mnsv2_callback
    _mnsv2_callback = cb


def call_mnsv2(combined: str, md5_combined: str, md5_url: str) -> str:
    """
    通过浏览器 VMP 调用 mnsv2
    返回 "mns0301_..." (200 字符)
    """
    if _mnsv2_callback is None:
        raise RuntimeError("mnsv2 callback 未设置，请调用 set_mnsv2_callback()")
    return _mnsv2_callback(combined, md5_combined, md5_url)


# ==== 签名 ====
def sign(url: str, body: dict | str | None) -> dict:
    """
    对请求签名，返回 {"X-s": "XYS_...", "X-t": "1234567890"}
    """
    if body is None:
        body_str = ""
        data_type = ""
    elif isinstance(body, str):
        body_str = body
        data_type = "string"
    else:
        body_str = json.dumps(body, separators=(",", ":"))
        data_type = "object"

    combined = url + body_str
    md5_combined = md5(combined)
    md5_url = md5(url)

    mnsv2_hash = call_mnsv2(combined, md5_combined, md5_url)

    payload = {
        "x0": "4.3.5",
        "x1": "xhs-pc-web",
        "x2": "Windows",
        "x3": mnsv2_hash,
        "x4": data_type,
    }

    json_str = json.dumps(payload, separators=(",", ":"))
    utf8_bytes = encode_utf8(json_str)
    encoded = b64_encode(utf8_bytes)

    return {
        "X-s": "XYS_" + encoded,
        "X-t": str(int(time.time() * 1000)),
    }


# ==== 客户端 ====
class XhsClient:
    def __init__(self):
        self.session = curl_requests.Session()
        self.session.headers.update({
            "user-agent": UA,
            "origin": "https://www.xiaohongshu.com",
            "referer": "https://www.xiaohongshu.com/",
        })
        if COOKIES_FILE.exists():
            cookies = json.loads(COOKIES_FILE.read_text())
            # curl_cffi 接受 dict[str,str]
            self.session.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})

    def homefeed(self, cursor: str = "", note_index: int = 0) -> dict:
        body = {
            "cursor_score": cursor,
            "num": 20,
            "refresh_type": 1,
            "note_index": note_index,
            "unread_begin_note_id": "",
            "unread_end_note_id": "",
            "unread_note_count": 0,
            "category": "homefeed_recommend",
            "search_key": "",
            "need_num": 14,
            "image_formats": ["jpg", "webp", "avif"],
            "need_filter_image": False,
        }

        signed = sign(API_PATH, body)
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "x-s": signed["X-s"],
            "x-t": signed["X-t"],
        }

        r = self.session.post(
            API_URL, json=body, headers=headers,
            timeout=30, impersonate="chrome131",
        )
        return r.json()


# ==== 独立运行（有 MCP bridge 时） ====
def show_item(i: int, item: dict):
    nc = item.get("note_card") or item
    title = nc.get("display_title") or nc.get("title", "(无标题)")
    user = nc.get("user", {})
    author = user.get("nickname") or user.get("nick_name", "?")
    likes = nc.get("interact_info", {}).get("liked_count", "?")
    print(f"  {i:2d}. {title[:60]}")
    if author != "?":
        print(f"      @{author}  ♥{likes}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="小红书首页抓取")
    parser.add_argument("--pages", type=int, default=1)
    args = parser.parse_args()

    # 从环境变量或文件读取 mnsv2 bridge
    # 在 Claude Code 中，由 MCP evaluate_script 提供

    client = XhsClient()
    total = 0
    try:
        cursor, note_index = "", 0
        for pg in range(1, args.pages + 1):
            print(f"\n{'=' * 50}")
            print(f"[*] 第 {pg}/{args.pages} 页 ...")

            data = client.homefeed(cursor, note_index)

            if not data.get("success") and data.get("code") != 0:
                print(f"[!] API 错误: code={data.get('code')}, msg={data.get('msg', '?')}")
                print(f"    响应: {json.dumps(data, ensure_ascii=False)[:300]}")
                break

            items = data.get("data", {}).get("notes") or data.get("data", {}).get("items", [])
            if not items:
                print("(无数据)")
                break

            total += len(items)
            for i, it in enumerate(items, 1):
                show_item((pg - 1) * 20 + i, it)

            cursor = data.get("data", {}).get("cursor", "")
            note_index += len(items)

            if not data.get("data", {}).get("has_more", False) or not cursor:
                print("(已到最后一页)")
                break

            time.sleep(1.5)
    except KeyboardInterrupt:
        print("\n[!] 中断")
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback; traceback.print_exc()
    finally:
        print(f"\n{'=' * 50}")
        print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    main()
