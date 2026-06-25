#!/usr/bin/env python3
"""
main.py — 小红书首页推荐流抓取 (API 翻页)

用法: python main.py
修改下方 PAGES 变量控制页数
"""

import json
import subprocess
import sys
import time
from pathlib import Path

from curl_cffi import requests

# ===== 配置 =====
PAGES = 3  # 翻页数，改这里
INTERVAL = 1.5  # 页间间隔秒数

# ===== 路径 =====
BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"


def load_cookies() -> dict:
    if COOKIES_FILE.exists():
        return json.loads(COOKIES_FILE.read_text())
    return {}


def node_sign(body: dict) -> dict:
    body_json = json.dumps(body, separators=(",", ":"))
    result = subprocess.run(
        ["node", str(SIGN_JS), body_json],
        capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR),
    )
    if result.returncode != 0:
        err = result.stderr or "(无错误输出)"
        raise RuntimeError(f"sign.js 失败 (exit={result.returncode}): {err.strip()}")
    if not result.stdout or not result.stdout.strip():
        raise RuntimeError("sign.js 无输出")
    return json.loads(result.stdout.strip())


def fetch_homefeed(cursor: str = "", note_index: int = 0, cookies: dict = None) -> dict:
    body = {
        "cursor_score": cursor, "num": 20, "refresh_type": 1,
        "note_index": note_index, "unread_begin_note_id": "",
        "unread_end_note_id": "", "unread_note_count": 0,
        "category": "homefeed_recommend", "search_key": "",
        "need_num": 14, "image_formats": ["jpg", "webp", "avif"],
        "need_filter_image": False,
    }

    signed = node_sign(body)

    s = requests.Session()
    s.headers.update({
        "user-agent": UA, "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    })
    if cookies:
        s.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})

    resp = s.post(API_URL, json=body, headers={
        "content-type": "application/json;charset=UTF-8",
        "x-s": signed["X-s"], "x-t": signed["X-t"],
        "x-s-common": signed.get("X-s-common", ""),
    }, timeout=30, impersonate="chrome131")

    return resp.json()


def main():
    cookies = load_cookies()
    if not cookies.get("web_session"):
        print("[!] cookies.json 缺少 web_session，请先在浏览器登录后更新")
        sys.exit(1)

    print(f"[*] web_session: {cookies['web_session'][:20]}...")

    # 签名预检
    try:
        node_sign({"cursor_score": "", "num": 1, "refresh_type": 1, "note_index": 0})
    except Exception as e:
        print(f"[!] 签名预检失败: {e}")
        sys.exit(1)

    total = 0
    cursor, note_index = "", 0

    for pg in range(1, PAGES + 1):
        print(f"\n{'=' * 50}")
        print(f"[*] 第 {pg}/{PAGES} 页 ...")

        data = fetch_homefeed(cursor, note_index, cookies)

        code = data.get("code")
        if not data.get("success") and code != 0:
            msg = data.get("msg", "")
            print(f"[!] API 错误: code={code} msg={msg}")
            if code == 300011:
                print("[!] 账号风控，需换 IP 或重新获取 web_session")
            break

        items = data.get("data", {}).get("items") or data.get("data", {}).get("notes") or []
        if not items:
            print("(无数据)")
            break

        total += len(items)
        for i, it in enumerate(items, 1):
            nc = it.get("note_card") or it
            title = (nc.get("display_title") or nc.get("title") or "?")[:60]
            author = (nc.get("user") or {}).get("nickname") or "?"
            likes = (nc.get("interact_info") or {}).get("liked_count") or "0"
            try:
                print(f"  {(pg - 1) * 20 + i:2d}. {title}")
                print(f"      @{author}  {likes}")
            except UnicodeEncodeError:
                print(f"  {(pg - 1) * 20 + i:2d}. {title.encode('ascii', errors='replace').decode()}")
                print(f"      @{author.encode('ascii', errors='replace').decode()}  {likes}")

        cursor = data.get("data", {}).get("cursor_score") or data.get("data", {}).get("cursor", "")
        note_index += len(items)

        if not cursor:
            print("(已到最后一页)")
            break

        time.sleep(INTERVAL)

    print(f"\n{'=' * 50}")
    print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    main()
