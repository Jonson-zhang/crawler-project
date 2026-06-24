#!/usr/bin/env python3
"""
兰州交通大学招标信息获取 — Python 主控 + Node.js Cookie 生成

架构：
  Python (main.py)
    |-- 调用 Node.js generate_cookies.js -> 获取 RS Cookie（sdenv）
    |-- requests 协议请求（携带 Cookie）
    |-- BeautifulSoup 解析招标列表
    |-- JSON 输出

依赖：
  pip install requests beautifulsoup4
  npm install sdenv  （已在 package.json 中声明）

用法：
  python main.py hwl     # 货物类（默认）
  python main.py gcl     # 工程类
  python main.py fwl     # 服务类
  python main.py all     # 全部三类
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

# -- 配置 --
HOST = "zbzx.lzjtu.edu.cn"
BASE_URL = f"https://{HOST}"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)

CATEGORIES = {
    "hwl": {"name": "货物类", "path": "/zbxx/hwl.htm"},
    "gcl": {"name": "工程类", "path": "/zbxx/gcl.htm"},
    "fwl": {"name": "服务类", "path": "/zbxx/fwl.htm"},
}

BASE_DIR = Path(__file__).parent


# ===============================================================
#  Cookie 生成（Node.js sdenv 子进程）
# ===============================================================

def generate_cookies() -> str | None:
    """
    调用 node generate_cookies.js，通过 sdenv 过 RS 412 挑战。
    返回 cookie 字符串，失败返回 None。
    """
    script = BASE_DIR / "generate_cookies.js"
    if not script.exists():
        raise FileNotFoundError(f"[FAIL] 找不到 {script}")

    print("  [*] 启动 Node.js 子进程...")
    result = subprocess.run(
        ["node", str(script)],
        capture_output=True,
        text=True,
        cwd=str(BASE_DIR),
        timeout=60,
    )

    if result.returncode != 0:
        print(f"  [FAIL] Node.js 退出码: {result.returncode}")
        print(f"  stderr: {result.stderr[:500]}")
        return None

    # 从 stdout 提取 JSON（可能混有 sdenv 日志）
    output = result.stdout.strip()
    # 尝试找到 JSON 块
    json_match = re.search(r'\{.*"success".*\}', output, re.DOTALL)
    if not json_match:
        print(f"  [FAIL] 无法从输出提取 JSON: {output[:300]}")
        return None

    try:
        data = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        print(f"  [FAIL] JSON 解析失败: {e}")
        return None

    if data.get("success") and data.get("cookies"):
        print(f"  [OK] Cookie 生成成功 ({len(data['cookies'])} 字符)")
        return data["cookies"]
    else:
        print(f"  [FAIL] sdenv 报错: {data.get('error', 'unknown')}")
        return None


# ===============================================================
#  HTTP 请求
# ===============================================================

def create_session(cookies_str: str) -> requests.Session:
    """创建带 Cookie 的 Session，统一请求头。"""
    session = requests.Session()
    session.headers.update({
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": BASE_URL + "/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
    })
    session.cookies.update({
        pair.split("=", 1)[0]: pair.split("=", 1)[1]
        for pair in cookies_str.split("; ")
        if "=" in pair
    })
    session.verify = False  # 旧版 OpenSSL 站点
    return session


def fetch_page(session: requests.Session, url: str) -> str | None:
    """请求页面，返回 HTML，失败返回 None。"""
    try:
        resp = session.get(url, timeout=30)
        resp.encoding = "utf-8"
        if resp.status_code == 200:
            return resp.text
        print(f"    [WARN] HTTP {resp.status_code} for {url}")
        return None
    except requests.RequestException as e:
        print(f"    [WARN] 请求失败: {e}")
        return None


# ===============================================================
#  HTML 解析
# ===============================================================

def resolve_url(href: str, base_path: str) -> str:
    """将相对路径解析为完整 URL。"""
    # 先构造 base_dir
    base_dir = "/" + "/".join(base_path.split("/")[1:-1]) + "/"
    full = urljoin(BASE_URL + base_dir, href)
    return full


def parse_list(html: str, base_path: str) -> list[dict]:
    """从 HTML 解析招标列表。"""
    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen_titles = set()

    # 网站群 CMS：招标数据在 div.listmain 中
    list_div = soup.select_one(".listmain")
    if not list_div:
        return items

    for a_tag in list_div.find_all("a"):
        title = a_tag.get_text(strip=True)
        href = a_tag.get("href", "")

        # 过滤
        if not title or len(title) < 5 or not href:
            continue
        if title in ("货物类", "工程类", "服务类", "招标信息", "信息公示"):
            continue
        if title in seen_titles:
            continue
        seen_titles.add(title)

        # 日期：从父元素提取 [YYYY年MM月DD日]
        parent_text = a_tag.parent.get_text() if a_tag.parent else ""
        date_match = re.search(r'\[(\d{4}年\d{2}月\d{2}日)\]', parent_text)
        date = date_match.group(1) if date_match else ""

        items.append({
            "title": title,
            "url": resolve_url(href, base_path),
            "date": date,
        })

    return items


def parse_next_page_url(html: str, base_path: str) -> str | None:
    """提取"下页"链接。"""
    soup = BeautifulSoup(html, "html.parser")

    for a_tag in soup.select(".page a"):
        text = a_tag.get_text(strip=True)
        if text in ("下页", "下一页"):
            href = a_tag.get("href", "")
            if href and href != "#" and "javascript:" not in href:
                return resolve_url(href, base_path)

    return None


# ===============================================================
#  爬取主逻辑
# ===============================================================

def crawl_category(session: requests.Session, cat_key: str) -> dict:
    """爬取单个分类的全部页面。"""
    cat = CATEGORIES[cat_key]
    print(f"\n{'='*60}")
    print(f"[*] {cat['name']} ({cat_key})")
    print(f"{'='*60}")

    all_items = []
    url = BASE_URL + cat["path"]
    page_num = 1

    while page_num <= 50:
        print(f"  第 {page_num} 页: {url}")
        html = fetch_page(session, url)
        if not html:
            break

        items = parse_list(html, cat["path"])
        new_items = [
            item for item in items
            if not any(e["title"] == item["title"] for e in all_items)
        ]
        print(f"  -> {len(new_items)} 条 (新增) / {len(items)} 条 (本页)")

        if not new_items:
            break

        all_items.extend(new_items)

        next_url = parse_next_page_url(html, cat["path"])
        if not next_url:
            print(f"  -> 无更多页")
            break

        url = next_url
        page_num += 1
        time.sleep(2)

    return {"category": cat["name"], "items": all_items, "total": len(all_items)}


def print_results(result: dict) -> None:
    """打印结果到控制台。"""
    items = result["items"]
    print(f"\n  [*] 共 {result['total']} 条")
    if items:
        print(f"    * 最新: {items[0]['title']}")
        print(f"    * 最旧: {items[-1]['title']}")
        print()
        for i, item in enumerate(items):
            print(f"  {i+1:3d}. {item['title']}")
            print(f"         # {item['date'] or '未标注'}  -> {item['url']}")


# ===============================================================
#  主入口
# ===============================================================

def main():
    import io
    import urllib3

    # Windows GBK 终端兼容 UTF-8 输出
    if sys.platform == "win32":
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    target = sys.argv[1] if len(sys.argv) > 1 else "hwl"
    keys = list(CATEGORIES.keys()) if target == "all" else [target]

    if target not in CATEGORIES and target != "all":
        print(f"[FAIL] 未知分类: {target}，可选: hwl/gcl/fwl/all")
        sys.exit(1)

    print("=" * 60)
    print("  兰州交通大学招标信息获取")
    print("  Python + Node.js/sdenv 混合方案")
    print("=" * 60)

    # Step 1: 获取 RS Cookie
    print("\n[1/3] 正在通过 RS 412 挑战（Node.js sdenv）...")
    cookies = generate_cookies()
    if not cookies:
        print("[FAIL] 无法获取 RS Cookie, 终止")
        sys.exit(1)

    # Step 2: 创建会话
    print("\n[2/3] 初始化 HTTP 会话...")
    session = create_session(cookies)

    # Step 3: 爬取
    print(f"\n[3/3] 爬取: {', '.join(CATEGORIES[k]['name'] for k in keys)}")
    start_time = time.time()

    for key in keys:
        result = crawl_category(session, key)

        # 保存
        out_path = BASE_DIR / f"{CATEGORIES[key]['name']}.json"
        out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n  [*] 已保存: {out_path}")

        # 打印
        print_results(result)

    elapsed = time.time() - start_time
    print(f"\n[OK] 完成! 耗时 {elapsed:.1f}s")


if __name__ == "__main__":
    main()
