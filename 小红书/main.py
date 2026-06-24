#!/usr/bin/env python3
"""小红书首页推荐流抓取 (纯 Python 签名)"""
import json, sys, time
from pathlib import Path
import requests
from sign import sign

BASE_DIR = Path(__file__).parent
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
PAGES = 1
INTERVAL = 1.5


class XhsClient:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "user-agent": UA, "origin": "https://www.xiaohongshu.com",
            "referer": "https://www.xiaohongshu.com/",
        })
        cf = BASE_DIR / "data" / "cookies.json"
        if cf.exists():
            self.session.cookies.update(json.loads(cf.read_text()))

    def homefeed(self, cursor: str = "", note_index: int = 0) -> dict:
        body = {
            "cursor_score": cursor, "num": 20, "refresh_type": 1,
            "note_index": note_index, "unread_begin_note_id": "",
            "unread_end_note_id": "", "unread_note_count": 0,
            "category": "homefeed_recommend", "search_key": "",
            "need_num": 14, "image_formats": ["jpg", "webp", "avif"],
            "need_filter_image": False,
        }
        signed = sign(API_URL, body)
        headers = {"content-type": "application/json;charset=UTF-8", "x-s": signed["x-s"], "x-t": signed["x-t"]}
        if signed.get("x-s-common"): headers["x-s-common"] = signed["x-s-common"]
        r = self.session.post(API_URL, json=body, headers=headers, timeout=30)
        return r.json()


def show_item(i: int, item: dict):
    nc = item.get("note_card") or item
    t = nc.get("display_title") or nc.get("title", "(无标题)")
    u = nc.get("user", {})
    a = u.get("nickname") or u.get("nick_name", "?")
    lk = nc.get("interact_info", {}).get("liked_count", "?")
    print(f"  {i:2d}. {t[:60]}")
    if a != "?":
        print(f"      @{a}  ❤{lk}")


def main():
    client = XhsClient()
    total = 0
    try:
        cursor, note_index = "", 0
        for pg in range(1, PAGES + 1):
            print(f"\n{'─' * 50}")
            print(f"[*] 第 {pg}/{PAGES} 页 ...")
            data = client.homefeed(cursor, note_index)
            if not data.get("success") and data.get("code") != 0:
                print(f"[!] API 错误: code={data.get('code')}, msg={data.get('msg','?')}")
                print(f"    响应: {json.dumps(data, ensure_ascii=False)[:200]}")
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
            time.sleep(INTERVAL)
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback; traceback.print_exc()
    finally:
        print(f"\n{'─' * 50}")
        print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--pages", type=int, default=PAGES)
    args = p.parse_args()
    PAGES = args.pages
    main()
