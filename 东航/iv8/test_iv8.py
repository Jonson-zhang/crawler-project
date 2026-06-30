"""
东航机票搜索 — iv8 方案（纯 Python，无浏览器自动化）
=====================================================

架构:
  - iv8 (C++ V8 引擎)         → WASM 白盒 AES 加解密
  - httpx / curl_cffi          → HTTP POST (TLS 指纹模拟)
  - browser_cookies.txt        → Cookie (手动从浏览器复制一次)

与 cloak/dp 方案的区别:
  cloak:  CloakBrowser 子进程 → Cookie 保鲜 + API 调用
  dp:     DrissionPage → Cookie 保鲜 + API 调用
  iv8:    纯 Python!  WASM 在 iv8 中运行，HTTP 直接发，无浏览器开销

Cookie 刷新:
  首次: 在浏览器访问 m.ceair.com，F12 → Application → Cookies → 复制全部 cookie
  保存到 browser_cookies.txt (格式: k1=v1; k2=v2; ...)
  Cookie 有效期 ~25 分钟，过期需手动刷新（这是不用自动化的代价）

TLS 指纹问题:
  Python requests/httpx 的 TLS 指纹与浏览器不同，可能被 WAF 第一层拦截。
  - 方案 A: curl_cffi (推荐) → 模拟 Chrome TLS
  - 方案 B: httpx + 系统 cert (部分可行)

用法:
  python test_iv8.py                    # 读 config.json
  python test_iv8.py 杭州 北京           # 出发 到达
  python test_iv8.py 杭州 北京 20260629  # 出发 到达 日期
"""

import json
import sys
import time
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from curl_cffi import requests as requests_lib

# ── 本地模块 ──
from ceair_iv8 import CeairWasm, IV as _WASM_IV

# ═══════════════════════════════════════════════════════════════
# 路径与常量
# ═══════════════════════════════════════════════════════════════

HERE = Path(__file__).parent
ROOT = HERE.parent
COOKIE_FILE = ROOT / "browser_cookies.txt"
CONFIG_FILE = HERE / "config.json"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/148.0.0.0 Safari/537.36"
)

API_URL = "https://m.ceair.com/m-base/sale/shoppingv2"

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
    """中文名→代码"""
    if not s:
        return s
    if s in CITY_MAP:
        return CITY_MAP[s]
    if s.upper() in CODE_REV:
        return s.upper()
    return s.upper()


def city_name(code):
    """机场代码→城市名"""
    return CODE_REV.get(code.upper(), code)


# ═══════════════════════════════════════════════════════════════
# Cookie 管理
# ═══════════════════════════════════════════════════════════════

def load_cookies(path=None):
    """从 browser_cookies.txt 加载 Cookie 字符串"""
    p = Path(path) if path else COOKIE_FILE
    if not p.exists():
        return ""
    raw = p.read_text(encoding="utf-8").strip()
    # 支持换行分隔和多行
    return " ".join(line.strip().rstrip(";") for line in raw.splitlines() if line.strip())


def cookie_header(cookie_str=None):
    """返回格式化的 Cookie header 值"""
    c = cookie_str or load_cookies()
    # 确保末尾不带 ;
    return c.strip().rstrip(";")


# ═══════════════════════════════════════════════════════════════
# HTTP 客户端 — Python requests
#
# ⚠ TLS 指纹: Python requests 底层 OpenSSL 的 TLS 指纹与 Chrome 不同，
# 东航 WAF 第一层 (技术报告 §7.1) 可能直接拦截。
# 如需解决，uv add curl_cffi → from curl_cffi import requests 替换 import。
# ═══════════════════════════════════════════════════════════════

