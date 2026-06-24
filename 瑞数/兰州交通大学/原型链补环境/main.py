#!/usr/bin/env python3
"""
兰州交通大学招标信息 — 原型链补环境方案

架构（三层）：
  第 1 层: env_framework.js     — 通用浏览器环境模拟（可复用）
  第 2 层: loader.js            — 注入站点专属代码 + 加载 RS VM
  第 3 层: main.py              — Python 主控：抓取页面 → 注入代码 → execjs 执行 → 获取 Cookie → 爬取数据

原理：
  1. requests 请求 412 页面 → 获得 meta_content + 内联 JS + 外链 JS URL
  2. 下载外链 RS VM JS 文件
  3. 将三段 JS 代码注入 loader.js
  4. execjs 编译执行 → RS VM 在模拟环境中运行 → 写入 document.cookie
  5. 提取 Cookie → 协议请求 → 解析招标列表

用法：
  pip install requests beautifulsoup4 lxml PyExecJS
  npm install -g jsdom  # execjs 需要 node 运行时
  python main.py
"""

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup
import execjs
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
#  步骤 1：从 412 页面提取三段关键代码
# ═══════════════════════════════════════════════════════════════

def fetch_412_page() -> dict:
    """请求目标页面，提取 RS6 需要的三段代码。"""
    session = requests.Session()
    session.verify = False

    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": BASE_URL + "/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
    }

    resp = session.get(f"{BASE_URL}{ENTRY_PATH}", headers=headers, timeout=30)
    resp.encoding = "utf-8"
    html = resp.text

    soup = BeautifulSoup(html, "html.parser")

    # 1. meta content（RS 核心：getElementsByTagName("META") 需要返回它）
    meta_tags = soup.find_all("meta")
    if not meta_tags:
        raise ValueError("未找到 meta 标签")

    metas = []
    for m in meta_tags:
        content = m.get("content", "")
        metas.append(content)
    meta_content = metas[-1] if metas else ""  # 取最后一个
    print(f"[+] meta content: {meta_content[:60]}...")

    # 2. 内联 JS（第一个 r='m' 的 script 标签 — $_ts 初始化）
    inlines = []
    for s in soup.find_all("script"):
        text = s.get_text(strip=True)
        if text and "$_ts" in text:
            inlines.append(text)
    inline_js = inlines[0] if inlines else ""
    print(f"[+] 内联 JS: {len(inline_js)} 字符")

    # 3. 外链 JS URL（RS VM 解释器）
    ext_url = None
    for s in soup.find_all("script"):
        src = s.get("src", "")
        if src and ".js" in src and "r='m'" in str(s):
            ext_url = src
            break
    if not ext_url:
        # fallback：找第二个 script src
        for s in soup.find_all("script"):
            src = s.get("src", "")
            if src and ".js" in src:
                ext_url = src
                break

    if not ext_url:
        raise ValueError("未找到外链 JS URL")

    if not ext_url.startswith("http"):
        ext_url = BASE_URL + (ext_url if ext_url.startswith("/") else "/" + ext_url)
    print(f"[+] 外链 JS URL: {ext_url}")

    # 4. 入口函数调用（如 _$g6()）
    entry_match = re.search(r"(_\$[a-zA-Z0-9]+)\(\)", html)
    entry_call = entry_match.group(0) if entry_match else ""
    print(f"[+] 入口函数: {entry_call}")

    # 下载外链 JS
    ext_resp = session.get(ext_url, headers=headers, timeout=30)
    ext_resp.encoding = "utf-8"
    external_js = ext_resp.text
    print(f"[+] 外链 JS: {len(external_js)} 字符 ({len(external_js)/1024:.1f}KB)")

    # 保存供调试
    (BASE_DIR / "_debug_meta.txt").write_text(meta_content, encoding="utf-8")
    (BASE_DIR / "_debug_inline.js").write_text(inline_js, encoding="utf-8")
    (BASE_DIR / "_debug_external.js").write_text(external_js, encoding="utf-8")

    return {
        "meta_content": meta_content,
        "inline_js": inline_js,
        "external_js": external_js,
        "entry_call": entry_call,
    }


# ═══════════════════════════════════════════════════════════════
#  步骤 2：组装 loader.js 并通过 execjs 执行
# ═══════════════════════════════════════════════════════════════

