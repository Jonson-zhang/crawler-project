"""
欧冶钢材网 — API 查询工具（Camoufox 自动过瑞数）

=== 方案说明 ===

| 层 | 组件 | 说明 |
|----|------|------|
| Cookie 获取 | **Camoufox 浏览器** | 自动打开页面、通过瑞数挑战、提取 Cookie |
| TLS 指纹 | **curl_cffi (Firefox 135)** | TLS 指纹匹配 Firefox 135 |
| API 调用 | **curl_cffi** | POST 搜索接口 |

工作流:
  1. 读 cookies.json 中的现有 Cookie（如果有）
  2. 用 curl_cffi 测试是否有效
  3. 如果失效 → 自动启动 Camoufox 浏览器获取新 Cookie
  4. 保存新 Cookie → curl_cffi 调用 API

使用方式:
  python main_sdenv.py --interactive   # 交互模式
  python main_sdenv.py --page 0 --channel RJ  # 单次查询
"""

import json
import sys
import io
import subprocess
import re
import time
from pathlib import Path
from typing import Optional, Dict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    from curl_cffi import requests as curl_requests
except ImportError:
    curl_requests = None

BASE = Path(__file__).parent
COOKIE_FILE = BASE / "cookies.json"

# ═══════════════════════════════════════════════════════════════
#  Cookie 管理
# ═══════════════════════════════════════════════════════════════

API_URL = "https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.5",
    "Content-Type": "application/x-www-form-urlencoded",
    "Origin": "https://www.ouyeel.com",
    "Referer": "https://www.ouyeel.com/steel/search",
}

def load_cookies() -> Dict[str, str]:
    if COOKIE_FILE.exists():
        return json.loads(COOKIE_FILE.read_text("utf-8"))
    return {}

def save_cookies(cookies: dict) -> None:
    existing = load_cookies()
    existing.update(cookies)
    COOKIE_FILE.write_text(json.dumps(existing, ensure_ascii=False, indent=2), "utf-8")
    print(f"[cookies] 已保存 {len(cookies)} 个 Cookie → cookies.json")

def cookies_valid(cookies: dict) -> bool:
    """快速检查 Cookie 是否有效（测试 1 条数据）"""
    if not cookies.get("T0k1m0u5AfREP"):
        return False
    if curl_requests is None:
        return True  # 无法验证，假设有效
    try:
        r = curl_requests.post(
            API_URL, headers=HEADERS, cookies=cookies,
            data={"criteriaJson": json.dumps({"pageSize": 1})},
            impersonate="firefox135", allow_redirects=False, timeout=10,
        )
        return r.status_code == 200
    except Exception:
        return False

# ═══════════════════════════════════════════════════════════════
#  Camoufox Cookie 刷新
# ═══════════════════════════════════════════════════════════════

def fresh_cookies_via_camoufox() -> Dict[str, str]:
    """
    通过 Camoufox 反检测浏览器自动获取 Cookie。

    需要: Claude Code + camoufox-reverse MCP 运行中
    或: 已预装 camoufox 浏览器

    返回新的 Cookie 字典。
    """
    print("[camoufox] 启动浏览器获取新 Cookie...")

    # 方式 1: 通过 Node.js 子进程调用 Playwright + Camoufox
    # 需要先 pip install camoufox
    try:
        return _fresh_via_python_camoufox()
    except Exception as e:
        print(f"[camoufox] Python 方式失败: {e}")
        # 方式 2: 提示用户手动操作
        print("[camoufox] 请手动在浏览器中打开 https://www.ouyeel.com/steel/search")
        print("[camoufox] 等待页面加载（瑞数挑战自动完成）")
        print("[camoufox] 然后按回车键继续...")
        input()
        return load_cookies()

def _fresh_via_python_camoufox() -> Dict[str, str]:
    """Python 版 Camoufox 自动化（需要 pip install camoufox）"""
    try:
        from camoufox import Camoufox
    except ImportError:
        raise ImportError("需要安装 camoufox: pip install camoufox")

    with Camoufox(headless=True, humanize=True) as browser:
        page = browser.new_page()
        page.goto("https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50",
                   wait_until="networkidle", timeout=30000)
        time.sleep(5)  # 等 JS 挑战完成

        # 提取 Cookie
        cookies_ctx = browser.contexts[0].cookies()
        cookies = {}
        for c in cookies_ctx:
            cookies[c["name"]] = c["value"]

        # 检查 P Cookie
        if "T0k1m0u5AfREP" in cookies:
            print(f"[camoufox] ✅ 成功获取 P Cookie: {cookies['T0k1m0u5AfREP'][:40]}...")
        else:
            print(f"[camoufox] ⚠️ 未找到 P Cookie，返回 {len(cookies)} 个 Cookie")

        return cookies

# ═══════════════════════════════════════════════════════════════
#  API 调用
# ═══════════════════════════════════════════════════════════════

