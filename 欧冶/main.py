"""
main.py — 欧冶钢材网 API 查询工具（纯算/补环境方案）

=== 方案说明 ===

欧冶网站使用瑞数 v4 反爬系统，核心机制：
  1. 首次请求返回 202（包含挑战 HTML + $_ts.cd 编码数据）
  2. 浏览器加载瑞数引擎 JS → 解码 bytecode → 计算环境指纹 → 回调完成挑战
  3. 挑战成功后设置 T0k1m0u5AfREP Cookie
  4. 后续请求携带 Cookie + 正确 TLS 指纹即可通过

=== 实现方式 ===

本方案采用"补环境 + 纯算"混合方式：

  方式 A：Node.js env_patch 补环境
    - 使用 .claude/env-patch/env_patch.js 框架
    - 在 Node.js vm 中模拟浏览器环境
    - 执行瑞数 JS 引擎（从 $_ts.cd 解码 bytecode）
    - 【已知限制】瑞数 v4 的 while(1)+switch 字节码解释器
      在纯 Node.js 环境中进入无限循环（缺少真实浏览器属性）

  方式 B：curl_cffi 纯 HTTP 方案（推荐，已验证可用）
    - 使用 curl_cffi 匹配 Firefox 135 的 TLS/HTTP2 指纹
    - 从浏览器获取有效 Cookie 后，直接调用 API
    - 浏览器 Cookie 有效期内可持续使用

=== 使用方式 ===

  1. 安装依赖：
     pip install curl_cffi httpx

  2. 确保有有效 Cookie（从浏览器获取）：
     手动编辑 cookies.json，或使用 cookie_fetcher.py

  3. 运行查询：
     python main.py --page 0 --size 50
     python main.py --interactive

=== 目录结构 ===

  欧冶/
  ├── main.py          ← 入口（这个文件）
  ├── env.js           ← Node.js 补环境模块
  ├── sign.js          ← Node.js 瑞数挑战求解
  ├── cookie_fetcher.py ← Cookie 获取工具
  ├── solver.py        ← 旧版浏览器代理求解器
  ├── cookies.json     ← 保存的 Cookie
  ├── README.md        ← 说明文档
  ├── 202_fresh.html   ← 202 挑战响应示例
  ├── ruiShu_engine_1.js  ← 瑞数引擎 JS（分析用）
  ├── ruiShu_engine_2.js  ← 瑞数第二 JS（分析用）
  └── ruishu_fresh.js  ← 最新瑞数 JS
"""

import json
import sys
import time
from pathlib import Path
from typing import Optional, Dict, Any, List

# ── 依赖检查 ──
try:
    from curl_cffi import requests as curl_requests
except ImportError:
    curl_requests = None

try:
    import httpx
except ImportError:
    httpx = None

# ── 配置 ──
DATA_DIR = Path(__file__).parent
CONFIG = {
    "api_url": "https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult",
    "target_url": "https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50",
    "referer": "https://www.ouyeel.com/steel/search",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "headers": {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://www.ouyeel.com",
        "Referer": "https://www.ouyeel.com/steel/search",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    },
}


# ═══════════════════════════════════════════
# 1. Cookie 管理
# ═══════════════════════════════════════════

def load_cookies() -> Dict[str, str]:
    """从 cookies.json 加载 Cookie"""
    cookie_file = DATA_DIR / "cookies.json"
    if cookie_file.exists():
        return json.loads(cookie_file.read_text(encoding="utf-8"))
    return {}


def save_cookies(cookies: dict) -> None:
    """保存 Cookie 到文件"""
    existing = load_cookies()
    existing.update(cookies)
    cookie_file = DATA_DIR / "cookies.json"
    cookie_file.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


# ═══════════════════════════════════════════
# 2. API 调用（curl_cffi TLS 指纹）
# ═══════════════════════════════════════════

