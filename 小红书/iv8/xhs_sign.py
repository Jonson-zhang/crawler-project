"""
小红书 x-s 签名 — iv8 方案

替代 sign.js + env.js + Node.js。

sign() 直接接受 cookie_str 参数，消除 set_cookie 销毁/重建竞态。

用法:
  from xhs_sign import XhsSigner
  signer = XhsSigner()
  x_s = signer.sign("/api/sns/web/v1/homefeed", {"num": 20},
                     cookie_str="a1=...; webId=...")
"""
import hashlib
import json
import urllib.parse
from pathlib import Path

import iv8

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)
B64_CHARS = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"


def _b64e(data: bytes) -> str:
    n, m, r = len(data), len(data) % 3, []
    for i in range(0, n - m, 16383):
        limit = min(i + 16383, n - m)
        for j in range(i, limit, 3):
            t = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            r.append(B64_CHARS[(t >> 18) & 63] + B64_CHARS[(t >> 12) & 63]
                     + B64_CHARS[(t >> 6) & 63] + B64_CHARS[t & 63])
    if m == 1:
        b = data[n - 1]
        r.append(B64_CHARS[b >> 2] + B64_CHARS[(b << 4) & 63] + "==")
    elif m == 2:
        p = (data[n - 2] << 8) + data[n - 1]
        r.append(B64_CHARS[p >> 10] + B64_CHARS[(p >> 4) & 63]
                 + B64_CHARS[(p << 2) & 63] + "=")
    return "".join(r)


def _json_to_bytes(obj: dict) -> bytes:
    s = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    e = urllib.parse.quote(s, safe="~()*!./:?=&-_")
    result, i = bytearray(), 0
    while i < len(e):
        if e[i] == "%":
            result.append(int(e[i + 1 : i + 3], 16))
            i += 3
        else:
            result.append(ord(e[i]))
            i += 1
    return bytes(result)


