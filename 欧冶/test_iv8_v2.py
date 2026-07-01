"""
test_iv8_v2.py — iv8 补环境迭代（完善 DOM stubs）
"""
import iv8, re, time, json
from pathlib import Path

BASE = Path(__file__).parent

ctx = iv8.JSContext()
ctx.eval("window = this")

# ── 完整 DOM 环境 ──
ENV_JS = r"""
(function() {
    var noop = function() {};

    // ── navigator ──
    try { Object.defineProperty(Navigator.prototype, 'vendor', { get: function(){ return ''; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'plugins', { get: function(){ return []; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'mimeTypes', { get: function(){ return []; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get: function(){ return 8; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: function(){ return 0; }, configurable: true }); } catch(e) {}
    navigator.__defineGetter__('deviceMemory', function(){ return undefined; });
    navigator.__defineGetter__('languages', function(){ return ['zh-CN', 'zh']; });
    navigator.__defineGetter__('language', function(){ return 'zh-CN'; });
    navigator.__defineGetter__('cookieEnabled', function(){ return true; });
    navigator.__defineGetter__('doNotTrack', function(){ return 'unspecified'; });
    navigator.__defineGetter__('oscpu', function(){ return 'Windows NT 10.0; Win64; x64'; });
    navigator.__defineGetter__('buildID', function(){ return '20250101000000'; });
    navigator.__defineGetter__('productSub', function(){ return '20100101'; });
    navigator.__defineGetter__('product', function(){ return 'Gecko'; });
    navigator.__defineGetter__('appCodeName', function(){ return 'Mozilla'; });
    navigator.__defineGetter__('appName', function(){ return 'Netscape'; });
    navigator.__defineGetter__('appVersion', function(){ return '5.0 (Windows)'; });

    // ── screen ──
    screen.width = 2560; screen.height = 1440;
    screen.availWidth = 2560; screen.availHeight = 1440;
    screen.colorDepth = 24; screen.pixelDepth = 24;
    screen.__defineGetter__('orientation', function() {
        return { type: 'landscape-primary', angle: 0 };
    });

    // ── history ──
    history.length = 1; history.state = null;
    history.__defineGetter__('scrollRestoration', function(){ return 'auto'; });

    // ── location ──
    // location properties may be read-only in iv8, skip redefine
    // Set them via Object.defineProperty if possible
    try { Object.defineProperty(location, 'href', { get: function() { return 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'origin', { get: function(){ return 'https://www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'host', { get: function(){ return 'www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'hostname', { get: function(){ return 'www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'protocol', { get: function(){ return 'https:'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'pathname', { get: function(){ return '/steel/search'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'search', { get: function(){ return '?channel=RJ&pageIndex=1&pageSize=50'; }, configurable: true }); } catch(e) {}

    // ── document ──
    // Cookie
    var _cookies = {};
    document.__defineGetter__('cookie', function() {
        var parts = [];
        for (var k in _cookies) {
            if (_cookies.hasOwnProperty(k)) parts.push(k + '=' + _cookies[k]);
        }
        return parts.join('; ');
    });
    document.__defineSetter__('cookie', function(v) {
        if (v && v.indexOf('=') > 0) {
            var eq = v.indexOf('=');
            var semi = v.indexOf(';');
            var val = semi > 0 ? v.substring(0, semi) : v;
            _cookies[v.substring(0, eq).trim()] = val.substring(eq + 1).trim();
        }
    });

    // document properties
    document.__defineGetter__('URL', function() {
        return 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50';
    });
    document.__defineGetter__('documentURI', function() {
        return 'https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50';
    });
    document.__defineGetter__('readyState', function(){ return 'complete'; });
    document.__defineGetter__('characterSet', function(){ return 'UTF-8'; });
    document.__defineGetter__('charset', function(){ return 'UTF-8'; });
    document.__defineGetter__('inputEncoding', function(){ return 'UTF-8'; });
    document.__defineGetter__('contentType', function(){ return 'text/html'; });
    document.__defineGetter__('compatMode', function(){ return 'CSS1Compat'; });
    document.__defineGetter__('title', function(){ return '搜全站-欧冶'; });
    document.__defineGetter__('domain', function(){ return 'www.ouyeel.com'; });
    document.__defineGetter__('referrer', function(){ return ''; });
    document.__defineGetter__('hidden', function(){ return false; });
    document.__defineGetter__('visibilityState', function(){ return 'visible'; });
    document.__defineGetter__('designMode', function(){ return 'off'; });
    try { Object.defineProperty(document, 'all', { get: function(){ return undefined; }, configurable: true }); } catch(e) {}

    document.addEventListener = noop;
    document.removeEventListener = noop;
    document.dispatchEvent = noop;
    document.hasFocus = function(){ return true; };
    document.close = noop;
    document.open = noop;
    document.write = noop;
    document.writeln = noop;
    document.clear = noop;

    // ── Performance ──
    performance.__defineGetter__('timing', function() {
        var n = Date.now();
        return {
            navigationStart: n - 5000,
            unloadEventStart: 0, unloadEventEnd: 0,
            redirectStart: 0, redirectEnd: 0,
            fetchStart: n - 4800,
            domainLookupStart: n - 4750, domainLookupEnd: n - 4700,
            connectStart: n - 4700, connectEnd: n - 4600,
            secureConnectionStart: n - 4650,
            requestStart: n - 4550, responseStart: n - 4000, responseEnd: n - 3800,
            domLoading: n - 3500,
            domInteractive: n - 2000,
            domContentLoadedEventStart: n - 1900,
            domContentLoadedEventEnd: n - 1800,
            domComplete: n - 500,
            loadEventStart: n - 400, loadEventEnd: n - 100
        };
    });
    performance.__defineGetter__('navigation', function() {
        return { type: 0, redirectCount: 0 };
    });
    performance.now = function() { return Date.now() - 5000; };
    performance.getEntries = function() { return []; };
    performance.getEntriesByType = function() { return []; };
    performance.mark = noop;
    performance.measure = noop;
    performance.clearMarks = noop;
    performance.clearMeasures = noop;

    // ── console ──
    if (!console) { console = {}; }
    console.log = function() {};
    console.warn = function() {};
    console.error = function() {};
    console.info = function() {};
    console.debug = function() {};

    // ── setTimeout/Interval ──
    // iv8 has these already, but ensure they work

    // ── atob/btoa ──
    // iv8 has these already

    // ── localStorage/sessionStorage ──
    if (typeof localStorage === 'undefined' || localStorage === null) {
        (function() {
            var store = {};
            window.localStorage = {
                getItem: function(k) { return store[k] || null; },
                setItem: function(k, v) { store[k] = String(v); },
                removeItem: function(k) { delete store[k]; },
                clear: function() { store = {}; },
                key: function(i) { return Object.keys(store)[i] || null; },
                get length() { return Object.keys(store).length; },
            };
        })();
    }
    if (typeof sessionStorage === 'undefined' || sessionStorage === null) {
        (function() {
            var store = {};
            window.sessionStorage = {
                getItem: function(k) { return store[k] || null; },
                setItem: function(k, v) { store[k] = String(v); },
                removeItem: function(k) { delete store[k]; },
                clear: function() { store = {}; },
                key: function(i) { return Object.keys(store)[i] || null; },
                get length() { return Object.keys(store).length; },
            };
        })();
    }

    // ── Canvas ──
    if (typeof HTMLCanvasElement !== 'undefined') {
        HTMLCanvasElement.prototype.getContext = function(type) {
            return {
                canvas: this,
                fillStyle: '#000000', strokeStyle: '#000000',
                font: '10px sans-serif',
                textAlign: 'start', textBaseline: 'alphabetic',
                globalAlpha: 1.0, globalCompositeOperation: 'source-over',
                lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
                shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', shadowOffsetX: 0, shadowOffsetY: 0,
                fillRect: noop, strokeRect: noop, clearRect: noop,
                fillText: noop, strokeText: noop,
                beginPath: noop, closePath: noop,
                moveTo: noop, lineTo: noop, bezierCurveTo: noop, quadraticCurveTo: noop,
                arc: noop, arcTo: noop, rect: noop,
                fill: noop, stroke: noop, clip: noop,
                save: noop, restore: noop,
                scale: noop, rotate: noop, translate: noop,
                transform: noop, setTransform: noop,
                createLinearGradient: function() { return { addColorStop: noop }; },
                createRadialGradient: function() { return { addColorStop: noop }; },
                createPattern: function() { return null; },
                createImageData: function(w, h) { return { width: w||300, height: h||150, data: [] }; },
                getImageData: function() { return { width: 300, height: 150, data: [] }; },
                putImageData: noop,
                measureText: function() { return { width: 100, actualBoundingBoxAscent: 80, actualBoundingBoxDescent: 20 }; },
                drawImage: noop,
                isPointInPath: function() { return false; },
                isPointInStroke: function(){ return false; },
                getContextAttributes: function(){ return {}; },
            };
        };
        HTMLCanvasElement.prototype.toDataURL = function() {
            return 'data:image/png;base64,';
        };
    }
})();
"""

