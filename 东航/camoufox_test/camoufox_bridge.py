"""
东航 API 桥接 — Camoufox（Firefox + 反检测指纹）
用法: python camoufox_bridge.py <enc_req>
输出: 末尾一行 JSON {"success": true/false, "enc_response": "..."}

与 api_bridge.py (DrissionPage/Chromium) 并行，用于测试 Camoufox 是否能突破 WAF。
"""

import json
import sys
import io
import time
from pathlib import Path

SD = Path(__file__).parent
COOKIES_FILE = SD / "camoufox_cookies.json"
COOKIE_MAX_AGE = 25 * 60  # Cookie 有效期：25 分钟


def _cookies_fresh(cookies_file):
    """检查 cookies 文件是否在有效期内"""
    if not cookies_file.exists():
        return False
    mtime = cookies_file.stat().st_mtime
    return (time.time() - mtime) < COOKIE_MAX_AGE


def run(enc_req):
    from playwright.sync_api import sync_playwright
    from camoufox.sync_api import NewBrowser

    with sync_playwright() as p:
        # ── 启动 Camoufox ──
        print("[Camoufox] launching...", file=sys.stderr)
        browser = NewBrowser(
            p,
            headless=True,
            os="windows",
            locale="zh-CN",
            window=(412, 915),
        )
        context = browser.new_context(
            viewport={"width": 412, "height": 915},
            user_agent=(
                "Mozilla/5.0 (Linux; Android 13; Pixel 7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Mobile Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            # ── Cookie 管理 ──
            if _cookies_fresh(COOKIES_FILE):
                print("[Cookie] loading cached...", file=sys.stderr)
                with open(COOKIES_FILE, encoding="utf-8") as f:
                    cookies = json.load(f)
                context.add_cookies(cookies)
                # 确保页面上下文可用
                page.goto("https://m.ceair.com/mapp/reserve/flightList",
                          wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
            else:
                print("[Cookie] refreshing...", file=sys.stderr)
                page.goto("https://m.ceair.com/mapp/Home",
                          wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                # 访问 flightList 触发 SPA 加载 → ssxmod_itna
                for attempt in range(3):
                    page.goto("https://m.ceair.com/mapp/reserve/flightList",
                              wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(5000)
                    names = {c["name"] for c in context.cookies()}
                    if "ssxmod_itna" in names:
                        print(f"  ssxmod_itna ready (attempt {attempt + 1})", file=sys.stderr)
                        break
                    print(f"  attempt {attempt + 1}: missing ssxmod_itna", file=sys.stderr)

                # 保存 cookies
                cookies = context.cookies()
                with open(COOKIES_FILE, "w", encoding="utf-8") as f:
                    json.dump(cookies, f, ensure_ascii=False)
                print(f"  saved {len(cookies)} cookies", file=sys.stderr)

            # ── API 调用 ──
            page.goto("https://m.ceair.com/mapp/reserve/flightList",
                      wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            # 注入加密请求到 JS 全局变量
            page.evaluate("(val) => { window._encReq = val; }", enc_req)

            for attempt in range(3):
                try:
                    raw = page.evaluate(
                        """
                        async () => {
                            const r = await fetch('/m-base/sale/shoppingv2', {
                                method: 'POST', credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json, text/plain, */*',
                                    'M-CEAIR-ENCRYPTED': 'true', 'X-CEAIR-OS': 'M',
                                },
                                body: JSON.stringify({ req: window._encReq })
                            });
                            const ct = r.headers.get('content-type') || '';
                            const text = await r.text();
                            return JSON.stringify({ status: r.status, contentType: ct, text: text });
                        }
                        """
                    )
                    resp = json.loads(raw)
                except Exception as e:
                    print(f"  fetch error: {e}", file=sys.stderr)
                    page.goto("https://m.ceair.com/mapp/reserve/flightList",
                              wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                    page.evaluate("(val) => { window._encReq = val; }", enc_req)
                    continue

                if resp["status"] != 200:
                    return {"success": False, "error": f"HTTP {resp['status']}"}

                text = resp.get("text", "")

                # WAF 检测
                if "aliyun_waf" in text:
                    print("[WAF] aliyun_waf detected!", file=sys.stderr)
                    return {"success": False, "error": "WAF blocked"}

                if "waf" in text.lower() and len(text) < 500:
                    print(f"[WAF] suspicious short response: {text[:300]}", file=sys.stderr)
                    return {"success": False, "error": "WAF suspected"}

                data = json.loads(text)
                if data.get("res"):
                    return {"success": True, "enc_response": data["res"]}
                return {"success": True, "enc_response": json.dumps(data, ensure_ascii=False)}

            return {"success": False, "error": "API: max retries"}

        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    if len(sys.argv) < 2:
        print("Usage: python camoufox_bridge.py <enc_req>", file=sys.stderr)
        print("  or use with crawler.py (set API_BRIDGE = 'camoufox_test/camoufox_bridge.py')",
              file=sys.stderr)
        sys.exit(1)

    result = run(sys.argv[1])
    print(json.dumps(result))