class XhsSigner:
    """小红书 X-s 签名器 — iv8 C++ V8 引擎

    签名时直接传入 cookie_str，每次签名确保 V8 环境中的 document.cookie
    与实际 HTTP cookie 一致。无需 set_cookie / close / 重建 Context。
    """

    def __init__(self):
        p = BASE_DIR / "ds_script.js"
        if not p.exists():
            raise FileNotFoundError(f"ds_script.js not found: {p}")
        self._ds_script = p.read_text("utf-8")
        self._ds_api = (DATA_DIR / "ds_api.js").read_text("utf-8")
        self._ds_v2 = (DATA_DIR / "ds_v2.js").read_text("utf-8")
        self._ctx = None
        self._last_cookie = "\x00"  # sentinel — force rebuild on first call

    def _build_context(self, cookie_str: str):
        """构建 V8 Context，注入 cookie 到 document.cookie getter"""
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass

        self._ctx = iv8.JSContext(
            environment={
                "location": {
                    "href": "https://www.xiaohongshu.com/",
                    "origin": "https://www.xiaohongshu.com",
                    "protocol": "https:",
                    "host": "www.xiaohongshu.com",
                    "hostname": "www.xiaohongshu.com",
                    "port": "",
                    "pathname": "/",
                    "search": "",
                    "hash": "",
                },
                "window": {"origin": "https://www.xiaohongshu.com"},
                "navigator": {
                    "userAgent": UA,
                    "platform": "Win32",
                    "webdriver": False,
                },
                "screen": {"width": 1920, "height": 1080},
            },
            config={"timezone": "Asia/Shanghai"},
        )
        self._ctx.__enter__()

        # ① DOM stubs + cookie getter + performance
        self._ctx.eval(f"""\
(function(){{var n=function(){{}};
document.getElementsByTagName=function(){{return[]}};
document.querySelector=function(){{return null}};
document.getElementById=function(){{return null}};
document.addEventListener=n;document.removeEventListener=n;
document.getElementsByClassName=function(){{return[]}};
document.createElement=function(t){{return{{tagName:(t||'').toUpperCase(),style:{{}},
  appendChild:n,removeChild:n,setAttribute:n,getAttribute:function(){{return null}},
  children:[],childNodes:[],parentNode:null,offsetWidth:1920,offsetHeight:1080}}}};
try{{Object.defineProperty(document,'body',{{get:function(){{return document.createElement('body')}},configurable:true}})}}catch(e){{}}
try{{Object.defineProperty(document,'documentElement',{{get:function(){{return document.createElement('html')}},configurable:true}})}}catch(e){{}}
try{{Object.defineProperty(document,'head',{{get:function(){{return document.createElement('head')}},configurable:true}})}}catch(e){{}}
performance.now=function(){{return Date.now()}};
// Override document.cookie — exact value, no C++ parser interference
window.__cookieStr={json.dumps(cookie_str)};
Object.defineProperty(document,'cookie',{{
    get:function(){{return window.__cookieStr;}},
    set:function(v){{}},
    configurable:true
}});
}})();""")

        # ② IIFE ds_script (module scope isolation)
        self._ctx.eval("(function(){" + self._ds_script + "})();")
        if self._ctx.eval("typeof window._AUuXfEG27Xa3x") != "function":
            raise RuntimeError("VMP init failed: _AUuXfEG27Xa3x")

        # ③ MutationObserver
        self._ctx.eval(
            "window.MutationObserver=function(){"
            "this.observe=function(){};this.disconnect=function(){};};")

        # ④ ds_api
        self._ctx.eval(self._ds_api)

        # ⑤ VMP setter interception
        self._ctx.eval("""(function(){
Object.getOwnPropertyNames(window).forEach(function(n){try{
  var v=window[n];if(typeof v!=='function'||v.toString().length<=100000)return;
  var _ra,_oa=v;
  Object.defineProperty(window,n,{
    get:function(){return _ra||_oa},
    set:function(fn){
      if(typeof fn==='function'&&fn.toString().length>100000){
        _ra=function(bc,env){for(var j=0;j<200;j++){if(env[j]===undefined){var s=function(){};s.prototype={};env[j]=s}}return fn.call(window,bc,env)};
      }else{_oa=fn}
    },
    configurable:true,enumerable:true
  });
}catch(e){}});
})();""")

        # ⑥ ds_v2 (VMP upgrade)
        self._ctx.eval(self._ds_v2)

        if self._ctx.eval("typeof window.mnsv2") != "function":
            raise RuntimeError("mnsv2 not created, VMP upgrade failed")

        self._last_cookie = cookie_str

    def sign(self, url: str, body: dict | None = None,
             cookie_str: str = "") -> str:
        """计算 X-s 签名值。

        Args:
            url: API 路径
            body: POST body
            cookie_str: 当前生效的 cookie 字符串（与 env.js document.cookie 对齐）
        """
        # Rebuild V8 Context if cookie changed (e.g., boot adds gid)
        if cookie_str != self._last_cookie:
            self._build_context(cookie_str)

        body_str = (
            json.dumps(body, separators=(",", ":"), ensure_ascii=False)
            if body is not None else ""
        )
        c = url + body_str
        md5_c = hashlib.md5(c.encode()).hexdigest()
        md5_url = hashlib.md5(url.encode()).hexdigest()
        h = str(self._ctx.eval(
            f"window.mnsv2({json.dumps(c)},{json.dumps(md5_c)},{json.dumps(md5_url)})"
        ))
        x4 = "object" if body is not None else ""
        return "XYS_" + _b64e(_json_to_bytes(
            {"x0": "4.3.5", "x1": "xhs-pc-web", "x2": "Windows",
             "x3": h, "x4": x4}
        ))

    def close(self):
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass
            self._ctx = None

    def __del__(self):
        self.close()


if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "/api/sns/web/v1/homefeed"
    body = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
    print(f"URL: {url}")
    print(f"body: {json.dumps(body, ensure_ascii=False) if body else '(empty)'}")
    s = XhsSigner()
    try:
        xs = s.sign(url, body, cookie_str="a1=test;webId=test")
        print(f"x-s: {xs[:80]}...")
        print(f"len: {len(xs)}")
    finally:
        s.close()
