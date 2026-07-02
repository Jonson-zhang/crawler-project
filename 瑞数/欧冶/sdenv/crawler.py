"""
欧冶 (ouyeel.com) 瑞数6 逆向 — sdenv 精简方案
=============================================

sdenv = C++ V8 Addon + jsdom，内置完整浏览器 API。
RS6 VM 在 sdenv 中"以为是 Chrome"，无需手写原型链。

流程:
  1. Node.js(sdenv) 加载 /steel → RS6 VM → 304 字节 Cookie
  2. Python requests 携带 Cookie → POST queryResult → JSON 数据

用法: python crawler.py
"""

import json
import subprocess
import sys
from pathlib import Path

import requests

CONFIG = {
    "channel": "RJ",
    "page_index": 0,
    "page_size": 50,
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

HERE = Path(__file__).parent
SDENV_JS = HERE / "runner.js"


def generate_cookie():
    """通过 sdenv 生成 RS6 Cookie。"""
    print("[1] sdenv 加载 RS6 挑战页面...", file=sys.stderr)

    result = subprocess.run(
        ["node", str(SDENV_JS), json.dumps({"url": "https://www.ouyeel.com", "entryPath": "/steel"})],
        capture_output=True, text=True, timeout=30,
        encoding="utf-8", errors="replace",
    )

    stderr = result.stderr.strip()
    if stderr:
        for line in stderr.split("\n")[:5]:
            if line.strip():
                print("    [sdenv] %s" % line[:150], file=sys.stderr)

    stdout = result.stdout.strip()
    data = json.loads(stdout)

    if not data.get("success"):
        raise RuntimeError("sdenv 未生成 Cookie: %s" % data.get("error", "unknown"))

    cookies = data["cookies"]
    print("    Cookie: %d chars" % len(cookies), file=sys.stderr)
    return cookies


def search(session, channel, page_index, page_size):
    """POST /search-ng/complexSearch/queryResult"""
    url = "https://www.ouyeel.com/search-ng/complexSearch/queryResult"
    criteria = json.dumps(
        {"channel": channel, "pageIndex": page_index, "pageSize": page_size},
        separators=(",", ":"), ensure_ascii=False,
    )

    print("[2] POST %s" % url, file=sys.stderr)

    headers = {
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.ouyeel.com/steel/search?channel=%s&pageIndex=%d&pageSize=%d"
        % (channel, page_index, page_size),
        "User-Agent": UA,
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Origin": "https://www.ouyeel.com",
    }

    resp = session.post(url, data={"criteriaJson": criteria}, headers=headers)
    print("    HTTP %d, %d bytes" % (resp.status_code, len(resp.content)), file=sys.stderr)

    data = resp.json()
    items = json.loads(data.get("resultList", "[]"))
    sold = json.loads(data.get("soldResultList", "[]"))

    return {
        "total_count": data.get("count", 0),
        "total_weight": data.get("totalWeight", 0),
        "items": items,
        "sold_items": sold,
    }


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60, file=sys.stderr)
    print("  欧冶 RS6 逆向 — sdenv 方案", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    # 1. 生成 Cookie
    cookie_str = generate_cookie()

    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    for item in cookie_str.split("; "):
        if "=" in item:
            session.cookies.set(*item.split("=", 1))

    # 2. 查询
    channel = CONFIG["channel"]
    page_index = CONFIG["page_index"]
    page_size = CONFIG["page_size"]

    results = search(session, channel, page_index, page_size)
    items = results["items"]

    print()
    print("--- Search Results (channel=%s, page=%d) ---" % (channel, page_index))
    print("Total: %d items, %d tons" % (results["total_count"], results["total_weight"]))
    print()

    # Header
    print("  %-3s %-10s %-14s %-6s %-8s %6s %7s %-16s %s" % (
        "", "品名", "规格", "类型", "卖家", "库存t", "单价", "仓库", "城市"))

    for i, item in enumerate(items[:40]):
        name = str(item.get("productName", "-"))[:10]
        spec = str(item.get("spec", "-"))[:14]
        ptype = str(item.get("productTypeName", "-"))[:6]
        seller = str(item.get("providerShortName", "-"))[:8]
        weight = item.get("balanceWeight", 0) or 0
        price = item.get("publishPrice", 0) or 0
        wh = str(item.get("warehouseName", "-"))[:16]
        city = str(item.get("storeCityName", "-"))[:6]

        print("  %3d. %-10s %-14s %-6s %-8s %6.2f %6d %-16s %s" % (
            i + 1, name, spec, ptype, seller, float(weight), int(price), wh, city))

    if len(items) > 40:
        print("  ... and %d more" % (len(items) - 40))

    session.close()
