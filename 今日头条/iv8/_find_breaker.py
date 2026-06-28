"""Find which extra stub breaks acrawler.js JSVMP in iv8."""
import iv8
from pathlib import Path

d = Path(__file__).parent.parent / "v1.0"
ac = d.joinpath("acrawler.js").read_text("utf-8")

base = """
self = window;
globalThis = window;
window.MessageChannel = function() {
    var _cb = null;
    this.port1 = { postMessage: function(m) { if (_cb) setTimeout(function() { _cb({data:m}); }, 0); } };
    this.port2 = {};
    Object.defineProperty(this.port2, 'onmessage', { get: function() { return _cb; }, set: function(fn) { _cb = fn; } });
};
window.setImmediate = function(fn) { return setTimeout(fn, 0); };
window.addEventListener = function(e, fn) { if (e === 'DOMContentLoaded') setTimeout(fn, 100); };
performance.now = function() { return Date.now(); };
document.createElement = function(t) {
    return {
        tagName: (t || '').toUpperCase(), style: {},
        appendChild: function() {}, removeChild: function() {},
        setAttribute: function() {}, getAttribute: function() { return null; },
        children: [], childNodes: [], parentNode: null,
        addEventListener: function() {}, getElementsByTagName: function() { return []; }
    };
};
try { Object.defineProperty(document, 'body', { get: function() { return document.createElement('body'); }, configurable: true }); } catch(e) {}
try { Object.defineProperty(document, 'documentElement', { get: function() { return document.createElement('html'); }, configurable: true }); } catch(e) {}
document.getElementsByTagName = function(t) { return [document.createElement(t)]; };
document.querySelector = function() { return null; };
document.getElementById = function() { return null; };
document.addEventListener = function() {};
document.all = undefined;
navigator.sendBeacon = function() { return true; };
Object.defineProperty(navigator, 'connection', { get: function() { return { effectiveType: '4g', rtt: 50, downlink: 10, saveData: false }; }, configurable: true });
Object.defineProperty(document, 'currentScript', { get: function() { return { src: 'x', getAttribute: function() { return null; } }; }, configurable: true });
var _sd={};
window.localStorage = { getItem: function(k) { return _sd[String(k)] || null; }, setItem: function(k, v) { _sd[String(k)] = String(v); }, removeItem: function(k) { delete _sd[String(k)]; }, clear: function() { _sd = {}; }, get length() { return Object.keys(_sd).length; }, key: function(n) { return Object.keys(_sd)[n] || null; } };
window.sessionStorage = window.localStorage;
window.chrome = { runtime: {}, app: { isInstalled: false }, loadTimes: function() { return {}; } };
window.Intl = { DateTimeFormat: function() { return { resolvedOptions: function() { return { locale: 'zh-CN', timeZone: 'Asia/Shanghai' }; } }; } };
"""

extras = [
    # Group 1: document extra props
    "document.removeEventListener = function() {}; document.createEvent = function(t) { return { initEvent: function() {} }; }; document.createTextNode = function(t) { return { nodeType: 3, textContent: String(t||''), nodeValue: String(t||'') }; }; document.readyState = 'complete'; document.hidden = false; document.visibilityState = 'visible'; document.characterSet = 'UTF-8'; document.title = ''; document.referrer = '';",

    # Group 2: cookie
    "var _dc=''; Object.defineProperty(document, 'cookie', { get: function() { return _dc; }, set: function(v) { if (v) _dc = _dc ? _dc + '; ' + v : v; }, configurable: true });",

    # Group 3: writeln + remote modules
    'document.writeln = function(html) {}; window._remoteModules = {};',

    # Group 4: Observers
    "window.MutationObserver = function() { this.observe = function() {}; this.disconnect = function() {}; }; window.PerformanceObserver = function() { this.observe = function() {}; this.disconnect = function() {}; };",

    # Group 5: Navigator extras
    "navigator.plugins = [{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' }]; navigator.mimeTypes = [{ type: 'application/pdf', suffixes: 'pdf' }]; if (!navigator.languages) navigator.languages = ['zh-CN', 'zh']; if (!navigator.language) navigator.language = 'zh-CN'; Object.defineProperty(navigator, 'userAgentData', { get: function() { return { platform: 'Windows', brands: [{ brand: 'Chromium', version: '143' }], mobile: false }; }, configurable: true });",

    # Group 6: Network stubs
    "window.Request = function(input) { this.url = typeof input === 'string' ? input : (input && input.url); this.method = 'GET'; }; window.Response = function(body) { this.body = body; this.status = 200; this.ok = true; }; window.Response.prototype.text = function() { return Promise.resolve(this.body || ''); }; window.Response.prototype.json = function() { return Promise.resolve(JSON.parse(this.body || '{}')); }; window.Headers = function(init) { this._h = {}; if (init) Object.assign(this._h, init); }; window.Headers.prototype.get = function(k) { return this._h[k]; }; window.Headers.prototype.set = function(k, v) { this._h[k] = v; }; window.XMLHttpRequest = function() { this.readyState = 0; this.status = 0; }; window.XMLHttpRequest.prototype.open = function() { this.readyState = 1; }; window.XMLHttpRequest.prototype.send = function() { this.readyState = 4; this.status = 200; }; window.XMLHttpRequest.prototype.setRequestHeader = function() {};",

    # Group 7: fetch
    "window.fetch = function() { return Promise.resolve({ status: 200, ok: true, text: function() { return Promise.resolve('{}'); }, json: function() { return Promise.resolve({}); }, headers: new window.Headers() }); };",

    # Group 8: Now split into individual culprits!
]

