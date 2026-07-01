"""
欧冶 (ouyeel.com) 瑞数6 逆向 - 完整数据获取方案
==============================================

流程:
  1. GET /steel → RS6 挑战 (HTTP 202)
  2. 提取 meta_content + 内联 JS + 外链 RS6 JS
  3. Node.js subprocess 执行 RS6 VM 生成 Cookie (304 bytes)
  4. POST /search-ng/complexSearch/queryResult → 获取产品数据

用法: python ouyeel_iv8.py

参考:
  - 0110原型链补环境欧冶-瑞数6.md (原始 Node.js 补环境方案)
"""

import gzip
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urljoin

import requests

CONFIG = {
    "channel": "RJ",
    "page_index": 0,
    "page_size": 50,
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

HERE = Path(__file__).parent


def _read_env_template():
    """Extract _ENV_JS template from this file (Python Jinja-style)."""
    py_code = Path(__file__).read_text(encoding="utf-8")
    m = re.search(r"_ENV_JS = r\"\"\"(.+?)\"\"\"", py_code, re.DOTALL)
    if not m:
        raise RuntimeError("Cannot find _ENV_JS template in source")
    return m.group(1)


def generate_cookie(session):
    """Generate RS6 cookie for ouyeel.com."""
    challenge_url = "https://www.ouyeel.com/steel"

    # Step 1: Get RS6 challenge page
    print("[1] GET %s" % challenge_url, file=sys.stderr)
    resp = session.get(
        challenge_url,
        headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "User-Agent": UA,
        },
    )
    print("    HTTP %d, %d bytes" % (resp.status_code, len(resp.text)), file=sys.stderr)
    resp.encoding = "utf-8"
    html = resp.text

    # Extract RS6 resources
    meta_content = re.findall(r'<meta[^>]+content="([^"]*)"', html)[-1]
    print("    meta_content: %s..." % meta_content[:40], file=sys.stderr)

    # Remove IE conditional comments that contain false script matches
    html_clean = re.sub(
        r"<!--\[if[^>]*>.*?<!\[endif\]-->", "", html, flags=re.DOTALL
    )

    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html_clean, re.DOTALL)
    inline_js = next((s for s in scripts if "$_ts" in s), "")
    assert inline_js, "Cannot find inline RS6 JS ($_ts not found)"
    print("    inline JS: %d bytes" % len(inline_js), file=sys.stderr)

    ext_match = re.search(r'<script[^>]*src="(/[^"]+)"', html_clean)
    assert ext_match, "Cannot find external RS6 JS URL"
    ext_url = urljoin("https://www.ouyeel.com", ext_match.group(1))
    print("    external JS: %s" % ext_url, file=sys.stderr)

    # Step 2: Download external RS6 JS
    print("[2] GET %s" % ext_url, file=sys.stderr)
    resp2 = session.get(ext_url, headers={"Referer": challenge_url})
    resp2.encoding = "utf-8"
    ext_js = resp2.text
    print("    HTTP %d, %d bytes" % (resp2.status_code, len(ext_js)), file=sys.stderr)

    # Step 3: Execute RS6 VM via Node.js subprocess
    env_template = _read_env_template()
    env_code = env_template % (json.dumps(UA), json.dumps(meta_content))

    js_parts = [
        env_code,
        inline_js,
        ext_js,
        'if (typeof _$gJ === "function") _$gJ();',
        'else if (typeof $_ts !== "undefined" && typeof $_ts.lcd === "function") $_ts.lcd();',
        'var c = document.cookie || "";',
        "console.log(JSON.stringify({cookie: c, len: c.length}));",
    ]
    full_js = "\n".join(js_parts)

    print("[3] Node.js executing (%d bytes JS)..." % len(full_js), file=sys.stderr)

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".js", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(full_js)
        tmp_path = tmp.name

    cookie = ""
    try:
        result = subprocess.run(
            ["node", str(tmp_path)],
            capture_output=True,
            text=True,
            timeout=30,
            encoding="utf-8",
            errors="replace",
        )
        stderr = result.stderr.strip()
        if stderr:
            for line in stderr.split("\n")[:5]:
                line = line.strip()
                if line and ("Error" in line or "WARN" in line):
                    print("    [stderr] %s" % line[:150], file=sys.stderr)

        for line in result.stdout.strip().split("\n"):
            line = line.strip()
            if line.startswith("{"):
                try:
                    data = json.loads(line)
                    cookie = data.get("cookie", "")
                except json.JSONDecodeError:
                    pass
    except subprocess.TimeoutExpired:
        print("[WARN] Node.js timeout (30s)", file=sys.stderr)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if not cookie or len(cookie) < 100:
        raise RuntimeError("Cookie generation failed (len=%d)" % len(cookie))

    print("    Cookie: %d bytes" % len(cookie), file=sys.stderr)

    # Update session with generated cookie
    for item in cookie.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            session.cookies.set(k, v)

    return cookie


