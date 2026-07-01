"""
test_iv8_v3.py — iv8 补环境迭代（注入真实浏览器环境值）
"""
import iv8, re, time, json
from pathlib import Path

BASE = Path(__file__).parent
ctx = iv8.JSContext()
ctx.eval("window = this")

# ── 精准环境注入（Camoufox 采集的真实值）───
ENV_JS = """
(function() {
    // Navigator 精确值
    navigator.__defineGetter__('vendor', function(){ return ''; });
    navigator.__defineGetter__('vendorSub', function(){ return ''; });
    navigator.__defineGetter__('product', function(){ return 'Gecko'; });
    navigator.__defineGetter__('productSub', function(){ return '20100101'; });
    navigator.__defineGetter__('appCodeName', function(){ return 'Mozilla'; });
    navigator.__defineGetter__('appName', function(){ return 'Netscape'; });
    navigator.__defineGetter__('appVersion', function(){ return '5.0 (Windows)'; });
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
    navigator.__defineGetter__('deviceMemory', function(){ return undefined; });
    navigator.__defineGetter__('globalPrivacyControl', function(){ return false; });
    navigator.__defineGetter__('userActivation', function(){ return {}; });

    // Screen
    screen.width = 2560; screen.height = 1440;
    screen.availWidth = 2560; screen.availHeight = 1440;
    screen.colorDepth = 24; screen.pixelDepth = 24;

    // Document properties
    document.__defineGetter__('title', function(){ return '搜全站-欧冶'; });
    document.__defineGetter__('domain', function(){ return 'www.ouyeel.com'; });
    document.__defineGetter__('referrer', function(){ return ''; });
    document.__defineGetter__('readyState', function(){ return 'complete'; });
    document.__defineGetter__('characterSet', function(){ return 'UTF-8'; });
    document.__defineGetter__('charset', function(){ return 'UTF-8'; });
    document.__defineGetter__('compatMode', function(){ return 'CSS1Compat'; });
    document.__defineGetter__('contentType', function(){ return 'text/html'; });
    document.__defineGetter__('hidden', function(){ return false; });
    document.__defineGetter__('visibilityState', function(){ return 'visible'; });
    document.__defineGetter__('designMode', function(){ return 'off'; });
    document.__defineGetter__('lastModified', function(){ return '07/01/2026 22:57:51'; });

    // Cookie handler
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
    location.__defineGetter__('href', function(){ return 'https://www.ouyeel.com/steel/search?pageIndex=0&pageSize=50&channel=RJ'; });
    location.__defineGetter__('origin', function(){ return 'https://www.ouyeel.com'; });
    location.__defineGetter__('host', function(){ return 'www.ouyeel.com'; });
    location.__defineGetter__('hostname', function(){ return 'www.ouyeel.com'; });
    location.__defineGetter__('port', function(){ return ''; });
    location.__defineGetter__('protocol', function(){ return 'https:'; });
    location.__defineGetter__('pathname', function(){ return '/steel/search'; });
    location.__defineGetter__('search', function(){ return '?pageIndex=0&pageSize=50&channel=RJ'; });

    // Doc URL
    document.__defineGetter__('URL', function(){ return location.href; });
    document.__defineGetter__('documentURI', function(){ return location.href; });

    // Performance
    var _perfNow = Date.now();
    performance.__defineGetter__('timeOrigin', function(){ return _perfNow - 5000; });

    var _timing = {};
    _timing.navigationStart = _perfNow - 5000;
    _timing.fetchStart = _perfNow - 4700;
    _timing.domainLookupStart = _perfNow - 4650; _timing.domainLookupEnd = _perfNow - 4600;
    _timing.connectStart = _perfNow - 4600; _timing.connectEnd = _perfNow - 4500;
    _timing.requestStart = _perfNow - 4450; _timing.responseStart = _perfNow - 4000;
    _timing.responseEnd = _perfNow - 3500;
    _timing.domLoading = _perfNow - 3400; _timing.domInteractive = _perfNow - 2000;
    _timing.domContentLoadedEventStart = _perfNow - 1900;
    _timing.domContentLoadedEventEnd = _perfNow - 1800;
    _timing.domComplete = _perfNow - 500;
    _timing.loadEventStart = _perfNow - 400; _timing.loadEventEnd = _perfNow - 100;
    performance.__defineGetter__('timing', function(){ return _timing; });

    // ── Element stubs ──
    var noop = function(){};
    function makeEl(tag) {
        return {
            tagName: (tag||'').toUpperCase(), nodeType: 1, nodeName: (tag||'').toUpperCase(),
            style: {}, className: '', id: '', innerHTML: '', textContent: '',
            childNodes: [], children: [], parentNode: null,
            ownerDocument: document,
            firstChild: null, lastChild: null,
            nextSibling: null, previousSibling: null,
            appendChild: noop, removeChild: noop, replaceChild: noop, insertBefore: noop,
            setAttribute: noop, removeAttribute: noop,
            getAttribute: function(attr){ return null; },
            hasAttribute: function(){ return false; },
            closest: function(){ return null; }, contains: function(){ return false; },
            hasChildNodes: function(){ return false; },
            addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
            cloneNode: function(){ return this; },
            offsetWidth: 2560, offsetHeight: 1440, offsetLeft: 0, offsetTop: 0,
            clientWidth: 2560, clientHeight: 1440,
            scrollLeft: 0, scrollTop: 0, scrollWidth: 2560, scrollHeight: 1440,
            getBoundingClientRect: function(){
                return {top:0,left:0,width:2560,height:1440,right:2560,bottom:1440};
            },
            querySelector: function(){ return null; },
            querySelectorAll: function(){ return []; },
            getElementsByTagName: function(){ return []; },
            getElementsByClassName: function(){ return []; },
            toString: function(){ return '[object HTMLElement]'; },
        };
    }

    // Document body/element/head
    try { Object.defineProperty(document, 'body', {
        get: function(){ var e = makeEl('body'); e.tagName = 'BODY'; return e; },
        configurable: true
    }); } catch(e){}
    try { Object.defineProperty(document, 'documentElement', {
        get: function(){ var e = makeEl('html'); e.tagName = 'HTML'; return e; },
        configurable: true
    }); } catch(e){}
    try { Object.defineProperty(document, 'head', {
        get: function(){ var e = makeEl('head'); e.tagName = 'HEAD'; return e; },
        configurable: true
    }); } catch(e){}

    // Document methods
    document.createElement = function(tag){ return makeEl(tag); };
    document.createTextNode = function(){ return {nodeType:3, nodeName:'#text', textContent:'', data:''}; };
    document.addEventListener = noop;
    document.removeEventListener = noop;
    document.dispatchEvent = noop;
    document.hasFocus = function(){ return true; };
    document.hasChildNodes = function(){ return false; };
    document.write = noop;
    document.close = noop;
    document.open = noop;

    // Document collections
    document.getElementsByTagName = function(){ return []; };
    document.getElementsByClassName = function(){ return []; };
    document.getElementsByName = function(){ return []; };

    // currentScript
    try { Object.defineProperty(document, 'currentScript', {
        get: function(){ var e = makeEl('script'); e.tagName = 'SCRIPT'; return e; },
        configurable: true
    }); } catch(e){}

    // scrollingElement
    try { Object.defineProperty(document, 'scrollingElement', {get:function(){ return document.body; }, configurable:true}); } catch(e){}

    // activeElement
    try { Object.defineProperty(document, 'activeElement', {get:function(){ return document.body; }, configurable:true}); } catch(e){}

    // doctype
    try { Object.defineProperty(document, 'doctype', {
        get:function(){ return {name:'html',publicId:'',systemId:'',nodeType:10,nodeName:'html'}; },
        configurable:true
    }); } catch(e){}

    // Canvas stub
    try {
        HTMLCanvasElement.prototype.getContext = function() {
            return {
                fillRect: noop, clearRect: noop, strokeRect: noop,
                fillText: noop, strokeText: noop,
                measureText: function(){ return {width:100, actualBoundingBoxAscent:80, actualBoundingBoxDescent:20}; },
                getImageData: function(){ return {width:300, height:150, data:[]}; },
                putImageData: noop, drawImage: noop,
                createImageData: function(w,h){ return {width:w||300, height:h||150, data:[]}; },
                beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
                arc: noop, save: noop, restore: noop, scale: noop, rotate: noop, translate: noop,
                fill: noop, stroke: noop, clip: noop,
                font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
                fillStyle: '#000000', strokeStyle: '#000000',
            };
        };
        HTMLCanvasElement.prototype.toDataURL = function(){ return 'data:image/png;base64,'; };
    } catch(e){}
})();
"""

