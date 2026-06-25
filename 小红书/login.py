#!/usr/bin/env python3
"""小红书登录 — 启动 Chrome 调试模式，扫码后自动保存 cookies"""
import json
import subprocess
import time
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DEBUG_PORT = 9222


def main():
    # 1. 启动 Chrome 调试模式
    print("[*] 启动 Chrome (调试模式)...")
    subprocess.Popen(
        [
            CHROME_PATH,
            f"--remote-debugging-port={DEBUG_PORT}",
            "--user-data-dir=C:\\Temp\\xhs_chrome_profile",
            "https://www.xiaohongshu.com/explore",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    print("\n[*] 请在 Chrome 中扫码登录小红书")
    print("[*] 登录成功后按 Enter 保存 cookies...")
    input()

    # 2. 通过 CDP 获取 cookies
    print("\n[*] 正在通过 CDP 获取 cookies...")
    try:
        resp = requests.get(
            f"http://127.0.0.1:{DEBUG_PORT}/json", timeout=5
        )
        pages = resp.json()
        ws_url = None
        for p in pages:
            if p.get("type") == "page" and "xiaohongshu" in p.get("url", ""):
                ws_url = p["webSocketDebuggerUrl"]
                break

        if not ws_url:
            print("[!] 找不到小红书页面，尝试从所有页面获取")
            if pages:
                ws_url = pages[0].get("webSocketDebuggerUrl")

        if ws_url:
            # 用 CDP 获取 cookies
            import websocket
            import json as js

            ws = websocket.create_connection(ws_url, timeout=10)

            # Network.getCookies
            ws.send(js.dumps({"id": 1, "method": "Network.getCookies"}))
            result = ws.recv()
            data = js.loads(result)
            cookies_list = data.get("result", {}).get("cookies", [])

            cookies_dict = {}
            for c in cookies_list:
                name = c.get("name", "")
                value = c.get("value", "")
                if name and value:
                    cookies_dict[name] = value

            ws.close()

            COOKIES_FILE.parent.mkdir(parents=True, exist_ok=True)
            COOKIES_FILE.write_text(
                json.dumps(cookies_dict, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            print(f"[+] Cookies 已保存! 共 {len(cookies_dict)} 项")
            print(f"    文件: {COOKIES_FILE}")
            has_session = "web_session" in cookies_dict
            print(f"    web_session: {'✅ 已获取' if has_session else '❌ 未获取'}")
        else:
            print("[!] 无法连接到 Chrome 调试端口")

    except Exception as e:
        print(f"[!] CDP 获取失败: {e}")
        print("[!] 请手动导出 cookies 到 data/cookies.json")


if __name__ == "__main__":
    main()