class ApiClient:
    """东航 API 客户端 — curl_cffi (Chrome TLS impersonation)"""

    def __init__(self, cookie_str=None, timeout=30):
        self._cookies = cookie_str or load_cookies()
        self._session = requests_lib.Session(impersonate="chrome124")
        self._session.headers.update({
            "Host": "m.ceair.com",
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Origin": "https://m.ceair.com",
            "Referer": "https://m.ceair.com/mapp/reserve/flightList",
            "M-CEAIR-ENCRYPTED": "true",
            "X-CEAIR-OS": "M",
            "ceair-ecuser-token": "null",
            "User-Agent": UA,
        })
        self._timeout = timeout

    def post(self, enc_req: str) -> dict | None:
        """POST shoppingv2"""
        cookie = cookie_header(self._cookies)
        h = {"Cookie": cookie} if cookie else {}

        body = json.dumps({"req": enc_req}, ensure_ascii=False)

        for attempt in range(3):
            try:
                r = self._session.post(
                    API_URL, data=body, headers=h,
                    timeout=self._timeout,
                )
            except requests_lib.RequestException as e:
                print(f"  [attempt {attempt+1}] 网络错误: {e}", file=sys.stderr)
                time.sleep(2)
                continue

            if r.status_code != 200:
                print(f"  HTTP {r.status_code}", file=sys.stderr)
                return None

            ct = r.headers.get("content-type", "")
            text = r.text

            if "text/html" in ct or "aliyun_waf" in text:
                print("  ⚠ WAF 拦截 (TLS 指纹 / Cookie 过期)", file=sys.stderr)
                print("  → 提示: 用浏览器手动刷新 browser_cookies.txt", file=sys.stderr)
                return None

            try:
                return r.json()
            except json.JSONDecodeError:
                print(f"  JSON 解析失败: {text[:200]}", file=sys.stderr)
                return None

        return None

    def close(self):
        self._session.close()


# ═══════════════════════════════════════════════════════════════
# 搜索流程
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
        "routes": [
            {
                "arrCode": arr, "depCode": dep,
                "flightDate": date,
                "arrCodeType": "1", "depCodeType": "1",
                "depCityName": dn, "arrCityName": an,
                "segIndex": 0, "leftInner": "", "rightInner": "",
            }
        ],
        "tripType": "OW",
        "cabinGrade": "",
    }

    with CeairWasm() as wasm:
        enc = wasm.encrypt(payload)

    t_enc = (time.time() - t0) * 1000
    print(f"  ✓ {len(enc['req'])} chars  ({t_enc:.0f}ms)", file=sys.stderr)

    # ── [1/2] API (requests) ──
    print("[1/2] API...", file=sys.stderr)
    t1 = time.time()

    client = ApiClient()
    try:
        for attempt in range(2):
            resp = client.post(enc["req"])
            if resp and resp.get("res"):
                t_api = time.time() - t1
                t_total_elapsed = time.time() - t_total
                print(
                    f"[2/2] Done  (API {t_api:.1f}s, total {t_total_elapsed:.1f}s)",
                    file=sys.stderr,
                )

                # ── [2/2] Decrypt (iv8) ──
                with CeairWasm() as wasm:
                    result = wasm.decrypt(resp["res"])
                return result

            if attempt == 0:
                print("  retry...", file=sys.stderr)
                time.sleep(1)

        t_api = time.time() - t1
        print(f"  ✗ failed after {t_api:.1f}s", file=sys.stderr)

        # 打印更详细的失败信息
        if resp:
            code = resp.get("code")
            msg = resp.get("message", "")[:100]
            print(f"  code={code} message={msg}", file=sys.stderr)
        return None
    finally:
        client.close()


# ═══════════════════════════════════════════════════════════════
# 显示
# ═══════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════════════

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

    # 检查 Cookie 文件
    cookie_str = load_cookies()
    if not cookie_str:
        print("⚠ browser_cookies.txt 为空或不存在", file=sys.stderr)
        print("  需要在浏览器中打开 m.ceair.com，", file=sys.stderr)
        print("  F12 → Application → Cookies → 全量复制到 browser_cookies.txt", file=sys.stderr)

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
