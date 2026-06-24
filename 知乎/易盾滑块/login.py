#!/usr/bin/env python3
"""
知乎登录 — 浏览器自动化获取 Cookie

用法：
  python login.py                            # 手动操作模式
  python login.py --phone 13800138000        # 自动填手机号
  python login.py --phone 138 --password xxx # 填好凭据
  python login.py --check                    # 仅检查已有 Cookie 是否有效
"""

import json
import sys
import time
from pathlib import Path
from cloakbrowser import launch

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "cookies.json"
SIGNIN_URL = "https://www.zhihu.com/signin?next=%2F"


def safe_print(*args):
    """Windows GBK 兼容打印"""
    try:
        print(*args)
    except UnicodeEncodeError:
        print(*(str(a).encode("ascii", errors="replace").decode("ascii") for a in args))
    sys.stdout.flush()


def do_login(phone="", password=""):
    b = launch(headless=False)
    page = b.new_page()

    safe_print("=" * 60)
    safe_print("  知乎登录")
    safe_print("=" * 60)

    # [1] 打开登录页 — 用 domcontentloaded 避免 networkidle 卡死
    safe_print("\n[1/3] 打开登录页...")
    try:
        page.goto(SIGNIN_URL, wait_until="domcontentloaded", timeout=30000)
    except Exception as e:
        safe_print(f"  goto warning: {e}, 继续等待...")
    time.sleep(3)

    # 等页面 React 渲染
    try:
        page.wait_for_selector(".SignFlow", timeout=10000)
    except:
        pass
    time.sleep(2)

    # [2] 切换到密码登录 + 填凭据
    safe_print("[2/3] 准备登录...")
    try:
        # 点击密码登录 tab
        page.click("text=密码登录", timeout=5000)
        time.sleep(1)
    except:
        try:
            page.click(".SignFlow-tab:last-child", timeout=5000)
            time.sleep(1)
        except:
            safe_print("  未找到密码登录 tab, 请手动点击")

    if phone or password:
        safe_print("  填写凭据...")
        if phone:
            try:
                page.fill('.SignFlow-account input[name="phone"]', phone)
            except:
                try:
                    page.fill(".SignFlow-account input", phone)
                except:
                    safe_print("  手机号输入框未找到, 请手动填写")
        if password:
            try:
                page.fill('.SignFlow-account input[name="password"]', password)
            except:
                try:
                    page.evaluate(f"""
                        var inputs = document.querySelectorAll('.SignFlow-account input');
                        if (inputs.length >= 2) inputs[1].value = '{password}';
                    """)
                except:
                    safe_print("  密码输入框未找到, 请手动填写")

        # 点击登录触发验证码
        try:
            page.click('button:has-text("登录")', timeout=5000)
            time.sleep(2)
        except:
            safe_print("  请手动点击登录按钮")

    # [3] 等待用户
    safe_print("""
  ┌──────────────────────────────────────────────┐
  │  请在浏览器窗口中手动完成易盾验证码并登录。    │
  │  完成后回到这里按 Enter。                      │
  └──────────────────────────────────────────────┘
""")
    input(">>> 按 Enter 继续...")

    # 提取 Cookie
    safe_print("\n[3/3] 提取 Cookie...")
    page_cookies = page.context.cookies()
    cookies_dict = {}
    for c in page_cookies:
        cookies_dict[c["name"]] = c["value"]

    doc_cookie = page.evaluate("document.cookie")
    for item in doc_cookie.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            cookies_dict[k] = v

    is_ok = bool(cookies_dict.get("z_c0") or cookies_dict.get("d_c0"))
    safe_print(
        f"  {'[OK] 登录成功' if is_ok else '[!] 可能未登录'} ({len(cookies_dict)} 个 Cookie)"
    )

    COOKIE_FILE.write_text(
        json.dumps(cookies_dict, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    safe_print(f"  已保存: {COOKIE_FILE}")

    b.close()
    return cookies_dict


def load_cookies():
    if COOKIE_FILE.exists():
        return json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
    return None


def test_cookies(cookies_dict):
    import requests

    s = requests.Session()
    s.cookies.update(cookies_dict)
    s.headers.update(
        {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    resp = s.get("https://www.zhihu.com/api/v4/me", timeout=10)
    if resp.status_code == 200 and "id" in (resp.json() or {}):
        safe_print(f"  [OK] Cookie 有效")
        return s
    safe_print(f"  [FAIL] Cookie 过期 (HTTP {resp.status_code})")
    return None


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--phone", default="")
    parser.add_argument("--password", default="")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.check:
        c = load_cookies()
        if c:
            test_cookies(c)
        else:
            safe_print("未找到 Cookie, 请先 python login.py")
        return

    cookies = do_login(args.phone, args.password)
    if cookies:
        test_cookies(cookies)


if __name__ == "__main__":
    main()
