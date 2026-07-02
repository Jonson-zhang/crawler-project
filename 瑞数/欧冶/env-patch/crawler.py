"""
欧冶 (ouyeel.com) 钢材数据爬虫
================================

基于 env-patch（手动补环境）生成的 RS6 Cookie 爬取钢材数据。

流程:
  1. subprocess 调用 runner.js → env-patch 环境 → RS6 VM → Cookie
  2. Python requests 携带 Cookie → POST 查询 API → JSON 数据
  3. 格式化输出搜索结果

用法:
  python crawler.py                              # 默认查询
  python crawler.py --channel RJ --page 0 --size 50  # 自定义参数
  python crawler.py --debug                      # 调试模式（打印完整 JSON）
  python crawler.py --help                       # 帮助

依赖:
  pip install requests
  (或: uv add requests)
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

HERE = Path(__file__).parent
RUNNER_JS = HERE / "runner.js"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

# 默认查询参数
DEFAULT_CHANNEL = "RJ"        # 热轧
DEFAULT_PAGE_INDEX = 0
DEFAULT_PAGE_SIZE = 50


# ═══════════════════════════════════════════════════════════════
# Phase 1: Cookie 生成
# ═══════════════════════════════════════════════════════════════

def generate_cookie(timeout: int = 60) -> str:
    """
    通过 env-patch (runner.js) 生成 RS6 Cookie。

    步骤:
      1. subprocess 启动 node runner.js
      2. runner.js 内部: HTTPS GET → 提取 RS6 挑战 → 补环境 → 执行 VM
      3. stdout 输出 Cookie，stderr 输出诊断日志

    Args:
        timeout: 超时秒数（RS6 VM 执行 + HTTP 请求）

    Returns:
        Cookie 字符串（如 "T0k1m0u5AfREP=xxx; T0k1m0u5AfREO=yyy"）

    Raises:
        RuntimeError: Cookie 生成失败或超时
    """
    print("[1/2] 生成 RS6 Cookie (env-patch)...", file=sys.stderr)
    start = time.time()

    result = subprocess.run(
        ["node", str(RUNNER_JS)],
        capture_output=True,
        text=True,
        timeout=timeout,
        encoding="utf-8",
        errors="replace",
    )

    elapsed = time.time() - start

    # 打印 stderr 诊断日志
    stderr = result.stderr.strip()
    if stderr:
        for line in stderr.split("\n"):
            if line.strip():
                print(f"  {line}", file=sys.stderr)

    stdout = result.stdout.strip()
    exit_code = result.returncode

    if exit_code != 0:
        raise RuntimeError(
            f"runner.js 退出码 {exit_code}，未生成有效 Cookie\n"
            f"  stdout: {stdout[:200]}\n"
            f"  尝试 DEBUG_PROXY=true 调试: 查看缺失的环境属性"
        )

    if not stdout or len(stdout) < 50:
        raise RuntimeError(
            f"Cookie 无效 ({len(stdout)} 字节): {stdout[:100]}"
        )

    print(f"  ✅ 耗时: {elapsed:.1f}s, Cookie: {len(stdout)} 字节", file=sys.stderr)
    return stdout


# ═══════════════════════════════════════════════════════════════
# Phase 2: 数据查询
# ═══════════════════════════════════════════════════════════════

def create_session(cookie_str: str) -> requests.Session:
    """
    创建携带 RS6 Cookie 的 requests Session。

    注: runner.js 输出的 Cookie 已清理（不含 path/expires/Secure 等属性），
    可直接用 SimpleCookie 正确解析。
    """
    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    from http.cookies import SimpleCookie
    parsed = SimpleCookie(cookie_str)
    for key, morsel in parsed.items():
        session.cookies.set(key, morsel.value, domain="www.ouyeel.com")

    return session


def search(
    session: requests.Session,
    channel: str = DEFAULT_CHANNEL,
    page_index: int = DEFAULT_PAGE_INDEX,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> dict:
    """
    POST 查询 API，获取钢材搜索结果。

    API: /search-ng/complexSearch/queryResult
    """
    url = "https://www.ouyeel.com/search-ng/complexSearch/queryResult"

    criteria = json.dumps(
        {
            "channel": channel,
            "pageIndex": page_index,
            "pageSize": page_size,
        },
        separators=(",", ":"),
        ensure_ascii=False,
    )

    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://www.ouyeel.com",
        "Pragma": "no-cache",
        "Referer": (
            f"https://www.ouyeel.com/steel/search?"
            f"channel={channel}&pageIndex={page_index}&pageSize={page_size}"
        ),
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "User-Agent": UA,
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    print(f"\n[2/2] POST {url}", file=sys.stderr)
    print(f"      条件: channel={channel}, page={page_index}, size={page_size}",
          file=sys.stderr)

    resp = session.post(url, data={"criteriaJson": criteria}, headers=headers)
    print(f"      响应: HTTP {resp.status_code}, {len(resp.content)} 字节",
          file=sys.stderr)

    if resp.status_code != 200:
        raise RuntimeError(
            f"查询 API 返回 HTTP {resp.status_code}\n"
            f"  {resp.text[:300]}"
        )

    data = resp.json()

    # 解析结果
    items_raw = json.loads(data.get("resultList", "[]"))
    sold_raw = json.loads(data.get("soldResultList", "[]"))

    return {
        "total_count": data.get("count", 0),
        "total_weight": data.get("totalWeight", 0),
        "items": items_raw,
        "sold_items": sold_raw,
    }


# ═══════════════════════════════════════════════════════════════
# Phase 3: 格式化输出
# ═══════════════════════════════════════════════════════════════

def format_results(results: dict, max_items: int = 40):
    """格式化和打印搜索结果。"""
    items = results["items"]
    sold = results["sold_items"]

    # ── 统计信息 ──
    print()
    print("═" * 70)
    print("  搜索结果")
    print("═" * 70)
    print(f"  总计: {results['total_count']} 件, {results['total_weight']} 吨")
    print(f"  在售: {len(items)} 件, 已售: {len(sold)} 件")
    print()

    if not items:
        print("  (无在售商品)")
        return

    # ── 表头 ──
    header = (
        f"  {'':>3s}  "
        f"{'品名':<10s}  "
        f"{'规格':<16s}  "
        f"{'材质':<8s}  "
        f"{'卖家':<10s}  "
        f"{'库存(吨)':>8s}  "
        f"{'单价':>7s}  "
        f"{'仓库':<14s}  "
        f"{'城市':<8s}"
    )
    sep = "  " + "-" * 66
    print(sep)
    print(header)
    print(sep)

    # ── 数据行 ──
    for i, item in enumerate(items[:max_items]):
        name   = str(item.get("productName", "-"))[:10]
        spec   = str(item.get("spec", "-"))[:16]
        material = str(item.get("material", "-"))[:8]
        seller = str(item.get("providerShortName", "-"))[:10]
        weight = float(item.get("balanceWeight", 0) or 0)
        price  = int(item.get("publishPrice", 0) or 0)
        wh     = str(item.get("warehouseName", "-"))[:14]
        city   = str(item.get("storeCityName", "-"))[:8]

        print(
            f"  {i+1:>3d}. "
            f"{name:<10s}  "
            f"{spec:<16s}  "
            f"{material:<8s}  "
            f"{seller:<10s}  "
            f"{weight:>8.2f}  "
            f"{price:>7,d}  "
            f"{wh:<14s}  "
            f"{city:<8s}"
        )

    if len(items) > max_items:
        print(f"\n  ... 还有 {len(items) - max_items} 件未显示")

    print()


# ═══════════════════════════════════════════════════════════════
# CLI 入口
# ═══════════════════════════════════════════════════════════════

def parse_args():
    parser = argparse.ArgumentParser(
        description="欧冶钢材数据爬虫 — 基于 env-patch RS6 Cookie",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python crawler.py                              # 默认查询热轧钢材
  python crawler.py --channel LG                 # 冷轧
  python crawler.py --channel GXG                # 管线钢
  python crawler.py --page 1 --size 100          # 翻页
  python crawler.py --json                       # JSON 格式输出
  python crawler.py --debug                      # 调试模式
        """,
    )
    parser.add_argument("--channel", default=DEFAULT_CHANNEL,
                        help="钢材频道 (RJ=热轧, LG=冷轧, GXG=管线钢, 等)")
    parser.add_argument("--page", type=int, default=DEFAULT_PAGE_INDEX,
                        help="页码 (默认 0)")
    parser.add_argument("--size", type=int, default=DEFAULT_PAGE_SIZE,
                        help="每页数量 (默认 50)")
    parser.add_argument("--json", action="store_true",
                        help="以 JSON 格式输出（不打印表格）")
    parser.add_argument("--debug", action="store_true",
                        help="调试模式（打印完整响应 JSON）")
    parser.add_argument("--cookie-only", action="store_true",
                        help="仅生成 Cookie，不查询数据")
    parser.add_argument("--cookie", type=str,
                        help="直接使用已有 Cookie（跳过 runner.js 调用）")
    parser.add_argument("--timeout", type=int, default=60,
                        help="runner.js 超时秒数 (默认 60)")
    return parser.parse_args()


