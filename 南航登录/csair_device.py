"""
南航设备指纹生成 — iv8 page.load() 方案

参考 CSDN 文章思路。单个 HTML 页面加载两个 SDK。
"""
import json, time
from pathlib import Path
import iv8, requests as py_requests, urllib3
urllib3.disable_warnings()

BASE_DIR = Path(__file__).parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36"
TD_PARTNER, TD_APP = "csair2", "quanyi_web"
ALI_KEY, ALI_APP = "shabe02f03hs4764a06e085542539a06", "b2c"


class CsairDevice:
    def __init__(self):
        self._ctx = None; self._requests = []

    def _py_get(self, url: str) -> str:
        try:
            r = py_requests.get(url, headers={"User-Agent": UA}, timeout=20, verify=False)
            self._requests.append(f"GET {url[:80]} -> {r.status_code} {len(r.text)}B")
            return r.text
        except Exception as e:
            self._requests.append(f"GET {url[:80]} -> ERR {e}")
            return ""

    def _py_post(self, url: str, body: str, hdr_json: str) -> str:
        try:
            h = json.loads(hdr_json) if hdr_json else {}
            h.setdefault("User-Agent", UA)
            r = py_requests.post(url, headers=h, data=body or None, timeout=20, verify=False)
            self._requests.append(f"POST {url[:60]} -> {r.status_code} {len(r.text)}B")
            return json.dumps({"status": r.status_code, "body": r.text})
        except Exception as e:
            self._requests.append(f"POST {url[:60]} -> ERR {e}")
            return json.dumps({"status": 0, "body": ""})

    def get_tokens(self) -> dict:
        fm_js = (BASE_DIR / "fm.js").read_text("utf-8")
        fp_js = (BASE_DIR / "fp.min.js").read_text("utf-8")

        html = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>CSAir</title></head><body>
<script>
(function(){{
var N=function(){{}};

// Worker stub
window.Worker=function(url){{this.onmessage=N;this.onerror=N;this.postMessage=function(d){{var
t=this;setTimeout(function(){{if(typeof t.onmessage==='function')t.onmessage({{data:{{}}}});}},30);}};this.terminate=N;}};
window.Blob=function(p){{this.parts=p;}};
window.URL=window.URL||{{}};window.URL.createObjectURL=function(){{return'blob:1';}};window.URL.revokeObjectURL=N;
if(typeof btoa==='undefined')window.btoa=function(s){{return s;}};
if(typeof atob==='undefined')window.atob=function(s){{return s;}};

// Performance timing
var now=Date.now();
performance.timing={{navigationStart:now,fetchStart:now,domainLookupStart:now,domainLookupEnd:now,connectStart:now,connectEnd:now,requestStart:now,responseStart:now,responseEnd:now,domLoading:now,domInteractive:now,domContentLoadedEventStart:now,domContentLoadedEventEnd:now,domComplete:now,loadEventStart:now,loadEventEnd:now}};

// localStorage
var ld={{}};window.localStorage={{getItem:function(k){{return ld[k]||null;}},setItem:function(k,v){{ld[k]=v;}},removeItem:function(k){{delete ld[k];}},clear:function(){{ld={{}};}},get length(){{return Object.keys(ld).length;}}}};
history.pushState=N;history.replaceState=N;

// ===== COMBINED document.createElement (canvas + script JSONP) =====
var _origCreate = document.createElement.bind(document);
document.createElement = function(tag) {{
    var el = _origCreate(tag);
    var t = (tag||'').toLowerCase();

    // Canvas stub
    if (t === 'canvas') {{
        el.getContext = function(type) {{
            if (type==='2d') return {{
                fillText:N,strokeText:N,fillRect:N,clearRect:N,measureText:function(t){{return{{width:t.length*8}};}},
                getImageData:function(){{return{{data:new Uint8ClampedArray(600)}};}},
                createLinearGradient:function(){{return{{addColorStop:N}};}},canvas:{{width:300,height:150}},font:'',
                fillStyle:'',strokeStyle:'',beginPath:N,moveTo:N,lineTo:N,stroke:N,arc:N,
                toDataURL:function(){{return'data:image/png;base64,test';}},}};
            if (type==='webgl'||type==='experimental-webgl') return {{
                getParameter:function(){{return'Google Inc.';}},getExtension:function(){{return null;}},}};
            return null;
        }};
    }}

    // Script JSONP hook
    if (t === 'script') {{
        var _origSA = el.setAttribute ? el.setAttribute.bind(el) : function() {{}};
        el.setAttribute = function(name, value) {{
            if (name==='src' && typeof value==='string' && window.__pythonGet) {{
                var r = window.__pythonGet(value);
                if (r) {{ try {{ eval(r); }} catch(e) {{ window.__jsonpErr = String(e).substring(0,200); }} }}
            }}
            return _origSA(name, value);
        }};
    }}
    return el;
}};

// ===== XHR Bridge =====
(function(){{
    var OX = XMLHttpRequest;
    XMLHttpRequest = function() {{
        var x = new OX(), _m, _u, _h={{}}, _b, _called=false;
        var oo = x.open; x.open = function(m,u,a) {{ _m=m; _u=u; oo.call(x,m,u,a!==false); }};
        var sh = x.setRequestHeader; x.setRequestHeader = function(n,v) {{ _h[n]=v; sh.call(x,n,v); }};
        var sd = x.send; x.send = function(b) {{
            if (_called) return; _called = true;
            _b = b;
            if (_u && window.__pythonPost) {{
                var r = window.__pythonPost(_u, _b||'', JSON.stringify(_h));
                try {{
                    var p = JSON.parse(r);
                    Object.defineProperty(x,'status',{{value:p.status||200}});
                    Object.defineProperty(x,'responseText',{{value:p.body||''}});
                    Object.defineProperty(x,'response',{{value:p.body||''}});
                    Object.defineProperty(x,'readyState',{{value:4}});
                }} catch(e) {{ window.__xhrErr = String(e).substring(0,200); }}
            }} else {{ sd.call(x, b); }}
            if(x.onreadystatechange) x.onreadystatechange();
            if(x.onload) x.onload();
            if(x.onloadend) x.onloadend();
        }};
        return x;
    }};
    XMLHttpRequest.DONE = 4;
}})();
}})();

