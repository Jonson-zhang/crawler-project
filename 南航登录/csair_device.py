"""
南航设备指纹生成 — iv8 page.load() 方案

参考文章思路：
  1. iv8 page.load() 加载最小 HTML 页面
  2. document.createElement('script') hook → 拦截 JSONP/XHR 通过 Python 发包
  3. 同盾 fm.js → _fmOpt.success(data) → blackbox
  4. 阿里云飞林 fp.min.js → ALIYUN_FP.use('um') → um.getToken() → deviceToken
"""
import json
import time
from pathlib import Path

import iv8
import requests as py_requests
import urllib3

urllib3.disable_warnings()

BASE_DIR = Path(__file__).parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36"

TD_PARTNER = "csair2"
TD_APP_NAME = "quanyi_web"
ALIYUN_APP_KEY = "shabe02f03hs4764a06e085542539a06"
ALIYUN_APP_NAME = "b2c"


class CsairDevice:
    """南航设备指纹生成器"""

    def __init__(self):
        self._ctx = None
        self._requests_log = []

    # ── Python 端 HTTP 桥接 ──────────────────────────────────

    def _http_get(self, url: str, **_kw) -> str:
        """JSONP/script GET → Python requests"""
        try:
            r = py_requests.get(url, headers={"User-Agent": UA}, timeout=15, verify=False)
            self._requests_log.append(f"GET {url[:80]} → {r.status_code} {len(r.text)}B")
            return r.text
        except Exception as e:
            self._requests_log.append(f"GET {url[:80]} → ERROR {e}")
            return ""

    def _http_post(self, url: str, body: str, headers_json: str) -> str:
        """XHR POST → Python requests"""
        try:
            if headers_json:
                h = json.loads(headers_json)
                h.setdefault("User-Agent", UA)
            else:
                h = {"User-Agent": UA}
            r = py_requests.post(url, headers=h, data=body or None, timeout=15, verify=False)
            return json.dumps({"status": r.status_code, "statusText": r.reason, "body": r.text})
        except Exception as e:
            return json.dumps({"status": 0, "statusText": str(e)[:200], "body": ""})

    # ── 构建 iv8 环境 ───────────────────────────────────────

    def _build_environment(self):
        if self._ctx is not None:
            return

        self._ctx = iv8.JSContext(
            environment={
                "location": {
                    "href": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
                    "origin": "https://b2c.csair.com",
                    "protocol": "https:", "host": "b2c.csair.com",
                    "hostname": "b2c.csair.com", "port": "",
                    "pathname": "/B2C40/modules/bookingnew/manage/login.html",
                    "search": "", "hash": "",
                },
                "window": {"origin": "https://b2c.csair.com"},
                "navigator": {
                    "userAgent": UA, "platform": "Win32",
                    "webdriver": False, "languages": ["zh-CN", "zh"],
                    "language": "zh-CN", "hardwareConcurrency": 8,
                },
                "screen": {"width": 1920, "height": 1080},
            },
            config={"timezone": "Asia/Shanghai"},
        )
        self._ctx.__enter__()

    # ── DOM / Browser API Stubs ──────────────────────────────

    def _setup_dom_stubs(self):
        """补全 iv8 缺失的浏览器 API，匹配真实浏览器行为"""
        self._ctx.eval("""\
(function() {
    var n = function(){};

    // Web Worker stub — fp.min.js uses Workers
    window.Worker = function() {
        this.onmessage = null; this.onerror = null;
        this.postMessage = function(data) {
            var s = this;
            setTimeout(function() {
                if (typeof s.onmessage === 'function') s.onmessage({data: {}});
            }, 50);
        };
        this.terminate = function(){};
    };

    // Blob + URL.createObjectURL — for inline workers
    window.Blob = function(parts) { this.parts = parts; };
    window.URL = window.URL || {};
    window.URL.createObjectURL = function(b) { return 'blob:stub-' + Date.now(); };
    window.URL.revokeObjectURL = function(u) {};

    // btoa / atob
    if (typeof btoa === 'undefined') window.btoa = function(s) { return s; };
    if (typeof atob === 'undefined') window.atob = function(s) { return s; };

    // Performance timing
    performance.timing = {
        navigationStart: Date.now(), fetchStart: Date.now(),
        domainLookupStart: Date.now(), domainLookupEnd: Date.now(),
        connectStart: Date.now(), connectEnd: Date.now(),
        requestStart: Date.now(), responseStart: Date.now(),
        responseEnd: Date.now(), domLoading: Date.now(),
        domInteractive: Date.now(), domContentLoadedEventStart: Date.now(),
        domContentLoadedEventEnd: Date.now(), domComplete: Date.now(),
        loadEventStart: Date.now(), loadEventEnd: Date.now()
    };

    // localStorage / sessionStorage
    if (!window.localStorage) {
        window.localStorage = { _data: {}, getItem: function(k) { return this._data[k] || null; },
            setItem: function(k,v) { this._data[k] = v; }, removeItem: function(k) { delete this._data[k]; },
            clear: function() { this._data = {}; }, key: function(i) { return Object.keys(this._data)[i] || null; },
            get length() { return Object.keys(this._data).length; } };
    }
    if (!window.sessionStorage) {
        window.sessionStorage = { _data: {}, getItem: function(k) { return this._data[k] || null; },
            setItem: function(k,v) { this._data[k] = v; }, removeItem: function(k) { delete this._data[k]; },
            clear: function() { this._data = {}; }, key: function(i) { return Object.keys(this._data)[i] || null; },
            get length() { return Object.keys(this._data).length; } };
    }

    // history
    history.pushState = n; history.replaceState = n;

    // Canvas stub — fingerprint SDKs need this
    var origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
        var el = origCreateElement(tag);
        var tagLower = (tag || '').toLowerCase();
        if (tagLower === 'canvas') {
            el.getContext = function(type) {
                if (type === '2d') return {
                    fillText: n, strokeText: n, fillRect: n, clearRect: n,
                    measureText: function(t) { return {width: t.length * 8}; },
                    getImageData: function(x,y,w,h) { return {data: new Uint8ClampedArray(w*h*4)}; },
                    createLinearGradient: function() { return {addColorStop: n}; },
                    createRadialGradient: function() { return {addColorStop: n}; },
                    canvas: {width: 300, height: 150},
                    font: '', textBaseline: '', textAlign: '',
                    fillStyle: '', strokeStyle: '',
                    beginPath: n, moveTo: n, lineTo: n, stroke: n, arc: n,
                    toDataURL: function(fmt) { return 'data:image/png;base64,iVBORw0KGgo='; },
                };
                if (type === 'webgl' || type === 'experimental-webgl') return {
                    getParameter: function(p) {
                        var m = {37445:'Google Inc.',37446:'ANGLE',7937:'WebKit',7938:'WebKit WebGL'};
                        return m[p];
                    },
                    getExtension: function() { return null; },
                    getShaderPrecisionFormat: function() { return {rangeMin:127,rangeMax:127,precision:23}; },
                };
                return null;
            };
        }
        return el;
    };

    window.__domStubsDone = true;
})();
""")

    # ── 获取 blackbox（同盾）──────────────────────────────────

    def _get_blackbox(self) -> str:
        """加载同盾 fm.js，通过 JSONP 生成 blackbox"""

        fm_js = (BASE_DIR / "fm.js").read_text("utf-8")

        # JSONP 桥接：拦截 document.createElement('script') 的 src 设置
        # 同盾 SDK 会动态创建 script 标签加载 JSONP URL
        html_page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>CSAir</title></head>
