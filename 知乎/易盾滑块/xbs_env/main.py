#!/usr/bin/env python3
"""
知乎推荐流请求 — Python 主控

三层架构:
  sign.js  → 纯 Node.js 签名生成（加载 zhihu runtime + 479.js 提取加密函数）
  main.py → Python 主控（读 Cookie → 调 sign.js 生成签名 → requests 发请求 → 解析 JSON）

用法:
  python main.py          # 获取推荐流
  python main.py --pages 3  # 获取 3 页

依赖: requests, json, subprocess
"""

import json, subprocess, sys, time
from pathlib import Path
from urllib.parse import urlencode

import requests
import urllib3; urllib3.disable_warnings()

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "cookies.json"
SIGN_SCRIPT = BASE_DIR / "sign.js"

if not COOKIE_FILE.exists():
    print("[!] 未找到 cookies.json")
    print(f"    请先运行: cd {BASE_DIR.parent} && python login.py --manual")
    sys.exit(1)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


class ZhihuAPI:
    """知乎协议客户端"""

    def __init__(self):
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Origin": "https://www.zhihu.com",
            "Referer": "https://www.zhihu.com/",
            "x-api-version": "3.0.53",
            "x-requested-with": "fetch",
        })

        # 加载 Cookie
        if COOKIE_FILE.exists():
            cookies = json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
            self.session.cookies.update(cookies)
            self._d_c0 = cookies.get("d_c0", "")
        else:
            self._d_c0 = ""

    def _sign(self, url_path: str) -> dict:
        """调用 Node.js sign.js 生成签名头"""
        payload = json.dumps({"url": url_path, "d_c0": self._d_c0})
        result = subprocess.run(
            ["node", str(SIGN_SCRIPT)],
            input=payload, capture_output=True, text=True,
            cwd=str(BASE_DIR), timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Sign failed: {result.stderr[:200]}")

        try:
            headers = json.loads(result.stdout.strip() or "{}")
        except json.JSONDecodeError:
            # JSON 可能混在日志中，取最后一行
            lines = result.stdout.strip().split("\n")
            headers = json.loads(lines[-1])

        return headers

    def get(self, path: str, params=None) -> dict:
        """发起已签名的 GET 请求"""
        full_path = path
        if params:
            full_path += "?" + urlencode(params)

        sign_headers = self._sign(full_path)

        self.session.headers["x-zse-96"] = sign_headers.get("x-zse-96", "")
        self.session.headers["x-zst-81"] = sign_headers.get("x-zst-81", "")

        resp = self.session.get(f"https://www.zhihu.com{full_path}", timeout=30)
        return resp.json() if "json" in resp.headers.get("content-type", "") else resp.text

    def get_recommend(self, page=1, size=17):
        """获取推荐流"""
        return self.get("/api/v3/feed/topstory/recommend", {
            "action": "down",
            "ad_interval": -10,
            "after_id": size * (page - 1),
            "desktop": "true",
            "end_offset": size * page,
            "page_number": page,
        })

    def get_me(self):
        return self.get("/api/v4/me")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=1)
    parser.add_argument("--output", type=str, default="")
    args = parser.parse_args()

    print("=" * 60)
    print("  知乎推荐流获取")
    print("  签名: Node.js sign.js (webpack extract)")
    print("=" * 60)

    api = ZhihuAPI()

    # 验证登录
    me = api.get_me()
    if me and "id" in me:
        print(f"\n[OK] 已登录: {me.get('name', '?')}")
    else:
        print("\n[!] 未登录或 Cookie 过期")
        print("   请先运行: python ../login.py --manual")

    # 获取推荐流
    all_items = []
    for pg in range(1, args.pages + 1):
        print(f"\n[*] 第 {pg} 页...")
        try:
            data = api.get_recommend(page=pg)
        except Exception as e:
            print(f"  [!] {e}")
            break

        items = data.get("data", []) if isinstance(data, dict) else []
        if not items:
            break

        all_items.extend(items)
        print(f"  [+]{len(items)} 条")

        for item in items[:5]:
            tgt = item.get("target", {})
            q = tgt.get("question", {})
            title = q.get("title", "") or tgt.get("title", "")
            print(f"    · {title[:60]}")

        time.sleep(1)

    # 保存
    out = args.output or str(BASE_DIR / "feed.json")
    Path(out).write_text(json.dumps(all_items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[+] 共 {len(all_items)} 条, 已保存 {out}")


if __name__ == "__main__":
    main()
