#!/usr/bin/env python3
"""
小红书 — 首页推荐流爬取 (Node.js 离线签名)

用法:
  python main.py            获取首页推荐
  python main.py --pages 3  获取 3 页

签名流程:
  1. Python 调用 node sign.js <url> <body> 获取 x-s / x-t
  2. Python 用 requests 发 HTTP 请求
  3. 解析和展示结果
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
SIGN_JS = BASE_DIR / "sign.js"

PAGES = 1
REQUEST_INTERVAL = 1.5
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        print(*(str(a).encode("ascii", "replace").decode() for a in args), **kwargs)
    sys.stdout.flush()


class XhsClient:
    """Python 客户端 — 签名委托给 Node.js sign.js"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "user-agent": UA,
            "origin": "https://www.xiaohongshu.com",
            "referer": "https://www.xiaohongshu.com/",
        })
        # 加载 cookie
        if COOKIES_FILE.exists():
            cookies = json.loads(COOKIES_FILE.read_text("utf-8"))
            self.session.cookies.update(cookies)

    def sign(self, url: str, body: dict) -> dict:
        """调用 Node.js sign.js 生成签名"""
        body_str = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
        result = subprocess.run(
            ["node", str(SIGN_JS), url, body_str],
            capture_output=True, text=True, timeout=60,
            cwd=str(BASE_DIR),
        )
        if result.returncode != 0:
            raise RuntimeError(f"sign.js 错误:\n{result.stderr}")
        return json.loads(result.stdout)

    def homefeed(self, cursor_score: str = "", note_index: int = 0) -> dict:
        """请求首页推荐流"""
        body = {
            "cursor_score": cursor_score,
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
        signed = self.sign(API_URL, body)
        headers = {
            "content-type": "application/json;charset=UTF-8",
            "x-s": signed["x-s"],
            "x-t": signed["x-t"],
        }
        if signed.get("x-s-common"):
            headers["x-s-common"] = signed["x-s-common"]

        resp = self.session.post(API_URL, json=body, headers=headers, timeout=30)
        return resp.json()


def show_item(i: int, item: dict):
    note = item.get("note_card") or item
    title = note.get("display_title", note.get("title", "(无标题)"))
    user = note.get("user", {})
    author = user.get("nickname", user.get("nick_name", "?"))
    likes = note.get("interact_info", {}).get("liked_count", "?")
    safe_print(f"  {i:2d}. {title[:60]}")
    if author != "?":
        safe_print(f"      @{author}  ❤{likes}")


def main():
    client = XhsClient()
    total = 0

    try:
        cursor = ""
        note_index = 0
        for pg in range(1, PAGES + 1):
            safe_print(f"\n{'─' * 50}")
            safe_print(f"[*] 第 {pg}/{PAGES} 页 ...")

            data = client.homefeed(cursor, note_index)
            if not data.get("success") and data.get("code") != 0:
                safe_print(f"[!] API 错误: code={data.get('code')}, msg={data.get('msg', '?')}")
                safe_print(f"    响应: {json.dumps(data, ensure_ascii=False)[:200]}")
                break

            items = data.get("data", {}).get("notes") or data.get("data", {}).get("items", [])
            if not items:
                safe_print("(无数据)")
                break

            total += len(items)
            for i, it in enumerate(items, 1):
                show_item((pg - 1) * 20 + i, it)

            cursor = data.get("data", {}).get("cursor", "")
            note_index += len(items)
            has_more = data.get("data", {}).get("has_more", False)
            if not has_more or not cursor:
                safe_print("(已到最后一页)")
                break

            time.sleep(REQUEST_INTERVAL)

    except Exception as e:
        safe_print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
    finally:
        safe_print(f"\n{'─' * 50}")
        safe_print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="小红书 — 首页推荐流")
    p.add_argument("--pages", type=int, default=PAGES, help=f"页数 (默认 {PAGES})")
    args = p.parse_args()
    PAGES = args.pages
    main()