# Group 8 individual items
g8_items = [
    ("Worker", "window.Worker = function() { this.onmessage = null; this.onerror = null; this.postMessage = function() {}; this.terminate = function() {}; };"),
    ("Blob", "window.Blob = function(parts, opts) { this._parts = parts; this.type = (opts||{}).type || ''; };"),
    ("URL", "var _URL = window.URL || {}; _URL.createObjectURL = function() { return 'blob:mock'; }; _URL.revokeObjectURL = function() {}; window.URL = _URL;"),
    ("Image", "window.Image = function(w, h) { this.width = w || 0; this.height = h || 0; };"),
    ("Audio", "window.Audio = function() { this.play = function() {}; };"),
    ("EventSource", "window.EventSource = function(url) { this.url = url; this.readyState = 0; var s = this; setTimeout(function() { s.readyState = 1; }, 0); };"),
    ("module/exports", "window.module = { exports: {} }; window.exports = {};"),
    ("onwheelx+version", "window.onwheelx = { _Ax: '0X21' }; window._sdkGlueVersionMap = { sdkGlueVersion: '1.0.0.55', bdmsVersion: '1.0.1.7', captchaVersion: '4.0.2' };"),
    ("dimensions", "window.pageYOffset = 0; window.devicePixelRatio = 1.25; window.innerWidth = 1920; window.innerHeight = 1080; window.outerWidth = 1936; window.outerHeight = 1112; window.screenX = 0; window.screenY = 0;"),
    ("ProgressEvent", "window.ProgressEvent = function() {};"),
]

# Apply group 1-7 as baseline
groups_1_to_7 = "".join(extras)

# Test each G8 item individually
for name, code in g8_items:
    test(f"G8: {name}", groups_1_to_7 + code)

# Test all G8 EXCEPT each one to find which breaks
print()
print("=== Excluding one at a time ===")
all_g8 = "".join(c for _, c in g8_items)
test("ALL G8", groups_1_to_7 + all_g8)
for i, (name, code) in enumerate(g8_items):
    reduced = all_g8.replace(code, "")
    test(f"NO-{name}", groups_1_to_7 + reduced)
]

# Test base
def test(label, extra, expected="object"):
    ctx = iv8.JSContext(environment={
        'location': {'href': 'https://www.toutiao.com/'},
        'navigator': {'userAgent': 'Mozilla/5.0', 'platform': 'Win32','webdriver': False},
        'screen': {'width': 1920, 'height': 1080},
    })
    ctx.__enter__()
    ctx.eval(base)
    if extra: ctx.eval(extra)
    try:
        ctx.eval(ac)
        r = ctx.eval('typeof window.byted_acrawler')
        ok = "OK" if r == expected else "BREAKS"
        print(f"  {label:30s} -> {r:10s} {ok}")
        return r
    except Exception as e:
        print(f"  {label:30s} → ERROR: {str(e)[:80]}")
        return None
    finally:
        ctx.__exit__(None, None, None)

print("=== Finding acrawler breaker ===")
test("BASE ONLY", None)

cumulative = ""
for i, extra in enumerate(extras):
    cumulative += extra
    test(f"+ Group {i+1}", cumulative)
