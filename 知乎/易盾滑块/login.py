#!/usr/bin/env python3
"""
知乎登录 — 获取 Cookie

方案 A (推荐): 手动在正常 Chrome 中登录 → 导出 Cookie
方案 B:       用 Playwright 持久化上下文（需首次手动登录）

用法:
  python login.py              # 方案 B: 自动化辅助登录
  python login.py --export     # 方案 A: 生成导出说明
  python login.py --check      # 检查已有 Cookie 是否有效
  python login.py --from-file cookies.txt  # 方案 A: 从文件加载
"""

import json, sys, time
from pathlib import Path

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "xbs_env" / "cookies.json"


def safe_print(*args):
    try:
        print(*args)
    except UnicodeEncodeError:
        print(*(str(a).encode("ascii", errors="replace").decode("ascii") for a in args))
    sys.stdout.flush()


# ═══════════════════════════════════════════════════════════════
#  方案 B：Playwright 持久化上下文
# ═══════════════════════════════════════════════════════════════

def login_with_persistent_context():
    """
    用持久化浏览器上下文（D:\zhihu_profile）。
    首次运行需要手动登录，之后 Cookie/登录态会被缓存。
    """
    from playwright.sync_api import sync_playwright  # 注意：不是 cloakbrowser

    profile_dir = str(BASE_DIR / "chrome_profile")

    with sync_playwright() as p:
        # 用普通 Chromium（非 Camoufox） + 持久化目录
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=ChromeWhatsNewUI",
            ],
            viewport={"width": 1280, "height": 800},
        )

        # 注入反检测脚本
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => false});
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN','zh','en']});
        """)

        page = context.new_page()
        page.goto("https://www.zhihu.com/signin?next=%2F", wait_until="domcontentloaded", timeout=30000)
        time.sleep(3)

        safe_print("""
  ┌──────────────────────────────────────────────┐
  │  请在浏览器窗口中完成登录（手动操作）。        │
  │  登录成功后回到这里按 Enter。                  │
  └──────────────────────────────────────────────┘
""")
        input(">>> 按 Enter 继续...")

        # 提取 Cookie
        page_cookies = context.cookies()
        cookies_dict = {c["name"]: c["value"] for c in page_cookies}
        COOKIE_FILE.write_text(json.dumps(cookies_dict, ensure_ascii=False, indent=2), encoding="utf-8")

        is_ok = bool(cookies_dict.get("z_c0"))
        safe_print(f"  {'[OK] 登录成功' if is_ok else '[!] 可能未登录'} ({len(cookies_dict)} Cookie)")
        safe_print(f"  已保存: {COOKIE_FILE}")
        safe_print(f"  下次运行无需再登录（profile: {profile_dir}）")

        context.close()


# ═══════════════════════════════════════════════════════════════
#  方案 A：手动导出 Cookie
# ═══════════════════════════════════════════════════════════════

def export_guide():
    """打印从正常 Chrome 导出 Cookie 的步骤"""
    safe_print("""
  ═══════════════════════════════════════════════════
    方案 A：从正常 Chrome 导出 Cookie（最可靠）
  ═══════════════════════════════════════════════════

  步骤：
    1. 用你的正常 Chrome 浏览器打开 https://www.zhihu.com/signin
    2. 正常登录（完全在普通浏览器中操作，无需任何自动化工具）
    3. 登录后按 F12 → Application → Cookies → www.zhihu.com
    4. 复制所有 Cookie，保存为文本文件

  然后运行:
    python login.py --from-file cookies.txt

  或者直接运行:
    python login.py --manual
    （会弹出一个窗口让你粘贴 Cookie 字符串）
""")


def import_from_file(filepath):
    """从 Netscape cookie 格式或 key=value 格式导入 Cookie"""
    text = Path(filepath).read_text(encoding="utf-8", errors="ignore")
    cookies_dict = {}

    # 格式 1: Netscape (curl cookie jar)
    for line in text.strip().split("\n"):
        if line.startswith("#") or not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) >= 7:
            cookies_dict[parts[5]] = parts[6]
        elif "=" in line:
            for item in line.split("; "):
                if "=" in item:
                    k, v = item.split("=", 1)
                    cookies_dict[k] = v

    if not cookies_dict:
        # 格式 2: key=value 对
        for item in text.replace("\n", "").split("; "):
            if "=" in item:
                k, v = item.split("=", 1)
                cookies_dict[k] = v

    COOKIE_FILE.write_text(json.dumps(cookies_dict, ensure_ascii=False, indent=2), encoding="utf-8")
    safe_print(f"  导入 {len(cookies_dict)} 个 Cookie, 已保存: {COOKIE_FILE}")

    test_cookies(cookies_dict)


def manual_input():
    """手动粘贴 Cookie 字符串"""
    safe_print("请粘贴浏览器中的 Cookie 字符串（完整一行），然后按 Enter:")
    try:
        cookie_str = input("Cookie: ").strip()
    except (EOFError, KeyboardInterrupt):
        return

    cookies_dict = {}
    for item in cookie_str.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            cookies_dict[k] = v

    COOKIE_FILE.write_text(json.dumps(cookies_dict, ensure_ascii=False, indent=2), encoding="utf-8")
    safe_print(f"  导入 {len(cookies_dict)} 个 Cookie")
    test_cookies(cookies_dict)


# ═══════════════════════════════════════════════════════════════
#  验证 + 入口
# ═══════════════════════════════════════════════════════════════

def test_cookies(cookies_dict):
    import requests
    s = requests.Session()
    s.cookies.update(cookies_dict)
    s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    try:
        resp = s.get("https://www.zhihu.com/api/v4/me", timeout=10)
        if resp.status_code == 200 and "id" in (resp.json() or {}):
            data = resp.json()
            safe_print(f"  [OK] Cookie 有效! 用户: {data.get('name', '?')}")
            return s
    except:
        pass
    safe_print(f"  [FAIL] Cookie 无效或过期")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="检查已有 Cookie")
    parser.add_argument("--export", action="store_true", help="导出指南")
    parser.add_argument("--manual", action="store_true", help="手动粘贴 Cookie")
    parser.add_argument("--from-file", type=str, help="从文件导入 Cookie")
    args = parser.parse_args()

    if args.export:
        export_guide()
    elif args.from_file:
        import_from_file(args.from_file)
    elif args.manual:
        manual_input()
    elif args.check:
        c = json.loads(COOKIE_FILE.read_text(encoding="utf-8")) if COOKIE_FILE.exists() else None
        if c:
            test_cookies(c)
        else:
            safe_print("未找到 Cookie")
    else:
        # 默认：方案 B — 持久化上下文
        login_with_persistent_context()


if __name__ == "__main__":
    main()