def main():
    args = parse_args()
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    try:
        # ══ Phase 1: 生成 / 使用 Cookie ══
        if args.cookie:
            cookie_str = args.cookie
            print(f"[1/2] 使用提供的 Cookie ({len(cookie_str)} 字节)",
                  file=sys.stderr)
        else:
            cookie_str = generate_cookie(timeout=args.timeout)

        if args.cookie_only:
            print(cookie_str)
            return

        # ══ Phase 2: 查询数据 ══
        session = create_session(cookie_str)
        results = search(
            session,
            channel=args.channel,
            page_index=args.page,
            page_size=args.size,
        )

        # ══ Phase 3: 输出 ══
        if args.debug:
            # 调试模式：打印完整响应
            print()
            print("═" * 70)
            print("  调试输出（完整 JSON）")
            print("═" * 70)
            print(json.dumps(results, ensure_ascii=False, indent=2))
            return

        if args.json:
            # JSON 输出
            print(json.dumps(results, ensure_ascii=False))
            return

        # 表格输出
        format_results(results)

        print(f"  提示: 用 --json 输出 JSON, --debug 查看原始数据",
              file=sys.stderr)
        print(f"  用 --channel LG --page 1 更换频道和翻页",
              file=sys.stderr)

    except subprocess.TimeoutExpired:
        print("❌ 超时: runner.js 执行超过限制时间", file=sys.stderr)
        print("   可能原因: RS6 VM 死循环、网络请求被拦截", file=sys.stderr)
        print("   尝试: 设置 RS6_TIMEOUT=60000 或检查网络代理", file=sys.stderr)
        sys.exit(1)

    except RuntimeError as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)

    except requests.RequestException as e:
        print(f"❌ 网络错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