print("[*] Injecting environment...")
ctx.eval(ENV_JS)

# Verify key values
for check in [
    "navigator.language", "navigator.buildID", "navigator.doNotTrack",
    "screen.width", "typeof document.body", "typeof document.currentScript",
    "typeof document.body.getAttribute", "typeof document.body.tagName",
    "typeof performance.timing.navigationStart",
]:
    print(f"  {check}: {ctx.eval(check)}")

# Load matched challenge
html = (BASE / "202_response.html").read_text("utf-8")
cd_m = re.search(r'\\$_ts\\.cd="([^"]+)"', html)
nsd_m = re.search(r'nsd=(\\d+)', html)
cd = cd_m.group(1) if cd_m else ""
nsd = int(nsd_m.group(1)) if nsd_m else 0
cd_esc = cd.replace("\\", "\\\\\\\\").replace('"', '\\\\"')
ctx.eval(f'window.$_ts = {{}};')
ctx.eval(f'window.$_ts.cd = "{cd_esc}";')
ctx.eval(f'window.$_ts.nsd = {nsd};')
ctx.eval(f'window.$_ts.scj = 0;')
ctx.eval(f'window.$_ts.aebi = 0;')
print(f"\\n$_ts: nsd={nsd}, cd_len={len(ctx.eval('window.$_ts.cd'))}")

# Execute
ruishu_js = (BASE / "ruishu_engine_1.js").read_text("utf-8")
print(f"Engine: {len(ruishu_js)} bytes")

start = time.time()
try:
    ctx.eval(f"""
        try {{ {ruishu_js} }} catch(e) {{
            window.__er = {{msg: e.message, st: e.stack || ''}};
        }}
    """)
    elapsed = time.time() - start
    err = ctx.eval("typeof window.__er")
    if err == "object":
        msg = ctx.eval("window.__er.msg")
        st = ctx.eval("window.__er.st") or ""
        print(f"Error @ {elapsed:.2f}s: {msg[:300]}")
        for line in st.split("\\n")[:10]:
            print(f"  {line}")
    else:
        print(f"OK @ {elapsed:.2f}s")
        print("$_ts:", ctx.eval("Object.keys(window.$_ts)"))
        print("lcd:", ctx.eval("typeof window.$_ts.lcd"))
except Exception as e:
    print(f"Exception: {e}")
