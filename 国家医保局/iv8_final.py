"""
国家医保局 — iv8 加密服务器
============================
iv8 (C++ V8) 替代 jsdom，直接使用内部 SM4 函数加密。

用法:
  python iv8_final.py status
  python iv8_final.py encrypt '{"keyword":"医院","pageNum":1,"pageSize":10}'
  python iv8_final.py serve    # JSON-RPC stdin/stdout
"""
import sys, json, time, random, string, hashlib, base64, subprocess
from pathlib import Path

try:
    import iv8
except ImportError:
    sys.exit("pip install iv8")

HERE = Path(__file__).parent

# ═══════════════════════════════════════════════════════════
# Bridge — 修补 iv8 原生 document（已验证通过 v2）
# ═══════════════════════════════════════════════════════════
BRIDGE = r"""
(function() {
    var _origCE = document.createElement;
    document.createElement = function(tag) {
        try { return _origCE.call(document, tag); } catch(e) {}
        return {
            style:{}, children:[], tagName:(tag||'div').toUpperCase(),
            setAttribute:function(){return this;}, getAttribute:function(){return null;},
            appendChild:function(c){return c;}, removeChild:function(){},
            addEventListener:function(){}, removeEventListener:function(){},
            querySelector:function(){return null;}, querySelectorAll:function(){return [];},
            getBoundingClientRect:function(){return{left:0,top:0,width:0,height:0};},
            getElementsByTagName:function(){return[];},
            getElementsByClassName:function(){return[];},
            insertBefore:function(){}, remove:function(){},
        };
    };
    if (document.createEvent) {
        var _origCev = document.createEvent;
        document.createEvent = function(type) {
            try { return _origCev.call(document, type); } catch(e) { return {initEvent:function(){}}; }
        };
    }
    document.querySelector = document.querySelector || function(){return null;};
    document.querySelectorAll = document.querySelectorAll || function(){return [];};
    document.getElementById = document.getElementById || function(){return null;};
    document.getElementsByTagName = document.getElementsByTagName || function(){return [];};
    document.getElementsByClassName = document.getElementsByClassName || function(){return [];};
    document.addEventListener = document.addEventListener || function(){};
    document.removeEventListener = document.removeEventListener || function(){};
    document.createElementNS = document.createElementNS || function(ns,tag){return document.createElement(tag);};
    document.createTextNode = document.createTextNode || function(){return{};};
    document.createComment = document.createComment || function(){return{};};
    document.documentElement = document.documentElement || document.createElement('html');
    document.body = document.body || document.createElement('body');
    document.head = document.head || document.createElement('head');
    document.cookie = document.cookie || '';

    window.location = {
        href:'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
        host:'fuwu.nhsa.gov.cn',hostname:'fuwu.nhsa.gov.cn',
        protocol:'https:',origin:'https://fuwu.nhsa.gov.cn',
        pathname:'/nationalHallSt/',search:'',hash:'#/search/medical',
        port:'',assign:function(){},replace:function(){},reload:function(){},
    };
    if (!navigator.platform) navigator.platform='Win32';
    navigator.serviceWorker={register:function(){return Promise.resolve({});},ready:Promise.resolve({})};
    window.screen={width:1920,height:1080};
    window.innerWidth=1920;window.innerHeight=1080;
    window.parent=window;window.top=window;window.self=window;
    window.crypto={
        getRandomValues:function(arr){for(var i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256);return arr;},
        subtle:{},
    };
    var _chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    window.atob=function(s){var o='',i=0;while(i<s.length){var e=_chars.indexOf(s[i++]),n=_chars.indexOf(s[i++]),h=_chars.indexOf(s[i++]),r=_chars.indexOf(s[i++]);o+=String.fromCharCode(e<<2|n>>4);if(h!==64)o+=String.fromCharCode((15&n)<<4|h>>2);if(r!==64)o+=String.fromCharCode((3&h)<<6|r);}return o;};
    window.btoa=function(s){var o='',i=0;while(i<s.length){var a=s.charCodeAt(i++),b=s.charCodeAt(i++),d=s.charCodeAt(i++);o+=_chars[a>>2]+_chars[(3&a)<<4|b>>4];o+=isNaN(b)?'=':_chars[(15&b)<<2|d>>6];o+=isNaN(d)?'=':_chars[63&d];}return o;};
    window.TextEncoder=function(){};
    window.TextEncoder.prototype.encode=function(s){var a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;};
    var XHR=window.XMLHttpRequest=function(){this.readyState=0;this.status=0;this.responseText='';this.onreadystatechange=null;};
    XHR.prototype.open=function(m,u){this._url=u;this.readyState=1;};
    XHR.prototype.setRequestHeader=function(){};
    XHR.prototype.send=function(b){this.readyState=4;this.status=200;if(this.onreadystatechange)try{this.onreadystatechange();}catch(e){}};
    XHR.prototype.addEventListener=function(){};
    XHR.prototype.getAllResponseHeaders=function(){return'';};
    XHR.UNSENT=0;XHR.OPENED=1;XHR.DONE=4;
    window.WebSocket=function(){this.readyState=0;};WebSocket.prototype.send=function(){};WebSocket.prototype.close=function(){};
    window.Worker=function(){this.onmessage=null;this.onerror=null;};
    Worker.prototype.postMessage=function(){};Worker.prototype.terminate=function(){};
    window.MessageChannel=function(){var s={postMessage:function(){},onmessage:null,close:function(){}};this.port1=s;this.port2=s;};
    window.fetch=function(){return Promise.resolve({json:function(){return Promise.resolve({});},text:function(){return Promise.resolve('');},status:200,ok:true,headers:{get:function(){return null;}}});};
    window.console={log:function(){},warn:function(){},error:function(){},info:function(){},debug:function(){},trace:function(){}};
    window.Event=function(t){this.type=t;};
    window.CustomEvent=function(t,o){this.type=t;this.detail=(o||{}).detail;};
    window.performance={now:function(){return Date.now();}};
    var _s={};
    window.localStorage={getItem:function(k){return _s[k]||null;},setItem:function(k,v){_s[k]=v;}};
    window.sessionStorage={getItem:function(k){return _s[k]||null;},setItem:function(k,v){_s[k]=v;}};
    window.requestAnimationFrame=function(fn){fn();return 0;};
    window.history={pushState:function(){},replaceState:function(){},back:function(){},forward:function(){},length:1,state:null};
    window.matchMedia=function(){return{matches:false,addEventListener:function(){}};};
    window.postMessage=function(){};
    window.onmessage=null;window.onerror=null;window.onpopstate=null;
    window.devicePixelRatio=1;
    window.__c=null;
    var _odp=Object.defineProperty;
    Object.defineProperty=function(obj,prop,desc){
        if(desc&&desc.value&&typeof desc.value==='object'&&desc.value!==null){
            if(desc.value.sm2&&desc.value.sm3&&desc.value.sm4)window.__c=desc.value;
        }
        return _odp.call(Object,obj,prop,desc);
    };
})();
"""

