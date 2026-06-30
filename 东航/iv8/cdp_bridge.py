"""
极简 CDP 桥接 — 仅 ~60 行，替代 DrissionPage/CloakBrowser。

原理:
  Python → WebSocket → Chrome DevTools Protocol (CDP)
  → Runtime.evaluate('fetch(...)') → 浏览器内发请求 → 返回

不依赖任何第三方浏览器框架（无 DrissionPage/Playwright/Selenium）。
只需要系统里有 Chrome。

用法:
  python cdp_bridge.py <enc_req_base64>

Cookie 保鲜:
  复用 dp/v1.0/dp_user_data profile（首次运行时自动触发 Home + flightList 获取 Cookie）
"""

import json
import sys
import time
import subprocess
import threading
from pathlib import Path
from http.client import HTTPConnection

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
DP_PROFILE = str(HERE.parent / "dp" / "v1.0" / "dp_user_data")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# ═══════════════════════════════════════════════════════════════
# 1. 启动/连接 Chrome（复用 profile，自动 Cookie 保鲜）
# ═══════════════════════════════════════════════════════════════

def _find_chrome():
    """查找 Chrome 路径"""
    paths = [
        CHROME_PATH,
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
    ]
    import os
    for p in paths:
        p = os.path.expandvars(p)
        if Path(p).exists():
            return p
    return "chrome"  # 希望在 PATH 里


def _get_debug_port(chrome_pid=None):
    """获取 Chrome 的 --remote-debugging-port 实际端口号"""
    import os, glob
    # 尝试读 Chrome 的 DevToolsActivePort 文件
    if chrome_pid:
        # 检查 Chrome UserDataDir 下的 DevToolsActivePort
        port_file = Path(DP_PROFILE) / "DevToolsActivePort"
        if port_file.exists():
            try:
                lines = port_file.read_text().strip().splitlines()
                return int(lines[0])
            except Exception:
                pass

    # Fallback: 扫描已打开的 websocket debugger
    try:
        conn = HTTPConnection("127.0.0.1", 9222, timeout=2)
        conn.request("GET", "/json/version")
        r = conn.getresponse()
        if r.status == 200:
            return 9222
    except Exception:
        pass

    return None


def _find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_chrome():
    """启动 Chrome（headless，复用 dp_user_data profile）"""
    port = _get_debug_port()
    if port is not None:
        print(f"[Chrome] already running on port {port}", file=sys.stderr)
        return port

    port = _find_free_port()
    chrome = _find_chrome()

    print(f"[Chrome] starting headless on port {port}...", file=sys.stderr)
    subprocess.Popen([
        chrome,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={DP_PROFILE}",
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--window-size=412,915",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # 等 Chrome 就绪
    for _ in range(30):
        time.sleep(0.5)
        if _get_debug_port() is not None:
            print(f"[Chrome] ready", file=sys.stderr)
            return port
    raise RuntimeError("Chrome did not start within 15s")


# ═══════════════════════════════════════════════════════════════
# 2. CDP WebSocket 通信
# ═══════════════════════════════════════════════════════════════

class CDPClient:
    """极简 CDP 客户端 — 只用标准库 websocket"""

    def __init__(self, debug_port):
        import websocket  # 标准库没有 websocket，用内置的 ws

        # 获取可调试的 page target
        self._base = f"http://127.0.0.1:{debug_port}"

        # 找到第一个 page target
        conn = HTTPConnection("127.0.0.1", debug_port, timeout=5)
        conn.request("GET", "/json")
        r = conn.getresponse()
        targets = json.loads(r.read())
        page_targets = [t for t in targets if t["type"] == "page"]
        if not page_targets:
            raise RuntimeError("No page target found. Chrome may not have started correctly.")

        self._ws_url = page_targets[0]["webSocketDebuggerUrl"]
        self._msg_id = 0
        self._pending = {}

        # Create websocket
        self._ws = websocket.create_connection(self._ws_url, timeout=10)

    def send(self, method, params=None):
        """Send a CDP command and wait for the result"""
        self._msg_id += 1
        msg = {"id": self._msg_id, "method": method, "params": params or {}}
        self._ws.send(json.dumps(msg))

        # Read responses until we get our result
        while True:
            raw = self._ws.recv()
            resp = json.loads(raw)
            if resp.get("id") == self._msg_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP error: {resp['error']}")
                return resp.get("result", {})

    def evaluate(self, expression, await_promise=False):
        """在浏览器中执行 JS，返回结果"""
        result = self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise,
        })
        return result.get("result", {}).get("value")

    def close(self):
        self._ws.close()


