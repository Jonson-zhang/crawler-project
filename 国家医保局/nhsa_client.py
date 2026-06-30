"""
国家医保局 — 统一客户端
======================

支持三种模式:
  1. CDP 模式 (推荐): 通过 Chrome CDP 利用页面自身加密/签名发起请求
  2. jsdom 模式: 通过 Node.js jsdom 加载 app.js 生成加密请求
  3. 纯协议模式 (待完成): 纯 Python 实现 SM2/SM4 加密和签名

用法:
  python nhsa_client.py "北京协和医院"
  python nhsa_client.py "医院" --page 1 --size 5
  python nhsa_client.py encrypt --keyword "医院"  # 只生成加密请求
"""

import json
import sys
import time
import subprocess
import os
import argparse
import requests
from pathlib import Path
from http.client import HTTPConnection

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
API_URL = "https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = str(HERE / "chrome_profile")
PAGE_URL = "https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical"


# ═══════════════════════════════════════════════════════════════
# CDP Client
# ═══════════════════════════════════════════════════════════════

def _find_chrome():
    for p in [CHROME_PATH, r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]:
        p = os.path.expandvars(p)
        if Path(p).exists():
            return p
    return "chrome"


def _get_debug_port():
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


class CDPClient:
    """Chrome DevTools Protocol 客户端"""

    def __init__(self, debug_port):
        import websocket
        conn = HTTPConnection("127.0.0.1", debug_port, timeout=5)
        conn.request("GET", "/json")
        r = conn.getresponse()
        targets = json.loads(r.read())
        pages = [t for t in targets if t["type"] == "page"]
        if not pages:
            raise RuntimeError("No page target found")
        self._ws = websocket.create_connection(
            pages[0]["webSocketDebuggerUrl"], timeout=30
        )
        self._msg_id = 0
        self._setup()

    def _setup(self):
        """初始化 CDP domains"""
        self.send("Page.enable")
        self.send("Runtime.enable")
        self.send("Network.enable")

    def send(self, method, params=None):
        self._msg_id += 1
        self._ws.send(json.dumps({
            "id": self._msg_id, "method": method,
            "params": params or {}
        }))
        while True:
            raw = self._ws.recv()
            resp = json.loads(raw)
            if resp.get("id") == self._msg_id:
                if "error" in resp:
                    raise RuntimeError(f"CDP: {resp['error']}")
                return resp.get("result", {})

    def evaluate(self, expression, await_promise=False):
        r = self.send("Runtime.evaluate", {
            "expression": expression,
            "returnByValue": True,
            "awaitPromise": await_promise,
        })
        result = r.get("result", {})
        if result.get("type") == "object" and result.get("subtype") == "error":
            raise RuntimeError(f"JS Error: {result.get('description', 'unknown')}")
        return result.get("value")

    def navigate(self, url, timeout=60):
        self.send("Page.navigate", {"url": url})
        for _ in range(timeout * 2):
            time.sleep(0.5)
            try:
                ready = self.evaluate("document.readyState")
                if ready == "complete":
                    # Check if search input is available
                    has_input = self.evaluate(
                        """document.querySelector('input[placeholder*="医疗机构"]') !== null"""
                    )
                    if has_input:
                        return True
            except Exception:
                pass
        return False

    def close(self):
        try:
            self._ws.close()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════
# Chrome 管理
# ═══════════════════════════════════════════════════════════════