def generate_cookie(code_parts: dict) -> str:
    """
    将三段代码注入 loader.js，通过 execjs 执行 RS VM 生成 Cookie。
    返回 cookie 字符串。
    """
    loader_path = BASE_DIR / "loader.js"
    loader_code = loader_path.read_text(encoding="utf-8")

    # 替换占位符
    loader_code = loader_code.replace(
        '"__METACONTENT__"',
        json.dumps(code_parts["meta_content"])
    )
    loader_code = loader_code.replace(
        "__INLINE_CODE__",
        code_parts["inline_js"]
    )
    loader_code = loader_code.replace(
        "__EXTERNAL_CODE__",
        code_parts["external_js"]
    )
    loader_code = loader_code.replace(
        "__ENTRY_CALL__",
        code_parts["entry_call"] + ";" if code_parts["entry_call"] else ""
    )

    # 保存完整代码供调试
    (BASE_DIR / "_debug_loader_full.js").write_text(loader_code, encoding="utf-8")

    print("\n[*] 通过 execjs 执行 RS VM（约 10-30 秒）...")

    # 编译执行
    ctx = execjs.compile(loader_code, cwd=str(BASE_DIR))

    # 可选：检查 debug 信息
    try:
        debug = ctx.call("get_debug_info")
        print(f"[*] Debug: variable={debug.get('variable','')[:60]}...")
        print(f"[*] Debug: dom_content={debug.get('dom_content','')[:60]}...")
    except Exception:
        pass

    # 获取 Cookie
    cookie = ctx.call("get_cookie")
    print(f"[+] Cookie 长度: {len(cookie)} 字符")

    return cookie


# ═══════════════════════════════════════════════════════════════
#  步骤 3：用 Cookie 请求数据
# ═══════════════════════════════════════════════════════════════

def fetch_data(cookie: str) -> list:
    """用生成的 Cookie 请求招标列表页面。"""
    session = requests.Session()
    session.verify = False

    # 从 Cookie 字符串中提取 key=value 并设置
    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": BASE_URL + "/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Dest": "document",
        "Cookie": cookie,
    }

    resp = session.get(f"{BASE_URL}{ENTRY_PATH}", headers=headers, timeout=30)
    resp.encoding = "utf-8"

    if resp.status_code != 200:
        print(f"[!] HTTP {resp.status_code}")
        return []

    html = resp.text

    # 解析招标列表
    soup = BeautifulSoup(html, "html.parser")
    items = []

    list_div = soup.select_one(".listmain")
    if not list_div:
        print("[!] 未找到 .listmain")
        return []

    for a_tag in list_div.find_all("a"):
        title = a_tag.get_text(strip=True)
        href = a_tag.get("href", "")
        if not title or len(title) < 5:
            continue
        if title in ("货物类", "工程类", "服务类", "招标信息", "信息公示"):
            continue

        # 日期
        parent_text = a_tag.parent.get_text() if a_tag.parent else ""
        date_match = re.search(r"\[(\d{4}年\d{2}月\d{2}日)\]", parent_text)
        date = date_match.group(1) if date_match else ""

        # URL 解析
        if href.startswith("http"):
            full_url = href
        elif href.startswith("/"):
            full_url = BASE_URL + href
        else:
            # ../info/10446/89194.htm → 相对路径
            base_dir = "/" + "/".join(ENTRY_PATH.split("/")[1:-1]) + "/"
            from urllib.parse import urljoin
            full_url = urljoin(BASE_URL + base_dir, href)

        items.append({"title": title, "date": date, "url": full_url})

    return items


# ═══════════════════════════════════════════════════════════════
#  主入口
# ═══════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  兰州交通大学招标信息获取")
    print("  方案：原型链补环境 (execjs)")
    print("=" * 60)

    # Step 1: 抓取 412 页面
    print("\n[1/3] 抓取 412 页面...")
    code_parts = fetch_412_page()

    # Step 2: 注入 + 执行 → 生成 Cookie
    print("\n[2/3] 执行 RS VM 生成 Cookie...")
    cookie = generate_cookie(code_parts)

    if not cookie:
        print("[!] Cookie 为空，退出")
        sys.exit(1)

    # 保存 Cookie
    (BASE_DIR / "_debug_cookie.txt").write_text(cookie, encoding="utf-8")

    # Step 3: 用 Cookie 请求数据
    print("\n[3/3] 请求招标数据...")
    items = fetch_data(cookie)

    print(f"\n[+] 共获取 {len(items)} 条招标信息")
    if items:
        out_path = BASE_DIR / "招标数据.json"
        out_path.write_text(
            json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"[+] 已保存到 {out_path}")

        for i, item in enumerate(items):
            print(f"  {i+1:3d}. {item['title']}")
            print(f"        {item['date'] or '未知日期'}  {item['url']}")

    print("\n✅ 完成")


if __name__ == "__main__":
    main()