def search_products(session, channel="RJ", page_index=0, page_size=50):
    """Search products using the search API."""
    api_url = "https://www.ouyeel.com/search-ng/complexSearch/queryResult"

    criteria = json.dumps(
        {
            "channel": channel,
            "pageIndex": page_index,
            "pageSize": page_size,
        },
        separators=(",", ":"),
        ensure_ascii=False,
    )

    print("[4] POST %s" % api_url, file=sys.stderr)
    print("    criteriaJson: %s" % criteria, file=sys.stderr)

    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://www.ouyeel.com/steel/search?channel=%s&pageIndex=%d&pageSize=%d"
        % (channel, page_index, page_size),
        "User-Agent": UA,
        "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Origin": "https://www.ouyeel.com",
    }

    resp = session.post(api_url, data={"criteriaJson": criteria}, headers=headers)
    print("    HTTP %d, %d bytes" % (resp.status_code, len(resp.content)), file=sys.stderr)

    if resp.status_code != 200:
        raise RuntimeError("API returned HTTP %d" % resp.status_code)

    raw = resp.content
    # Handle possible gzip
    try:
        if resp.headers.get("content-encoding", "") == "gzip":
            raw = gzip.decompress(raw)
    except Exception:
        pass

    text = raw.decode("utf-8", errors="replace")

    if text.startswith("{"):
        data = json.loads(text)
    elif "<!DOCTYPE" in text or "<html" in text:
        raise RuntimeError("RS6 challenge returned - cookie may have expired")
    else:
        raise RuntimeError("Unexpected response: %s" % text[:200])

    # Parse resultList (it's a JSON string inside the JSON)
    result_list_str = data.get("resultList", "[]")
    if isinstance(result_list_str, str):
        items = json.loads(result_list_str)
    else:
        items = result_list_str

    sold_list_str = data.get("soldResultList", "[]")
    if isinstance(sold_list_str, str):
        sold_items = json.loads(sold_list_str)
    else:
        sold_items = sold_list_str

    summary = {
        "total_quantity": data.get("totalQuantity", 0),
        "total_count": data.get("count", 0),
        "total_weight": data.get("totalWeight", 0),
        "approx_count": data.get("approximateCount", 0),
        "items": items,
        "sold_items": sold_items,
    }

    return summary


# ═══════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60, file=sys.stderr)
    print("  欧冶 RS6 Cookie Generator + API Client", file=sys.stderr)
    print("=" * 60, file=sys.stderr)

    session = requests.Session()
    session.headers.update({"User-Agent": UA})

    # Step 1-3: Generate RS6 cookie
    cookie = generate_cookie(session)

    # Show cookie info
    cookies = dict(session.cookies)
    for k, v in cookies.items():
        if len(v) > 30:
            print("  %s = %s... (%d chars)" % (k, v[:50], len(v)), file=sys.stderr)

    # Step 4: Search products
    channel = CONFIG["channel"]
    page_index = CONFIG["page_index"]
    page_size = CONFIG["page_size"]

    try:
        results = search_products(session, channel, page_index, page_size)
    except RuntimeError as e:
        print("[FAIL] %s" % e, file=sys.stderr)
        sys.exit(1)

    items = results["items"]
    sold = results["sold_items"]

    print()
    print("--- Search Results (channel=%s, page=%d, size=%d) ---" % (
        channel, page_index, page_size))
    print("Total: %d items, %d tons" % (results["total_count"], results["total_weight"]))
    print()

    # Define display fields (steel product specific)
    DISPLAY_FIELDS = [
        ("wareName", "品名"),
        ("spec", "规格"),
        ("material", "材质"),
        ("wareHouse", "仓库"),
        ("balanceWeight", "库存(t)"),
        ("price", "价格"),
        ("manufacture", "钢厂"),
        ("shopName", "店铺"),
    ]

    for i, item in enumerate(items[:30]):
        print("  %d." % (i + 1), end="")
        parts = []
        for field, label in DISPLAY_FIELDS:
            val = item.get(field, "")
            if val:
                if field in ("balanceWeight", "price"):
                    parts.append("%s=%s" % (label, val))
                elif field == "wareName":
                    parts.insert(0, str(val))
                else:
                    parts.append(str(val))
        print("  ".join(parts[:4]))
        if len(parts) > 4:
            print("       " + "  ".join(parts[4:]))

    if len(items) > 30:
        print("  ... and %d more items" % (len(items) - 30))

    if sold:
        print("\n--- Sold Out (%d items) ---" % len(sold))
        for i, item in enumerate(sold[:5]):
            name = item.get("wareName", "?")
            spec = item.get("spec", "")
            print("  %d. %s [%s]" % (i + 1, name, spec))

    session.close()