<body>
<script>
// ===== JSONP + XHR 桥接 =====
(function() {{
    window.__jsonpResults = [];
    window.__jsonpCount = 0;
    // Hook document.createElement for script JSONP
    var _origCE = document.createElement.bind(document);
    document.createElement = function(tag) {{
        var el = _origCE(tag);
        if ((tag || '').toLowerCase() === 'script') {{
            var _origSA = el.setAttribute ? el.setAttribute.bind(el) : function(){{}};
            el.setAttribute = function(name, value) {{
                if (name === 'src' && value && value.indexOf('fp.tongdun') >= 0) {{
                    window.__jsonpCount++;
                    var result = window.__pythonGet(value);
                    window.__jsonpResults.push({{url: value, len: result ? result.length : 0}});
                    if (result) {{
                        try {{ eval(result); }} catch(e) {{ window.__jsonpErr = String(e); }}
                    }}
                }}
                _origSA(name, value);
            }};
        }}
        return el;
    }};

    // XHR bridge (for any XHR calls in fm.js)
    (function() {{
        var OrigXHR = XMLHttpRequest;
        XMLHttpRequest = function() {{
            var xhr = new OrigXHR();
            var _m, _u, _h = {{}}, _b;
            var o = xhr.open; xhr.open = function(m,u,a) {{ _m=m; _u=u; o.call(xhr,m,u,a!==false); }};
            var s = xhr.setRequestHeader; xhr.setRequestHeader = function(n,v) {{ _h[n]=v; s.call(xhr,n,v); }};
            var d = xhr.send; xhr.send = function(b) {{
                _b = b;
                if (_u && window.__pythonPost) {{
                    var r = window.__pythonPost(_u, _b||'', JSON.stringify(_h));
                    try {{
                        var p = JSON.parse(r);
                        Object.defineProperty(xhr, 'status', {{value: p.status||200}});
                        Object.defineProperty(xhr, 'responseText', {{value: p.body||''}});
                        Object.defineProperty(xhr, 'response', {{value: p.body||''}});
                        Object.defineProperty(xhr, 'readyState', {{value: 4}});
                        if (xhr.onreadystatechange) xhr.onreadystatechange();
                        if (xhr.onload) xhr.onload();
                    }} catch(e) {{}}
                }} else {{ d.call(xhr, b); }}
            }};
            return xhr;
        }};
        XMLHttpRequest.DONE = 4; XMLHttpRequest.UNSENT = 0;
    }})();
}})();