def query_commodity(
    page_index: int = 0,
    page_size: int = 50,
    channel: str = "RJ",
    cookies: Optional[Dict[str, str]] = None,
    **kwargs,
) -> Optional[Dict[str, Any]]:
    """
    查询商品列表

    使用 curl_cffi 的 Firefox 135 TLS 指纹，
    配合有效 Cookie 调用 API。

    Args:
        page_index: 页码 (0=第一页, 1=第二页)
        page_size: 每页数量 (默认50)
        channel: 频道代码
        cookies: Cookie 字典
        **kwargs: 其他搜索参数

    Returns:
        API 响应或 None
    """
    if curl_requests is None:
        print("[!] 需要安装 curl_cffi: pip install curl_cffi")
        return None

    cookies = cookies or load_cookies()
    if not cookies:
        print("[!] 无 Cookie，请先获取")
        return None

    # 构建请求体
    criteria = {
        "pageSize": page_size,
        "industryComponent": None,
        "channel": channel,
        "productType": None,
        "sort": None,
        "warehouseCode": None,
        "key_search": None,
        "is_central": None,
        "searchField": None,
        "companyCode": None,
        "inquiryCategory": None,
        "inquirySpec": None,
        "provider": None,
        "shopCode": None,
        "packCodes": None,
        "steelFactory": None,
        "resourceIds": None,
        "providerCode": None,
        "jsonParam": {
            "channel": channel,
            "keywordAnalyseResult": None,
        },
        "excludeShowSoldOut": None,
        "pageIndex": page_index,
        "maxPage": page_size,
    }

    for k, v in kwargs.items():
        if v is not None:
            criteria[k] = v

    data = {"criteriaJson": json.dumps(criteria, ensure_ascii=False)}

    try:
        resp = curl_requests.post(
            CONFIG["api_url"],
            headers=CONFIG["headers"],
            cookies=cookies,
            data=data,
            impersonate="firefox135",
            allow_redirects=False,
            timeout=30,
        )

        if resp.status_code == 200:
            result = resp.json()
            count = result.get("count", 0)
            result_list = json.loads(result.get("resultList", "[]"))
            print(f"[✓] 查询成功: 总数={count}, 本页={len(result_list)}")
            return result
        elif resp.status_code == 202:
            print(
                f"[✗] 收到 202 挑战响应 - Cookie 无效/已过期"
            )
            # 检查新 Cookie
            new_cookies = dict(resp.cookies) if hasattr(resp, 'cookies') else {}
            if new_cookies:
                print(f"    收到新 Cookie: {list(new_cookies.keys())}")
                save_cookies(new_cookies)
            return None
        else:
            print(f"[✗] API 失败: HTTP {resp.status_code}")
            return None

    except Exception as e:
        print(f"[✗] 请求异常: {e}")
        return None


# ═══════════════════════════════════════════
# 3. 202 挑战处理
# ═══════════════════════════════════════════

def fetch_challenge() -> Optional[Dict]:
    """
    发起初始请求获取 202 挑战

    首次请求会返回 202 状态码 + 挑战 HTML，
    同时设置 T0k1m0u5AfREO 和 cookiesession1。

    Returns:
        {"html": "挑战HTML", "cookies": {...}, "cd": "...", "nsd": 0}
    """
    if curl_requests is None:
        return None

    try:
        resp = curl_requests.post(
            CONFIG["api_url"],
            headers=CONFIG["headers"],
            data={"criteriaJson": json.dumps({"pageSize": 1})},
            impersonate="firefox135",
            allow_redirects=False,
            timeout=15,
        )

        result = {
            "status": resp.status_code,
            "cookies": dict(resp.cookies),
            "html": resp.text if resp.status_code == 202 else "",
        }

        # 解析 cd 和 nsd
        if resp.status_code == 202:
            html = resp.text
            import re
            nsd_match = re.search(r'nsd=(\d+)', html)
            cd_match = re.search(r'\$_ts\.cd="([^"]+)"', html)
            meta_match = re.search(r'<meta content="([^"]+)"', html)
            src_match = re.search(r'src="([^"]+\.js)"', html)

            result["nsd"] = int(nsd_match.group(1)) if nsd_match else 0
            result["cd"] = cd_match.group(1) if cd_match else ""
            result["meta"] = meta_match.group(1) if meta_match else ""
            result["ruishu_js_url"] = src_match.group(1) if src_match else ""

        return result

    except Exception as e:
        print(f"[✗] 挑战请求失败: {e}")
        return None


# ═══════════════════════════════════════════
# 4. 结果处理
# ═══════════════════════════════════════════

def format_products(data: dict, max_items: int = 10) -> str:
    """格式化商品数据为文本"""
    if not data:
        return "无数据"

    items = json.loads(data.get("resultList", "[]"))
    count = data.get("count", 0)

    lines = [f"共 {count} 条商品，本页 {len(items)} 条", "=" * 50]

    for i, item in enumerate(items[:max_items]):
        res = item.get("resourceObj", {})
        lines.extend([
            f"\n[{i + 1}] {item.get('productName', 'N/A')}",
            f"    钢厂: {item.get('manufactureName', 'N/A')}",
            f"    规格: {res.get('spec', 'N/A')}  材质: {res.get('material', 'N/A')}",
            f"    基价: {res.get('basicPrice', 'N/A')}  重量: {res.get('balanceWeight', 'N/A')}吨",
            f"    仓库: {res.get('warehouseName', 'N/A')}",
            f"    供应商: {item.get('providerName', 'N/A')}",
        ])

    if len(items) > max_items:
        lines.append(f"\n... 还有 {len(items) - max_items} 条")

    return "\n".join(lines)


# ═══════════════════════════════════════════
# 5. CLI 入口
# ═══════════════════════════════════════════

