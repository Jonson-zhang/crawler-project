"""
欧冶 RS6 逆向 — iv8 方案
===========================

流程:
  1. GET /steel → 获取 RS6 挑战页面 (HTTP 202)
  2. 从 HTML 提取: meta content、内联 JS、外链 JS
  3. iv8 V8 引擎执行 RS6 VM → 生成 Cookie
  4. 携带 Cookie 请求 API → 获取钢材数据

iv8 是 Python 原生的 C++ V8 引擎嵌入，比 execjs 快 100 倍，
且无 Windows GBK 编码问题。
"""

import json
import sys
import time
import re
from pathlib import Path

import iv8
import requests

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Referer": "https://www.ouyeel.com/steel/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": UA,
    "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
}

HERE = Path(__file__).parent
session = requests.Session()


# ═══════════════════════════════════════════════════════════════
# Phase 1: 获取 RS6 挑战
# ═══════════════════════════════════════════════════════════════

def fetch_challenge():
    """GET /steel，提取 RS6 挑战参数。"""
    print("[1/4] 请求 https://www.ouyeel.com/steel ...", file=sys.stderr)
    resp = session.get("https://www.ouyeel.com/steel", headers=headers)
    resp.encoding = "utf-8"
    html_text = resp.text
    print(f"      HTTP {resp.status_code}, {len(html_text)} bytes", file=sys.stderr)

    # 提取 meta content（RS6 挑战值）
    meta_content = ""
    for m in re.finditer(r'<meta[^>]+content=["\']([^"\']+)["\']', html_text):
        meta_content = m.group(1)

    # 按 HTML 顺序提取脚本
    scripts = []
    for m in re.finditer(r'<script\s*([^>]*)>([\s\S]*?)</script>', html_text):
        attrs = m.group(1) or ""
        content = (m.group(2) or "").strip()
        src_match = re.search(r'src\s*=\s*["\']([^"\']+)["\']', attrs)
        if src_match:
            url = src_match.group(1)
            if not url.startswith("http"):
                url = "https://www.ouyeel.com" + ("/" if not url.startswith("/") else "") + url
            scripts.append({"type": "external", "url": url})
        elif content:
            scripts.append({"type": "inline", "code": content})

    # 收集初始 cookies
    initial_cookies = {}
    if "set-cookie" in resp.headers:
        for cookie_str in resp.headers.get_all("set-cookie") if hasattr(resp.headers, "get_all") else [resp.headers.get("set-cookie", "")]:
            parts = cookie_str.split(";")
            if "=" in parts[0]:
                n, v = parts[0].split("=", 1)
                initial_cookies[n.strip()] = v.strip()

    print(f"      meta content: {meta_content[:30]}...", file=sys.stderr)
    print(f"      脚本: {len(scripts)} 个", file=sys.stderr)
    for i, s in enumerate(scripts):
        t = "inline" if s["type"] == "inline" else "external"
        sz = str(len(s.get("code", s.get("url", "")))) + "b"
        print(f"        #{i} [{t}] {sz}", file=sys.stderr)

    return meta_content, scripts, initial_cookies


# ═══════════════════════════════════════════════════════════════
# Phase 2: iv8 执行 RS6 VM
# ═══════════════════════════════════════════════════════════════

