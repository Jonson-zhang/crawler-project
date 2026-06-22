"""
东航 API 桥接 — DrissionPage（Chromium 浏览器自动化）
用法: python api_bridge.py <enc_req>
输出: 末尾一行 JSON {"success": true/false, "enc_response": "..."}

策略:
- 手机 UA 导航 → 阿里云 WAF 对移动端限制较松，不弹滑块
- fetch API 从浏览器内发起 → 复用页面已加载的 WAF 脚本上下文
- 持久化 profile → 后续复用 Cookie
"""
import json, sys, io, time
from pathlib import Path

SD = Path(__file__).parent
PROFILE_DIR = str(SD / "dp_user_data")


def run(enc_req):
    from DrissionPage import ChromiumPage, ChromiumOptions

    co = ChromiumOptions()
    co.set_browser_path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
    co.set_user_data_path(PROFILE_DIR)
    co.auto_port()
    co.set_argument("--no-sandbox")
    co.set_argument("--disable-gpu")
    co.set_argument("--disable-blink-features=AutomationControlled")
    co.set_argument("--window-size=412,915")

    page = None
    try:
        page = ChromiumPage(co)

        # ── 加载页面 ──
        for _ in range(3):
            page.get("https://m.ceair.com/mapp/Home")
            page.wait(3)

            page.get("https://m.ceair.com/mapp/reserve/flightList")
            page.wait(5)

            if "ssxmod_itna" in [c.get("name") for c in page.cookies()]:
                break

        if "ssxmod_itna" not in [c.get("name") for c in page.cookies()]:
            return {"success": False, "error": "ssxmod_itna missing"}

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
                page.wait(5)
                page.run_js("window._encReq = arguments[0];", enc_req)
                continue

            if resp["status"] != 200:
                return {"success": False, "error": f"HTTP {resp['status']}"}

            text = resp.get("text", "")
            if "aliyun_waf" in text:
                return {"success": False, "error": "WAF blocked — 当前IP被风控，请稍后重试或换代理"}

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
