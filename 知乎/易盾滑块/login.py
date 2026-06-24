#!/usr/bin/env python3
"""
知乎登录 — 网易易盾验证码的过法（浏览器自动化）

原理：
  网易易盾不是纯滑块，是风控驱动的智能验证码，无法纯协议还原。
  本脚本用 cloakbrowser 打开知乎登录页：
    1. 自动填写手机号/密码
    2. 弹出易盾验证码 → 用户手动完成
    3. 验证通过后自动点击登录
    4. 导出 Cookie 供后续 requests 复用

用法：
  python login.py
  # 或带凭据：
  python login.py --phone 13800138000 --password yourpass
"""

import json, sys, time
from pathlib import Path
from cloakbrowser import launch

BASE_DIR = Path(__file__).parent
COOKIE_FILE = BASE_DIR / "cookies.json"
SIGNIN_URL = "https://www.zhihu.com/signin?next=%2F"


def do_login(phone="", password=""):
    """打开浏览器完成知乎登录，返回 cookies。"""
    b = launch(headless=False)
    page = b.new_page()

    # 监控网络请求，找易盾验证码的相关接口
    captcha_info = {}

    def on_response(resp):
        url = resp.url
        if "captcha" in url and resp.status == 200:
            try:
                ct = resp.headers.get("content-type", "")
                if "json" in ct:
                    data = resp.json()
                    if "script" in str(data) or "show_image" in str(data):
                        captcha_info["captcha_resp"] = {"url": url, "data": data}
            except:
                pass
        if "oauth/captcha" in url and resp.status == 200:
            try:
                ct = resp.headers.get("content-type", "")
                if "json" in ct:
                    captcha_info["captcha_config"] = resp.json()
            except:
                pass

    page.on("response", on_response)

    print("=" * 60)
    print("  知乎登录（网易易盾验证码）")
    print("=" * 60)

    # 打开登录页
    print("\n[1/4] 打开登录页...")
    page.goto(SIGNIN_URL, wait_until="networkidle")
    time.sleep(2)

    # 切换到密码登录
    print("[2/4] 切换到密码登录...")
    try:
        # 点击"密码登录" tab
        page.click('text=密码登录', timeout=3000)
        time.sleep(1)
    except:
        try:
            page.click('.SignFlow-tab:has-text("密码登录")', timeout=3000)
            time.sleep(1)
        except:
            print("  未找到密码登录入口，可能已在密码登录页")

    # 填写凭据（如果提供了）
    if phone or password:
        print("[3/4] 填写凭据...")
        if phone:
            try:
                page.fill('input[name="phone"]', phone)
            except:
                try:
                    page.fill('input[type="tel"]', phone)
                except:
                    try:
                        page.fill('input', phone)
                    except:
                        print("  手机号输入框未找到，请手动填写")
        if password:
            try:
                page.fill('input[name="password"]', password)
            except:
                try:
                    page.fill('input[type="password"]', password)
                except:
                    print("  密码输入框未找到，请手动填写")

        # 点击登录按钮以弹出验证码
        try:
            page.click('button:has-text("登录")', timeout=3000)
            time.sleep(2)
        except:
            print("  登录按钮未找到，请手动点击")

    # 等待用户完成验证码
    print("""
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  请在弹出的浏览器窗口中手动完成网易易盾验证码。          │
│  （滑块 / 点选 / 语序 — 由易盾风控自动决定类型）         │
│                                                          │
│  完成验证码并在浏览器中完成登录后，回到这里按 Enter。     │
│                                                          │
└──────────────────────────────────────────────────────────┘
""")

    if not phone:
        print("[*] 请手动填写手机号/密码 + 完成验证码 + 点击登录")
    input(">>> 按 Enter 继续...")

    # 检查登录状态
    print("\n[4/4] 提取 Cookie...")
    cookies_raw = page.evaluate("document.cookie")
    page_cookies = page.context.cookies()

    # 检查是否有登录成功的标志
    is_logged_in = page.evaluate("""
        (() => {
            return document.cookie.includes('z_c0') ||
                   document.cookie.includes('d_c0');
        })()
    """)

    if is_logged_in:
        print("  ✅ 登录成功!")
    else:
        print("  ⚠️ 可能未完成登录 — 请确认是否已完成")

    # 转换 cookies 为 requests 可用的格式
    cookies_dict = {}
    for c in page_cookies:
        cookies_dict[c["name"]] = c["value"]

    # 同时解析 document.cookie
    for item in cookies_raw.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            cookies_dict[k] = v

    # 保存
    COOKIE_FILE.write_text(
        json.dumps(cookies_dict, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  💾 Cookie 已保存到: {COOKIE_FILE}")

    # 显示关键的认证 cookie
    key_cookies = ["z_c0", "d_c0", "x-zse-96", "x-zst-81", "z_c0.sig"]
    print("\n  关键 Cookie:")
    for k in key_cookies:
        if k in cookies_dict:
            print(f"    {k} = {cookies_dict[k][:50]}...")

    b.close()
    return cookies_dict


def load_cookies():
    """从文件加载已保存的 Cookie."""
    if COOKIE_FILE.exists():
        return json.loads(COOKIE_FILE.read_text(encoding="utf-8"))
    return None


def test_cookies(cookies_dict):
    """测试 Cookie 是否仍然有效."""
    import requests

    s = requests.Session()
    s.cookies.update(cookies_dict)
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })

    resp = s.get("https://www.zhihu.com/api/v4/me", timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        if "id" in data:
            print(f"  ✅ Cookie 有效! 用户名: {data.get('name', 'unknown')}")
            return s
    print(f"  ❌ Cookie 过期 (HTTP {resp.status_code})")
    return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="知乎登录")
    parser.add_argument("--phone", default="", help="手机号")
    parser.add_argument("--password", default="", help="密码")
    parser.add_argument("--check", action="store_true", help="仅检查已有 Cookie 是否有效")
    args = parser.parse_args()

    if args.check:
        cookies = load_cookies()
        if cookies:
            test_cookies(cookies)
        else:
            print("未找到已保存的 Cookie，请先运行 python login.py 登录")
        return

    cookies = do_login(args.phone, args.password)

    # 验证
    if cookies:
        test_cookies(cookies)


if __name__ == "__main__":
    main()
