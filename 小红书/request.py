#!/usr/bin/env python3
"""
request.py — 小红书首页推荐流抓取 (Node.js 签名桥接)

用法:
  python request.py [--pages 3]

签名链:
  Python 侧: cookies + 构建 body → subprocess 调用 node sign.js
  Node 侧: env + VMP 字节码 → window.mnsv2 → seccore_signv2 → XYS_
  Python 侧: 组装 headers → HTTP POST → 解析响应
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import requests

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
    """从 cookies.json 加载已登录 cookie"""
    if COOKIES_FILE.exists():
        raw = json.loads(COOKIES_FILE.read_text())
        # 保留所有 cookie 字段
        return raw
    print("[WARN] cookies.json 不存在，将以未登录状态请求")
    return {}


def node_sign(body: dict) -> dict:
    """
    调用 Node.js 签名脚本

    sign.js 通过 stdout 输出 JSON: {"X-s": "XYS_...", "X-t": "1234567890"}
    """
    body_json = json.dumps(body, separators=(",", ":"))
    result = subprocess.run(
        ["node", str(SIGN_JS), body_json],
        capture_output=True,
        text=True,
        timeout=15,
        cwd=str(BASE_DIR),
    )

    if result.returncode != 0:
        stderr = result.stderr.strip()
        raise RuntimeError(f"sign.js 退出码 {result.returncode}: {stderr}")

    # 解析 stdout 中的 JSON
    stdout = result.stdout.strip()
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        # 可能 stdout 还含其他输出，尝试提取 JSON 行
        for line in stdout.split("\n"):
            line = line.strip()
            if line.startswith("{"):
                try:
                    return json.loads(line)
                except json.JSONDecodeError:
                    continue
        raise RuntimeError(f"无法解析 sign.js 输出: {stdout[:200]}")


class XhsClient:
    """小红书 API 客户端"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "user-agent": UA,
                "origin": "https://www.xiaohongshu.com",
                "referer": "https://www.xiaohongshu.com/",
            }
        )
        cookies = load_cookies()
        if cookies:
            self.session.cookies.update(cookies)

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

        # 通过 Node.js VMP 签名
        signed = node_sign(body)

        headers = {
            "content-type": "application/json;charset=UTF-8",
            "x-s": signed["X-s"],
            "x-t": signed["X-t"],
        }
        if signed.get("X-s-common"):
            headers["x-s-common"] = signed["X-s-common"]

        r = self.session.post(API_URL, json=body, headers=headers, timeout=30)
        return r.json()


def show_item(i: int, item: dict):
    """打印笔记摘要"""
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

    parser = argparse.ArgumentParser(description="小红书首页推荐流抓取")
    parser.add_argument("--pages", type=int, default=1, help="抓取页数")
    args = parser.parse_args()

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
        print("\n[!] 用户中断")
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback

        traceback.print_exc()
    finally:
        print(f"\n{'=' * 50}")
        print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    main()
