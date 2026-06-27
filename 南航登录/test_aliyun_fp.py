"""
Test: Aliyun FP deviceToken generation in iv8
Minimal test — just load fp.min.js and see what it needs
"""
import json
import iv8
import requests as py_requests
import urllib3
urllib3.disable_warnings()

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36"

ctx = iv8.JSContext(
    environment={
        "location": {
            "href": "https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html",
            "origin": "https://b2c.csair.com",
            "protocol": "https:",
            "host": "b2c.csair.com",
            "hostname": "b2c.csair.com",
            "port": "",
            "pathname": "/B2C40/modules/bookingnew/manage/login.html",
            "search": "",
            "hash": "",
        },
        "window": {"origin": "https://b2c.csair.com"},
        "navigator": {
            "userAgent": UA,
            "platform": "Win32",
            "webdriver": False,
            "languages": ["zh-CN", "zh"],
            "language": "zh-CN",
        },
        "screen": {"width": 1920, "height": 1080},
    },
    config={"timezone": "Asia/Shanghai"},
)
ctx.__enter__()

# XHR bridge
def xhr_bridge(method, url, headers_json, body):
    try:
        h = json.loads(headers_json) if headers_json else {}
        h.setdefault("User-Agent", UA)
        if method == "GET":
            r = py_requests.get(url, headers=h, timeout=15, verify=False)
        elif method == "POST":
            r = py_requests.post(url, headers=h, data=body or None, timeout=15, verify=False)
        else:
            r = py_requests.request(method, url, headers=h, data=body or None, timeout=15, verify=False)
        return json.dumps({"status": r.status_code, "statusText": r.reason, "body": r.text[:10000]})
    except Exception as e:
        return json.dumps({"status": 0, "statusText": str(e)[:200], "body": ""})

# XHR hook
ctx.eval("""\
window.__xhrBridge = true;
(function() {
    var OrigXHR = XMLHttpRequest;
    XMLHttpRequest = function() {
        var xhr = new OrigXHR();
        var _method, _url, _headers = {}, _body = null;
        var o = xhr.open; xhr.open = function(m,a,b) { _method=m; _url=a; o.call(xhr,m,a,b!==false); };
        var s = xhr.setRequestHeader; xhr.setRequestHeader = function(n,v) { _headers[n]=v; s.call(xhr,n,v); };
        var d = xhr.send; xhr.send = function(b) {
            _body = b;
            if (window.__pythonXhr) {
                var r = window.__pythonXhr(_method, _url, JSON.stringify(_headers), _body||'');
                try {
                    var p = JSON.parse(r);
                    Object.defineProperty(xhr, 'status', {value: p.status||200});
                    Object.defineProperty(xhr, 'responseText', {value: p.body||''});
                    Object.defineProperty(xhr, 'response', {value: p.body||''});
                    Object.defineProperty(xhr, 'readyState', {value: 4});
                    if (xhr.onreadystatechange) xhr.onreadystatechange();
                    if (xhr.onload) xhr.onload();
                } catch(e) {
                    Object.defineProperty(xhr, 'status', {value: 0});
                    Object.defineProperty(xhr, 'readyState', {value: 4});
                    if (xhr.onerror) xhr.onerror();
                }
            } else { d.call(xhr, b); }
        };
        return xhr;
    };
    XMLHttpRequest.DONE = 4; XMLHttpRequest.UNSENT = 0;
})();
""")

ctx.locals["__pythonXhr"] = xhr_bridge

# Load fp.min.js
print("Loading fp.min.js...")
fp_js = open("fp.min.js", encoding="utf-8").read()
ctx.eval(fp_js)

# Check what's available
print(f"ALIYUN_FP: {ctx.eval('typeof window.ALIYUN_FP')}")
print(f"ALIYUN_FP type: {ctx.eval('typeof window.ALIYUN_FP || typeof ALIYUN_FP')}")

# Try to initialize
ctx.eval("""\
window.__umToken = '';
window.__umStatus = 'init';

if (typeof ALIYUN_FP !== 'undefined') {
    try {
        ALIYUN_FP.use('um', function(state, um) {
            window.__umStatus = state;
            if (state === 'loaded') {
                um.init({
                    appKey: 'shabe02f03hs4764a06e085542539a06',
                    appName: 'b2c'
                }, function(initStatus) {
                    window.__umInitStatus = initStatus;
                    if (initStatus === 'success') {
                        window.__umToken = um.getToken() || '';
                    }
                });
            }
        });
    } catch(e) {
        window.__umError = String(e);
    }
}
""")

import time
time.sleep(3)

print(f"um status: {ctx.eval('window.__umStatus')}")
print(f"um init status: {ctx.eval('window.__umInitStatus || \"not_set\"')}")
print(f"um token: {ctx.eval('window.__umToken || \"empty\"')[:80]}")
print(f"um error: {ctx.eval('window.__umError || \"none\"')}")

# Check network requests that were made
print(f"\nXHR calls made: checking...")

ctx.__exit__(None, None, None)
