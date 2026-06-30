"""
东航机票搜索 — iv8 + DrissionPage 混合方案
==========================================

iv8 (C++ V8) 替代 Node.js 做 WASM 加解密,
DrissionPage (Chrome) 做 Cookie 保鲜 + API 调用。

与 dp/v1.0/test_drission.py 的区别:
  - 加密: iv8 内嵌 V8  ← 替代 Node.js 子进程
  - 解密: iv8 内嵌 V8  ← 替代 Node.js 子进程
  - HTTP: DrissionPage ← 同上 (浏览器是必须的, TLS 指纹绑定)

为什么 HTTP 层还是需要浏览器:
  ssxmod_itna Cookie 由 Tongdun JS SDK 在浏览器中生成,
  内嵌了浏览器 TLS 指纹。服务器验证 Cookie 指纹与 HTTP 连接的
  指纹是否一致。纯 Python HTTP 库 (requests/curl_cffi) 的 TLS 指纹
  与浏览器不同, 无法通过验证。

用法:
  python test_hybrid.py                    # 读 config.json
  python test_hybrid.py 杭州 北京           # 出发 到达
  python test_hybrid.py 杭州 北京 20260630  # 出发 到达 日期
"""

import json
import sys
import time
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── iv8 加密模块 ──
from ceair_iv8 import CeairWasm

HERE = Path(__file__).parent
DP_DIR = HERE.parent / "dp" / "v1.0"
CONFIG_FILE = HERE / "config.json"

# ═══════════════════════════════════════════════════════════════
# 城市映射
# ═══════════════════════════════════════════════════════════════

CITY_MAP = {
    "上海": "SHA", "北京": "BJS", "广州": "CAN", "深圳": "SZX",
    "成都": "CTU", "重庆": "CKG", "西安": "XIY", "昆明": "KMG",
    "杭州": "HGH", "南京": "NKG", "武汉": "WUH", "长沙": "CSX",
    "青岛": "TAO", "大连": "DLC", "厦门": "XMN", "福州": "FOC",
    "海口": "HAK", "三亚": "SYX", "沈阳": "SHE", "郑州": "CGO",
    "济南": "TNA", "哈尔滨": "HRB", "乌鲁木齐": "URC",
    "兰州": "LHW", "银川": "INC", "西宁": "XNN",
}
CODE_REV = {v: k for k, v in CITY_MAP.items()}


def resolve(s):
    if not s:
        return s
    if s in CITY_MAP:
        return CITY_MAP[s]
    if s.upper() in CODE_REV:
        return s.upper()
    return s.upper()


def city_name(code):
    return CODE_REV.get(code.upper(), code)


# ═══════════════════════════════════════════════════════════════
# WASM 加解密 — iv8 (替代 Node.js 子进程)
# ═══════════════════════════════════════════════════════════════

wasm = None  # 全局复用


def _get_wasm():
    global wasm
    if wasm is None:
        wasm = CeairWasm()
        wasm.__enter__()
    return wasm


def encrypt(data):
    return _get_wasm().encrypt(data)


def decrypt(b64):
    return _get_wasm().decrypt(b64)


# ═══════════════════════════════════════════════════════════════
# API 桥接 — DrissionPage 子进程
# ═══════════════════════════════════════════════════════════════

def _run_bridge(enc_req):
    """调用 dp/v1.0/api_bridge.py 子进程"""
    import subprocess
    t0 = time.time()
    r = subprocess.run(
        [sys.executable, str(DP_DIR / "api_bridge.py"), enc_req],
        capture_output=True, text=True, timeout=180, cwd=str(DP_DIR),
    )
    for line in r.stderr.splitlines():
        if line.strip():
            print(f"  {line.strip()}", file=sys.stderr)
    if r.returncode != 0:
        return None
    for line in reversed(r.stdout.strip().splitlines()):
        try:
            data = json.loads(line)
            if data.get("success") and data.get("enc_response"):
                t_elapsed = time.time() - t0
                print(f"  ── API 总耗时: {t_elapsed:.1f}s ──", file=sys.stderr)
                return decrypt(data["enc_response"])
        except json.JSONDecodeError:
            pass
    return None


# ═══════════════════════════════════════════════════════════════
# 搜索
# ═══════════════════════════════════════════════════════════════

def search(dep, arr, date, dn, an):
    t_total = time.time()

    # ── [0/2] Encrypt (iv8) ──
    print("[0/2] Encrypt (iv8)...", file=sys.stderr)
    t0 = time.time()
    payload = {
        "currentQueryType": "FLIGHT_LIST",
        "currentSegIndex": 0,
        "language": "zh",
        "selectedRoutes": [],
        "productType": "CASH",
        "routes": [{
            "arrCode": arr, "depCode": dep, "flightDate": date,
            "arrCodeType": "1", "depCodeType": "1",
            "depCityName": dn, "arrCityName": an,
            "segIndex": 0, "leftInner": "", "rightInner": "",
        }],
        "tripType": "OW",
        "cabinGrade": "",
    }
    enc = encrypt(payload)
    t_enc = (time.time() - t0) * 1000
    print(f"  ✓ {len(enc['req'])} chars  ({t_enc:.0f}ms)", file=sys.stderr)

    # ── [1/2] API (DrissionPage 浏览器) ──
    print("[1/2] API...", file=sys.stderr)
    for attempt in range(2):
        result = _run_bridge(enc["req"])
        if result:
            t_api = time.time() - t_total
            print(
                f"[2/2] Done  (total {t_api:.1f}s)",
                file=sys.stderr,
            )
            return result
        if attempt == 0:
            print("  retry...", file=sys.stderr)
    print(f"  ✗ failed", file=sys.stderr)
    return None


# ═══════════════════════════════════════════════════════════════
# 显示
# ═══════════════════════════════════════════════════════════════

def show(result, date):
    data = result.get("data", result)
    flights = (
        data.get("flights") or data.get("flightList")
        or data.get("flightlist") or []
    )
    if not flights:
        print(json.dumps(result, ensure_ascii=False, indent=2)[:3000])
        return

    ds = ""
    if date and len(date) == 8:
        y, m, d = date[:4], str(int(date[4:6])), str(int(date[6:8]))
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
            (float(x.get("salePrice") or x.get("price") or 999999)
             for x in fares),
            default=None,
        )
        line = f"  [{i + 1:2d}] {no:8s}  {dt}→{at}  {da}{dterm}→{aa}{aterm}"
        if mp and mp < 999999:
            line += f"  ¥{mp:.0f}"
        print(line)
    print("-" * 80)


# ═══════════════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    cfg = {"dep": "SHA", "arr": "BJS", "date": "20260630"}

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

    print(
        f"CEAIR: {dep_name}({dep_code}) → {arr_name}({arr_code}) {date_str}",
        file=sys.stderr,
    )
    print("=" * 55, file=sys.stderr)

    try:
        r = search(dep_code, arr_code, date_str, dep_name, arr_name)
        if r is None:
            print("\nSearch failed", file=sys.stderr)
            sys.exit(1)
        show(r, date_str)
    finally:
        if wasm:
            wasm.__exit__(None, None, None)
