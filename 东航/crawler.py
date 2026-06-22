"""
东航机票爬取 — DrissionPage + WASM 加解密
API: POST https://m.ceair.com/m-base/sale/shoppingv2

用法:
  python crawler.py              # 在 config.json 中设置出发地、目的地和出发时间
  python crawler.py 杭州 北京    # 出发 到达
  python crawler.py 杭州 北京 20260630  # 出发 到达 日期
"""

import subprocess
import json
import sys
import time
import io
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SD = Path(__file__).parent
SIGN_JS = SD / "sign.js"
COOKIES_FILE = SD / "cookies.json"
CONFIG_FILE = SD / "config.json"
API_BRIDGE = SD / "api_bridge.py"

# 城市映射
CITY_MAP = {
    "上海": "SHA",
    "北京": "BJS",
    "广州": "CAN",
    "深圳": "SZX",
    "成都": "CTU",
    "重庆": "CKG",
    "西安": "XIY",
    "昆明": "KMG",
    "杭州": "HGH",
    "南京": "NKG",
    "武汉": "WUH",
    "长沙": "CSX",
    "青岛": "TAO",
    "大连": "DLC",
    "厦门": "XMN",
    "福州": "FOC",
    "海口": "HAK",
    "三亚": "SYX",
    "沈阳": "SHE",
    "郑州": "CGO",
    "济南": "TNA",
    "哈尔滨": "HRB",
    "乌鲁木齐": "URC",
    "兰州": "LHW",
    "银川": "INC",
    "西宁": "XNN",
}
CODE_REV = {v: k for k, v in CITY_MAP.items()}


def resolve(s):
    """中文名→代码，代码→原样，未知→大写"""
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
    """机场代码→城市名"""
    return CODE_REV.get(code.upper(), code)


# ============================================================
# WASM 加解密
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
    """加密 → {"req": "base64..."}"""
    return json.loads(
        _node("encrypt", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    )


def decrypt(b64):
    """解密 → dict"""
    return json.loads(_node("decrypt", b64))


# ============================================================
# API 桥接 — api_bridge.py 子进程（CloakBrowser，单 Session 完成一切）
# ============================================================


def _venv():
    """返回装有 DrissionPage 的 Python 路径"""
    venv = SD.parent / ".venv" / "Scripts" / "python.exe"
    return str(venv) if venv.exists() else sys.executable


def call_api(enc_req):
    """浏览器单 Session：自动判断 Cookie 保鲜 + API 调用"""
    t0 = time.time()
    r = subprocess.run(
        [_venv(), str(API_BRIDGE), enc_req],
        capture_output=True,
        text=True,
        timeout=180,
        cwd=str(SD),
    )
    for line in r.stderr.splitlines():
        if line.strip():
            print(f"  {line.strip()}", file=sys.stderr)
    if r.returncode != 0:
        return None
    # api_bridge.py 末尾打印一行 JSON，取最后一行
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


# ============================================================
# 搜索
# ============================================================


def search(dep, arr, date, dn, an):
    t_total_start = time.time()

    t0 = time.time()
    print("[0/2] Encrypt...", file=sys.stderr)
    payload = {
        "currentQueryType": "FLIGHT_LIST",
        "currentSegIndex": 0,
        "language": "zh",
        "selectedRoutes": [],
        "productType": "CASH",
        "routes": [
            {
                "arrCode": arr,
                "depCode": dep,
                "flightDate": date,
                "arrCodeType": "1",
                "depCodeType": "1",
                "depCityName": dn,
                "arrCityName": an,
                "segIndex": 0,
                "leftInner": "",
                "rightInner": "",
            }
        ],
        "tripType": "OW",
        "cabinGrade": "",
    }
    enc = encrypt(payload)
    t_enc = (time.time() - t0) * 1000
    print(f"  ✓ {len(enc['req'])} chars  ({t_enc:.0f}ms)", file=sys.stderr)

    # API 调用（浏览器单 Session：自动判断 cookie 保鲜 + 发请求）
    t1 = time.time()
    print("[1/2] API...", file=sys.stderr)
    for attempt in range(2):
        result = call_api(enc["req"])
        if result:
            t_api = time.time() - t1
            t_total = time.time() - t_total_start
            print(
                f"[2/2] Done  (API {t_api:.1f}s, total {t_total:.1f}s)",
                file=sys.stderr,
            )
            return result
        if attempt == 0:
            print("  retry...", file=sys.stderr)
    t_api = time.time() - t1
    print(f"  ✗ failed after {t_api:.1f}s", file=sys.stderr)
    return None


def show(result, date):
    data = result.get("data", result)
    flights = (
        data.get("flights") or data.get("flightList") or data.get("flightlist") or []
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
            (float(x.get("salePrice") or x.get("price") or 999999) for x in fares),
            default=None,
        )
        line = f"  [{i + 1:2d}] {no:8s}  {dt}→{at}  {da}{dterm}→{aa}{aterm}"
        if mp and mp < 999999:
            line += f"  ¥{mp:.0f}"
        print(line)
    print("-" * 80)


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

    print(
        f"CEAIR: {dep_name}({dep_code}) → {arr_name}({arr_code}) {date_str}",
        file=sys.stderr,
    )
    print("=" * 55, file=sys.stderr)

    r = search(dep_code, arr_code, date_str, dep_name, arr_name)
    if r is None:
        print("\nSearch failed", file=sys.stderr)
        sys.exit(1)
    show(r, date_str)
