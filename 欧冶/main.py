"""
欧冶钢材网 - API 查询工具（curl_cffi TLS指纹方案）

=== 方案说明 ===

当前采用 curl_cffi（Firefox 135 TLS 指纹）+ 有效 Cookie 的方案：
  1. 从浏览器获取有效的瑞数 Cookie（T0k1m0u5AfREO + T0k1m0u5AfREP）
  2. 使用 curl_cffi 的 Firefox 135 指纹发起请求
  3. Cookie 与 TLS 指纹双重匹配后，API 返回 200 业务数据

=== iv8 补环境进展（可继续完善）===

已在 iv8 中成功加载并启动瑞数引擎 JS（175KB），
但字节码挑战（$_ts.cd）需要精确匹配 DOM 环境，
目前停在 `getAttribute on undefined` 错误。

完善方向见 README.md#iv8-继续完善
"""

import json
import sys
import io
import re
from pathlib import Path
from typing import Optional, Dict

# ── 编码修复 ──
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── 依赖 ──
try:
    from curl_cffi import requests as curl_requests
except ImportError:
    curl_requests = None

DATA_DIR = Path(__file__).parent
COOKIE_FILE = DATA_DIR / "cookies.json"

# ═══════════════════════════════════════════
# Cookie 管理
# ═══════════════════════════════════════════

def load_cookies() -> Dict[str, str]:
    if COOKIE_FILE.exists():
        return json.loads(COOKIE_FILE.read_text("utf-8"))
    return {}

def save_cookies(cookies: dict) -> None:
    existing = load_cookies()
    existing.update(cookies)
    COOKIE_FILE.write_text(json.dumps(existing, ensure_ascii=False, indent=2), "utf-8")

# ═══════════════════════════════════════════
# API 调用
# ═══════════════════════════════════════════

API_URL = "https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.5",
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://www.ouyeel.com",
    "Referer": "https://www.ouyeel.com/steel/search",
}

def search(
    channel: str = "RJ",
    page_index: int = 0,
    page_size: int = 50,
    cookies: Optional[Dict] = None,
) -> Optional[Dict]:
    if curl_requests is None:
        print("[FAIL] pip install curl_cffi")
        return None

    cookies = cookies or load_cookies()
    if not cookies:
        print("[FAIL] 无 Cookie，请先通过浏览器获取")
        return None

    criteria = {
        "pageSize": page_size, "channel": channel, "pageIndex": page_index,
        "maxPage": page_size, "jsonParam": {"channel": channel, "keywordAnalyseResult": None},
    }
    data = {"criteriaJson": json.dumps(criteria, ensure_ascii=False)}

    try:
        resp = curl_requests.post(
            API_URL, headers=HEADERS, cookies=cookies, data=data,
            impersonate="firefox135", allow_redirects=False, timeout=30,
        )

        if resp.status_code == 200:
            result = resp.json()
            items = json.loads(result.get("resultList", "[]"))
            print(f"[OK] 总数={result.get('count',0)}, 本页={len(items)} 条")
            return result
        elif resp.status_code == 202:
            new_cookies = dict(resp.cookies) if hasattr(resp, 'cookies') else {}
            if new_cookies:
                save_cookies(new_cookies)
            print(f"[FAIL] 202 - Cookie 无效/过期，需要在浏览器刷新后重试")
            return None
        else:
            print(f"[FAIL] HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f"[FAIL] {e}")
        return None


def search_cli(page: int = 0, size: int = 50, channel: str = "RJ"):
    """CLI 搜索"""
    cookies = load_cookies()
    if not cookies:
        print("[FAIL] 无 Cookie，请通过浏览器获取后再运行")
        return

    print(f"channel={channel}, pageIndex={page}, pageSize={size}")
    result = search(channel=channel, page_index=page, page_size=size, cookies=cookies)
    if not result:
        return

    items = json.loads(result.get("resultList", "[]"))
    print(f"\n共 {result.get('count',0)} 条，本页 {len(items)} 条")
    print("=" * 50)
    for i, item in enumerate(items[:5]):
        r = item.get("resourceObj", {})
        print(f"\n[{i+1}] {item.get('productName','')}")
        print(f"    钢厂: {item.get('manufactureName','')}")
        print(f"    规格: {r.get('spec','N/A')}  材质: {r.get('material','N/A')}")
        print(f"    基价: {r.get('basicPrice','N/A')}  重量: {r.get('balanceWeight','N/A')}吨")


def fetch_challenge() -> Optional[Dict]:
    """获取 202 挑战（调试用）"""
    if curl_requests is None:
        return None
    try:
        resp = curl_requests.post(
            API_URL, headers=HEADERS,
            data={"criteriaJson": json.dumps({"pageSize": 1})},
            impersonate="firefox135", allow_redirects=False, timeout=15,
        )
        info = {"status": resp.status_code, "cookies": dict(resp.cookies)}
        if resp.status_code == 202:
            html = resp.text
            nsd_m = re.search(r'nsd=(\d+)', html)
            cd_m = re.search(r'\$_ts\.cd="([^"]+)"', html)
            src_m = re.search(r'src="([^"]+\.js)"', html)
            info.update({
                "nsd": int(nsd_m.group(1)) if nsd_m else 0,
                "cd_len": len(cd_m.group(1)) if cd_m else 0,
                "js_url": src_m.group(1) if src_m else "",
            })
        return info
    except Exception as e:
        print(f"[FAIL] {e}")
        return None


def interactive():
    print("=" * 55)
    print("  欧冶钢材网 API 查询工具")
    print("  curl_cffi + Firefox 135 TLS 指纹")
    print("=" * 55)

    while True:
        cookies = load_cookies()
        has_cookie = bool(cookies.get("T0k1m0u5AfREP"))
        print(f"\n--- Cookie: {'有效' if has_cookie else '无/过期'} ---")
        print("1. 查询热卷")
        print("2. 查询其他频道")
        print("3. 检查/更新 Cookie")
        print("4. 获取 202 挑战信息")
        print("0. 退出")
        ch = input("选择: ").strip()

        if ch == "0":
            break
        elif ch == "1":
            search_cli(page=0, size=20, channel="RJ")
        elif ch == "2":
            c = input("频道 (RJ/LC/ZX/GX/TP): ").strip().upper() or "RJ"
            search_cli(page=0, size=20, channel=c)
        elif ch == "3":
            ck = load_cookies()
            print(f"Cookie ({len(ck)}):")
            for k, v in ck.items():
                if k in ("T0k1m0u5AfREO", "T0k1m0u5AfREP"):
                    print(f"  {k}: {v[:50]}...")
                else:
                    print(f"  {k}: {v}")
        elif ch == "4":
            ch_info = fetch_challenge()
            if ch_info:
                print(json.dumps(ch_info, indent=2))


def main():
    import argparse
    parser = argparse.ArgumentParser(description="欧冶钢材网 API")
    parser.add_argument("--page", type=int, default=-1)
    parser.add_argument("--size", type=int, default=50)
    parser.add_argument("--channel", default="RJ")
    parser.add_argument("--interactive", "-i", action="store_true")
    args = parser.parse_args()

    if args.interactive:
        interactive()
    elif args.page >= 0:
        search_cli(page=args.page, size=args.size, channel=args.channel)
    else:
        print("python main.py --interactive  # 交互模式")
        print("python main.py --page 0 --size 50 --channel RJ  # 查询")

if __name__ == "__main__":
    main()
