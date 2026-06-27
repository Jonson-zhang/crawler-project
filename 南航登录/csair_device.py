"""
南航设备指纹生成 — iv8 page.load() 方案

参考 CSDN 文章思路：
  1. iv8 page.load() 加载单个 HTML 页面，内含两个 SDK
  2. document.createElement('script') hook → 拦截 JSONP
  3. XHR hook → 拦截 XMLHttpRequest 通过 Python 发包
  4. 同盾 fm.js → window._fmOpt.success(data) → blackbox
  5. 阿里云飞林 fp.min.js → ALIYUN_FP.use('um') → um.getToken() → deviceToken

修复早期踩坑：
  - page.load() 每次都重置环境，必须一个 HTML 加载所有 JS
  - iv8 Worker/Blob 必须先 stub 再加载 SDK
  - 阿里云 XHR 返回 body 要完整（不能截断）
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
        self._requests = []

    # ── Python HTTP bridge ────────────────────────────────────

    def _py_get(self, url: str) -> str:
        """JSONP GET request"""
        try:
            r = py_requests.get(url, headers={"User-Agent": UA}, timeout=20, verify=False)
            self._requests.append(f"GET:{url[:100]} -> {r.status_code} {len(r.text)}B")
            return r.text
        except Exception as e:
            self._requests.append(f"GET:{url[:100]} -> ERR:{e}")
            return ""

    def _py_post(self, url: str, body: str, hdr_json: str) -> str:
        """XHR POST request"""
        try:
            h = json.loads(hdr_json) if hdr_json else {}
            h.setdefault("User-Agent", UA)
            h.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            r = py_requests.post(url, headers=h, data=body or None, timeout=20, verify=False)
            self._requests.append(f"POST:{url[:60]} -> {r.status_code} {len(r.text)}B")
            return json.dumps({"status": r.status_code, "body": r.text})
        except Exception as e:
            self._requests.append(f"POST:{url[:60]} -> ERR:{e}")
            return json.dumps({"status": 0, "body": ""})

    # ── Build single HTML page loading both SDKs ───────────────

    def get_tokens(self) -> dict:
        fm_js = (BASE_DIR / "fm.js").read_text("utf-8")
        fp_js = (BASE_DIR / "fp.min.js").read_text("utf-8")

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>CSAir</title></head>
<body>
<script>
// ============ 1. Browser API Stubs ============
(function() {{
    var N = function(){{}};

    // Worker stub
    window.Worker = function(url) {{
        this.onmessage = N; this.onerror = N;
        this.postMessage = function(d) {{
            var s = this;
            setTimeout(function(){{ if(typeof s.onmessage==="function") s.onmessage({{data:{{}}}}); }}, 20);
        }};
        this.terminate = N;
    }};
    window.Blob = function(p) {{ this.parts = p; this.size = p.join('').length; }};
    window.URL = window.URL || {{}};
    window.URL.createObjectURL = function() {{ return 'blob:s-'+Math.random(); }};
    window.URL.revokeObjectURL = N;
    if(typeof btoa==='undefined') window.btoa = function(s){{return s;}};
    if(typeof atob==='undefined') window.atob = function(s){{return s;}};

    // Performance
    if(!performance.timing) {{
        var now = Date.now();
        performance.timing = {{ navigationStart:now, fetchStart:now, domainLookupStart:now,
            domainLookupEnd:now, connectStart:now, connectEnd:now, requestStart:now,
            responseStart:now, responseEnd:now, domLoading:now, domInteractive:now,
            domContentLoadedEventStart:now, domContentLoadedEventEnd:now,
            domComplete:now, loadEventStart:now, loadEventEnd:now }};
    }}

    // localStorage
    if(!window.localStorage) {{
        var d={{}}; window.localStorage={{ getItem:function(k){{return d[k]||null}},
        setItem:function(k,v){{d[k]=v}}, removeItem:function(k){{delete d[k]}},
        clear:function(){{d={{}}}}, key:function(i){{return Object.keys(d)[i]||null}},
        get length(){{return Object.keys(d).length;}} }};
    }}
    if(!window.sessionStorage) {{
        var s={{}}; window.sessionStorage={{ getItem:function(k){{return s[k]||null}},
        setItem:function(k,v){{s[k]=v}}, removeItem:function(k){{delete s[k]}},
        clear:function(){{s={{}}}}, key:function(i){{return Object.keys(s)[i]||null}},
        get length(){{return Object.keys(s).length;}} }};
    }}
    history.pushState = N; history.replaceState = N;

    // Canvas
    var _origCE = document.createElement.bind(document);
    document.createElement = function(tag) {{
        var el = _origCE(tag);
        if((tag||'').toLowerCase()==='canvas') {{
            el.getContext = function(type) {{
                if(type==='2d') return {{
                    fillText:N, strokeText:N, fillRect:N, clearRect:N,
                    measureText:function(t){{return {{width:t.length*8}};}},
                    getImageData:function(x,y,w,h){{return {{data:new Uint8ClampedArray(w*h*4)}};}},
                    createLinearGradient:function(){{return {{addColorStop:N}};}},
                    canvas:{{width:300,height:150}}, font:'', fillStyle:'', strokeStyle:'',
                    beginPath:N, moveTo:N, lineTo:N, stroke:N, arc:N,
                    toDataURL:function(){{return 'data:image/png;base64,test';}},
                }};
                if(type==='webgl'||type==='experimental-webgl') return {{
                    getParameter:function(p){{return {{37445:'Google Inc.'}}[p];}},
                    getExtension:function(){{return null;}},
                }};
                return null;
            }};
        }}
        return el;
    }};
}})();

// ============ 2. JSONP + XHR Bridge ============
(function() {{
    // JSONP: intercept script.src assignment for tongdun.net
    var _origCE2 = document.createElement.bind(document);
    document.createElement = function(tag) {{
        var el = _origCE2(tag);
        if((tag||'').toLowerCase()==='script') {{
            var _origSA = el.setAttribute ? el.setAttribute.bind(el) : function(){{}};
            el.setAttribute = function(name, value) {{
                if(name==='src' && typeof value==='string' && window.__pythonGet) {{
                    var result = window.__pythonGet(value);
                    if(result) {{
                        try{{ eval(result); }}catch(e){{ window.__jsonpErr=String(e).substring(0,200); }}
                    }}
                }}
                return _origSA(name, value);
            }};
        }}
        return el;
    }};

    // XHR bridge
    var _OrigXHR = XMLHttpRequest;
    XMLHttpRequest = function() {{
        var xhr = new _OrigXHR(), _m, _u, _hdrs={{}}, _body;
        var o = xhr.open; xhr.open = function(m,u,a) {{ _m=m; _u=u; o.call(xhr,m,u,a!==false); }};
        var sh = xhr.setRequestHeader; xhr.setRequestHeader = function(n,v) {{ _hdrs[n]=v; sh.call(xhr,n,v); }};
        var sd = xhr.send; xhr.send = function(b) {{
            _body = b;
            if(_u && window.__pythonPost) {{
                var resp = window.__pythonPost(_u, _body||'', JSON.stringify(_hdrs));
                try {{
                    var p = JSON.parse(resp);
                    Object.defineProperty(xhr,'status',{{value:p.status||200}});
                    Object.defineProperty(xhr,'responseText',{{value:p.body||''}});
                    Object.defineProperty(xhr,'response',{{value:p.body||''}});
                    Object.defineProperty(xhr,'readyState',{{value:4}});
                }} catch(e) {{ window.__xhrErr = String(e).substring(0,200); }}
            }} else {{ sd.call(xhr, b); }}
            if(xhr.onreadystatechange) xhr.onreadystatechange();
            if(xhr.onload) xhr.onload();
            if(xhr.onloadend) xhr.onloadend();
        }};
        return xhr;
    }};
    XMLHttpRequest.DONE = 4; XMLHttpRequest.UNSENT = 0;
}})();

// ============ 3. Load Tongdun (同盾) ============
window._fmOpt = {{
    partner: '{TD_PARTNER}',
    appName: '{TD_APP_NAME}',
    success: function(data) {{ window.__blackbox = data || ''; }}
}};
</script>
<script src="/fm.js"></script>

<script>
// ============ 4. Load Aliyun FP ============
</script>
<script src="/fp.js"></script>
<script>
if(typeof ALIYUN_FP !== 'undefined') {{
    ALIYUN_FP.use('um', function(state, um) {{
        window.__umState = state;
        if(state === 'loaded') {{
            um.init({{
                appKey: '{ALIYUN_APP_KEY}',
                appName: '{ALIYUN_APP_NAME}'
            }}, function(s) {{
                window.__umInit = s;
                if(s === 'success') {{
                    window.__deviceToken = um.getToken() || '';
                }}
            }});
        }}
    }});
}} else {{
    window.__fpErr = 'ALIYUN_FP not defined';
}}
</script>
</body></html>"""

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
        self._ctx.locals["__pythonGet"] = self._py_get
        self._ctx.locals["__pythonPost"] = self._py_post

        self._ctx.expose(
            {
                "baseURL": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
                "html": html,
                "headers": [],
                "resources": {
                    "/fm.js": fm_js,
                    "/fp.js": fp_js,
                },
            },
            "snapshot",
        )

        print("Loading page with both SDKs...")
        self._ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")

        # Wait for async callbacks
        time.sleep(8)

        result = {
            "blackbox": str(self._ctx.eval("window.__blackbox || ''")),
            "deviceToken": str(self._ctx.eval("window.__deviceToken || ''")),
        }

        # Debug info
        fp_err = str(self._ctx.eval(
            "window.__fpErr || window.__umInit || window.__umState || 'N/A'"
        ))
        jsonp_err = str(self._ctx.eval("window.__jsonpErr || 'none'"))
        xhr_err = str(self._ctx.eval("window.__xhrErr || 'none'"))
        print(f"  FP state: {fp_err}, JSONP err: {jsonp_err}, XHR err: {xhr_err}")
        print(f"  blackbox: {len(result['blackbox'])} chars")
        print(f"  deviceToken: {len(result['deviceToken'])} chars")
        for r in self._requests:
            print(f"  HTTP: {r}")

        return result

    def close(self):
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass
            self._ctx = None


if __name__ == "__main__":
    print("南航设备指纹 (iv8 page.load)")
    print("=" * 50)
    dev = CsairDevice()
    try:
        tokens = dev.get_tokens()
        print(f"\nblackbox: {tokens['blackbox'][:80]}...")
        print(f"deviceToken: {tokens['deviceToken'][:80]}...")
    finally:
        dev.close()