def print_banner():
    print("=" * 55)
    print("  欧冶钢材网 API 查询工具")
    print("  瑞数 v4 | curl_cffi TLS指纹 | 补环境方案")
    print("=" * 55)
    print()


def search_simple(page: int = 0, size: int = 50, channel: str = "RJ"):
    """简单搜索"""
    cookies = load_cookies()
    if not cookies:
        print("[!] 无 Cookie，请先获取")
        print("    方式: 打开浏览器访问 ouyeel.com，提取 Cookie 保存到 cookies.json")
        return

    print(f"查询: channel={channel}, pageIndex={page-1 if page>0 else 0}, pageSize={size}")
    result = query_commodity(
        page_index=page - 1 if page > 0 else page,
        page_size=size,
        channel=channel,
        cookies=cookies,
    )

    if result:
        print()
        print(format_products(result, max_items=5))


def interactive_mode():
    """交互模式"""
    print_banner()

    while True:
        print("\n" + "-" * 40)
        print("1. 查询热卷（默认）")
        print("2. 查询冷轧")
        print("3. 查询中厚板")
        print("4. 查询特钢")
        print("5. 查看/刷新 Cookie")
        print("6. 查询指定频道和页码")
        print("7. 获取 202 挑战信息")
        print("8. 运行 Node.js 补环境验证")
        print("0. 退出")
        print("-" * 40)

        choice = input("请选择: ").strip()

        if choice == "0":
            break
        elif choice == "1":
            search_simple(page=0, channel="RJ")
        elif choice == "2":
            search_simple(page=0, channel="LC")
        elif choice == "3":
            search_simple(page=0, channel="ZX")
        elif choice == "4":
            search_simple(page=0, channel="TP")
        elif choice == "5":
            cookies = load_cookies()
            if cookies:
                print(f"[*] Cookie 共 {len(cookies)} 个:")
                for k, v in cookies.items():
                    print(f"    {k}: {v[:40]}...")
            else:
                print("[!] 无 Cookie")
        elif choice == "6":
            channel = input("频道代码 (RJ/LC/ZX/GX/TP): ").strip().upper() or "RJ"
            try:
                page = int(input("页码 (从1开始): ").strip() or "1")
                size = int(input("每页数量: ").strip() or "50")
                search_simple(page=page, size=size, channel=channel)
            except ValueError:
                print("输入无效")
        elif choice == "7":
            print("[*] 获取 202 挑战...")
            challenge = fetch_challenge()
            if challenge:
                print(f"    状态: {challenge['status']}")
                print(f"    CD长度: {len(challenge.get('cd', ''))}")
                print(f"    NSD: {challenge.get('nsd')}")
                print(f"    Cookie: {list(challenge.get('cookies', {}).keys())}")
                print(f"    元数据: {challenge.get('meta', '')[:60]}...")
            else:
                print("    获取失败")
        elif choice == "8":
            print("[*] 运行 Node.js 补环境...")
            import subprocess
            try:
                r = subprocess.run(
                    ["node", str(DATA_DIR / "sign.js")],
                    capture_output=True, text=True, timeout=15,
                )
                print(f"    stdout: {r.stdout[:500]}")
                if r.stderr:
                    print(f"    stderr: {r.stderr[:300]}")
            except subprocess.TimeoutExpired:
                print("    [超时] Node.js 执行超时 (>15s)")
            except FileNotFoundError:
                print("    [错误] 未找到 Node.js")
        else:
            print("无效选择")


def main():
    """主入口"""
    import argparse

    parser = argparse.ArgumentParser(description="欧冶钢材网 API 查询")
    parser.add_argument("--page", type=int, default=-1, help="页码 (0=第一页)")
    parser.add_argument("--size", type=int, default=50, help="每页数量")
    parser.add_argument("--channel", default="RJ", help="频道代码")
    parser.add_argument("--interactive", "-i", action="store_true", help="交互模式")
    parser.add_argument("--check-cookies", "-c", action="store_true", help="检查 Cookie")

    args = parser.parse_args()

    if args.interactive:
        interactive_mode()
    elif args.check_cookies:
        cookies = load_cookies()
        if cookies:
            print(f"Cookie ({len(cookies)}):")
            for k, v in cookies.items():
                print(f"  {k}: {v[:50]}...")
        else:
            print("无 Cookie")
    elif args.page >= 0:
        search_simple(page=args.page, size=args.size, channel=args.channel)
    else:
        print_banner()
        print("使用:")
        print("  python main.py --interactive   交互模式")
        print("  python main.py --page 0 --size 50  查询第一页")
        print("  python main.py --check-cookies 检查 Cookie")
        print()
        print("注意: 需要有效 Cookie。如 Cookie 过期，")
        print("请通过浏览器访问 ouyeel.com 后提取 Cookie 到 cookies.json")


if __name__ == "__main__":
    main()
