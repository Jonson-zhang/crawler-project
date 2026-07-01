"""
test_iv8.py — 测试在 iv8 中执行瑞数 JS
"""
import iv8
import re
import time
import json
from pathlib import Path

BASE = Path(__file__).parent

# ── 1. 创建 iv8 上下文 ──
ctx = iv8.JSContext()
ctx.eval("window = this")

# ── 2. DOM Stubs ──
DOM_STUBS = r"""
(function() {
    var noop = function() {};
    var stubElement = function(tag) {
        var el = {
            tagName: (tag || '').toUpperCase(),
            nodeType: 1,
            nodeName: (tag || '').toUpperCase(),
            style: {}, className: '', id: '', innerHTML: '', textContent: '',
            childNodes: [], children: [], parentNode: null,
            firstChild: null, lastChild: null, nextSibling: null, previousSibling: null,
            appendChild: noop, removeChild: noop,
            setAttribute: noop,
            getAttribute: function() { return null; },
            hasAttribute: function() { return false; },
            hasChildNodes: function() { return false; },
            closest: function() { return null; },
            contains: function() { return false; },
            insertAdjacentElement: noop, insertBefore: noop, replaceChild: noop,
            cloneNode: function() { return this; },
            addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
            offsetWidth: 1920, offsetHeight: 1080,
            offsetLeft: 0, offsetTop: 0, offsetParent: null,
            clientWidth: 1920, clientHeight: 1080,
            scrollLeft: 0, scrollTop: 0,
            scrollWidth: 1920, scrollHeight: 1080,
            getBoundingClientRect: function() {
                return {top:0, left:0, width:1920, height:1080, right:1920, bottom:1080};
            },
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; },
            getElementsByTagName: function() { return []; },
            getElementsByClassName: function() { return []; },
            toString: function() { return '[object HTMLUnknownElement]'; }
        };
        return el;
    };

    // document methods
    document.createElement = function(tag) { return stubElement(tag); };
    document.createTextNode = function() {
        return {nodeType: 3, nodeName: '#text', textContent: '', data: ''};
    };
    document.getElementsByTagName = function() { return []; };
    document.getElementsByClassName = function() { return []; };
    document.getElementsByName = function() { return []; };
    document.querySelector = function() { return null; };
    document.querySelectorAll = function() { return []; };
    document.getElementById = function() { return null; };
    document.addEventListener = noop;
    document.removeEventListener = noop;
    document.dispatchEvent = noop;
    document.write = noop;
    document.writeln = noop;
    document.hasFocus = function() { return true; };
    document.close = noop;
    document.open = noop;

    // document.documentElement / body / head
    try { Object.defineProperty(document, 'documentElement', {get: function() { return stubElement('html'); }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'body', {get: function() { return stubElement('body'); }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'head', {get: function() { return stubElement('head'); }, configurable: true}); } catch(e) {}

    // document.cookie
    var _cookies = {};
    Object.defineProperty(document, 'cookie', {
        get: function() {
            return Object.entries(_cookies).map(function(kv) { return kv[0]+'='+kv[1]; }).join('; ');
        },
        set: function(v) {
            if (v && v.includes('=')) {
                var parts = v.split('=');
                _cookies[parts[0].trim()] = parts.slice(1).join('=').split(';')[0].trim();
            }
            window.__capturedCookies = JSON.parse(JSON.stringify(_cookies));
        },
        configurable: true, enumerable: true
    });

    // document.URL / location / readyState / charset
    try { Object.defineProperty(document, 'URL', {get: function() { return 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50'; }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'documentURI', {get: function() { return 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50'; }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'location', {get: function() { return window.location; }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'readyState', {get: function() { return 'complete'; }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'characterSet', {get: function() { return 'UTF-8'; }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'charset', {get: function() { return 'UTF-8'; }, configurable: true}); } catch(e) {}
    try { Object.defineProperty(document, 'referrer', {get: function() { return ''; }, configurable: true}); } catch(e) {}

    // Screen
    screen.width = 1920; screen.height = 1080;
    screen.availWidth = 1920; screen.availHeight = 1040;
    screen.colorDepth = 24; screen.pixelDepth = 24;
    screen.orientation = { type: 'landscape-primary', angle: 0 };

    // History
    history.length = 1; history.state = null;

    // Navigator overrides
    try { Object.defineProperty(Navigator.prototype, 'vendor', {get: function() { return ''; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'oscpu', {get: function() { return 'Windows NT 10.0; Win64; x64'; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'buildID', {get: function() { return '20250101000000'; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'doNotTrack', {get: function() { return 'unspecified'; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'productSub', {get: function() { return '20100101'; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'plugins', {get: function() { return []; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'mimeTypes', {get: function() { return []; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', {get: function() { return 8; }, configurable: true, enumerable: true}); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'maxTouchPoints', {get: function() { return 0; }, configurable: true, enumerable: true}); } catch(e) {}

    // Canvas stub
    try {
        HTMLCanvasElement.prototype.getContext = function() {
            return {
                canvas: {width: 300, height: 150},
                fillStyle: '#000000', strokeStyle: '#000000',
                font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
                fillRect: noop, strokeRect: noop, clearRect: noop,
                fillText: noop, strokeText: noop,
                beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
                arc: noop, arcTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
                rect: noop, clip: noop, fill: noop, stroke: noop,
                save: noop, restore: noop, scale: noop, rotate: noop, translate: noop,
                transform: noop, setTransform: noop,
                createLinearGradient: noop, createRadialGradient: noop,
                createPattern: noop, createImageData: noop,
                getImageData: function() { return {data: [], width: 300, height: 150}; },
                putImageData: noop,
                measureText: function() { return {width: 100}; },
                drawImage: noop,
                getContextAttributes: function() { return {}; },
                isPointInPath: function() { return false; },
                isPointInStroke: function() { return false; },
            };
        };
        HTMLCanvasElement.prototype.toDataURL = function() { return 'data:image/png;base64,'; };
    } catch(e) {}

    // XHR capture
    window._xhrRequests = [];
    var OrigXHR = XMLHttpRequest;
    var OrigOpen = OrigXHR.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        var xhr = this;
        xhr._method = arguments[0];
        xhr._url = arguments[1];
        xhr._headers = {};
        window._xhrRequests.push({method: xhr._method, url: xhr._url, ts: Date.now()});
        try { return OrigOpen.apply(xhr, arguments); } catch(e) {}
    };
    XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
        this._headers = this._headers || {};
        this._headers[k] = v;
        try { return OrigXHR.prototype.setRequestHeader.apply(this, arguments); } catch(e) {}
    };
    XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        xhr._body = body || '';
        setTimeout(function() {
            try {
                xhr.readyState = 4;
                xhr.status = 200;
                xhr.statusText = 'OK';
                xhr.responseText = '';
                if (xhr.onreadystatechange) xhr.onreadystatechange();
                if (xhr.onload) xhr.onload();
                if (xhr.onloadend) xhr.onloadend();
            } catch(e) {}
        }, 50);
    };

    window.__capturedCookies = {};
})();
"""