// ===== Tongdun (blackbox) =====
window._fmOpt = {{ partner:'{TD_PARTNER}', appName:'{TD_APP}',
    success: function(data) {{ window.__blackbox = data || ''; }} }};
</script>
<script src="/fm.js"></script>

<script>
// ===== Aliyun FP (deviceToken) =====
</script>
<script src="/fp.js"></script>
<script>
if (typeof ALIYUN_FP !== 'undefined') {{
    ALIYUN_FP.use('um', function(state, um) {{
        window.__umState = state;
        if (state === 'loaded') {{
            um.init({{ appKey:'{ALI_KEY}', appName:'{ALI_APP}' }}, function(s) {{
                window.__umInit = s;
                if (s === 'success') window.__deviceToken = um.getToken() || '';
            }});
        }}
    }});
}} else {{ window.__fpErr = 'ALIYUN_FP undef'; }}
</script>
</body></html>"""

        self._ctx = iv8.JSContext(
            environment={
                "location": {"href": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
                    "origin": "https://b2c.csair.com","protocol":"https:","host":"b2c.csair.com",
                    "hostname":"b2c.csair.com","port":"","pathname":"/B2C40/modules/bookingnew/manage/login.html","search":"","hash":""},
                "window": {"origin": "https://b2c.csair.com"},
                "navigator": {"userAgent":UA,"platform":"Win32","webdriver":False,"languages":["zh-CN","zh"],"language":"zh-CN","hardwareConcurrency":8},
                "screen": {"width":1920,"height":1080},
            },
            config={"timezone": "Asia/Shanghai"},
        )
        self._ctx.__enter__()
        # iv8 can't convert bound methods — use lambda wrappers
        _get = self._py_get
        _post = self._py_post
        self._ctx.locals["__pythonGet"] = lambda url, get=_get: get(url)
        self._ctx.locals["__pythonPost"] = lambda url, body, hdr, post=_post: post(url, body, hdr)

        self._ctx.expose({
            "baseURL": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
            "html": html, "headers": [],
            "resources": {"/fm.js": fm_js, "/fp.js": fp_js},
        }, "snapshot")

        print("page.load()...")
        self._ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")
        time.sleep(8)

        result = {
            "blackbox": str(self._ctx.eval("window.__blackbox || ''")),
            "deviceToken": str(self._ctx.eval("window.__deviceToken || ''")),
        }
        info = {
            "fpErr": str(self._ctx.eval("window.__fpErr || 'N/A'")),
            "umState": str(self._ctx.eval("window.__umState || 'none'")),
            "umInit": str(self._ctx.eval("window.__umInit || 'none'")),
            "jsonpErr": str(self._ctx.eval("window.__jsonpErr || 'none'")),
            "xhrErr": str(self._ctx.eval("window.__xhrErr || 'none'")),
        }
        print(f"  Info: {info}")
        for r in self._requests: print(f"  HTTP: {r}")
        print(f"  blackbox: {len(result['blackbox'])} chars, deviceToken: {len(result['deviceToken'])} chars")
        return result

    def close(self):
        if self._ctx is not None:
            try: self._ctx.__exit__(None, None, None)
            except: pass
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
