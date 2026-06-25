#!/usr/bin/env python3
"""
request.py — 小红书首页推荐流抓取 (离线签名)

签名链: Node.js (env + VMP → mnsv2 → seccore_signv2) → Python HTTP

用法:
  python request.py [--pages 3]

前提:
  - node 已安装, crypto-js 已安装 (npm install crypto-js)
  - data/cookies.json 含有效登录 cookie (a1, webId, web_session 等)
"""

import json
import subprocess
import time
from pathlib import Path

from curl_cffi import requests

BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
API_PATH = "/api/sns/web/v1/homefeed"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)


def load_cookies() -> dict:
    """加载 cookies.json"""
    if COOKIES_FILE.exists():
        return json.loads(COOKIES_FILE.read_text())
    print("[WARN] cookies.json 不存在")
    return {}


def node_sign(body: dict) -> dict:
    """调用 Node.js 签名脚本, 返回 {"X-s": "...", "X-t": "..."}"""
    body_json = json.dumps(body, separators=(",", ":"))
    result = subprocess.run(
        ["node", str(SIGN_JS), body_json],
        capture_output=True,
        text=True,
        timeout=15,
        cwd=str(BASE_DIR),
    )

    if result.returncode != 0:
        raise RuntimeError(f"sign.js 失败 (exit={result.returncode}): {result.stderr.strip()}")

    stdout = result.stdout.strip()
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        # 尝试提取最后一行 JSON
        for line in reversed(stdout.split("\n")):
            line = line.strip()
            if line.startswith("{"):
                try:
                    return json.loads(line)
                except json.JSONDecodeError:
                    continue
        raise RuntimeError(f"无法解析 sign.js 输出: {stdout[:200]}")


class XhsClient:
    """小红书客户端"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "user-agent": UA,
            "origin": "https://www.xiaohongshu.com",
            "referer": "https://www.xiaohongshu.com/",
        })
        cookies = load_cookies()
        if cookies:
            # filter to string values only
            self.session.cookies.update({
                k: str(v) for k, v in cookies.items() if isinstance(v, str)
            })

    def homefeed(self, cursor: str = "", note_index: int = 0) -> dict:
        """获取首页推荐流"""
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

        signed = node_sign(body)

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


def show_item(i: int, item: dict):
    """打印笔记摘要"""
    nc = item.get("note_card") or item
    title = nc.get("display_title") or nc.get("title", "(无标题)")
    user = nc.get("user", {})
    author = user.get("nickname") or user.get("nick_name", "?")
    likes = nc.get("interact_info", {}).get("liked_count", "?")
    print(f"  {i:2d}. {title[:60]}")
    print(f"      @{author}  ♥{likes}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="小红书首页抓取")
    parser.add_argument("--pages", type=int, default=1, help="抓取页数")
    args = parser.parse_args()

    # 预检: 签名脚本能否运行
    try:
        node_sign({"cursor_score": "", "num": 1, "refresh_type": 1, "note_index": 0})
    except Exception as e:
        print(f"[!] 签名预检失败: {e}")
        print("[!] 请检查: npm install crypto-js 是否已执行")
        return

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

            items = (
                data.get("data", {}).get("notes")
                or data.get("data", {}).get("items", [])
            )
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
        import traceback

        traceback.print_exc()
    finally:
        print(f"\n{'=' * 50}")
        print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    main()