# ═══════════════════════════════════════════════════════════════
# 3. Cookie 保鲜
# ═══════════════════════════════════════════════════════════════

def ensure_cookies(cdp):
    """导航到东航页面，确保 ssxmod_itna Cookie 存在"""
    # 先检查是否已有
    cookies = cdp.evaluate(
        "document.cookie.split('; ').filter(c => c.startsWith('ssxmod_itna')).join('|')"
    )
    if cookies and cookies != "":
        print("[Cookie] cached (fresh)", file=sys.stderr)
        # 确保页面在东航域上
        _nav_flightlist(cdp)
        return True

    print("[Cookie] refresh...", file=sys.stderr)
    for attempt in range(3):
        # 导航到 Home 触发 WAF
        cdp.send("Page.navigate", {"url": "https://m.ceair.com/mapp/Home"})
        cdp.send("Page.loadEventFired")  # 等待加载完成
        time.sleep(2)

        # 导航到 flightList 触发 Tongdun SDK
        _nav_flightlist(cdp)
        time.sleep(3)

        cookies = cdp.evaluate(
            "document.cookie.split('; ').filter(c => c.startsWith('ssxmod_itna')).join('|')"
        )
        if cookies and cookies != "":
            print("  ssxmod ready", file=sys.stderr)
            return True

        print(f"  attempt {attempt+1}/3: no ssxmod yet", file=sys.stderr)

    return False


def _nav_flightlist(cdp):
    """导航到 flightList（纯 CDP，不检查返回）"""
    cdp.send("Page.navigate", {
        "url": "https://m.ceair.com/mapp/reserve/flightList"
    })
    time.sleep(2)


# ═══════════════════════════════════════════════════════════════
# 4. API 调用
# ═══════════════════════════════════════════════════════════════

def post_api(cdp, enc_req):
    """在浏览器中执行 fetch() 发 POST"""
    js = """
    (async () => {
        const r = await fetch('/m-base/sale/shoppingv2', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*',
                'M-CEAIR-ENCRYPTED': 'true',
                'X-CEAIR-OS': 'M',
            },
            body: JSON.stringify({ req: arguments[0] })
        });
        const ct = r.headers.get('content-type') || '';
        const text = await r.text();
        return JSON.stringify({ status: r.status, contentType: ct, text: text });
    })()
    """

    # 先确保在东航页面
    cdp.evaluate(f"window.location.hostname", await_promise=False)

    for attempt in range(3):
        try:
            raw = cdp.evaluate(
                f"({js})({json.dumps(enc_req)})",
                await_promise=True,
            )
            if raw is None:
                time.sleep(2)
                continue
            resp = json.loads(raw)
        except Exception as e:
            print(f"  fetch error: {e}", file=sys.stderr)
            _nav_flightlist(cdp)
            time.sleep(2)
            continue

        if resp.get("status") != 200:
            return {"success": False, "error": f"HTTP {resp.get('status')}"}

        text = resp.get("text", "")
        if "aliyun_waf" in text:
            return {"success": False, "error": "WAF blocked"}

        data = json.loads(text)
        if data.get("res"):
            return {"success": True, "enc_response": data["res"]}
        return {"success": True, "enc_response": json.dumps(data, ensure_ascii=False)}

    return {"success": False, "error": "API: max retries"}


# ═══════════════════════════════════════════════════════════════
# 5. 入口
# ═══════════════════════════════════════════════════════════════

def run(enc_req):
    port = start_chrome()

    try:
        cdp = CDPClient(port)

        # Cookie 保鲜
        if not ensure_cookies(cdp):
            return {"success": False, "error": "ssxmod_itna missing"}

        # API 调用
        result = post_api(cdp, enc_req)
        return result
    finally:
        cdp.close() if 'cdp' in dir() else None
        # 不关闭 Chrome 进程，下次复用


if __name__ == "__main__":
    result = run(sys.argv[1])
    print(json.dumps(result))
