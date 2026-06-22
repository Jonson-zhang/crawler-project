"""
东航机票爬取 — Camoufox 反检测浏览器 + WASM 加解密
=================================================
API: POST https://m.ceair.com/m-base/sale/shoppingv2
浏览器: Camoufox (Firefox 135 ESR, 49 C++ 指纹补丁)

与 crawler.py 的区别：
  - crawler.py:       DrissionPage Chromium + api_bridge.py 子进程
  - crawler_camoufox.py: Camoufox Firefox + 全程内联（无子进程）

用法:
  .claude/mcp-servers/.venv/Scripts/python.exe 东航/crawler_camoufox.py
  .claude/mcp-servers/.venv/Scripts/python.exe 东航/crawler_camoufox.py 成都 广州
  .claude/mcp-servers/.venv/Scripts/python.exe 东航/crawler_camoufox.py 成都 广州 20260628

因为 Camoufox 只装在 MCP venv 里，必须用那个 Python 运行。
"""

import asyncio
import io
import json
import subprocess
import sys
import time
from pathlib import Path

# ── Windows GBK 终端兼容 ──
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SD = Path(__file__).parent
SIGN_JS = SD / "sign.js"
CONFIG_FILE = SD / "config.json"
PROFILE_DIR = SD / "camoufox_profile"  # 持久化 profile（Cookie 复用，与 DrissionPage 的 dp_user_data 同理）

# 城市映射
CITY_MAP = {
    "上海": "SHA", "北京": "BJS", "广州": "CAN", "深圳": "SZX",
    "成都": "CTU", "重庆": "CKG", "西安": "XIY", "昆明": "KMG",
    "杭州": "HGH", "南京": "NKG", "武汉": "WUH", "长沙": "CSX",
    "青岛": "TAO", "大连": "DLC", "厦门": "XMN", "福州": "FOC",
    "海口": "HAK", "三亚": "SYX", "沈阳": "SHE", "郑州": "CGO",
    "济南": "TNA", "哈尔滨": "HRB", "乌鲁木齐": "URC", "兰州": "LHW",
    "银川": "INC", "西宁": "XNN",
}
CODE_REV = {v: k for k, v in CITY_MAP.items()}


def resolve(s):
    if not s:
        return s
    if s in CITY_MAP:
        return CITY_MAP[s]
    if s.upper() in CODE_REV:
        return s.upper()
    if s in CODE_REV:
        return CODE_REV[s]
    return s.upper()


def city_name(code):
    return CODE_REV.get(code.upper(), code)


# ============================================================
#   WASM 加解密 (通过 sign.js 子进程，逻辑与 crawler.py 一致)
# ============================================================