def start_chrome():
    port = _get_debug_port()
    if port is not None:
        print(f"[Chrome] already running on port {port}", file=sys.stderr)
        return port
    port = _find_free_port()
    chrome = _find_chrome()
    os.makedirs(PROFILE_DIR, exist_ok=True)
    print(f"[Chrome] launching headless on port {port}...", file=sys.stderr)
    subprocess.Popen([
        chrome,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={PROFILE_DIR}",
        "--headless=new", "--no-sandbox", "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(30):
        time.sleep(0.5)
        if _get_debug_port() is not None:
            print(f"[Chrome] ready", file=sys.stderr)
            return port
    raise RuntimeError("Chrome did not start")


# ═══════════════════════════════════════════════════════════════
# CDP Bridge — 利用页面自身加密
# ═══════════════════════════════════════════════════════════════

_ENCRYPT_ONLY_JS = r"""
(async () => {
    // 安装 XHR 拦截器
    if (!window.__nhsa_intercept_installed) {
        const origSetReqHeader = XMLHttpRequest.prototype.setRequestHeader;
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method, url) {
            this.__url = url;
            return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function(body) {
            this.__body = body;
            return origSend.apply(this, arguments);
        };
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (!this.__headers) this.__headers = {};
            this.__headers[name] = value;
            if (name === 'x-tif-signature') {
                window.__nhsa_result = {
                    url: this.__url,
                    body: this.__body,
                    headers: Object.assign({}, this.__headers),
                };
            }
            return origSetReqHeader.apply(this, arguments);
        };
        window.__nhsa_intercept_installed = true;
    }

    window.__nhsa_result = null;
    const keyword = {keyword_json};
    const pageNum = {page_num};
    const pageSize = {page_size};

    const input = document.querySelector('input[placeholder*="医疗机构"]');
    if (!input) return JSON.stringify({{error: 'no search input'}});

    const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(input, keyword);
    input.dispatchEvent(new Event('input', {{bubbles: true}}));

    await new Promise(r => setTimeout(r, 500));
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {{
        if (btn.textContent.trim() === '查询') {{ btn.click(); break; }}
    }}

    // 等待 XHR 完成
    let waited = 0;
    while (!window.__nhsa_result && waited < 100) {{
        await new Promise(r => setTimeout(r, 200));
        waited++;
    }}

    if (!window.__nhsa_result) return JSON.stringify({{error: 'no request captured after 20s'}});

    return JSON.stringify({{
        success: true,
        url: window.__nhsa_result.url,
        headers: window.__nhsa_result.headers,
        body: window.__nhsa_result.body,
    }});
})()
"""


def cdp_encrypt(keyword="", page_num=1, page_size=10):
    """通过 CDP 获取加密后的请求"""
    port = start_chrome()
    cdp = CDPClient(port)
    try:
        print(f"[CDP] Loading page...", file=sys.stderr)
        if not cdp.navigate(PAGE_URL, timeout=45):
            return {"success": False, "error": "Page load timeout"}

        print(f"[CDP] Generating encrypted request for: {keyword}", file=sys.stderr)
        js = _ENCRYPT_ONLY_JS.format(
            keyword_json=json.dumps(keyword),
            page_num=page_num,
            page_size=page_size,
        )
        result_json = cdp.evaluate(js, await_promise=True)
        if not result_json:
            return {"success": False, "error": "No response from page"}
        return json.loads(result_json)
    finally:
        try:
            cdp.close()
        except Exception:
            pass


# ═══════════════════════════════════════════════════════════════
# HTTP Client
# ═══════════════════════════════════════════════════════════════

def send_request(encrypted_request):
    """发送已加密的请求到 API"""
    headers = encrypted_request["headers"]
    body = encrypted_request["body"]

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    })

    # 只保留必要的 headers
    send_headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "channel": "web",
        "x-tif-signature": headers.get("x-tif-signature", ""),
        "x-tif-timestamp": headers.get("x-tif-timestamp", ""),
        "x-tif-nonce": headers.get("x-tif-nonce", ""),
        "x-tif-paasid": "undefined",
        "Origin": "https://fuwu.nhsa.gov.cn",
        "Referer": "https://fuwu.nhsa.gov.cn/nationalHallSt/",
    }

    resp = session.post(API_URL, headers=send_headers, data=body, timeout=30)
    return resp


# ═══════════════════════════════════════════════════════════════
# 搜索
# ═══════════════════════════════════════════════════════════════

def search_medical(keyword="", page_num=1, page_size=10):
    """通过 CDP 搜索医疗机构"""
    # 1. 生成加密请求
    encrypted = cdp_encrypt(keyword, page_num, page_size)
    if encrypted.get("error"):
        return encrypted

    print(f"[Nhsa] x-tif-signature: {encrypted['headers'].get('x-tif-signature', '?')[:16]}...", file=sys.stderr)

    # 2. 发送 HTTP 请求
    resp = send_request(encrypted)
    result = resp.json() if resp.status_code == 200 else {
        "code": -1, "message": f"HTTP {resp.status_code}"
    }

    return result


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="国家医保局 医疗机构查询")
    subparsers = parser.add_subparsers(dest="command")

    # search command (default)
    search_parser = subparsers.add_parser("search", help="搜索医疗机构")
    search_parser.add_argument("keyword", nargs="?", default="北京协和医院")
    search_parser.add_argument("--page", "-p", type=int, default=1)
    search_parser.add_argument("--size", "-s", type=int, default=10)
    search_parser.add_argument("--json", action="store_true", help="JSON output")

    # encrypt command
    encrypt_parser = subparsers.add_parser("encrypt", help="只生成加密请求")
    encrypt_parser.add_argument("--keyword", "-k", default="医院")
    encrypt_parser.add_argument("--page", "-p", type=int, default=1)
    encrypt_parser.add_argument("--size", "-s", type=int, default=10)

    # Legacy: direct keyword
    parser.add_argument("keyword_legacy", nargs="?", default=None,
                        help=argparse.SUPPRESS)

    args = parser.parse_args()

    # Handle legacy usage
    if args.command is None and args.keyword_legacy:
        keyword = args.keyword_legacy
    elif args.command == "search":
        keyword = args.keyword
    elif args.command == "encrypt":
        # Just encrypt and print
        encrypted = cdp_encrypt(args.keyword, args.page, args.size)
        print(json.dumps(encrypted, ensure_ascii=False, indent=2))
        return
    else:
        keyword = "北京协和医院"

    if args.command == "search" or args.command is None:
        result = search_medical(keyword, args.page, args.size)

        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if result.get("error"):
            print(f"Error: {result['error']}")
            return
        if result.get("code") != 0:
            print(f"API 返回错误: code={result.get('code')}, message={result.get('message')}")
            print(json.dumps(result, ensure_ascii=False, indent=2)[:1000])
            return

        print(f"\n查询成功! code={result['code']}, message={result.get('message')}")
        data_section = result.get("data", {})
        enc_data = data_section.get("data", {}).get("encData", "")
        if enc_data:
            print(f"响应已加密 (encData: {enc_data[:32]}...)")

        print(json.dumps(result, ensure_ascii=False, indent=2)[:3000])


if __name__ == "__main__":
    main()
