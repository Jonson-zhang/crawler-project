"""
东航 API 桥接 — CloakBrowser（Cookie 保鲜 + API 调用）
用法: python api_bridge.py <enc_req>
"""
import json, sys, io, time
from pathlib import Path

SD = Path(__file__).parent
COOKIES_FILE = SD / "cookies.json"
COOKIE_MAX_AGE = 25 * 60


def load_cookies():
    if COOKIES_FILE.exists():
        with open(COOKIES_FILE, encoding="utf-8") as f: return json.load(f)
    return {}


def get_cookie_age():
    if not COOKIES_FILE.exists(): return float("inf")
    try:
        t = load_cookies().get("_refreshed_at")
        if t: return time.time() - t
    except Exception: pass
    return time.time() - COOKIES_FILE.stat().st_mtime


def run(enc_req):
    launch = __import__("cloakbrowser").launch

    need_refresh = get_cookie_age() >= COOKIE_MAX_AGE or not COOKIES_FILE.exists()

    if need_refresh:
        # Session 1: Cookie 刷新
        print("[Cookie] refresh...", file=sys.stderr)
        b = launch(headless=True, locale="zh-CN")
        ctx = b.new_context()
        page = ctx.new_page()
        try:
            page.goto("https://m.ceair.com/mapp/Home", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)
            page.goto("https://m.ceair.com/mapp/reserve/flightList", wait_until="domcontentloaded", timeout=30000)
            for i in range(20):
                if "ssxmod_itna" in [c["name"] for c in ctx.cookies()]:
                    print(f"  ssxmod ({i}s)", file=sys.stderr)
                    break
                page.wait_for_timeout(1000)
            page.wait_for_timeout(2000)
            cd = {c["name"]: c["value"] for c in ctx.cookies() if c["name"]}
            cd["_refreshed_at"] = time.time()
            with open(COOKIES_FILE, "w", encoding="utf-8") as f:
                json.dump(cd, f, ensure_ascii=False, indent=2)
            print(f"  [OK] {len(cd)} cookies", file=sys.stderr)
        finally:
            b.close()

        if "ssxmod_itna" not in load_cookies():
            return {"success": False, "error": "cookie refresh failed"}

    # Session 2: API 调用
    print("[API] call...", file=sys.stderr)
    cookies = load_cookies()
    b = launch(headless=True, locale="zh-CN")
    ctx = b.new_context()
    ctx.add_cookies([{"name": k, "value": v, "domain": ".ceair.com", "path": "/"}
                     for k, v in cookies.items() if v and not k.startswith("_")])
    page = ctx.new_page()
    try:
        page.goto("https://m.ceair.com/mapp/reserve/flightList",
                  wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        # SPA may have replaced page — poll alive pages
        for attempt in range(3):
            for pg in ctx.pages:
                if pg.is_closed(): continue
                try:
                    resp = pg.evaluate("""
                        async (encReq) => {
                            const r = await fetch('https://m.ceair.com/m-base/sale/shoppingv2', {
                                method: 'POST', credentials: 'include',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Accept': 'application/json, text/plain, */*',
                                    'M-CEAIR-ENCRYPTED': 'true', 'X-CEAIR-OS': 'M',
                                },
                                body: JSON.stringify({ req: encReq })
                            });
                            return {
                                status: r.status,
                                contentType: r.headers.get('content-type') || '',
                                text: await r.text()
                            };
                        }
                    """, enc_req)
                    break  # succeeded
                except Exception:
                    time.sleep(1)
            else:
                return {"success": False, "error": "SPA replaced all pages"}
            if resp: break
            time.sleep(1)
    finally:
        b.close()

    if resp["status"] == 200 and "json" in resp.get("contentType", ""):
        data = json.loads(resp["text"])
        if data.get("res"):
            print(f"[API] OK {len(data['res'])} chars", file=sys.stderr)
            return {"success": True, "enc_response": data["res"]}
        return {"success": True, "enc_response": json.dumps(data)}

    err = "WAF" if "aliyun_waf" in resp.get("text", "") else f"HTTP {resp['status']}"
    print(f"[API] FAIL: {err}", file=sys.stderr)
    return {"success": False, "error": err}


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    result = run(sys.argv[1])
    print(json.dumps(result))