def _node(cmd, data=""):
    p = subprocess.Popen(
        ["node", str(SIGN_JS), cmd],
        cwd=str(SD),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, err = p.communicate(input=data.encode() if data else None, timeout=30)
    if p.returncode:
        raise RuntimeError(err.decode()[:500])
    return out.decode().strip()


def encrypt(data):
    return json.loads(
        _node("encrypt", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    )


def decrypt(b64):
    return json.loads(_node("decrypt", b64))


# ============================================================
#   Camoufox 浏览器 — Cookie 保鲜 + API 调用
# ============================================================

async def _wait_for_cookie(ctx, name, timeout=30):
    """轮询等待某个 cookie 出现"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        cookies = await ctx.cookies()
        for c in cookies:
            if c.get("name") == name:
                return True
        await asyncio.sleep(1)
    return False


async def _acquire_cookies(ctx, page):
    """
    访问东航首页 + flightList → 获取 WAF 和 Tongdun Cookie。
    返回 ssxmod_itna 值，失败返回 None。
    """
    print("  [Cookie] 正在获取...", file=sys.stderr)
    t0 = time.time()

    # Step 1: 首页 → 获取 acw_tc (Aliyun WAF)
    await page.goto("https://m.ceair.com/", wait_until="domcontentloaded", timeout=30_000)
    await asyncio.sleep(2)

    # Step 2: flightList → 触发 Tongdun SDK → 获取 ssxmod_itna
    await page.goto("https://m.ceair.com/mapp/reserve/flightList",
                     wait_until="domcontentloaded", timeout=30_000)
    await asyncio.sleep(3)

    # Step 3: 轮询等待 ssxmod_itna
    for _ in range(8):
        cookies = await ctx.cookies()
        names = {c.get("name") for c in cookies}
        if "ssxmod_itna" in names:
            itna = next(c["value"] for c in cookies if c.get("name") == "ssxmod_itna")
            print(f"  [Cookie] ssxmod_itna 就绪 ({time.time() - t0:.1f}s)", file=sys.stderr)
            return True
        await asyncio.sleep(1.5)

    return False


async def _call_api(page, ctx, enc_req):
    """
    在浏览器中通过 fetch 调用东航机票 API。
    用 route 拦截器替换 UA 为 Chrome（绕过 WAF UA 检查）。
    返回: {status, text} 或异常时返回 None
    """
    # 调试：当前页面 + Cookie
    current_url = page.url
    cookies = await ctx.cookies()
    cookie_names = [c["name"] for c in cookies]
    print(f"  [debug] 当前页: {current_url}", file=sys.stderr)
    print(f"  [debug] Cookie: {cookie_names}", file=sys.stderr)

    # 把加密请求注入到 window 上
    await page.evaluate(f"window._encReq = {json.dumps(enc_req)}")

    for attempt in range(3):
        try:
            raw = await page.evaluate("""
                (() => new Promise((resolve) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', '/m-base/sale/shoppingv2', true);
                    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
                    xhr.setRequestHeader('Accept', 'application/json, text/plain, */*');
                    xhr.setRequestHeader('M-CEAIR-ENCRYPTED', 'true');
                    xhr.setRequestHeader('X-CEAIR-OS', 'M');
                    xhr.setRequestHeader('Referer', 'https://m.ceair.com/mapp/reserve/flightList');
                    xhr.setRequestHeader('Origin', 'https://m.ceair.com');
                    xhr.onload = () => resolve(JSON.stringify({ status: xhr.status, text: xhr.responseText }));
                    xhr.onerror = () => resolve(JSON.stringify({ status: 0, text: '' }));
                    xhr.send(JSON.stringify({ req: window._encReq }));
                }))();
            """)
            resp = json.loads(raw)
            text = resp.get("text", "")

            # 如果没被 WAF 拦截，直接返回
            if "aliyun_waf" not in text:
                return resp

            # ── WAF 挑战：把挑战 HTML 注入 iframe，让浏览器跑完挑战 JS ──
            if attempt < 2:
                print(f"  WAF 挑战，自动解析中... (attempt {attempt + 1})", file=sys.stderr)
                ok = await page.evaluate(f"""
                    (() => new Promise((resolve) => {{
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.srcdoc = {json.dumps(text)};
                        document.body.appendChild(iframe);
                        // 等 3 秒让挑战 JS 跑完
                        setTimeout(() => {{
                            iframe.remove();
                            resolve(true);
                        }}, 3000);
                    }}))();
                """)
                await asyncio.sleep(1)
                # 检查是否有新 cookie 生成
                cookies = await ctx.cookies()
                new_names = [c["name"] for c in cookies]
                print(f"  Cookie after challenge: {new_names}", file=sys.stderr)
            else:
                return None

        except Exception as e:
            if attempt < 2:
                print(f"  attempt {attempt + 1} 失败，重试 ({e})", file=sys.stderr)
                try:
                    await page.goto("https://m.ceair.com/mapp/reserve/flightList",
                                    wait_until="domcontentloaded", timeout=15_000)
                    await asyncio.sleep(2)
                except Exception:
                    pass
    return None


async def search(dep_code, arr_code, date_str, dep_name, arr_name):
    """完整搜索流程：WASM 加密 → Camoufox Cookie + API → WASM 解密"""
    from camoufox.async_api import AsyncCamoufox

    t_total = time.time()

    # ── Step 1: WASM 加密 ──
    t0 = time.time()
    print("[1/3] WASM 加密...", file=sys.stderr)
    payload = {
        "currentQueryType": "FLIGHT_LIST",
        "currentSegIndex": 0,
        "language": "zh",
        "selectedRoutes": [],
        "productType": "CASH",
        "routes": [{
            "arrCode": arr_code, "depCode": dep_code,
            "flightDate": date_str,
            "arrCodeType": "1", "depCodeType": "1",
            "depCityName": dep_name, "arrCityName": arr_name,
            "segIndex": 0, "leftInner": "", "rightInner": "",
        }],
        "tripType": "OW",
        "cabinGrade": "",
    }
    enc = encrypt(payload)
    t_enc = (time.time() - t0) * 1000
    enc_req = enc["req"]
    print(f"  ✓ {len(enc_req)} chars  ({t_enc:.0f}ms)", file=sys.stderr)

    # ── Step 2: Camoufox 持久化 profile + Cookie + API ──
    print("[2/3] Camoufox Cookie + API...", file=sys.stderr)
    t1 = time.time()

    # persistent_context=True → 返回 BrowserContext（非 Browser）
    # user_data_dir → Cookie/存储持久化，跨运行复用（第一跑过 WAF 后即缓存）
    profile_exists = (PROFILE_DIR / "storage").exists() if PROFILE_DIR.exists() else False
    if profile_exists:
        print(f"  [Profile] 缓存命中 ({PROFILE_DIR.name})", file=sys.stderr)

    cam = AsyncCamoufox(
        headless=True,
        os="windows",
        locale="zh-CN",
        persistent_context=True,
        user_data_dir=str(PROFILE_DIR),
    )

    try:
        ctx = await cam.__aenter__()
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()

        # Cookie 保鲜
        if not await _acquire_cookies(ctx, page):
            print("  ✗ 获取 Cookie 失败", file=sys.stderr)
            return None

        # API 调用
        resp = await _call_api(page, ctx, enc_req)
        if resp is None:
            print("  ✗ API 调用失败", file=sys.stderr)
            return None

    finally:
        await ctx.close()

    t_api = time.time() - t1

    if resp["status"] != 200:
        print(f"  ✗ HTTP {resp['status']}", file=sys.stderr)
        print(f"    响应前500字: {resp.get('text', '')[:500]}", file=sys.stderr)
        return None

    text = resp.get("text", "")
    if "aliyun_waf" in text:
        print(f"  ✗ WAF 拦截, 实际响应前800字:", file=sys.stderr)
        print(f"    {text[:800]}", file=sys.stderr)
        return None

    data = json.loads(text)
    if not data.get("res"):
        print(f"  ⚠ 响应无 res 字段", file=sys.stderr)
        return data

    # ── Step 3: WASM 解密 ──
    print("[3/3] WASM 解密...", file=sys.stderr)
    t2 = time.time()
    result = decrypt(data["res"])
    t_dec = (time.time() - t2) * 1000

    t_total_elapsed = time.time() - t_total
    print(f"  ── API {t_api:.1f}s / 解密 {t_dec:.0f}ms / 总耗时 {t_total_elapsed:.1f}s ──",
          file=sys.stderr)
    return result


def show(result, date_str):
    """显示搜索结果"""
    data = result.get("data", result)
    flights = (
        data.get("flights") or data.get("flightList") or data.get("flightlist") or []
    )
    if not flights:
        print(json.dumps(result, ensure_ascii=False, indent=2)[:3000])
        return

    ds = ""
    if date_str and len(date_str) == 8:
        y, m, d = date_str[:4], str(int(date_str[4:6])), str(int(date_str[6:8]))
        ds = f"  {y}年{m}月{d}日"

    print(f"\n  {data.get('depName', '?')} → {data.get('arrName', '?')}{ds}")
    print(f"  {len(flights)} flights:")
    print("-" * 80)
    for i, f in enumerate(flights):
        no = f.get("flightNoGroup") or f.get("flightNo") or "?"
        dt = f.get("depTime", "?")
        at = f.get("arrTime", "?")
        da = f.get("depAirportName", "")
        aa = f.get("arrAirportName", "")
        dterm = f" T{f['depTerminal']}" if f.get("depTerminal") else ""
        aterm = f" T{f['arrTerminal']}" if f.get("arrTerminal") else ""
        fares = f.get("fares", [])
        mp = min(
            (float(x.get("salePrice") or x.get("price") or 999999) for x in fares),
            default=None,
        )
        line = f"  [{i + 1:2d}] {no:8s}  {dt}→{at}  {da}{dterm}→{aa}{aterm}"
        if mp and mp < 999999:
            line += f"  ¥{mp:.0f}"
        print(line)
    print("-" * 80)


# ============================================================
#   入口
# ============================================================

if __name__ == "__main__":
    cfg = {"dep": "SHA", "arr": "BJS", "date": "20260629"}
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, encoding="utf-8") as f:
            cfg.update(json.load(f))
    if len(sys.argv) > 1:
        cfg["dep"] = sys.argv[1]
    if len(sys.argv) > 2:
        cfg["arr"] = sys.argv[2]
    if len(sys.argv) > 3:
        cfg["date"] = sys.argv[3]

    dep_code = resolve(cfg["dep"])
    arr_code = resolve(cfg["arr"])
    date_str = cfg["date"]
    dep_name = city_name(dep_code)
    arr_name = city_name(arr_code)

    print(f"CEAIR: {dep_name}({dep_code}) → {arr_name}({arr_code}) {date_str}",
          file=sys.stderr)
    print("=" * 55, file=sys.stderr)

    r = asyncio.run(search(dep_code, arr_code, date_str, dep_name, arr_name))
    if r is None:
        print("\nSearch failed", file=sys.stderr)
        sys.exit(1)
    show(r, date_str)