ctx.eval(ENV_JS)

# Verify env
print("=== Environment check ===")
for prop in ["navigator.userAgent", "navigator.vendor", "navigator.plugins.length",
             "screen.width", "screen.height", "document.readyState",
             "document.cookie", "performance.timing.navigationStart",
             "typeof localStorage", "typeof HTMLCanvasElement"]:
    try:
        print(f"{prop}: {ctx.eval(prop)}")
    except Exception as e:
        print(f"{prop}: ERROR - {e}")

# Load challenge
html = (BASE / "202_response.html").read_text("utf-8")
cd_m = re.search(r'\$_ts\.cd="([^"]+)"', html)
nsd_m = re.search(r'nsd=(\d+)', html)
cd = cd_m.group(1) if cd_m else ""
nsd = int(nsd_m.group(1)) if nsd_m else 0
cd_esc = cd.replace("\\", "\\\\").replace('"', '\\"')
ctx.eval(f"""
    window.$_ts = {{}};
    window.$_ts.cd = "{cd_esc}";
    window.$_ts.nsd = {nsd};
    window.$_ts.scj = 0;
    window.$_ts.aebi = 0;
""")
print(f"\n$_ts set: nsd={nsd}, cd_len={len(ctx.eval('window.$_ts.cd'))}")

# Load and run engine
ruishu_js = (BASE / "ruishu_engine_1.js").read_text("utf-8")
print(f"\n=== Loading engine ({len(ruishu_js)} bytes) ===")

start = time.time()
try:
    ctx.eval(f"""
        try {{
            {ruishu_js}
        }} catch(e) {{
            window.__err = {{msg: e.message, stack: e.stack}};
        }}
    """)
    elapsed = time.time() - start

    err = ctx.eval("typeof window.__err")
    if err == "object":
        msg = ctx.eval("window.__err.msg")
        stack = ctx.eval("window.__err.stack") or ""
        print(f"Error @ {elapsed:.2f}s: {msg[:300]}")
        st_lines = stack.split("\\n")
        for l in st_lines[:10]:
            print(f"  {l}")
    else:
        print(f"OK ({elapsed:.2f}s)")
        print("$_ts keys:", ctx.eval("Object.keys(window.$_ts)"))
        print("$_ts.lcd:", ctx.eval("typeof window.$_ts.lcd"))
except Exception as e:
    print(f"Exception: {e}")