// ===== 同盾 SDK 入口 =====
window._fmOpt = {{
    partner: '{TD_PARTNER}',
    appName: '{TD_APP_NAME}',
    success: function(data) {{
        window.__blackbox = data || '';
    }}
}};
</script>
<script src="/fm.js"></script>
</body></html>"""

        self._ctx.expose(
            {
                "baseURL": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
                "html": html_page,
                "headers": [],
                "resources": {
                    "/fm.js": fm_js,
                },
            },
            "snapshot",
        )
        self._ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")

        time.sleep(3)
        blackbox = str(self._ctx.eval("window.__blackbox || ''"))
        jsonp_count = self._ctx.eval("window.__jsonpCount || 0")
        print(f"  [同盾] JSONP calls: {jsonp_count}, blackbox len: {len(blackbox)}")
        return blackbox

    # ── 获取 deviceToken（阿里云飞林）─────────────────────────

    def _get_device_token(self) -> str:
        """加载阿里云飞林 fp.min.js，通过 XHR 生成 deviceToken"""

        fp_js = (BASE_DIR / "fp.min.js").read_text("utf-8")

        html_page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>CSAir</title></head>
<body>
<script>
// ===== XHR 桥接 =====
(function() {{
    var OrigXHR = XMLHttpRequest;
    XMLHttpRequest = function() {{
        var xhr = new OrigXHR();
        var _m, _u, _h = {{}}, _b;
        var o = xhr.open; xhr.open = function(m,u,a) {{ _m=m; _u=u; o.call(xhr,m,u,a!==false); }};
        var s = xhr.setRequestHeader; xhr.setRequestHeader = function(n,v) {{ _h[n]=v; s.call(xhr,n,v); }};
        var d = xhr.send; xhr.send = function(b) {{
            _b = b;
            if (_u && window.__pythonPost) {{
                var r = window.__pythonPost(_u, _b||'', JSON.stringify(_h));
                try {{
                    var p = JSON.parse(r);
                    Object.defineProperty(xhr, 'status', {{value: p.status||200}});
                    Object.defineProperty(xhr, 'responseText', {{value: p.body||''}});
                    Object.defineProperty(xhr, 'response', {{value: p.body||''}});
                    Object.defineProperty(xhr, 'readyState', {{value: 4}});
                    if (xhr.onreadystatechange) xhr.onreadystatechange();
                    if (xhr.onload) xhr.onload();
                }} catch(e) {{ window.__xhrErr = String(e); }}
            }} else {{ d.call(xhr, b); }}
        }};
        return xhr;
    }};
    XMLHttpRequest.DONE = 4; XMLHttpRequest.UNSENT = 0;
}})();
</script>
<script src="/fp.js"></script>
<script>
// ===== 阿里云飞林 SDK 初始化 =====
if (typeof ALIYUN_FP !== 'undefined') {{
    ALIYUN_FP.use('um', function(state, um) {{
        if (state === 'loaded') {{
            um.init({{
                appKey: '{ALIYUN_APP_KEY}',
                appName: '{ALIYUN_APP_NAME}'
            }}, function(initStatus) {{
                if (initStatus === 'success') {{
                    window.__deviceToken = um.getToken() || '';
                }} else {{
                    window.__umInitError = 'initStatus=' + initStatus;
                }}
            }});
        }} else {{
            window.__umLoadError = 'state=' + state;
        }}
    }});
}} else {{
    window.__fpError = 'ALIYUN_FP not defined';
}}
</script>
</body></html>"""

        self._ctx.expose(
            {
                "baseURL": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
                "html": html_page,
                "headers": [],
                "resources": {
                    "/fp.js": fp_js,
                },
            },
            "snapshot",
        )
        self._ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")

        time.sleep(5)
        device_token = str(self._ctx.eval("window.__deviceToken || ''"))
        fp_error = str(self._ctx.eval("window.__fpError || window.__umInitError || window.__umLoadError || 'none'"))
        print(f"  [阿里云] deviceToken len: {len(device_token)}, error: {fp_error}")
        return device_token

    # ── 公开接口 ──────────────────────────────────────────────

    def get_tokens(self) -> dict:
        """获取 blackbox 和 deviceToken"""
        self._build_environment()
        self._setup_dom_stubs()

        # 注册 HTTP 桥接函数
        self._ctx.locals["__pythonGet"] = self._http_get
        self._ctx.locals["__pythonPost"] = self._http_post

        # 先获取 deviceToken（阿里云，纯 XHR）
        print("[1/2] 获取 deviceToken (阿里云飞林)...")
        device_token = self._get_device_token()

        # 再获取 blackbox（同盾，JSONP）
        print("[2/2] 获取 blackbox (同盾)...")
        blackbox = self._get_blackbox()

        return {
            "blackbox": blackbox,
            "deviceToken": device_token,
        }

    def close(self):
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass
            self._ctx = None


# ===== 命令行测试 =====
if __name__ == "__main__":
    print("南航设备指纹生成器 (iv8 page.load)")
    print("=" * 50)

    dev = CsairDevice()
    try:
        tokens = dev.get_tokens()
        print()
        print(f"blackbox:    {tokens['blackbox'][:80]}... ({len(tokens['blackbox'])} chars)")
        print(f"deviceToken: {tokens['deviceToken'][:80]}... ({len(tokens['deviceToken'])} chars)")
        print()
        print("HTTP requests made:")
        for r in dev._requests_log:
            print(f"  {r}")
    finally:
        dev.close()
