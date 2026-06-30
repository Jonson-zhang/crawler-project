"""
国家医保局 — iv8 加密服务器
============================

使用 iv8 (C++ V8) 替代 jsdom 加载 app.js，提取加密模块。
启动时间约 3-5 秒，之后可快速生成加密请求。

依赖: pip install iv8

用法:
  python iv8_server.py              # JSON-RPC (stdin/stdout)
  python iv8_server.py encrypt '{"keyword":"医院","pageNum":1,"pageSize":10}'
  python iv8_server.py status
"""

import sys, json, hashlib, time, random, string
from pathlib import Path

try:
    import iv8
except ImportError:
    print("pip install iv8", file=sys.stderr)
    sys.exit(1)

HERE = Path(__file__).parent

# ═══════════════════════════════════════════════════════════════
# 1. Bridge (已验证可在 iv8 中正常运行 app.js)
# ═══════════════════════════════════════════════════════════════
BRIDGE = r"""
(function() {
    var safe = function(){ return safe; };
    safe.toString = function(){ return 'function(){}'; };
    safe.apply = safe.call = safe.bind = function(){ return safe; };

    window.location = {
        href: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
        host: 'fuwu.nhsa.gov.cn', hostname: 'fuwu.nhsa.gov.cn',
        protocol: 'https:', origin: 'https://fuwu.nhsa.gov.cn',
        pathname: '/nationalHallSt/', search: '', hash: '#/search/medical',
        port: '', assign: function(){}, replace: function(){}, reload: function(){},
    };

    var el = function(tag) { return {
        style: {}, children: [], tagName: (tag||'div').toUpperCase(),
        setAttribute: function(){return this;}, getAttribute: function(){return null;},
        appendChild: function(c){return c;}, removeChild: function(){},
        addEventListener: function(){}, removeEventListener: function(){},
        querySelector: function(){return null;}, querySelectorAll: function(){return [];},
        getBoundingClientRect: function(){return {left:0,top:0,width:0,height:0};},
        getElementsByTagName: function(){return [];},
        getElementsByClassName: function(){return [];},
        insertBefore: function(){}, remove: function(){},
    };};

    window.document = {
        cookie: '', createElement: el, createElementNS: function(ns,t){return el(t);},
        querySelector: function(){return null;}, querySelectorAll: function(){return [];},
        getElementById: function(){return null;}, getElementsByTagName: function(){return [];},
        getElementsByClassName: function(){return [];},
        addEventListener: function(){}, removeEventListener: function(){},
        documentElement: el('html'), body: el('body'), head: el('head'),
        createTextNode: function(){return {};},
        createEvent: function(type){return{initEvent:function(){}};},
        createComment: function(){return{};},
    };

    if (!navigator.platform) navigator.platform = 'Win32';
    if (!navigator.language) navigator.language = 'zh-CN';
    navigator.appVersion = '5.0'; navigator.appName = 'Netscape';
    navigator.serviceWorker = { register: function(){ return Promise.resolve({}); }, ready: Promise.resolve({}) };

    window.screen = { width:1920, height:1080, availWidth:1920, availHeight:1040, colorDepth:24 };
    window.innerWidth = 1920; window.innerHeight = 1080;
    window.outerWidth = 1920; window.outerHeight = 1080;
    window.parent = window; window.top = window; window.self = window;

    window.crypto = {
        getRandomValues: function(arr) { for (var i=0;i<arr.length;i++) arr[i]=Math.floor(Math.random()*256); return arr; },
        subtle: {}, randomUUID: function(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:r&0x3|0x8).toString(16);});},
    };

    window.atob = function(s){var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',o='',i=0;while(i<s.length){var e=c.indexOf(s[i++]),n=c.indexOf(s[i++]),h=c.indexOf(s[i++]),r=c.indexOf(s[i++]);o+=String.fromCharCode(e<<2|n>>4);if(h!==64)o+=String.fromCharCode((15&n)<<4|h>>2);if(r!==64)o+=String.fromCharCode((3&h)<<6|r);}return o;};
    window.btoa = function(s){var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',o='',i=0;while(i<s.length){var a=s.charCodeAt(i++),b=s.charCodeAt(i++),d=s.charCodeAt(i++);o+=c[a>>2]+c[(3&a)<<4|b>>4];o+=isNaN(b)?'=':c[(15&b)<<2|d>>6];o+=isNaN(d)?'=':c[63&d];}return o;};

    window.TextEncoder = function(){};
    window.TextEncoder.prototype.encode = function(s){var a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;};

    window.XMLHttpRequest = function(){this.readyState=0;this.status=0;this.responseText='';this.onreadystatechange=null;};
    XMLHttpRequest.prototype.open = function(m,u){this._url=u;this.readyState=1;};
    XMLHttpRequest.prototype.setRequestHeader = function(){};
    XMLHttpRequest.prototype.send = function(b){this.readyState=4;this.status=200;if(this.onreadystatechange)try{this.onreadystatechange();}catch(e){}};
    XMLHttpRequest.prototype.addEventListener = function(){};
    XMLHttpRequest.prototype.getAllResponseHeaders = function(){return'';};
    XMLHttpRequest.UNSENT=0;XMLHttpRequest.OPENED=1;XMLHttpRequest.DONE=4;

    window.WebSocket = function(){this.readyState=0;};WebSocket.prototype.send=function(){};WebSocket.prototype.close=function(){};
    WebSocket.prototype.addEventListener=function(){};WebSocket.CONNECTING=0;WebSocket.OPEN=1;WebSocket.CLOSED=3;

    window.Worker = function(){this.onmessage=null;this.onerror=null;};
    Worker.prototype.postMessage=function(){};Worker.prototype.terminate=function(){};

    window.MessageChannel = function(){
        var s={postMessage:function(){},onmessage:null,close:function(){},addEventListener:function(){},start:function(){}};
        this.port1=s;this.port2=JSON.parse(JSON.stringify(s));
    };

    window.fetch = function(){return Promise.resolve({json:function(){return Promise.resolve({});},text:function(){return Promise.resolve('');},status:200,ok:true,headers:{get:function(){return null;}}});};

    window.console = {log:function(){},warn:function(){},error:function(){},info:function(){},debug:function(){},trace:function(){}};
    window.Event = function(t){this.type=t;};
    window.CustomEvent = function(t,o){this.type=t;this.detail=(o||{}).detail;};
    window.performance = {now:function(){return Date.now();},timing:{navigationStart:Date.now()-1000}};

    var _s={};
    window.localStorage = {getItem:function(k){return _s[k]||null;},setItem:function(k,v){_s[k]=v;},removeItem:function(k){delete _s[k];}};
    window.sessionStorage = {getItem:function(k){return _s[k]||null;},setItem:function(k,v){_s[k]=v;},removeItem:function(k){delete _s[k];}};
    window.requestAnimationFrame = function(fn){fn();return 0;};
    window.cancelAnimationFrame = function(){};
    window.history = {pushState:function(){},replaceState:function(){},back:function(){},forward:function(){},length:1,state:null};
    window.matchMedia = function(){return{matches:false,media:'',addListener:function(){},addEventListener:function(){}};};
    window.postMessage = function(){};
    window.onmessage = null; window.onerror = null; window.onpopstate = null;
    window.devicePixelRatio = 1;

    // 拦截加密模块
    window.__c = null;
    var _odp = Object.defineProperty;
    Object.defineProperty = function(obj, prop, desc) {
        if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null) {
            if (desc.value.sm2 && desc.value.sm3 && desc.value.sm4) window.__c = desc.value;
        }
        return _odp.call(Object, obj, prop, desc);
    };
    window.__nhsa_ready = true;
})();
"""

