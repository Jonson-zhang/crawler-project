"""
东航 API 桥接 — CloakBrowser（Chromium 持久化 profile + Cookie）
用法: python cloak_bridge.py <enc_req>
输出: 末尾一行 JSON {"success": true/false, "enc_response": "..."}
"""

import json
import sys
import io
from pathlib import Path

HERE = Path(__file__).parent
PROFILE_DIR = str(HERE / "cloak_profile")
COOKIE_MAX_AGE = 25 * 60  # Cookie 有效期：25 分钟


def _has_valid_cookie(context):
    """检查 profile 中是否已有有效的 ssxmod_itna"""
    page = context.pages[0] if context.pages else context.new_page()
    page.goto("https://m.ceair.com/mapp/Home",
              wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2000)
    cookies = context.cookies()
    return "ssxmod_itna" in {c.get("name") for c in cookies}


def _refresh_cookies(context):
    """访问 flightList 触发 SPA 加载，确保 Cookie 完整"""
    page = context.pages[0] if context.pages else context.new_page()
    for _ in range(3):
        page.goto("https://m.ceair.com/mapp/reserve/flightList",
                  wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)
        cookies = context.cookies()
        if "ssxmod_itna" in {c.get("name") for c in cookies}:
            return True
    return False


def _ensure_page(context):
    """确保有可用的页面上下文用于 fetch API"""
    page = context.pages[0] if context.pages else context.new_page()
    try:
        page.goto("https://m.ceair.com/mapp/reserve/flightList",
                  wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)
    except Exception:
        pass


def run(enc_req):
    from cloakbrowser import launch

    browser = launch(
        headless=True,
        humanize=True,
    )

    try:
        # ── 持久化 profile，跨运行复用 Cookie ──
        try:
            context = browser.new_context(
                viewport={"width": 412, "height": 915},
                storage_state=str(HERE / "cloak_state.json") if (HERE / "cloak_state.json").exists() else None,
            )
        except Exception:
            context = browser.new_context(
                viewport={"width": 412, "height": 915},
            )

        page = context.pages[0] if context.pages else context.new_page()

        try:
            # ── Cookie：已有则跳过，过期则刷新 ──
            if _has_valid_cookie(context):
                print("[Cookie] cached (fresh)", file=sys.stderr)
                _ensure_page(context)
            else:
                print("[Cookie] refresh...", file=sys.stderr)
                if not _refresh_cookies(context):
                    return {"success": False, "error": "ssxmod_itna missing"}
                # 保存状态以供后续复用
                context.storage_state(path=str(HERE / "cloak_state.json"))
                print("  ssxmod ready", file=sys.stderr)

            # ── API ──
            page = context.pages[0] if context.pages else context.new_page()
            _ensure_page(context)
            page.evaluate("(val) => { window._encReq = val; }", enc_req)

            for _ in range(3):
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
                    _ensure_page(context)
                    page.evaluate("(val) => { window._encReq = val; }", enc_req)
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
            context.close()
    finally:
        browser.close()


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    result = run(sys.argv[1])
    print(json.dumps(result))
