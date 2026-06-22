"""
东航 API 桥接 — DrissionPage（Chromium headless + 持久化 Cookie）
用法: python api_bridge.py <enc_req>
输出: 末尾一行 JSON {"success": true/false, "enc_response": "..."}
"""
import json, sys, io, time
from pathlib import Path

SD = Path(__file__).parent
PROFILE_DIR = str(SD / "dp_user_data")
COOKIE_MAX_AGE = 25 * 60  # Cookie 有效期：25 分钟


def _has_valid_cookie(page):
    """检查 profile 中是否已有有效的 ssxmod_itna"""
    # 需要至少加载一个页面才能读取 Cookie
    page.get("https://m.ceair.com/mapp/Home")
    page.wait(2)
    return "ssxmod_itna" in [c.get("name") for c in page.cookies()]


def _refresh_cookies(page):
    """访问 flightList 触发 SPA 加载，确保 Cookie 完整"""
    for _ in range(3):
        page.get("https://m.ceair.com/mapp/reserve/flightList")
        page.wait(5)
        if "ssxmod_itna" in [c.get("name") for c in page.cookies()]:
            return True
    return False


def _ensure_page(page):
    """确保有可用的页面上下文用于 fetch API"""
    try:
        page.get("https://m.ceair.com/mapp/reserve/flightList")
        page.wait(2)
    except Exception:
        pass


def run(enc_req):
    from DrissionPage import ChromiumPage, ChromiumOptions

    co = ChromiumOptions()
    co.set_browser_path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    co.set_user_data_path(PROFILE_DIR)
    co.auto_port()
    co.headless(True)
    co.set_user_agent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    )
    co.set_argument("--no-sandbox")
    co.set_argument("--disable-gpu")
    co.set_argument("--disable-blink-features=AutomationControlled")
    co.set_argument("--window-size=412,915")

    page = None
    try:
        page = ChromiumPage(co)

        # ── Cookie：已有则跳过，过期则刷新 ──
        if _has_valid_cookie(page):
            print("[Cookie] cached (fresh)", file=sys.stderr)
            _ensure_page(page)
        else:
            print("[Cookie] refresh...", file=sys.stderr)
            if not _refresh_cookies(page):
                return {"success": False, "error": "ssxmod_itna missing"}
            print(f"  ssxmod ready", file=sys.stderr)

        # ── API ──
        page.run_js("window._encReq = arguments[0];", enc_req)

        for attempt in range(3):
            try:
                raw = page.run_js(
                    """
                    (async () => {
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
                    })();
                    """,
                    as_expr=True,
                    timeout=60,
                )
                resp = json.loads(raw)
            except Exception:
                page.get("https://m.ceair.com/mapp/reserve/flightList")
                page.wait(3)
                page.run_js("window._encReq = arguments[0];", enc_req)
                continue

            if resp["status"] != 200:
                return {"success": False, "error": f"HTTP {resp['status']}"}

            text = resp.get("text", "")
            if "aliyun_waf" in text:
                return {"success": False, "error": "WAF blocked"}

            data = json.loads(text)
            if data.get("res"):
                return {"success": True, "enc_response": data["res"]}
            return {"success": True, "enc_response": json.dumps(data, ensure_ascii=False)}

        return {"success": False, "error": "API: max retries"}

    finally:
        if page:
            try:
                page.quit()
            except Exception:
                pass


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    result = run(sys.argv[1])
    print(json.dumps(result))
