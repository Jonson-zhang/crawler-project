"""
知乎 — iv8 签名 + 推荐流爬取（纯 Python，无需 Node.js）

用法:
  python main_iv8.py            获取推荐流
  python main_iv8.py --pages 5  获取 5 页
  python main_iv8.py -u         仅查看用户信息

依赖: pip install iv8 requests urllib3
"""

import json
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
import urllib3

urllib3.disable_warnings()

from zhihu_sign import ZhihuSigner

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "cookies.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

FEED_PAGES = 10
REQUEST_INTERVAL = 1

# 全局 iv8 签名器（复用 Context，避免重复初始化 V8）
_signer = None


def get_signer():
    global _signer
    if _signer is None:
        _signer = ZhihuSigner()
    return _signer


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        print(
            *(
                str(a).encode("ascii", "replace").decode() if isinstance(a, str) else a
                for a in args
            ),
            **kwargs,
        )
    sys.stdout.flush()


# ═══ Cookie ═══


def cookies_load():
    return json.loads(COOKIE_FILE.read_text("utf-8")) if COOKIE_FILE.exists() else {}


def cookies_save(d):
    COOKIE_FILE.write_text(json.dumps(d, ensure_ascii=False, indent=2), "utf-8")


def cookies_check(verbose=True):
    c = cookies_load()
    if not c:
        if verbose:
            safe_print("[!] 未找到 cookies.json")
        return False
    s = requests.Session()
    s.cookies.update(c)
    s.headers.update({"User-Agent": UA})
    try:
        r = s.get("https://www.zhihu.com/api/v4/me", timeout=10)
        if r.status_code == 200 and (r.json() or {}).get("id"):
            if verbose:
                safe_print(f"[OK] Cookie 有效: {(r.json() or {}).get('name', '?')}")
            return True
        if verbose:
            safe_print("[!] Cookie 已过期")
        return False
    except Exception as e:
        if verbose:
            safe_print(f"[!] Cookie 检测失败: {e}")
        return False


def ensure_login():
    if cookies_check(verbose=True):
        return True

    safe_print("\n🔐 Cookie 无效或不存在，请手工登录...")
    for attempt in range(3):
        c = login_browser()
        if c and cookies_check(verbose=False):
            safe_print("[OK] 登录成功，Cookie 已自动保存\n")
            return True
        if attempt < 2:
            safe_print(f"[!] 登录未成功 (第 {attempt + 1}/3 次)，请重试...")

    safe_print("[FAIL] 3 次登录均失败，退出")
    return False


def login_browser():
    try:
        from cloakbrowser import launch

        b = launch(headless=False)
        p = b.new_page()
        p.goto(
            "https://www.zhihu.com/signin?next=%2F",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        time.sleep(1)
        safe_print("\n  [*] 请在浏览器中完成登录, 然后回到这里按 Enter")
        input(">>> 按 Enter 继续...")
        cookies = {c["name"]: c["value"] for c in p.context.cookies()}
        b.close()
        if cookies.get("z_c0"):
            cookies_save(cookies)
            return cookies
        safe_print("[FAIL] 未检测到 z_c0")
        return None
    except Exception as e:
        safe_print(f"[FAIL] {e}")
        return None


# ═══ API 客户端（iv8 签名） ═══


class ZhihuAPI:
    def __init__(self):
        ck = cookies_load()
        self._d_c0 = ck.get("d_c0", "")
        self.session = requests.Session()
        self.session.verify = False
        self.session.cookies.update(ck)
        self.session.headers.update(
            {
                "User-Agent": UA,
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "zh-CN,zh;q=0.9",
                "Origin": "https://www.zhihu.com",
                "Referer": "https://www.zhihu.com/",
                "x-api-version": "3.0.53",
                "x-requested-with": "fetch",
            }
        )
        self._signer = get_signer()

    def _sign(self, url_full: str) -> dict:
        return self._signer.sign(url_full, self._d_c0)

    def _get(self, path: str, params: dict = None) -> dict:
        full = path + ("?" + urlencode(params) if params else "")
        return self._get_raw(full)

    def _get_raw(self, raw_path: str) -> dict:
        h = self._sign(raw_path)
        self.session.headers["x-zse-96"] = h["x-zse-96"]
        self.session.headers["x-zst-81"] = h["x-zst-81"]
        r = self.session.get(f"https://www.zhihu.com{raw_path}", timeout=30)
        return r.json() if "json" in r.headers.get("content-type", "") else r.text

    def me(self):
        return self._get("/api/v4/me")

    def feed_first(self):
        return self._get(
            "/api/v3/feed/topstory/recommend",
            {
                "action": "down",
                "ad_interval": -10,
                "desktop": "true",
                "page_number": 1,
            },
        )

    def feed_next(self, next_url: str):
        path = (
            next_url.split("zhihu.com", 1)[-1] if "zhihu.com" in next_url else next_url
        )
        if not path.startswith("/"):
            path = "/" + path
        return self._get_raw(path)


# ═══ 命令 ═══


def show_user(api):
    me = api.me()
    if me and me.get("id"):
        safe_print(
            f"\n{'─' * 50}\n"
            f"  👤 {me.get('name', '?')}\n"
            f"  id: {me.get('id')}\n"
            f"  headline: {me.get('headline', '(无)')}\n"
            f"  follower: {me.get('follower_count', '?')}  "
            f"following: {me.get('following_count', '?')}\n"
            f"{'─' * 50}\n"
        )


def cmd_feed(args):
    if not ensure_login():
        return
    api = ZhihuAPI()
    show_user(api)

    pages = args.pages if hasattr(args, "pages") else FEED_PAGES
    total = 0
    next_url = None

    for pg in range(1, pages + 1):
        safe_print(f"\n{'─' * 50}")
        safe_print(f"[*] 第 {pg}/{pages} 页")
        try:
            data = api.feed_next(next_url) if next_url else api.feed_first()
        except Exception as e:
            safe_print(f"[FAIL] {e}")
            break
        if not isinstance(data, dict):
            break
        items = data.get("data", [])
        if not items:
            safe_print("(无数据)")
            break
        total += len(items)
        for i, it in enumerate(items, 1):
            t = it.get("target", {})
            q = t.get("question", {})
            safe_print(f"  {i:2d}. {(q.get('title') or t.get('title', ''))}")

        paging = data.get("paging", {})
        if paging.get("is_end"):
            safe_print("(已到最后一页)")
            break
        next_url = paging.get("next", "")
        if not next_url:
            break
        time.sleep(REQUEST_INTERVAL)

    safe_print(f"\n{'─' * 50}")
    safe_print(f"[+] 共 {total} 条")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="知乎 — iv8 签名 + 爬取")
    p.add_argument("--pages", type=int, default=FEED_PAGES, help="页数")
    p.add_argument("-u", "--user", action="store_true", help="仅查看用户信息")

    args = p.parse_args()
    if args.user:
        if not ensure_login():
            sys.exit(1)
        show_user(ZhihuAPI())
    else:
        cmd_feed(args)
