#!/usr/bin/env python3
"""
知乎 API 调用示例 — 使用已保存的 Cookie

前置：先运行 python login.py 登录一次，保存 Cookie 到 cookies.json
然后本脚本可以纯协议请求，无需浏览器。

用法：
  python demo_fetch.py          # 获取首页推荐
  python demo_fetch.py --me     # 获取我的信息
  python demo_fetch.py --question 12345678  # 获取问答内容
"""

import json
from pathlib import Path
import requests

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "xbs_env" / "cookies.json"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def create_session():
    """创建带 Cookie 的 requests Session."""
    if not COOKIE_FILE.exists():
        raise FileNotFoundError(f"请先运行 login.py 登录: {COOKIE_FILE}")

    cookies = json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
    s = requests.Session()
    s.cookies.update(cookies)
    s.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": "https://www.zhihu.com",
        "Referer": "https://www.zhihu.com/",
        "x-requested-with": "fetch",
    })
    return s


def get_me(session):
    """获取当前用户信息."""
    resp = session.get("https://www.zhihu.com/api/v4/me", timeout=15)
    return resp.json() if resp.status_code == 200 else None


def get_feed(session):
    """获取首页推荐流."""
    resp = session.get(
        "https://www.zhihu.com/api/v3/feed/topstory/recommend",
        params={"action": "down", "ad_interval": -10, "session_token": ""},
        timeout=15,
    )
    return resp.json() if resp.status_code == 200 else None


def get_question(session, qid):
    """获取问答详情."""
    resp = session.get(
        f"https://www.zhihu.com/api/v4/questions/{qid}",
        timeout=15,
    )
    return resp.json() if resp.status_code == 200 else None


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--me", action="store_true")
    parser.add_argument("--question", type=str, default="")
    args = parser.parse_args()

    try:
        s = create_session()
    except FileNotFoundError as e:
        print(f"❌ {e}")
        return

    if args.me or (not args.question):
        me = get_me(s)
        if me and "id" in me:
            print(f"✅ 已登录: {me.get('name', '')} ({me.get('headline', '')})")
        else:
            print("❌ Cookie 过期，请重新运行 login.py")
            return

    if args.question:
        q = get_question(s, args.question)
        if q and "title" in q:
            print(f"\n📋 {q['title']}")
        else:
            print("❌ 获取问答失败")

    if not args.me and not args.question:
        feed = get_feed(s)
        if feed and "data" in feed:
            print(f"\n📰 首页推荐:")
            for item in feed["data"][:5]:
                target = item.get("target", {})
                title = target.get("title", target.get("question", {}).get("title", ""))
                print(f"  · {title[:60]}")
        else:
            print("❌ 获取首页失败")


if __name__ == "__main__":
    main()