# ═══════════════════════════════════════════════════════════════
# 2. Patch app.js
# ═══════════════════════════════════════════════════════════════
def build_patched():
    src = (HERE / "config" / "app.js").read_text("utf-8")
    patches = [
        # Export crypto
        ('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
         ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";'),
        # Export all modules
        ('(_0x1210ab["l"] = !0x0),',
         '(window["_m"+_0x518e77]=_0x1210ab["exports"]),'),
        # Hook SM4
        ('function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {',
         'window.__k=_0x1a6c05;window.__kp=_0x2e1290;'),
        # Hook doSignature key
        ('function _0x379870(_0x114d61, _0x2fdcf9) {',
         'window.__ds_key=_0x2fdcf9;window.__ds_msg=_0x114d61;'),
    ]
    items = [(src.index(p), len(p), ins) for p, ins in patches]
    items.sort()
    result, off = src, 0
    for pos, plen, ins in items:
        ap = pos + off
        result = result[:ap + plen] + ins + result[ap + plen:]
        off += len(ins)
    return result


# ═══════════════════════════════════════════════════════════════
# 3. Iv8Crypto — 加密上下文
# ═══════════════════════════════════════════════════════════════
class Iv8Crypto:
    def __init__(self):
        self._ctx = None
        self._sm4_key = None

    def __enter__(self):
        print("[iv8] Patching app.js...", file=sys.stderr)
        patched = build_patched()
        print(f"[iv8] Patched: {len(patched)/1024/1024:.1f}MB", file=sys.stderr)

        print("[iv8] Creating JS context...", file=sys.stderr)
        self._ctx = iv8.JSContext(mode="prod")
        self._ctx.__enter__()

        print("[iv8] Loading bridge...", file=sys.stderr)
        self._ctx.eval(BRIDGE, name="bridge.js")

        print("[iv8] Loading patched app.js...", file=sys.stderr)
        wrapped = "try {\n" + patched + "\n} catch(e) { window.__iv8_err = String(e); }"
        try:
            self._ctx.eval(wrapped, name="app.js")
        except Exception as e:
            print(f"[iv8] app.js eval error: {e}", file=sys.stderr)

        # Drain event loop
        try:
            self._ctx.eval("__iv8__.eventLoop.drain()")
        except Exception:
            pass

        # Get SM4 key
        key_raw = self._ctx.eval(
            "window.__k ? Array.from(window.__k).map(function(b){return String.fromCharCode(b)}).join('') : null"
        )
        self._sm4_key = key_raw
        print(f"[iv8] SM4 key: {key_raw}", file=sys.stderr)

        has_crypto = self._ctx.eval("window.__c ? true : false")
        mod_count = self._ctx.eval(
            "Object.keys(window).filter(function(k){return k.startsWith('_m')}).length"
        )
        has_sha = self._ctx.eval("window._m21bf && window._m21bf.SHA256 ? true : false")
        print(f"[iv8] Crypto: {has_crypto}, Modules: {mod_count}, SHA256: {has_sha}", file=sys.stderr)

        return self

    def __exit__(self, *args):
        if self._ctx:
            self._ctx.__exit__(*args)

    def _wa2hex(self, wa):
        """CryptoJS WordArray → hex string"""
        return self._ctx.eval(f"""
            (function(){{
                var wa = {wa};
                if (typeof wa === 'string') return wa;
                var w = wa.words, s = wa.sigBytes, h = '';
                for (var i = 0; i < s; i++) h += ('0' + ((w[i>>>2]>>>(24-(i%4)*8))&0xff).toString(16)).slice(-2);
                return h;
            }})()
        """)

    def encrypt(self, params: dict) -> dict:
        """使用内部 SM4/SM2 生成加密请求"""
        if not self._ctx:
            raise RuntimeError("Not initialized")

        AC = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
        KEY_HEX = "009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42"
        ts = int(time.time())
        nonce = ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(8))

        plain_json = json.dumps(params, ensure_ascii=False)
        escaped = json.dumps(plain_json)

        # Call internal SM4
        enc_data = self._ctx.eval(f"""
            (function(){{
                var k = window.__k;
                var enc = window.__c.sm4.encrypt;
                var plain = {escaped};
                var pb = [];
                for (var i = 0; i < plain.length; i++) pb.push(plain.charCodeAt(i));
                var pad = 16 - (pb.length % 16);
                for (var i = 0; i < pad; i++) pb.push(pad);
                var encArr = enc(pb, k);
                var hex = '';
                for (var i = 0; i < encArr.length; i++) hex += ('0' + (encArr[i] & 0xFF).toString(16)).slice(-2);
                return hex;
            }})()
        """)

        # Call internal SM2 doSignature
        inner = json.dumps({
            "data": {"encData": enc_data},
            "appCode": AC, "version": "1.0.0",
            "encType": "SM4", "signType": "SM2", "timestamp": ts
        }, ensure_ascii=False)
        inner_escaped = json.dumps(inner)

        sign_hex = self._ctx.eval(f"""
            (function(){{
                var doSig = window._m4d09 ? window._m4d09.doSignature : null;
                if (!doSig) return 'ERROR: no doSignature';
                var msg = {inner_escaped};
                var key = "{KEY_HEX}";
                var hex = doSig(msg, key, {{hash: true}});
                return hex;
            }})()
        """)

        import base64
        sign_bytes = bytes.fromhex(sign_hex)
        sign_b64 = base64.b64encode(sign_bytes).decode()

        # x-tif-signature
        x_tif_sig = hashlib.sha256(f"{ts}{nonce}{ts}".encode()).hexdigest()

        body = {
            "data": {
                "data": {"encData": enc_data},
                "appCode": AC, "version": "1.0.0",
                "encType": "SM4", "signType": "SM2",
                "timestamp": ts, "signData": sign_b64,
            }
        }

        return {
            "headers": {
                "Content-Type": "application/json",
                "channel": "web",
                "x-tif-paasid": "undefined",
                "x-tif-signature": x_tif_sig,
                "x-tif-timestamp": str(ts),
                "x-tif-nonce": nonce,
            },
            "body": body,
            "body_json": json.dumps(body, ensure_ascii=False, separators=(",", ":")),
            "_debug": {
                "sm4_key": self._sm4_key,
                "encData": enc_data,
                "signData": sign_b64[:40] + "...",
                "signData_len": len(sign_bytes),
                "x_tif_sig": x_tif_sig,
            }
        }