def search(
    channel: str = "RJ",
    page_index: int = 0,
    page_size: int = 50,
    cookies: Optional[Dict] = None,
    auto_refresh: bool = True,
) -> Optional[Dict]:
    if curl_requests is None:
        print("[FAIL] pip install curl_cffi")
        return None

    cookies = cookies or load_cookies()
    if not cookies:
        if not auto_refresh:
            print("[FAIL] 无 Cookie")
            return None
        cookies = fresh_cookies_via_camoufox()
        if not cookies:
            return None

    criteria = {
        "pageSize": page_size, "channel": channel, "pageIndex": page_index,
        "jsonParam": {"channel": channel, "keywordAnalyseResult": None},
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
            print(f"[FAIL] 202 - Cookie 过期")
            if auto_refresh:
                print("[*] 自动刷新 Cookie...")
                new_cookies = fresh_cookies_via_camoufox()
                if new_cookies and new_cookies != cookies:
                    save_cookies(new_cookies)
                    return search(channel, page_index, page_size, new_cookies, auto_refresh=False)
            return None
        else:
            print(f"[FAIL] HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f"[FAIL] {e}")
        return None

# ═══════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════

def search_cli(page=0, size=50, channel="RJ"):
    cookies = load_cookies()
    if not cookies_valid(cookies):
        print("[*] Cookie 无效/过期，自动获取新 Cookie...")
        cookies = fresh_cookies_via_camoufox()
        if cookies:
            save_cookies(cookies)
        if not cookies:
            return

    print(f"channel={channel}, pageIndex={page}, pageSize={size}")
    result = search(channel=channel, page_index=page, page_size=size, cookies=cookies)
    if not result:
        return

    items = json.loads(result.get("resultList", "[]"))
    print(f"\n共 {result.get('count',0)} 条，本页 {len(items)} 条")
    print("=" * 60)
    for i, item in enumerate(items[:5]):
        r = item.get("resourceObj", {})
        print(f"\n[{i+1}] {item.get('productName','')}")
        print(f"    钢厂: {item.get('manufactureName','')}")
        print(f"    规格: {r.get('spec','N/A')}  材质: {r.get('material','N/A')}")
        print(f"    基价: {r.get('basicPrice','N/A')}  重量: {r.get('balanceWeight','N/A')}吨")

def interactive():
    print("=" * 60)
    print("  欧冶钢材网 API 查询工具")
    print("  Camoufox 自动过瑞数 + curl_cffi Firefox 135 指纹")
    print("=" * 60)

    while True:
        cookies = load_cookies()
        valid = cookies_valid(cookies)
        has_p = bool(cookies.get("T0k1m0u5AfREP"))
        ck_status = "有效" if valid else "无/过期"

        print(f"\n--- Cookie: {ck_status} ---")
        if cookies:
            for k in ["T0k1m0u5AfREO", "T0k1m0u5AfREP", "cookiesession1"]:
                v = cookies.get(k, "")
                print(f"  {k}: {v[:40]}..." if v else f"  {k}: (无)")

        print("\n1. 查询热卷 (RJ)")
        print("2. 查询其他频道")
        print("3. 刷新 Cookie（Camoufox 浏览器）")
        print("4. 查看 Cookie 详情")
        print("5. 测试 API（202 挑战信息）")
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
            ck = fresh_cookies_via_camoufox()
            if ck:
                save_cookies(ck)
        elif ch == "4":
            ck = load_cookies()
            for k, v in ck.items():
                print(f"  {k}: {v[:50]}..." if len(v) > 50 else f"  {k}: {v}")
        elif ch == "5":
            if curl_requests is None:
                print("[FAIL] pip install curl_cffi")
                continue
            try:
                r = curl_requests.post(
                    API_URL, headers=HEADERS,
                    data={"criteriaJson": json.dumps({"pageSize": 1})},
                    impersonate="firefox135", allow_redirects=False, timeout=15,
                )
                info = {"status": r.status_code, "cookies": dict(r.cookies)}
                if r.status_code == 202:
                    html = r.text
                    nsd_m = re.search(r'nsd=(\d+)', html)
                    cd_m = re.search(r'\$_ts\.cd="([^"]+)"', html)
                    src_m = re.search(r'src="([^"]+\.js)"', html)
                    info.update({
                        "nsd": int(nsd_m.group(1)) if nsd_m else 0,
                        "cd_len": len(cd_m.group(1)) if cd_m else 0,
                        "js_url": src_m.group(1) if src_m else "",
                    })
                print(json.dumps(info, indent=2))
            except Exception as e:
                print(f"[FAIL] {e}")

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
        print("python main_sdenv.py --interactive  交互模式")
        print("python main_sdenv.py --page 0 --size 50 --channel RJ  查询")

if __name__ == "__main__":
    main()
