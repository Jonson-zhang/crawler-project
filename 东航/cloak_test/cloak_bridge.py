"""
东航 API 桥接 — CloakBrowser（Chromium + 58 个 C++ 源码级指纹补丁）
用法: python cloak_bridge.py <enc_req>
输出: 末尾一行 JSON {"success": true/false, "enc_response": "..."}

所有文件均在本目录内，不影响父目录下的 DrissionPage 代码。
"""

import json
import sys
import io
import subprocess
import time
from pathlib import Path

# ── 自动纠偏 ──
if not sys.executable.replace("\\", "/").endswith(".venv/Scripts/python.exe"):
    PROJECT = Path(__file__).resolve().parent.parent.parent
    UV_PYTHON = PROJECT / ".venv" / "Scripts" / "python.exe"
    if UV_PYTHON.exists():
        result = subprocess.run(
            [str(UV_PYTHON), __file__, *sys.argv[1:]],
            cwd=str(PROJECT),
        )
        sys.exit(result.returncode)

HERE = Path(__file__).parent
COOKIES_FILE = HERE / "cloak_cookies.json"
WAF_DUMP = HERE / "waf_response.html"


def _cookies_fresh():
    if not COOKIES_FILE.exists():
        return False
    return (time.time() - COOKIES_FILE.stat().st_mtime) < (25 * 60)


def run(enc_req):
    from cloakbrowser import launch

    browser = launch(
        headless=True,
        humanize=True,
    )

    try:
        context = browser.new_context(
            viewport={"width": 412, "height": 915},
            # 不设自定义 UA，让 CloakBrowser 原生 Chromium 指纹保持一致
        )
        page = context.new_page()

        try:
            # ========================================================
            # Cookie 保鲜：必须拿到 ssxmod_itna（Tongdun + Aliyun WAF）
            # ========================================================
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

            # ========================================================
            # 环境探测（调试用）
            # ========================================================
            page.goto("https://m.ceair.com/mapp/reserve/flightList",
                      wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)

            env_info = page.evaluate("""() => {
                return {
                    ua: navigator.userAgent,
                    webdriver: navigator.webdriver,
                    plugins: navigator.plugins.length,
                    languages: navigator.languages,
                    platform: navigator.platform,
                    cookieEnabled: navigator.cookieEnabled,
                    chrome: typeof window.chrome,
                };
            }""")
            print(f"  UA: {env_info['ua'][:80]}...", file=sys.stderr)
            print(f"  webdriver={env_info['webdriver']} plugins={env_info['plugins']} "
                  f"chrome={env_info['chrome']}", file=sys.stderr)
            cookie_names = [c["name"] for c in context.cookies()]
            print(f"  cookies: {cookie_names}", file=sys.stderr)

            # ========================================================
            # API 调用
            # ========================================================
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
                            return JSON.stringify({
                                status: r.status,
                                statusText: r.statusText,
                                contentType: ct,
                                text: text,
                                url: r.url
                            });
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

                print(f"  HTTP {resp['status']} {resp.get('statusText','')}  "
                      f"ct={resp.get('contentType','?')[:50]}  "
                      f"body_len={len(resp.get('text',''))}", file=sys.stderr)

                text = resp.get("text", "")

                if resp["status"] != 200:
                    print(f"  response preview: {text[:300]}", file=sys.stderr)
                    # 保存完整响应到文件方便分析
                    WAF_DUMP.write_text(text, encoding="utf-8")
                    print(f"  full response saved to {WAF_DUMP}", file=sys.stderr)
                    return {"success": False, "error": f"HTTP {resp['status']}"}

                if "aliyun_waf" in text:
                    print("[WAF] aliyun_waf detected!", file=sys.stderr)
                    WAF_DUMP.write_text(text, encoding="utf-8")
                    print(f"  WAF page saved to {WAF_DUMP}", file=sys.stderr)
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
        sys.exit(1)

    result = run(sys.argv[1])
    print(json.dumps(result))
