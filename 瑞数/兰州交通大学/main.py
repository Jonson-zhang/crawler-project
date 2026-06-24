#!/usr/bin/env python3
"""
兰州交通大学招标信息获取

架构（三层）:
  第 1 层: sdenv               — 浏览器环境（npm 包，C++ V8 Addon）
            cookie_gen/generate.js  — RS6 Cookie 生成器

  第 2 层: main.py             — Python 主控
            · 调用 generate.js 获取 Cookie
            · requests 协议请求招标列表页面
            · BeautifulSoup 解析数据
            · JSON 输出

用法:
  npm install            # 安装 sdenv（仅第一次）
  pip install requests beautifulsoup4
  python main.py
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings()

# ── 配置 ──
HOST = "zbzx.lzjtu.edu.cn"
BASE_URL = f"https://{HOST}"
ENTRY_PATH = "/zbxx/hwl.htm"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

BASE_DIR = Path(__file__).parent


# ═══════════════════════════════════════════════════════════════
#  Cookie 生成 — 调用 sdenv
# ═══════════════════════════════════════════════════════════════

def get_cookies() -> str:
    """
    调用 Node.js subprocess，通过 sdenv 过 RS6 412 挑战。
    返回 cookie 字符串（如 "keyS=abc; keyP=def"）。
    """
    script = BASE_DIR / "cookie_gen" / "generate.js"
    config = json.dumps({
        "url": BASE_URL,
        "entryPath": ENTRY_PATH,
        "userAgent": UA,
    })

    result = subprocess.run(
        ["node", str(script)],
        input=config,
        capture_output=True,
        text=True,
        cwd=str(BASE_DIR),
        timeout=120,
    )

    # 从 stdout 提取 JSON
    match = re.search(r'\{.*"success".*\}', result.stdout, re.DOTALL)
    if not match:
        err = result.stderr.strip()[:300] if result.stderr else "无输出"
        raise RuntimeError(f"sdenv 返回异常: {err}")

    data = json.loads(match.group())
    if not data.get("success") or not data.get("cookies"):
        raise RuntimeError(f"sdenv 失败: {data.get('error', 'unknown')}")

    return data["cookies"]


# ═══════════════════════════════════════════════════════════════
#  数据爬取 — requests + BeautifulSoup
# ═══════════════════════════════════════════════════════════════

def fetch_bidding_list(cookie: str) -> list[dict]:
    """
    用 Cookie 请求招标列表页面，解析返回结构化数据。
    """
    session = requests.Session()
    session.verify = False
    session.headers.update({
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": BASE_URL + "/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        "Cookie": cookie,
    })

    resp = session.get(BASE_URL + ENTRY_PATH, timeout=30)
    resp.encoding = "utf-8"

    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code} — Cookie 可能已过期")

    soup = BeautifulSoup(resp.text, "html.parser")
    list_div = soup.select_one(".listmain")
    if not list_div:
        return []

    items = []
    seen = set()

    for a_tag in list_div.find_all("a"):
        title = a_tag.get_text(strip=True)
        href = a_tag.get("href", "")

        if not title or len(title) < 5 or not href:
            continue
        if title in ("货物类", "工程类", "服务类", "招标信息", "信息公示"):
            continue
        if title in seen:
            continue
        seen.add(title)

        # 日期
        parent_text = a_tag.parent.get_text() if a_tag.parent else ""
        dm = re.search(r"\[(\d{4}年\d{2}月\d{2}日)\]", parent_text)
        date = dm.group(1) if dm else ""

        # URL（处理 ../info/10446/89194.htm 等相对路径）
        if href.startswith("http"):
            full_url = href
        elif href.startswith("/"):
            full_url = BASE_URL + href
        else:
            base_dir = "/" + "/".join(ENTRY_PATH.split("/")[1:-1]) + "/"
            full_url = urljoin(BASE_URL + base_dir, href)

        items.append({"title": title, "date": date, "url": full_url})

    return items


# ═══════════════════════════════════════════════════════════════
#  主入口
# ═══════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  兰州交通大学招标信息获取")
    print("  方案：sdenv (C++ 环境) → Cookie → requests 协议爬取")
    print("=" * 60)

    # [1/2] Cookie
    print("\n[1/2] sdenv 过 RS6 412 挑战（约 10s）...")
    try:
        cookie = get_cookies()
        print(f"  Cookie 长度: {len(cookie)} 字符")
    except RuntimeError as e:
        print(f"  失败: {e}")
        sys.exit(1)

    # [2/2] 爬取
    print("\n[2/2] 协议请求招标列表...")
    try:
        items = fetch_bidding_list(cookie)
    except RuntimeError as e:
        print(f"  失败: {e}")
        sys.exit(1)

    print(f"\n{'─' * 60}")
    print(f"  共 {len(items)} 条招标信息")
    print(f"{'─' * 60}")

    if not items:
        print("  无数据 — 页面可能改版，检查 .listmain 选择器")
        return

    # 保存
    out = BASE_DIR / "招标数据.json"
    out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  已保存: {out}\n")

    for i, item in enumerate(items):
        print(f"  {i+1:3d}. {item['title']}")
        print(f"        {item['date'] or '日期未知'}  →  {item['url']}")

    print(f"\n  完成")


if __name__ == "__main__":
    main()
