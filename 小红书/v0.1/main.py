#!/usr/bin/env python3
"""
main.py — 小红书首页推荐流抓取 (API 翻页)

用法: python main.py
修改下方 PAGES 控制页数
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote

from curl_cffi import requests

# ===== 配置 =====
PAGES = 3       # 翻页数，改这里
DETAIL_COUNT = 0  # 默认不抓详情，--detail N 设置
INTERVAL = 1.5  # 页间间隔秒数

# ===== 路径 =====
BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"

B64_ALPHABET = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"


def b64_encode(data: bytes) -> str:
    n = len(data)
    m = n % 3
    r = []
    i = 0
    end = n - m
    while i < end:
        limit = min(i + 16383, end)
        j = i
        while j < limit:
            t = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            r.append(B64_ALPHABET[(t >> 18) & 63] + B64_ALPHABET[(t >> 12) & 63] + B64_ALPHABET[(t >> 6) & 63] + B64_ALPHABET[t & 63])
            j += 3
        i = limit
    if m == 1:
        b = data[n - 1]
        r.append(B64_ALPHABET[b >> 2] + B64_ALPHABET[(b << 4) & 63] + "==")
    elif m == 2:
        p = (data[n - 2] << 8) + data[n - 1]
        r.append(B64_ALPHABET[p >> 10] + B64_ALPHABET[(p >> 4) & 63] + B64_ALPHABET[(p << 2) & 63] + "=")
    return "".join(r)


def utf8_encode(s: str) -> bytes:
    e = quote(s, safe="~()*!./:?=&-_")
    result = bytearray()
    i = 0
    while i < len(e):
        if e[i] == "%":
            result.append(int(e[i + 1 : i + 3], 16))
            i += 3
        else:
            result.append(ord(e[i]))
            i += 1
    return bytes(result)


def load_cookies() -> dict:
    if COOKIES_FILE.exists():
        return json.loads(COOKIES_FILE.read_text())
    return {}


def node_sign(api_path: str, body: dict = None) -> dict:
    """调用 sign.js，传入 api_path 和 JSON body"""
    body_json = json.dumps(body or {}, separators=(",", ":"))
    result = subprocess.run(
        ["node", str(SIGN_JS), api_path, body_json],
        capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR),
    )
    if result.returncode != 0:
        err = result.stderr or "(无错误输出)"
        raise RuntimeError(f"sign.js 失败 (exit={result.returncode}): {err.strip()}")
    if not result.stdout or not result.stdout.strip():
        raise RuntimeError("sign.js 无输出")
    return json.loads(result.stdout.strip())


def build_xs_common(api_path: str) -> str:
    """构建 x-s-common 头"""
    import hashlib
    md5_url = hashlib.md5(api_path.encode()).hexdigest()
    payload = {"a1": "", "x1": "4.3.5", "x2": api_path, "x3": "xhs-pc-web", "x4": md5_url}
    return b64_encode(utf8_encode(json.dumps(payload, separators=(",", ":"))))


def sign_api(api_path: str, body: dict = None) -> dict:
    """对任意 API 路径签名"""
    signed = node_sign(api_path, body)
    return {
        "x-s": signed.get("X-s", signed.get("x-s", "")),
        "x-t": signed.get("X-t", signed.get("x-t", "")),
        "x-s-common": build_xs_common(api_path),
    }


def fetch_homefeed(cursor: str = "", note_index: int = 0, cookies: dict = None) -> dict:
    api_path = "/api/sns/web/v1/homefeed"
    body = {
        "cursor_score": cursor, "num": 20, "refresh_type": 1,
        "note_index": note_index, "unread_begin_note_id": "",
        "unread_end_note_id": "", "unread_note_count": 0,
        "category": "homefeed_recommend", "search_key": "",
        "need_num": 14, "image_formats": ["jpg", "webp", "avif"],
        "need_filter_image": False,
    }
    signed = sign_api(api_path, body)

    s = requests.Session()
    s.headers.update({
        "user-agent": UA, "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    })
    if cookies:
        s.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})

    resp = s.post(API_URL, json=body, headers={
        "content-type": "application/json;charset=UTF-8",
        **signed,
    }, timeout=30, impersonate="chrome131")
    return resp.json()


def fetch_note_detail(note_id: str, cookies: dict, session: requests.Session) -> dict | None:
    """通过 SSR 页面提取笔记正文（desc）"""
    try:
        resp = session.get(
            f"https://www.xiaohongshu.com/explore/{note_id}",
            headers={"accept": "text/html"},
            timeout=20, impersonate="chrome131",
        )
        html = resp.text
        idx = html.find("window.__INITIAL_STATE__=")
        if idx < 0:
            return None

        start = html.index("{", idx)
        depth = 0
        end = start
        for i in range(start, len(html)):
            if html[i] == "{":
                depth += 1
            elif html[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        data = json.loads(html[start:end].replace("undefined", "null"))
        note = data.get("note", {}).get("noteDetailMap", {}).get(note_id, {}).get("note", {})
        if note:
            return {
                "desc": note.get("desc", ""),
                "title": note.get("title", ""),
                "type": note.get("type", ""),
                "tag_list": [t.get("name", "") for t in (note.get("tagList") or [])],
                "image_count": len(note.get("imageList") or []),
            }
    except Exception:
        pass
    return None


def format_note(i: int, item: dict) -> str:
    """格式化笔记摘要"""
    nc = item.get("note_card") or item
    note_type = nc.get("type", "?")
    type_icon = {"video": "🎬", "normal": "📝"}.get(note_type, "📌")
    title = (nc.get("display_title") or nc.get("title") or "").strip()
    user = nc.get("user", {})
    author = user.get("nickname") or user.get("nick_name", "?")
    likes = (nc.get("interact_info") or {}).get("liked_count", "0")
    cover = nc.get("cover", {})
    cover_url = cover.get("url", "")

    lines = [
        f"{'=' * 60}",
        f"  #{i}  {type_icon} {title[:80]}",
        f"  作者: {author}  |  ❤ {likes}  |  类型: {note_type}",
    ]
    if cover_url:
        lines.append(f"  封面: {cover_url[:100]}")

    return "\n".join(lines)


def format_note_detail(note_id: str, detail: dict) -> str:
    """格式化笔记正文"""
    lines = [
        f"{'  ' + '-' * 56}",
        f"  笔记ID: {note_id}",
        f"  类型: {detail.get('type', '?')}",
        f"  标签: {', '.join(detail.get('tag_list', []))}",
        f"  图片数: {detail.get('image_count', 0)}",
        f"  正文:",
    ]
    desc = detail.get("desc", "")
    # 每行最多 70 字符换行
    for j in range(0, len(desc), 70):
        lines.append(f"    {desc[j:j+70]}")
    return "\n".join(lines)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="小红书首页推荐流抓取")
    parser.add_argument("--detail", type=int, default=0, help="提取前 N 条笔记的详细正文")
    args = parser.parse_args()

    detail_count = args.detail or DETAIL_COUNT

    cookies = load_cookies()
    if not cookies.get("web_session"):
        print("[!] cookies.json 缺少 web_session，请先在浏览器登录后更新")
        sys.exit(1)

    print(f"[*] web_session: {cookies['web_session'][:20]}...")
    print(f"[*] 页数: {PAGES}, 详情: {'前' + str(detail_count) + '条' if detail_count else '不抓'}")

    # 签名预检
    try:
        sign_api("/api/sns/web/v1/homefeed", {"cursor_score": "", "num": 1, "refresh_type": 1, "note_index": 0})
    except Exception as e:
        print(f"[!] 签名预检失败: {e}")
        sys.exit(1)

    # 共享 session（带 cookie 用于详情页请求）
    shared_session = requests.Session()
    shared_session.headers.update({
        "user-agent": UA, "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    })
    shared_session.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})

    total = 0
    all_notes = []  # [(note_id, item), ...]
    cursor, note_index = "", 0

    # ── 翻页抓取 ──
    for pg in range(1, PAGES + 1):
        print(f"\n{'─' * 60}")
        print(f"  第 {pg}/{PAGES} 页")
        print(f"{'─' * 60}")

        data = fetch_homefeed(cursor, note_index, cookies)

        code = data.get("code")
        if not data.get("success") and code != 0:
            msg = data.get("msg", "")
            print(f"  [!] API 错误: code={code} msg={msg}")
            break

        items = data.get("data", {}).get("items") or []
        if not items:
            print("  (无数据)")
            break

        total += len(items)
        for i, it in enumerate(items, 1):
            global_idx = (pg - 1) * 20 + i
            note_id = it.get("id", "")
            all_notes.append((note_id, it))
            print(format_note(global_idx, it))

        cursor = data.get("data", {}).get("cursor_score") or ""
        note_index += len(items)

        if not cursor:
            print(f"\n  (已到最后一页)")
            break

        time.sleep(INTERVAL)

    # ── 摘要 ──
    print(f"\n{'=' * 60}")
    print(f"  总计: {total} 条笔记")
    print(f"{'=' * 60}")

    # ── 详情 ──
    if detail_count > 0 and all_notes:
        print(f"\n{'─' * 60}")
        print(f"  提取前 {min(detail_count, len(all_notes))} 条笔记正文...")
        print(f"{'─' * 60}")

        for i, (note_id, _) in enumerate(all_notes[:detail_count]):
            print(f"\n  [{i + 1}/{min(detail_count, len(all_notes))}] 获取 {note_id}...")
            detail = fetch_note_detail(note_id, cookies, shared_session)
            if detail:
                print(format_note_detail(note_id, detail))
            else:
                print(f"    (无法获取)")

    print(f"\n{'=' * 60}")
    print(f"  完成! 共 {total} 条笔记")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
