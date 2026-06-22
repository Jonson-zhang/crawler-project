"""
东航 API 桥接 — CloakBrowser（Chromium + 58 个 C++ 源码级指纹补丁）
用法: python cloak_bridge.py <enc_req>
输出: 末尾一行 JSON {"success": true/false, "enc_response": "..."}

与 api_bridge.py (DrissionPage/Chromium) 并行，用于测试 CloakBrowser 是否能突破 WAF。
"""

import json
import sys
import io
import time
from pathlib import Path

SD = Path(__file__).parent.parent  # 东航/
COOKIES_FILE = Path(__file__).parent / "cloak_cookies.json"
COOKIE_MAX_AGE = 25 * 60  # Cookie 有效期：25 分钟


def _cookies_fresh():
    """检查 cookies 文件是否在有效期内"""
    if not COOKIES_FILE.exists():
        return False
    mtime = COOKIES_FILE.stat().st_mtime
    return (time.time() - mtime) < COOKIE_MAX_AGE


def run(enc_req):
    from cloakbrowser import launch

    browser = launch(
        headless=True,
        humanize=True,
        proxy="http://127.0.0.1:10808",
    )

    try:
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
            if _cookies_fresh():
                print("[Cookie] loading cached...", file=sys.stderr)
                page.goto("https://m.ceair.com/mapp/reserve/flightList",
                          wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
                with open(COOKIES_FILE, encoding="utf-8") as f:
                    cookies = json.load(f)
                context.add_cookies(cookies)
                print(f"  loaded {len(cookies)} cookies", file=sys.stderr)
                page.goto("https://m.ceair.com/mapp/reserve/flightList",
                          wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
            else:
                print("[Cookie] refreshing...", file=sys.stderr)
                page.goto("https://m.ceair.com/", wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)

                for attempt in range(3):
                    page.goto("https://m.ceair.com/mapp/reserve/flightList",
                              wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(5000)
                    names = {c["name"] for c in context.cookies()}
                    if "ssxmod_itna" in names:
                        print(f"  ssxmod_itna ready (attempt {attempt + 1})", file=sys.stderr)
                        break
                    print(f"  attempt {attempt + 1}: missing ssxmod_itna", file=sys.stderr)

                cookies = context.cookies()
                with open(COOKIES_FILE, "w", encoding="utf-8") as f:
                    json.dump(cookies, f, ensure_ascii=False)
                print(f"  saved {len(cookies)} cookies", file=sys.stderr)

            # ── API 调用 ──
            page.goto("https://m.ceair.com/mapp/reserve/flightList",
                      wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            current_url = page.evaluate("() => location.href")
            cookie_names = [c["name"] for c in context.cookies()]
            print(f"  page: {current_url}", file=sys.stderr)
            print(f"  cookies: {cookie_names}", file=sys.stderr)

            # 注入加密请求
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
                                    'M-CEAIR-ENCRYPTED': 'true',
                                    'X-CEAIR-OS': 'M',
                                    'Origin': location.origin,
                                    'Referer': location.href,
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
                    print(f"  fetch error (attempt {attempt + 1}): {e}", file=sys.stderr)
                    page.goto("https://m.ceair.com/mapp/reserve/flightList",
                              wait_until="domcontentloaded", timeout=30000)
                    page.wait_for_timeout(3000)
                    page.evaluate("(val) => { window._encReq = val; }", enc_req)
                    continue

                print(f"  HTTP {resp['status']}  ct={resp.get('contentType','?')[:40]}  "
                      f"body_len={len(resp.get('text',''))}", file=sys.stderr)

                if resp["status"] != 200:
                    preview = resp.get("text", "")[:300]
                    print(f"  response preview: {preview}", file=sys.stderr)
                    return {"success": False, "error": f"HTTP {resp['status']}"}

                text = resp.get("text", "")

                # WAF 检测
                if "aliyun_waf" in text:
                    print("[WAF] aliyun_waf detected!", file=sys.stderr)
                    # 打印 WAF 页面片段帮助分析
                    waf_idx = text.find("aliyun_waf")
                    print(f"  WAF context: ...{text[max(0,waf_idx-100):waf_idx+200]}...", file=sys.stderr)
                    return {"success": False, "error": "WAF blocked"}

                data = json.loads(text)
                if data.get("res"):
                    return {"success": True, "enc_response": data["res"]}
                return {"success": True, "enc_response": json.dumps(data, ensure_ascii=False)}

            return {"success": False, "error": "API: max retries"}

        finally:
            context.close()

    finally:
        browser.close()


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    if len(sys.argv) < 2:
        print("Usage: python cloak_bridge.py <enc_req>", file=sys.stderr)
        print("  Encrypt via sign.js first, then pass the result here.", file=sys.stderr)
        sys.exit(1)

    result = run(sys.argv[1])
    print(json.dumps(result))
