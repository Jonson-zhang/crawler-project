#!/usr/bin/env python3
"""
request.py — 小红书首页推荐流抓取（离线版）

方案:
  1. SSR HTML → 解析笔记（无需 cookie，无需签名）
  2. homefeed API → 翻页（需 web_session cookie + mns0201 签名）

用法:
  python request.py             # 抓首页 SSR 数据
  python request.py --api       # 用 API 模式（需 cookies.json 含 web_session）
  python request.py --pages 3   # 翻页（API 模式）
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

from curl_cffi import requests

BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
EXPLORE_URL = "https://www.xiaohongshu.com/explore"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
API_PATH = "/api/sns/web/v1/homefeed"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)

NOTE_LINK_RE = re.compile(r"/explore/([a-f0-9]{24})")


def extract_notes_from_html(html: str) -> list[dict]:
    """从 SSR HTML 提取笔记（title + author + likes）"""
    notes = []
    seen = set()

    # SSR 结构: <section class="note-item"> ... <a href="/explore/<24位hex>"> ... </section>
    sections = re.split(r'<section[^>]*class="[^"]*note-item[^"]*"[^>]*>', html)

    for section in sections[1:]:
        id_match = re.search(r'href="/explore/([a-f0-9]{24})', section)
        if not id_match:
            continue
        note_id = id_match.group(1)
        if note_id in seen:
            continue
        seen.add(note_id)

        sec_end = section.find("</section>")
        if sec_end < 0:
            sec_end = len(section)
        text_block = section[:sec_end]

        # 去掉 HTML 标签和空白
        text = re.sub(r"<[^>]+>", " ", text_block)
        text = " ".join(text.split())
        if not text:
            continue

        parts = text.split()

        # 解析: title_words... author_name likes_count
        likes = ""
        author = ""
        title_end = len(parts)

        # 从末尾向前找 likes 数字
        if parts and re.match(r"^\d+[\d.]*[万kmK]?$", parts[-1]):
            likes = parts[-1]
            title_end -= 1

        # 作者通常在末尾一个非数字 tokens 之前
        if title_end > 0:
            author = parts[title_end - 1]
            title_end -= 1

        title = " ".join(parts[:title_end]) if title_end > 0 else text[:60]
        if not title:
            title = note_id[:12]

        notes.append({
            "id": note_id,
            "title": title[:80],
            "author": author[:20],
            "likes": likes,
        })

    return notes


def fetch_explore_ssr() -> list[dict]:
    """GET explore 页面，从 SSR HTML 提取笔记（无需 cookie）"""
    s = requests.Session()
    s.headers.update({
        "user-agent": UA,
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9",
    })

    # 先访问首页获取基础 cookie
    s.get("https://www.xiaohongshu.com/", impersonate="chrome131", timeout=15)

    # 再访问 explore
    resp = s.get(EXPLORE_URL, impersonate="chrome131", timeout=15)
    html = resp.text

    # 保存 cookie 以备 API 模式使用
    cookies = {k: v for k, v in s.cookies.items()}
    if cookies.get("web_session"):
        print(f"[*] 获取到 web_session: {cookies['web_session'][:20]}...")
        COOKIES_FILE.parent.mkdir(parents=True, exist_ok=True)
        existing = {}
        if COOKIES_FILE.exists():
            existing = json.loads(COOKIES_FILE.read_text())
        existing.update(cookies)
        COOKIES_FILE.write_text(json.dumps(existing, ensure_ascii=False, indent=2))

    notes = extract_notes_from_html(html)
    print(f"[+] SSR 提取 {len(notes)} 条笔记")
    return notes


def load_cookies() -> dict:
    if COOKIES_FILE.exists():
        return json.loads(COOKIES_FILE.read_text())
    return {}


def node_sign(body: dict) -> dict:
    body_json = json.dumps(body, separators=(",", ":"))
    result = subprocess.run(
        ["node", str(SIGN_JS), body_json],
        capture_output=True, text=True, timeout=20, cwd=str(BASE_DIR),
    )
    if result.returncode != 0:
        raise RuntimeError(f"sign.js 失败: {result.stderr.strip()}")
    return json.loads(result.stdout.strip())


def fetch_homefeed_api(cursor: str = "", note_index: int = 0, cookies: dict = None) -> dict:
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


def safe_print(s: str):
    """安全打印，过滤终端不支持的 Unicode 字符"""
    try:
        print(s)
    except UnicodeEncodeError:
        print(s.encode("ascii", errors="replace").decode("ascii"))


def show_item(i: int, item: dict):
    title = item.get("title", "") or item.get("id", "?")[:12]
    if "author" in item:
        safe_print(f"  {i:2d}. {title[:60]}")
        safe_print(f"      @{item['author']}  likes:{item.get('likes', '?')}")
    else:
        safe_print(f"  {i:2d}. {title[:60]}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="小红书首页抓取")
    parser.add_argument("--api", action="store_true", help="API 模式（需 web_session）")
    parser.add_argument("--pages", type=int, default=1, help="翻页数")
    parser.add_argument("--refresh-cookies", action="store_true", help="先访问页面获取 cookie")
    args = parser.parse_args()

    # SSR 模式：无需 cookie，无需签名
    if not args.api:
        notes = fetch_explore_ssr()
        if notes:
            print(f"\n{'=' * 50}")
            print(f"共 {len(notes)} 条:")
            for i, n in enumerate(notes[:20]):
                show_item(i + 1, n)
            if len(notes) > 20:
                print(f"  ... 还有 {len(notes) - 20} 条")
            print(f"\n[提示] 首次访问已自动保存 cookies 到 data/cookies.json")
            print(f"[提示] 需要翻页时使用: python request.py --api --pages 3")
        return

    # API 模式
    if args.refresh_cookies:
        print("[*] 先访问页面获取 cookie...")
        fetch_explore_ssr()

    cookies = load_cookies()
    if not cookies.get("web_session"):
        print("[!] web_session 不存在")
        print("[!] 请先运行: python request.py (获取临时 cookie)")
        print("[!] 或手动设置 data/cookies.json 中的 web_session")
        sys.exit(1)

    print(f"[*] API 模式, web_session: {cookies['web_session'][:20]}...")

    # 签名预检
    try:
        node_sign({"cursor_score": "", "num": 1, "refresh_type": 1, "note_index": 0})
    except Exception as e:
        print(f"[!] 签名失败: {e}")
        sys.exit(1)

    total = 0
    cursor, note_index = "", 0
    for pg in range(1, args.pages + 1):
        print(f"\n{'=' * 50}")
        print(f"[*] 第 {pg}/{args.pages} 页 ...")

        data = fetch_homefeed_api(cursor, note_index, cookies)

        if not data.get("success") and data.get("code") != 0:
            code = data.get("code")
            msg = data.get("msg", "")
            print(f"[!] API 错误: code={code} msg={msg}")
            if code == 300011:
                print("[!] 账号风控，需换 IP 或重新获取 web_session")
            break

        items = data.get("data", {}).get("notes") or data.get("data", {}).get("items", [])
        if not items:
            print("(无数据)")
            break

        total += len(items)
        for i, it in enumerate(items, 1):
            nc = it.get("note_card") or it
            title = (nc.get("display_title") or nc.get("title") or "?")[:60]
            author = (nc.get("user") or {}).get("nickname") or "?"
            likes = (nc.get("interact_info") or {}).get("liked_count") or 0
            show_item((pg - 1) * 20 + i, {"title": title, "author": author, "likes": likes})

        cursor = data.get("data", {}).get("cursor", "")
        note_index += len(items)

        if not data.get("data", {}).get("has_more") or not cursor:
            print("(已到最后一页)")
            break

        time.sleep(1.5)

    print(f"\n{'=' * 50}")
    print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    main()
