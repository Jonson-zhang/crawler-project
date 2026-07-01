"""
test_iv8_v4.py — iv8 补环境迭代（全覆盖 DOM stub）
"""
import iv8, re, time, json
from pathlib import Path

BASE = Path(__file__).parent
ctx = iv8.JSContext()
ctx.eval("window = this")

ENV_JS = """
(function() {
    // Global Element.prototype.getAttribute safety
    try {
        var _ga = Element.prototype.getAttribute;
        Element.prototype.getAttribute = function(attr) {
            if (this === undefined || this === null || this === window) return null;
            try { return _ga.call(this, attr); } catch(e) { return null; }
        };
    } catch(e) {}

    // Navigator
    var navProps = {
        vendor: '', vendorSub: '', product: 'Gecko', productSub: '20100101',
        appCodeName: 'Mozilla', appName: 'Netscape', appVersion: '5.0 (Windows)',
        buildID: '20181001000000', oscpu: 'Windows NT 10.0; Win64; x64',
        doNotTrack: '1', platform: 'Win32', hardwareConcurrency: 8,
        maxTouchPoints: 0, cookieEnabled: true, onLine: true,
        webdriver: false, pdfViewerEnabled: true, language: 'en-US',
        languages: ['en-US', 'en'], globalPrivacyControl: false,
    };
    Object.keys(navProps).forEach(function(k) {
        navigator.__defineGetter__(k, function(){ return navProps[k]; });
    });

    // Screen
    screen.width = 2560; screen.height = 1440;
    screen.availWidth = 2560; screen.availHeight = 1440;
    screen.colorDepth = 24; screen.pixelDepth = 24;

    // Document props
    var docProps = {
        title: 'Search - Ouyeel', domain: 'www.ouyeel.com', referrer: '',
        readyState: 'complete', characterSet: 'UTF-8', charset: 'UTF-8',
        compatMode: 'CSS1Compat', contentType: 'text/html',
        hidden: false, visibilityState: 'visible', designMode: 'off',
        inputEncoding: 'UTF-8',
    };
    Object.keys(docProps).forEach(function(k) {
        document.__defineGetter__(k, function(){ return docProps[k]; });
    });

    // Document collections (all empty)
    ['forms','images','links','scripts','styleSheets','embeds','anchors',
     'applets','children','childNodes','plugins'].forEach(function(k) {
        document.__defineGetter__(k, function(){ return []; });
    });

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

    // Location (wrapped in try/catch)
    try { Object.defineProperty(location, 'href', { get: function(){ return 'https://www.ouyeel.com/steel/search?pageIndex=0&pageSize=50&channel=RJ'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'origin', { get: function(){ return 'https://www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'host', { get: function(){ return 'www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'hostname', { get: function(){ return 'www.ouyeel.com'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'protocol', { get: function(){ return 'https:'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'pathname', { get: function(){ return '/steel/search'; }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(location, 'search', { get: function(){ return '?pageIndex=0&pageSize=50&channel=RJ'; }, configurable: true }); } catch(e) {}

    // Doc URL
    document.__defineGetter__('URL', function(){ return location.href; });
    document.__defineGetter__('documentURI', function(){ return location.href; });

    // Performance
    var _n = Date.now();
    performance.__defineGetter__('timeOrigin', function(){ return _n - 5000; });
    performance.__defineGetter__('timing', function() {
        return { navigationStart: _n-5000, fetchStart: _n-4700,
                 domLoading: _n-3400, domInteractive: _n-2000,
                 domComplete: _n-500, loadEventStart: _n-400, loadEventEnd: _n-100,
                 responseStart: _n-4000, responseEnd: _n-3500,
                 requestStart: _n-4450, connectStart: _n-4600, connectEnd: _n-4500 };
    });
    performance.now = function(){ return Date.now() - _n + 5000; };
    performance.getEntries = function(){ return []; };

    // Element factory
    var noop = function(){};
    function makeEl(tag) {
        return {
            tagName: (tag||'div').toUpperCase(), nodeType: 1,
            nodeName: (tag||'div').toUpperCase(),
            style: {}, className: '', id: '', innerHTML: '', textContent: '',
            childNodes: [], children: [], parentNode: null, ownerDocument: document,
            firstChild: null, lastChild: null,
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

    // querySelector/getElementById with fallback
    var _qs = document.querySelector;
    document.querySelector = function(sel) {
        var r = null; try { r = _qs.call(document, sel); } catch(e) {}
        return r || makeEl();
    };
    var _gid = document.getElementById;
    document.getElementById = function(id) {
        var r = null; try { r = _gid.call(document, id); } catch(e) {}
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

print("[*] Injecting environment...")
ctx.eval(ENV_JS)

for c in ["navigator.buildID", "navigator.doNotTrack", "screen.width",
          "typeof document.body.getAttribute", "typeof location.href"]:
    print(f"  {c}: {ctx.eval(c)}")

# Load challenge
html = (BASE / "202_response.html").read_text("utf-8")
cd_m = re.search(r'\$_ts\.cd="([^"]+)"', html)
nsd_m = re.search(r'nsd=(\d+)', html)
cd = cd_m.group(1) if cd_m else ""
nsd = int(nsd_m.group(1)) if nsd_m else 0

ctx.eval("window.$_ts = {};")
ctx.eval(f"window.$_ts.cd = {json.dumps(cd)};")
ctx.eval(f"window.$_ts.nsd = {nsd};")
ctx.eval("window.$_ts.scj = 0;")
ctx.eval("window.$_ts.aebi = 0;")
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
        print(f"Error @ {elapsed:.2f}s: {result['msg'][:300]}")
        for l in result.get("stack","").split("\n")[:8]:
            print(f"  {l}")
    else:
        print(f"OK @ {elapsed:.2f}s")
        print("$_ts:", ctx.eval("Object.keys(window.$_ts)"))
        print("lcd:", ctx.eval("typeof window.$_ts.lcd"))
except Exception as e:
    print(f"Exception: {e}")