# ═══════════════════════════════════════════════════════════════
# 4. CLI
# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"

    if cmd == "status":
        with Iv8Crypto() as c:
            print(json.dumps({
                "crypto": True,
                "sm4_key": c._sm4_key,
            }, indent=2))

    elif cmd == "encrypt":
        params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {
            "keyword": "北京协和医院", "pageNum": 1, "pageSize": 10
        }
        with Iv8Crypto() as c:
            result = c.encrypt(params)
            print(json.dumps(result, ensure_ascii=False, indent=2))

    elif cmd == "serve":
        import sys
        print("[iv8] Starting encryption server...", file=sys.stderr)
        with Iv8Crypto() as c:
            print("[iv8] Ready for JSON-RPC", file=sys.stderr)
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                try:
                    req = json.loads(line)
                    if req.get("method") == "encrypt":
                        result = c.encrypt(req.get("params", {}))
                        resp = json.dumps({"id": req.get("id", 0), "result": result})
                    elif req.get("method") == "ping":
                        resp = json.dumps({"id": req.get("id", 0), "result": {"pong": True}})
                    else:
                        resp = json.dumps({"id": req.get("id", 0), "error": {"message": f"Unknown: {req.get('method')}"}})
                    print(resp, flush=True)
                except Exception as e:
                    print(json.dumps({"id": 0, "error": {"message": str(e)}}), flush=True)

    else:
        print(f"Usage: python iv8_server.py status|encrypt|serve")