# ═══════════════════════════════════════════════════════════
# Patch app.js (2处，直接在 iv8 评估之前处理)
# ═══════════════════════════════════════════════════════════
def build_patched() -> str:
    src = (HERE / "config" / "app.js").read_text("utf-8")
    # Patch 1: export crypto
    p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };'
    i1 = src.index(p1)
    s = src[:i1 + len(p1)] + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' + src[i1 + len(p1):]
    off = len(';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};')
    # Patch 2: hook SM4
    p2 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {'
    i2r = src.index(p2)
    i2 = i2r if i2r < i1 else i2r + off
    s = s[:i2 + len(p2)] + 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;' + s[i2 + len(p2):]
    return s


# ═══════════════════════════════════════════════════════════
# Iv8Engine
# ═══════════════════════════════════════════════════════════
SM2_KEY = "009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42"
APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"


class Iv8Engine:
    def __init__(self):
        self._ctx = None
        self._sm4_key_ascii = None

    def __enter__(self):
        patched = build_patched()
        print(f"[iv8] Patched: {len(patched)/1024/1024:.1f}MB", file=sys.stderr)

        self._ctx = iv8.JSContext(mode="prod")
        self._ctx.__enter__()
        self._ctx.eval(BRIDGE, name="bridge.js")
        print("[iv8] Bridge loaded", file=sys.stderr)

        self._ctx.eval(patched, name="app.js")
        print("[iv8] app.js loaded", file=sys.stderr)

        try: self._ctx.eval("__iv8__.eventLoop.drain()")
        except: pass

        if self._ctx.eval("window.__k ? true : false"):
            self._sm4_key_ascii = self._ctx.eval(
                "Array.from(window.__k).map(function(b){return String.fromCharCode(b)}).join('')"
            )
        print(f"[iv8] SM4 key: {self._sm4_key_ascii or 'MISSING'}", file=sys.stderr)

        # Verify
        ok = self._ctx.eval("""
            (function(){
                var k=window.__k, enc=window.__c.sm4.encrypt;
                var pt=[123,34,107,101,121,115,34,58,34,34,125,5,5,5,5,5];
                var hex=Array.from(enc(pt,k)).map(function(b){return('0'+(b&0xFF).toString(16)).slice(-2)}).join('');
                return hex.toUpperCase()==='4A8E4673BB18D86FE780DACC31C49FE3';
            })()
        """)
        print(f"[iv8] SM4 verify: {'PASS' if ok else 'FAIL'}", file=sys.stderr)
        return self

    def __exit__(self, *args):
        if self._ctx:
            self._ctx.__exit__(*args)

    def encrypt(self, params: dict) -> dict:
        if not self._ctx or not self._sm4_key_ascii:
            raise RuntimeError("Not initialized")

        ts = int(time.time())
        nonce = ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(8))
        plain_json = json.dumps(params, ensure_ascii=False)

        # Internal SM4 encrypt via iv8
        enc_data = self._ctx.eval(f"""
            (function(){{
                var k=window.__k, enc=window.__c.sm4.encrypt;
                var s={json.dumps(plain_json)}, pb=[];
                for(var i=0;i<s.length;i++)pb.push(s.charCodeAt(i));
                var pad=16-(pb.length%16);
                for(var i=0;i<pad;i++)pb.push(pad);
                var a=enc(pb,k), hex='';
                for(var i=0;i<a.length;i++)hex+=('0'+(a[i]&0xFF).toString(16)).slice(-2);
                return hex;
            }})()
        """)

        # SM2 sign via npm sm-crypto (内部 doSignature 依赖链不完整)
        inner_json = json.dumps({
            "data": {"encData": enc_data},
            "appCode": APP_CODE, "version": "1.0.0",
            "encType": "SM4", "signType": "SM2", "timestamp": ts,
        }, ensure_ascii=False)
        inner_js = json.dumps(inner_json)
        r = subprocess.run(
            ["node", "-e",
             f"const s=require('sm-crypto').sm2;console.log(s.doSignature({inner_js},'{SM2_KEY[:64]}',{{hash:true,der:false}}));"],
            capture_output=True, text=True, cwd=str(HERE), timeout=10,
        )
        if r.returncode != 0:
            raise RuntimeError(f"SM2 error: {r.stderr}")
        sign_b64 = r.stdout.strip()

        # x-tif-signature
        x_tif_sig = hashlib.sha256(f"{ts}{nonce}{ts}".encode()).hexdigest()

        body = {
            "data": {
                "data": {"encData": enc_data},
                "appCode": APP_CODE, "version": "1.0.0",
                "encType": "SM4", "signType": "SM2",
                "timestamp": ts, "signData": sign_b64,
            }
        }

        return {
            "headers": {
                "Content-Type": "application/json", "channel": "web",
                "x-tif-paasid": "undefined",
                "x-tif-signature": x_tif_sig,
                "x-tif-timestamp": str(ts), "x-tif-nonce": nonce,
            },
            "body": body,
            "body_json": json.dumps(body, ensure_ascii=False, separators=(",", ":")),
            "_debug": {
                "sm4_key": self._sm4_key_ascii,
                "encData": enc_data,
                "signData": sign_b64[:40] + "...",
            },
        }


