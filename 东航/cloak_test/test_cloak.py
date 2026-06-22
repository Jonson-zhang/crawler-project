"""
东航 CloakBrowser WAF 绕过测试
用法: uv run python test_cloak.py [出发] [到达] [日期]
示例: uv run python 东航/cloak_test/test_cloak.py 成都 广州 20260628
"""

import subprocess
import json
import sys
import io
import time
from pathlib import Path

# ── 自动纠偏：如果用系统 Python 而非 uv 环境，自动重调 ──
if not sys.executable.replace("\\", "/").endswith(".venv/Scripts/python.exe"):
    PROJECT = Path(__file__).resolve().parent.parent.parent  # crawler/
    UV_PYTHON = PROJECT / ".venv" / "Scripts" / "python.exe"
    if UV_PYTHON.exists():
        result = subprocess.run(
            [str(UV_PYTHON), __file__, *sys.argv[1:]],
            cwd=str(PROJECT),
        )
        sys.exit(result.returncode)

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SD = Path(__file__).parent.parent  # 东航/
SIGN_JS = SD / "sign.js"
CLOAK_BRIDGE = Path(__file__).parent / "cloak_bridge.py"

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
    if s in CITY_MAP:
        return CITY_MAP[s]
    if s.upper() in CODE_REV:
        return s.upper()
    return s.upper()


def city_name(code):
    return CODE_REV.get(code.upper(), code)


def encrypt(payload):
    """通过 sign.js 加密"""
    p = subprocess.Popen(
        ["node", str(SIGN_JS), "encrypt"],
        cwd=str(SD),
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    out, err = p.communicate(
        input=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(),
        timeout=30,
    )
    if p.returncode:
        raise RuntimeError(err.decode()[:500])
    return json.loads(out.decode().strip())


def call_cloak(enc_req_str):
    """调用 cloak_bridge.py"""
    t0 = time.time()
    r = subprocess.run(
        [sys.executable, str(CLOAK_BRIDGE), enc_req_str],
        capture_output=True, text=True, timeout=180, cwd=str(SD),
    )
    for line in r.stderr.splitlines():
        if line.strip():
            print(f"  {line.strip()}", file=sys.stderr)

    if r.returncode != 0 or not r.stdout.strip():
        print(f"  Exit code: {r.returncode}, stdout empty", file=sys.stderr)
        return None

    for line in reversed(r.stdout.strip().splitlines()):
        try:
            data = json.loads(line)
            if data.get("success") and data.get("enc_response"):
                print(f"  ── API 总耗时: {time.time() - t0:.1f}s ──", file=sys.stderr)
                return data["enc_response"]
            elif data.get("error"):
                print(f"  ── Error: {data['error']}", file=sys.stderr)
                return None
        except json.JSONDecodeError:
            pass
    return None


def decrypt(b64):
    """通过 sign.js 解密"""
    p = subprocess.Popen(
        ["node", str(SIGN_JS), "decrypt"],
        cwd=str(SD),
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    out, err = p.communicate(input=b64.encode(), timeout=30)
    if p.returncode:
        raise RuntimeError(err.decode()[:500])
    return json.loads(out.decode().strip())


def show(result, date):
    data = result.get("data") or result
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
    dep = "CTU"
    arr = "CAN"
    date = "20250628"
    if len(sys.argv) > 1:
        dep = resolve(sys.argv[1])
    if len(sys.argv) > 2:
        arr = resolve(sys.argv[2])
    if len(sys.argv) > 3:
        date = sys.argv[3]

    dn = city_name(dep)
    an = city_name(arr)

    print(f"CEAIR (CloakBrowser test): {dn}({dep}) → {an}({arr}) {date}", file=sys.stderr)
    print("=" * 55, file=sys.stderr)

    # 1. 加密
    t0 = time.time()
    print("[0/2] Encrypt...", file=sys.stderr)
    payload = {
        "currentQueryType": "FLIGHT_LIST", "currentSegIndex": 0,
        "language": "zh", "selectedRoutes": [], "productType": "CASH",
        "routes": [{
            "arrCode": arr, "depCode": dep, "flightDate": date,
            "arrCodeType": "1", "depCodeType": "1",
            "depCityName": dn, "arrCityName": an,
            "segIndex": 0, "leftInner": "", "rightInner": "",
        }],
        "tripType": "OW", "cabinGrade": "",
    }
    enc = encrypt(payload)
    print(f"  ✓ {len(enc['req'])} chars  ({(time.time() - t0) * 1000:.0f}ms)", file=sys.stderr)

    # 2. CloakBrowser API
    print("[1/2] CloakBrowser API...", file=sys.stderr)
    enc_response = call_cloak(enc["req"])
    if enc_response is None:
        print("\nSearch failed", file=sys.stderr)
        sys.exit(1)

    # 3. 解密
    result = decrypt(enc_response)
    show(result, date)
