#!/usr/bin/env python3
"""
知乎 — 完整方案 (登录 + x-zse 签名 + 爬取)

用法:
  python main.py feed                获取推荐流 (默认 1 页)
  python main.py feed --pages 3      获取 3 页
  python main.py me                  获取用户信息

Cookie 自动管理: feed / me 启动时自动检查，失效则弹浏览器手工登录并保存。

项目文件:
  main.py        本文件
  sign.js        x-zse-96 / x-zst-81 签名引擎 (Node.js)
  runtime.js     知乎 webpack runtime (17KB)
  vendor.js      知乎 vendor chunk (215KB)
  479.js         签名模块所在 chunk (3.3MB)
  cookies.json   login 后自动生成
"""

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
import urllib3

urllib3.disable_warnings()

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "cookies.json"
SIGN_SCRIPT = BASE_DIR / "sign.js"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        print(*(str(a).encode("ascii", "replace").decode() for a in args), **kwargs)
    sys.stdout.flush()


# ═══════════════════════════════════════════════════════════════
#  Cookie
# ═══════════════════════════════════════════════════════════════


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
    """每次启动时检查 Cookie，失效则弹窗让用户手工登录"""
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
    """浏览器弹窗登录 → 导出 Cookie"""
    try:
        from cloakbrowser import launch

        b = launch(headless=False)
        p = b.new_page()
        p.goto(
            "https://www.zhihu.com/signin?next=%2F",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        time.sleep(3)
        safe_print("\n  [*] 请在浏览器中完成登录, 然后回到这里按 Enter")
        input(">>> 按 Enter 继续...")
        cookies = {c["name"]: c["value"] for c in p.context.cookies()}
        b.close()
        if cookies.get("z_c0"):
            cookies_save(cookies)
            safe_print(f"[OK] {len(cookies)} 个 Cookie 已保存")
            return cookies
        safe_print("[FAIL] 未检测到 z_c0, 可能未登录成功")
        return None
    except Exception as e:
        safe_print(f"[FAIL] {e}")
        return None


# ═══════════════════════════════════════════════════════════════
#  API 客户端 (签名 + 协议请求)
# ═══════════════════════════════════════════════════════════════


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

    def _sign(self, url_full: str) -> dict:
        payload = json.dumps({"url": url_full, "d_c0": self._d_c0})
        r = subprocess.run(
            ["node", str(SIGN_SCRIPT)],
            input=payload,
            capture_output=True,
            text=True,
            cwd=str(BASE_DIR),
            timeout=120,
        )
        if r.returncode != 0:
            raise RuntimeError(
                r.stderr.strip()[-300:] if r.stderr else "sign.js failed"
            )
        return json.loads(r.stdout.strip() or "{}")

    def _get(self, path: str, params: dict = None) -> dict:
        full = path + ("?" + urlencode(params) if params else "")
        h = self._sign(full)
        self.session.headers["x-zse-96"] = h.get("x-zse-96", "")
        self.session.headers["x-zst-81"] = h.get("x-zst-81", "")
        r = self.session.get(f"https://www.zhihu.com{full}", timeout=30)
        return r.json() if "json" in r.headers.get("content-type", "") else r.text

    def me(self):
        return self._get("/api/v4/me")

    def feed(self, page: int = 1, size: int = 17):
        return self._get(
            "/api/v3/feed/topstory/recommend",
            {
                "action": "down",
                "ad_interval": -10,
                "after_id": size * (page - 1),
                "desktop": "true",
                "end_offset": size * page,
                "page_number": page,
            },
        )


# ═══════════════════════════════════════════════════════════════
#  命令处理
# ═══════════════════════════════════════════════════════════════


def cmd_feed(args):
    if not ensure_login():
        return
    api = ZhihuAPI()
    me = api.me()
    safe_print(f"[OK] 已登录: {me.get('name', '?')}")

    all_items = []
    pages = getattr(args, "pages", 1)
    for pg in range(1, pages + 1):
        safe_print(f"[*] 第 {pg} 页...", end=" ")
        sys.stdout.flush()
        try:
            data = api.feed(page=pg)
        except Exception as e:
            safe_print(f"[FAIL] {e}")
            break
        items = data.get("data", []) if isinstance(data, dict) else []
        if not items:
            safe_print("无数据")
            break
        all_items.extend(items)
        safe_print(f"{len(items)} 条")
        for it in items[:3]:
            t = it.get("target", {})
            q = t.get("question", {})
            safe_print(f"    · {(q.get('title') or t.get('title', ''))[:60]}")
        time.sleep(1)

    out = getattr(args, "output", "") or str(BASE_DIR / "feed.json")
    Path(out).write_text(json.dumps(all_items, ensure_ascii=False, indent=2), "utf-8")
    safe_print(f"\n[+] 共 {len(all_items)} 条, 已保存 {out}")


def cmd_me(args):
    if not ensure_login():
        return
    api = ZhihuAPI()
    d = api.me()
    if d and d.get("id"):
        safe_print(
            f"[OK] {d.get('name')}  id={d.get('id')}  headline={d.get('headline', '')}"
        )
    else:
        safe_print(f"[FAIL] {json.dumps(d, ensure_ascii=False)[:200]}")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser(description="知乎 — 登录 + x-zse 签名 + 爬取")
    sp = p.add_subparsers(dest="cmd")

    p_feed = sp.add_parser("feed")
    p_feed.add_argument("--pages", type=int, default=1)
    p_feed.add_argument("--output", type=str, default="")

    sp.add_parser("me")

    args = p.parse_args()
    if args.cmd == "feed":
        cmd_feed(args)
    elif args.cmd == "me":
        cmd_me(args)
    else:
        cmd_feed(args)