print("[*] Setting up iv8 environment...")
ctx.eval(DOM_STUBS)

# ── 3. 读取挑战数据 ──
html = (BASE / "202_response.html").read_text(encoding="utf-8")
cd_match = re.search(r'\$_ts\.cd="([^"]+)"', html)
nsd_match = re.search(r'nsd=(\d+)', html)
cd = cd_match.group(1) if cd_match else ""
nsd = int(nsd_match.group(1)) if nsd_match else 0

print(f"[*] Challenge data: nsd={nsd}, cd_len={len(cd)}")

# 设置 $_ts
cd_escaped = cd.replace("\\", "\\\\").replace('"', '\\"')
ctx.eval(f"""
    window.$_ts = {{}};
    window.$_ts.cd = "{cd_escaped}";
    window.$_ts.nsd = {nsd};
    window.$_ts.scj = 0;
    window.$_ts.aebi = 0;
""")

print(f"[*] $_ts.cd length: {len(ctx.eval('window.$_ts.cd'))}")
print(f"[*] $_ts keys: {ctx.eval('Object.keys(window.$_ts)')}")

# ── 4. 执行瑞数 JS ──
ruishu_js = (BASE / "ruishu_engine_1.js").read_text(encoding="utf-8")
print(f"[*] Loading RuiShu JS ({len(ruishu_js)} bytes)...")

start = time.time()
try:
    ctx.eval(ruishu_js)
    elapsed = time.time() - start
    print(f"[OK] RuiShu JS executed ({elapsed:.2f}s)")
    ts_keys = ctx.eval("Object.keys(window.$_ts)")
    print(f"  $_ts keys: {ts_keys}")
    lcd_type = ctx.eval("typeof window.$_ts.lcd")
    print(f"  $_ts.lcd type: {lcd_type}")
    cookies = ctx.eval("JSON.stringify(window.__capturedCookies)")
    print(f"  Cookies: {cookies}")
    xhrs = ctx.eval("JSON.stringify(window._xhrRequests)")
    print(f"  XHRs: {xhrs}")

except iv8.JSError as e:
    elapsed = time.time() - start
    msg = str(e)
    print(f"[FAIL] JSError after {elapsed:.2f}s")
    # Try to find which line/function caused the error
    lines = msg.split("\n")
    for line in lines[:5]:
        print(f"  {line}")
except Exception as e:
    elapsed = time.time() - start
    print(f"[FAIL] Error after {elapsed:.2f}s: {e}")
