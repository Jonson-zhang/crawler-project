"""
国家医保局 CDP 桥接 — Chrome DevTools Protocol
===============================================

利用页面自身的加密/签名逻辑完成 API 调用。

原理:
  app.js 每次加载时通过 sm2.generateKeyPairHex() 动态生成加密密钥对，
  密钥无法离线提取。本方案通过 Chrome CDP 在页面上下文中执行操作，
  利用页面既有的加密层完成请求。

依赖: websocket-client (已在项目虚拟环境中安装)

用法:
  python cdp_bridge.py "北京协和医院"
  python cdp_bridge.py "北京大学第一医院" --page 1 --size 5
"""

import json
import sys
import time
import subprocess
import os
import argparse
from pathlib import Path
from http.client import HTTPConnection

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PROFILE_DIR = str(HERE / "chrome_profile")
PAGE_URL = "https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical"


# ═══════════════════════════════════════════════════════════════
# Chrome 管理
# ═══════════════════════════════════════════════════════════════

def _find_chrome():
    for p in [
        CHROME_PATH,
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]:
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
# CDP 客户端
# ═══════════════════════════════════════════════════════════════

class CDPClient:
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
            pages[0]["webSocketDebuggerUrl"], timeout=15
        )
        self._msg_id = 0

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
        return r.get("result", {}).get("value")

    def navigate(self, url, timeout=60):
        self.send("Page.enable")
        self.send("Page.navigate", {"url": url})
        for _ in range(timeout * 2):
            time.sleep(0.5)
            try:
                ready = self.evaluate("document.readyState")
                if ready == "complete":
                    has_table = self.evaluate(
                        """document.querySelector('.el-table__body, .el-table') !== null"""
                    )
                    if has_table:
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
# 搜索与数据提取
# ═══════════════════════════════════════════════════════════════

_SEARCH_JS_TEMPLATE = r"""
(async () => {
    const keyword = {keyword_json};
    const pageNum = {page_num};
    const pageSize = {page_size};

    // Step 1: Set search input via Vue reactivity
    const input = document.querySelector('input[placeholder="请输入医疗机构名称"]');
    if (!input) return JSON.stringify({{error: 'no search input'}});

    const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(input, keyword);
    input.dispatchEvent(new Event('input', {{bubbles: true}}));

    // Step 2: Click search button
    await new Promise(r => setTimeout(r, 500));
    const btns = document.querySelectorAll('button');
    let clicked = false;
    for (const btn of btns) {{
        const span = btn.querySelector('span');
        if (span && span.textContent.trim() === '查询') {{
            btn.click();
            clicked = true;
            break;
        }}
    }}
    if (!clicked) return JSON.stringify({{error: 'no search button'}});

    // Step 3: Wait for results
    await new Promise(r => setTimeout(r, 3000));

    // Step 4: Extract table data
    const table = document.querySelector('.el-table__body');
    if (!table) return JSON.stringify({{error: 'no result table'}});

    const headers = [];
    const headerCells = document.querySelectorAll('.el-table__header th');
    headerCells.forEach(cell => {{
        const text = cell.textContent.trim();
        if (text) headers.push(text);
    }});

    const rows = table.querySelectorAll('tr');
    const data = [];
    rows.forEach(row => {{
        const cells = row.querySelectorAll('td');
        const item = {{}};
        cells.forEach((cell, i) => {{
            if (i > 0 && headers[i-1]) {{
                item[headers[i-1]] = cell.textContent.trim();
            }} else if (i > 0) {{
                item['col_' + i] = cell.textContent.trim();
            }}
        }});
        if (Object.keys(item).length > 0) data.push(item);
    }});

    // Get total count
    const totalEl = document.querySelector('.el-pagination__total');
    const total = totalEl ? totalEl.textContent.trim() : '';

    return JSON.stringify({{
        success: true,
        total: total,
        count: data.length,
        headers: headers.filter(Boolean),
        data: data,
    }});
})()
"""


def search_medical(keyword="", page_num=1, page_size=10):
    port = start_chrome()
    cdp = CDPClient(port)
    try:
        print(f"[CDP] Loading page...", file=sys.stderr)
        if not cdp.navigate(PAGE_URL, timeout=45):
            return {"success": False, "error": "Page load timeout"}

        print(f"[CDP] Searching: {keyword}", file=sys.stderr)
        js = _SEARCH_JS_TEMPLATE.format(
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


def main():
    parser = argparse.ArgumentParser(description="国家医保局 医疗机构查询 (CDP)")
    parser.add_argument("keyword", nargs="?", default="北京协和医院")
    parser.add_argument("--page", "-p", type=int, default=1)
    parser.add_argument("--size", "-s", type=int, default=10)
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    result = search_medical(args.keyword, args.page, args.size)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if result.get("error"):
        print(f"Error: {result['error']}")
        return
    if not result.get("success"):
        print(f"Failed: {result}")
        return

    print("\n" + "=" * 80)
    print(f"  定点医疗机构查询: {args.keyword}")
    print(f"  {result.get('total', '')} 条结果, 当前显示 {result.get('count', 0)} 条")
    print(f"{'='*80}")
    if result.get("headers"):
        header_line = "  ".join(
            h[:12] if isinstance(h, str) else str(h)[:12]
            for h in result["headers"]
        )
        print(header_line)
        print("-" * 80)
    for item in result.get("data", []):
        values = list(item.values())
        if values:
            print("  ".join(str(v)[:20] for v in values[:6]))


if __name__ == "__main__":
    main()