# ═══════════════════════════════════════════════════════════════
# JS Environment Template (extracted from 0110原型链补环境欧冶-瑞数6.md)
# ═══════════════════════════════════════════════════════════════

_ENV_JS = r"""
/************************************************************
 * RS6 Browser Environment
 * (from 0110原型链补环境欧冶-瑞数6.md, verified 304-byte cookie)
 ************************************************************/

// --- Utils ---
function v_log() {}
const nativeToString = Function.prototype.toString;

function safeFunction(func) {
    if (typeof func !== "function") return func;
    var name = func.name || "";
    var fake = "function " + name + "() { [native code] }";
    Object.defineProperty(func, "toString", {
        value: function () { return fake; },
        writable: false, enumerable: false, configurable: true
    });
    return func;
}

// --- EventTarget ---
function EventTarget() { this._listeners = {}; }
EventTarget.prototype.addEventListener = function () {};
EventTarget.prototype.removeEventListener = function () {};
EventTarget.prototype.dispatchEvent = function (e) { return true; };
safeFunction(EventTarget);
safeFunction(EventTarget.prototype.addEventListener);
safeFunction(EventTarget.prototype.removeEventListener);
safeFunction(EventTarget.prototype.dispatchEvent);

// --- DOM Prototype Chain ---
function HTMLCollection(list) {
    list = list || [];
    Object.setPrototypeOf(list, HTMLCollection.prototype);
    list.item = function (i) { return list[i] || null; };
    list.namedItem = function (n) {
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === n || (list[i].attributes && list[i].attributes.name === n))
                return list[i];
        }
        return null;
    };
    safeFunction(list.item);
    safeFunction(list.namedItem);
    return list;
}
Object.defineProperty(HTMLCollection.prototype, Symbol.toStringTag, {
    value: "HTMLCollection", configurable: true
});
safeFunction(HTMLCollection);

function Node() {}
safeFunction(Node);

function Element() {}
Element.prototype = Object.create(Node.prototype);
Element.prototype.setAttribute = function (n, v) {
    if (!this.attributes) this.attributes = {};
    this.attributes[n] = String(v);
    if (n === "id") this.id = v;
};
Element.prototype.getAttribute = function (n) {
    return this.attributes ? (this.attributes[n] || null) : null;
};
Element.prototype.getElementsByTagName = function (t) {
    return document.getElementsByTagName(t);
};
safeFunction(Element);
safeFunction(Element.prototype.setAttribute);
safeFunction(Element.prototype.getAttribute);
safeFunction(Element.prototype.getElementsByTagName);

function HTMLElement() {}
HTMLElement.prototype = Object.create(Element.prototype);
safeFunction(HTMLElement);

// --- Document ---
function Document() {}
Document.prototype = Object.create(Node.prototype);
Object.defineProperty(Document.prototype, Symbol.toStringTag, { value: "HTMLDocument" });

Document.prototype.createElement = function (tagName) {
    var tag = String(tagName).toUpperCase();
    var el = Object.create(HTMLElement.prototype);
    el.tagName = tag;
    el.nodeName = tag;
    el.style = {};
    el.attributes = {};
    return el;
};

Document.prototype.getElementsByTagName = function (tagName) {
    var tag = String(tagName).toLowerCase();
    var res = [];
    if (tag === "meta") {
        var meta = this.createElement("META");
        meta.setAttribute("content", metacontent);
        res.push(meta);
    }
    return new HTMLCollection(res);
};

Document.prototype.getElementById = function (id) { return null; };
Document.prototype.querySelector = function (s) { return null; };
Document.prototype.querySelectorAll = function (s) {
    var r = [];
    r.item = function (i) { return r[i] || null; };
    return r;
};
Document.prototype.getElementsByClassName = function (c) { return new HTMLCollection([]); };
Document.prototype.appendChild = function (c) { return c; };
Document.prototype.removeChild = function (c) { return c; };

safeFunction(Document);
safeFunction(Document.prototype.createElement);
safeFunction(Document.prototype.getElementsByTagName);
safeFunction(Document.prototype.getElementById);
safeFunction(Document.prototype.querySelector);
safeFunction(Document.prototype.querySelectorAll);
safeFunction(Document.prototype.getElementsByClassName);
safeFunction(Document.prototype.appendChild);
safeFunction(Document.prototype.removeChild);

var documentInstance = new Document();
Object.setPrototypeOf(documentInstance, Document.prototype);

// --- Window ---
function Window() {}
Window.prototype = Object.create(EventTarget.prototype);
Window.prototype.constructor = Window;
Window.prototype.attachEvent = function (type, handler) {
    var n = type.startsWith("on") ? type.slice(2) : type;
    return this.addEventListener(n, handler);
};
safeFunction(Window.prototype.attachEvent);
safeFunction(Window);

var windowInstance = globalThis;
Object.setPrototypeOf(windowInstance, Window.prototype);
if (!windowInstance.addEventListener) {
    windowInstance.addEventListener = Window.prototype.addEventListener.bind(windowInstance);
    windowInstance.removeEventListener = Window.prototype.removeEventListener.bind(windowInstance);
    windowInstance.dispatchEvent = Window.prototype.dispatchEvent.bind(windowInstance);
    windowInstance.attachEvent = Window.prototype.attachEvent.bind(windowInstance);
}

globalThis.window = windowInstance;
globalThis.self = windowInstance;
globalThis.top = windowInstance;
globalThis.document = documentInstance;
windowInstance.document = documentInstance;
windowInstance.HTMLCollection = HTMLCollection;

// --- Navigator ---
function Navigator() {}
safeFunction(Navigator);
Object.defineProperty(Navigator.prototype, Symbol.toStringTag, { value: "Navigator" });
Object.defineProperty(Navigator.prototype, "userAgent", {
    get: function () { return %s; }
});
var nav = new Navigator();
windowInstance.navigator = nav;
globalThis.navigator = nav;

// --- Screen ---
function Screen() {}
safeFunction(Screen);
Object.defineProperty(Screen.prototype, Symbol.toStringTag, { value: "Screen" });
windowInstance.screen = new Screen();
globalThis.screen = windowInstance.screen;

// --- History ---
function History() {}
safeFunction(History);
Object.defineProperty(History.prototype, Symbol.toStringTag, { value: "History" });
windowInstance.history = new History();
globalThis.history = windowInstance.history;

// --- Location ---
function Location() {}
safeFunction(Location);
Location.prototype.toString = function () { return "https://www.ouyeel.com/steel"; };
safeFunction(Location.prototype.toString);
Object.defineProperties(Location.prototype, {
    href: { get: function () { return "https://www.ouyeel.com/steel"; }, configurable: true },
    protocol: { get: function () { return "https:"; }, configurable: true },
    host: { get: function () { return "www.ouyeel.com"; }, configurable: true },
    hostname: { get: function () { return "www.ouyeel.com"; }, configurable: true },
    port: { get: function () { return ""; }, configurable: true },
    origin: { get: function () { return "https://www.ouyeel.com"; }, configurable: true },
    pathname: { get: function () { return "/steel"; }, configurable: true },
    search: { get: function () { return ""; }, configurable: true },
    hash: { get: function () { return ""; }, configurable: true }
});
windowInstance.location = new Location();
globalThis.location = windowInstance.location;

// --- Misc ---
Object.defineProperty(windowInstance, "ActiveXObject", {
    value: undefined, writable: true, enumerable: false, configurable: true
});

setTimeout = function () { };
setInterval = function () { };
clearTimeout = function () { };
clearInterval = function () { };

var metacontent = %s;
Object.setPrototypeOf(documentInstance, Document.prototype);
"""