# ═══════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"

    if cmd == "status":
        with Iv8Engine() as e:
            print(json.dumps({"ready": e._sm4_key_ascii is not None, "key": e._sm4_key_ascii}, indent=2))

    elif cmd == "encrypt":
        params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {
            "keyword": "北京协和医院", "pageNum": 1, "pageSize": 10
        }
        with Iv8Engine() as e:
            print(json.dumps(e.encrypt(params), ensure_ascii=False, indent=2))

    elif cmd == "serve":
        with Iv8Engine() as e:
            print("[iv8] JSON-RPC ready", file=sys.stderr)
            for line in sys.stdin:
                line = line.strip()
                if not line: continue
                try:
                    req = json.loads(line)
                    rid = req.get("id", 0)
                    if req.get("method") == "encrypt":
                        print(json.dumps({"id": rid, "result": e.encrypt(req.get("params", {}))}), flush=True)
                    elif req.get("method") == "ping":
                        print(json.dumps({"id": rid, "result": {"pong": True}}), flush=True)
                    else:
                        print(json.dumps({"id": rid, "error": {"message": f"Unknown: {req.get('method')}"}}), flush=True)
                except Exception as ex:
                    print(json.dumps({"id": 0, "error": {"message": str(ex)}}), flush=True)
    else:
        print("Usage: python iv8_final.py status|encrypt|serve")
