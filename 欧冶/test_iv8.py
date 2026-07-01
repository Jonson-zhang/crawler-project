"""
test_iv8_v5.py — iv8 补环境：关键修复 screen.width 用 Python 侧设置
"""
import iv8, re, time, json
from pathlib import Path

BASE = Path(__file__).parent
ctx = iv8.JSContext()
ctx.eval("window = this")

# Set screen.width via Python IV8 API if available
# Otherwise set it BEFORE any C++ initialization
import ctypes
try:
    # Try to use iv8 API to set property
    pass
except:
    pass

# Check C++ screen defaults
print("Default screen.width:", ctx.eval("screen.width"))
print("Default screen.height:", ctx.eval("screen.height"))

# Set env
ENV_JS = """
(function() {
    // Override C++ screen using Object.defineProperty
    try { Object.defineProperty(screen, 'width', { value: 2560, writable: true, configurable: true }); } catch(e1) {
        // Fallback: try direct assignment
        try { screen.width = 2560; } catch(e2) {}
    }
    try { Object.defineProperty(screen, 'height', { value: 1440, writable: true, configurable: true }); } catch(e) {}
    try { Object.defineProperty(screen, 'availWidth', { value: 2560, writable: true, configurable: true }); } catch(e) {}
    try { Object.defineProperty(screen, 'availHeight', { value: 1440, writable: true, configurable: true }); } catch(e) {}
    try { Object.defineProperty(screen, 'colorDepth', { value: 24, writable: true, configurable: true }); } catch(e) {}

    // Navigator
    navigator.__defineGetter__('vendor', function(){ return ''; });
    navigator.__defineGetter__('buildID', function(){ return '20181001000000'; });
    navigator.__defineGetter__('oscpu', function(){ return 'Windows NT 10.0; Win64; x64'; });
    navigator.__defineGetter__('doNotTrack', function(){ return '1'; });
    navigator.__defineGetter__('platform', function(){ return 'Win32'; });
    navigator.__defineGetter__('hardwareConcurrency', function(){ return 8; });
    navigator.__defineGetter__('maxTouchPoints', function(){ return 0; });
    navigator.__defineGetter__('cookieEnabled', function(){ return true; });
    navigator.__defineGetter__('onLine', function(){ return true; });
    navigator.__defineGetter__('webdriver', function(){ return false; });
    navigator.__defineGetter__('pdfViewerEnabled', function(){ return true; });
    navigator.__defineGetter__('language', function(){ return 'en-US'; });
    navigator.__defineGetter__('languages', function(){ return ['en-US', 'en']; });
    navigator.__defineGetter__('product', function(){ return 'Gecko'; });
    navigator.__defineGetter__('productSub', function(){ return '20100101'; });

    // Document
    document.__defineGetter__('title', function(){ return 'Search - Ouyeel'; });
    document.__defineGetter__('domain', function(){ return 'www.ouyeel.com'; });
    document.__defineGetter__('referrer', function(){ return ''; });
    document.__defineGetter__('readyState', function(){ return 'complete'; });
    document.__defineGetter__('characterSet', function(){ return 'UTF-8'; });
    document.__defineGetter__('compatMode', function(){ return 'CSS1Compat'; });
    document.__defineGetter__('hidden', function(){ return false; });
    document.__defineGetter__('visibilityState', function(){ return 'visible'; });

    // Cookie
    var _ck = {};
    document.__defineGetter__('cookie', function() {
        return Object.entries(_ck).map(function(kv){return kv[0]+'='+kv[1];}).join('; ');
    });
    document.__defineSetter__('cookie', function(v) {
        if (v && v.indexOf('=') > 0) {
            var eq = v.indexOf('=');
            var semi = v.indexOf(';');
            var val = semi > 0 ? v.substring(0, semi) : v;
            _ck[v.substring(0, eq).trim()] = val.substring(eq + 1).trim();
        }
    });

    // Location
    try { Object.defineProperty(location, 'href', { get: function(){ return 'https://www.ouyeel.com/steel/search?pageIndex=0&pageSize=50&channel=RJ'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'origin', { get: function(){ return 'https://www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'host', { get: function(){ return 'www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'hostname', { get: function(){ return 'www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'protocol', { get: function(){ return 'https:'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'pathname', { get: function(){ return '/steel/search'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'search', { get: function(){ return '?pageIndex=0&pageSize=50&channel=RJ'; }, configurable: true }); } catch(e) {}
    document.__defineGetter__('URL', function(){ return location.href; });
    document.__defineGetter__('documentURI', function(){ return location.href; });

    // Performance
    var _n = Date.now();
    performance.__defineGetter__('timeOrigin', function(){ return _n - 5000; });
    performance.__defineGetter__('timing', function() {
        return { navigationStart: _n-5000, fetchStart: _n-4700,
                 domLoading: _n-3400, domInteractive: _n-2000,
                 domComplete: _n-500, loadEventStart: _n-400, loadEventEnd: _n-100 };
    });
    performance.now = function(){ return Date.now() - _n + 5000; };

    // Element stubs + document methods
    var noop = function(){};
    function makeEl(tag) {
        return {
            tagName: (tag||'div').toUpperCase(), nodeType: 1,
            nodeName: (tag||'div').toUpperCase(),
            style: {}, className: '', id: '', innerHTML: '', textContent: '',
            childNodes: [], children: [], parentNode: null, ownerDocument: document,
            appendChild: noop, removeChild: noop, replaceChild: noop, insertBefore: noop,
            setAttribute: noop, removeAttribute: noop,
            getAttribute: function(){ return null; },
            hasAttribute: function(){ return false; },
            closest: function(){ return null; }, contains: function(){ return false; },
            addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
            cloneNode: function(){ return this; },
            offsetWidth: 2560, offsetHeight: 1440,
            clientWidth: 2560, clientHeight: 1440,
            scrollLeft: 0, scrollTop: 0,
            getBoundingClientRect: function(){ return {top:0,left:0,width:2560,height:1440}; },
            querySelector: function(){ return null; },
            querySelectorAll: function(){ return []; },
            getElementsByTagName: function(){ return []; },
            toString: function(){ return '[object HTMLElement]'; },
        };
    }

    try { Object.defineProperty(document, 'body', { get: function(){ return makeEl('body'); }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'documentElement', { get: function(){ return makeEl('html'); }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'head', { get: function(){ return makeEl('head'); }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'currentScript', { get: function(){ return makeEl('script'); }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'scrollingElement', { get: function(){ return document.body; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'activeElement', { get: function(){ return document.body; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'doctype', { get: function(){ return {name:'html',publicId:'',systemId:'',nodeType:10}; }, configurable: true }); } catch(e) {}

    document.createElement = function(tag){ return makeEl(tag); };
    document.createTextNode = function(){ return {nodeType:3,nodeName:'#text',textContent:'',data:''}; };
    document.addEventListener = noop; document.removeEventListener = noop; document.dispatchEvent = noop;
    document.hasFocus = function(){ return true; };
    document.write = noop;
    document.getElementsByTagName = function(){ return []; };
    document.getElementsByClassName = function(){ return []; };
    document.getElementsByName = function(){ return []; };

    document.querySelector = function(sel) {
        var r = null;
        try { r = document.querySelector.call(document, sel); } catch(e) {}
        return r || makeEl();
    };
    document.getElementById = function(id) {
        var r = null;
        try { r = document.getElementById.call(document, id); } catch(e) {}
        return r || makeEl();
    };

    // Canvas
    try {
        HTMLCanvasElement.prototype.getContext = function() {
            return {
                fillRect: noop, clearRect: noop, strokeRect: noop,
                fillText: noop, strokeText: noop,
                measureText: function(){ return {width:100}; },
                getImageData: function(){ return {width:300,height:150,data:[]}; },
                putImageData: noop, drawImage: noop,
                beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
                arc: noop, save: noop, restore: noop, fill: noop, stroke: noop,
            };
        };
        HTMLCanvasElement.prototype.toDataURL = function(){ return 'data:image/png;base64,'; };
    } catch(e) {}
})();
"""