def generate_cookie_iv8(meta_content, scripts, initial_cookies):
    """在 iv8 V8 引擎中执行 RS6 代码，生成 Cookie。"""
    print("[2/4] iv8 执行 RS6 VM ...", file=sys.stderr)

    # --- 构建 iv8 环境 ---
    ctx = iv8.JSContext(
        environment={
            "location": {
                "href": "https://www.ouyeel.com/steel",
                "protocol": "https:",
                "host": "www.ouyeel.com",
                "hostname": "www.ouyeel.com",
                "port": "",
                "pathname": "/steel",
                "search": "",
                "hash": "",
                "origin": "https://www.ouyeel.com",
            },
            "navigator": {
                "userAgent": UA,
                "platform": "Win32",
                "webdriver": False,
            },
            "screen": {
                "width": 1920,
                "height": 1080,
                "availWidth": 1920,
                "availHeight": 1040,
                "colorDepth": 24,
            },
        },
        config={"timezone": "Asia/Shanghai"},
    )
    ctx.__enter__()

    try:
        # --- 设置 meta content ---
        # iv8 的 document.getElementsByTagName 返回 HTMLCollection
        # 需要覆盖使其返回 meta 元素
        ctx.eval(f"""
        (function() {{
            var _metaContent = {json.dumps(meta_content)};
            var origGet = document.getElementsByTagName;
            document.getElementsByTagName = function(tag) {{
                if (String(tag).toUpperCase() === 'META') {{
                    var meta = document.createElement('meta');
                    meta.setAttribute('content', _metaContent);
                    var coll = [meta];
                    coll.item = function(i) {{ return coll[i] || null; }};
                    return coll;
                }}
                return origGet ? origGet.call(document, tag) : [];
            }};
        }})();
        """)

        # --- 设置初始 cookies ---
        if initial_cookies:
            cookie_str = "; ".join(f"{k}={v}" for k, v in initial_cookies.items())
            ctx.eval(f"document.cookie = {json.dumps(cookie_str)};")

        # --- 按序执行脚本 ---
        total = 0
        errors = 0
        for i, script in enumerate(scripts):
            if script["type"] == "inline":
                try:
                    ctx.eval(script["code"])
                    total += len(script["code"])
                except Exception as e:
                    errors += 1
                    print(f"        ⚠️ inline #{i}: {str(e)[:80]}", file=sys.stderr)
            else:
                print(f"        ↓ 外链 JS: {script['url']}", file=sys.stderr)
                resp = session.get(script["url"], headers=headers)
                code = resp.text
                try:
                    ctx.eval(code)
                    total += len(code)
                except Exception as e:
                    errors += 1
                    print(f"        ⚠️ external #{i}: {str(e)[:80]}", file=sys.stderr)

        # --- 触发 load 事件 ---
        try:
            ctx.eval("window.dispatchEvent(new Event('load'))")
        except Exception:
            pass

        # --- 提取 cookie ---
        cookie = str(ctx.eval("document.cookie") or "")

        # 清理 cookie：去除 path/expires/Secure 等属性
        clean_parts = []
        if cookie:
            for part in cookie.split(";"):
                part = part.strip()
                if not part:
                    continue
                if "=" not in part:
                    continue
                name = part.split("=", 1)[0].strip().lower()
                if name in ("path", "expires", "domain", "max-age", "samesite", "httponly", "secure", "comment"):
                    continue
                if name.startswith("enable_"):
                    continue
                clean_parts.append(part)
        cookie = "; ".join(clean_parts)

        print(f"      已执行 {total} bytes, {errors} 个报错(跳过)", file=sys.stderr)
        print(f"      Cookie: {len(cookie)} 字节", file=sys.stderr)

        return cookie

    finally:
        ctx.__exit__(None, None, None)


# ═══════════════════════════════════════════════════════════════
# Phase 3: API 查询
# ═══════════════════════════════════════════════════════════════

def search(cookie_str):
    """携带 Cookie 查询钢材数据。"""
    print("[3/4] 查询 API ...", file=sys.stderr)

    # 注入 cookie
    if cookie_str:
        session.headers.update({"Cookie": cookie_str})

    url = "https://www.ouyeel.com/search-ng/complexSearch/queryResult"
    criteria = json.dumps(
        {"channel": "RJ", "pageIndex": 0, "pageSize": 5},
        separators=(",", ":"),
        ensure_ascii=False,
    )
    api_headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://www.ouyeel.com",
        "Referer": "https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=0&pageSize=5",
        "User-Agent": UA,
    }

    resp = session.post(url, data={"criteriaJson": criteria}, headers=api_headers)
    print(f"      HTTP {resp.status_code}, {len(resp.content)} bytes", file=sys.stderr)

    if resp.status_code != 200:
        print(f"      ❌ API 返回 {resp.status_code}", file=sys.stderr)
        if len(resp.content) < 500:
            print(f"      body: {resp.content[:300]}", file=sys.stderr)
        return None

    try:
        data = resp.json()
        count = data.get("count", 0)
        weight = data.get("totalWeight", 0)
        print(f"      ✅ 共 {count} 件, {weight} 吨", file=sys.stderr)
        return data
    except json.JSONDecodeError as e:
        print(f"      ❌ JSON 解析失败: {e}", file=sys.stderr)
        print(f"      body({len(resp.content)}): {resp.content[:200]}", file=sys.stderr)
        return None


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

def main():
    print("═" * 50, file=sys.stderr)
    print("  欧冶 RS6 逆向 — iv8 方案", file=sys.stderr)
    print("═" * 50, file=sys.stderr)

    try:
        # Phase 1
        meta_content, scripts, initial_cookies = fetch_challenge()

        # Phase 2
        start = time.time()
        cookie = generate_cookie_iv8(meta_content, scripts, initial_cookies)
        elapsed = time.time() - start
        print(f"      ⏱ {elapsed:.1f}s", file=sys.stderr)

        if not cookie or len(cookie) < 50:
            print("❌ Cookie 无效或为空", file=sys.stderr)
            sys.exit(1)

        # Phase 3
        data = search(cookie)

        # Phase 4: 显示结果
        print("\n[4/4] 结果:", file=sys.stderr)
        if data:
            items = json.loads(data.get("resultList", "[]"))
            print(f"      在售: {len(items)} 件", file=sys.stderr)
            for i, item in enumerate(items[:10]):
                name = item.get("productName", "-")
                spec = item.get("spec", "-")
                price = item.get("publishPrice", 0)
                weight = item.get("balanceWeight", 0)
                print(f"        {i+1}. {name} | {spec} | ¥{price} | {weight}t", file=sys.stderr)
        else:
            print("      ❌ 未获取到数据", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"\n❌ 错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