print("[*] Before env injection:")
print("  screen.width:", ctx.eval("screen.width"))

ctx.eval(ENV_JS)

print("[*] After env injection:")
print("  screen.width:", ctx.eval("screen.width"))
print("  navigator.buildID:", ctx.eval("navigator.buildID"))
print("  navigator.doNotTrack:", ctx.eval("navigator.doNotTrack"))

# Load challenge
html = (BASE / "202_response.html").read_text("utf-8")
cd_m = re.search(r'\$_ts\.cd="([^"]+)"', html)
nsd_m = re.search(r'nsd=(\d+)', html)
cd = cd_m.group(1) if cd_m else ""
nsd = int(nsd_m.group(1)) if nsd_m else 0

ctx.eval("window.$_ts = {};")
ctx.eval(f"window.$_ts.cd = {json.dumps(cd)};")
ctx.eval(f"window.$_ts.nsd = {nsd};")
ctx.eval("window.$_ts.scj = 0; window.$_ts.aebi = 0;")
print(f"\n$_ts: nsd={nsd}, cd_len={len(ctx.eval('window.$_ts.cd'))}")

# Execute
ruishu_js = (BASE / "ruishu_engine_1.js").read_text("utf-8")
print(f"Engine: {len(ruishu_js)} bytes")
start = time.time()
try:
    result = ctx.eval(f"""
        (function() {{
            try {{ {ruishu_js} }}
            catch(e) {{ return {{error:true, msg:e.message, stack:e.stack||''}}; }}
            return {{error:false}};
        }})()
    """)
    elapsed = time.time() - start
    if isinstance(result, dict) and result.get("error"):
        print(f"Error @ {elapsed:.2f}s: {result['msg'][:200]}")
    else:
        print(f"OK @ {elapsed:.2f}s")
        print("$_ts:", ctx.eval("Object.keys(window.$_ts)"))
        print("lcd:", ctx.eval("typeof window.$_ts.lcd"))
except Exception as e:
    print(f"Exception: {e}")
