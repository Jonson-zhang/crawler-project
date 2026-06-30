"""
iv8 加载 app.js 测试
"""
import sys
import json
import iv8
from pathlib import Path

HERE = Path(__file__).parent
APP_JS = HERE / "config" / "app.js"

# 增强 bridge: 比 jsdom 更完整的浏览器环境
BRIDGE = """
(function() {
    // === safe stub ===
    var safe = function(){ return safe; };
    safe.toString = function(){ return 'function(){}'; };
    safe.apply = safe.call = safe.bind = function(){ return safe; };

    // === location ===
    window.location = {
        href: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
        host: 'fuwu.nhsa.gov.cn', hostname: 'fuwu.nhsa.gov.cn',
        protocol: 'https:', origin: 'https://fuwu.nhsa.gov.cn',
        pathname: '/nationalHallSt/', search: '', hash: '#/search/medical',
        port: '', assign: function(){}, replace: function(){}, reload: function(){},
    };

    // === document ===
    window.document = {
        cookie: '',
        createElement: function(tag) {
            return {
                style: {}, children: [], tagName: (tag||'div').toUpperCase(),
                setAttribute: function(){return this;}, getAttribute: function(){return null;},
                appendChild: function(c){ return c; }, removeChild: function(){},
                addEventListener: function(){}, removeEventListener: function(){},
                querySelector: function(){return null;}, querySelectorAll: function(){return [];},
                getBoundingClientRect: function(){return {left:0,top:0,width:0,height:0};},
                getElementsByTagName: function(){return [];},
                getElementsByClassName: function(){return [];},
                insertBefore: function(){}, remove: function(){},
            };
        },
        createElementNS: function(ns,tag){ return document.createElement(tag); },
        querySelector: function(){return null;},
        querySelectorAll: function(){return [];},
        getElementById: function(){return null;},
        getElementsByTagName: function(){return [];},
        getElementsByClassName: function(){return [];},
        addEventListener: function(){}, removeEventListener: function(){},
        documentElement: { style:{} },
        body: null,
        head: null,
        createTextNode: function(t){ return {}; },
        createDocumentFragment: function(){ return {appendChild:function(){}}; },
    };
    document.body = document.createElement('body');
    document.head = document.createElement('head');
    document.documentElement = document.createElement('html');

    // === navigator ===
    if (!navigator.platform) navigator.platform = 'Win32';
    if (!navigator.language) navigator.language = 'zh-CN';
    navigator.appVersion = '5.0';
    navigator.appName = 'Netscape';
    navigator.product = 'Gecko';
    navigator.vendor = 'Google Inc.';
    navigator.maxTouchPoints = 0;
    navigator.hardwareConcurrency = 8;
    navigator.deviceMemory = 8;
    navigator.serviceWorker = { register: function(){ return Promise.resolve({}); }, ready: Promise.resolve({}) };

    // === screen ===
    window.screen = { width:1920, height:1080, availWidth:1920, availHeight:1040, colorDepth:24, pixelDepth:24 };

    // === dimensions ===
    window.innerWidth = 1920; window.innerHeight = 1080;
    window.outerWidth = 1920; window.outerHeight = 1080;
    window.screenX = 0; window.screenY = 0;
    window.pageXOffset = 0; window.pageYOffset = 0;

    // === window relationships ===
    window.parent = window; window.top = window; window.self = window;

    // === crypto ===
    window.crypto = {
        getRandomValues: function(arr) {
            for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
            return arr;
        },
        subtle: {},
        randomUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0; return (c==='x'?r:r&0x3|0x8).toString(16);
            });
        },
    };

    // === atob/btoa ===
    window.atob = function(s) {
        var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=', out='', i=0;
        while(i<s.length){var e=chars.indexOf(s[i++]),n=chars.indexOf(s[i++]),h=chars.indexOf(s[i++]),r=chars.indexOf(s[i++]);out+=String.fromCharCode(e<<2|n>>4);if(h!==64)out+=String.fromCharCode((15&n)<<4|h>>2);if(r!==64)out+=String.fromCharCode((3&h)<<6|r);}
        return out;
    };
    window.btoa = function(s) {
        var chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out='', i=0;
        while(i<s.length){var a=s.charCodeAt(i++),b=s.charCodeAt(i++),c=s.charCodeAt(i++);out+=chars[a>>2]+chars[(3&a)<<4|b>>4];out+=isNaN(b)?'=':chars[(15&b)<<2|c>>6];out+=isNaN(c)?'=':chars[63&c];}
        return out;
    };

    // === TextEncoder ===
    window.TextEncoder = function(){};
    window.TextEncoder.prototype.encode = function(str) {
        var arr = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i);
        return arr;
    };

    // === XMLHttpRequest ===
    var XHR_DONE = 4, XHR_UNSENT = 0, XHR_OPENED = 1;
    window.XMLHttpRequest = function() {
        this.readyState = 0; this.status = 0; this.responseText = ''; this.responseURL = '';
        this.onreadystatechange = null; this.onerror = null; this.onload = null; this.onabort = null;
        this.withCredentials = false; this.timeout = 0;
    };
    XMLHttpRequest.prototype.open = function(m,u,a){this._url=u;this.readyState=1;};
    XMLHttpRequest.prototype.setRequestHeader = function(){};
    XMLHttpRequest.prototype.send = function(b){
        var self = this;
        this.readyState = 4; this.status = 200;
        var cb = function(){
            if (self.onreadystatechange) try{self.onreadystatechange();}catch(e){}
            if (self.onload) try{self.onload();}catch(e){}
        };
        if (typeof setTimeout === 'function') setTimeout(cb, 0);
        else cb();
    };
    XMLHttpRequest.prototype.addEventListener = function(){};
    XMLHttpRequest.prototype.getAllResponseHeaders = function(){return '';};
    XMLHttpRequest.prototype.getResponseHeader = function(){return null;};
    XMLHttpRequest.prototype.abort = function(){};
    XMLHttpRequest.UNSENT = 0; XMLHttpRequest.OPENED = 1; XMLHttpRequest.DONE = 4;

    // === WebSocket ===
    window.WebSocket = function(){ this.readyState = 0; this.onmessage = null; this.onerror = null; this.onopen = null; };
    WebSocket.prototype.send = function(){};
    WebSocket.prototype.close = function(){};
    WebSocket.prototype.addEventListener = function(){};
    WebSocket.CONNECTING = 0; WebSocket.OPEN = 1; WebSocket.CLOSED = 3;

    // === Worker ===
    window.Worker = function(){ this.onmessage = null; this.onerror = null; };
    Worker.prototype.postMessage = function(){};
    Worker.prototype.terminate = function(){};

    // === MessageChannel ===
    window.MessageChannel = function(){
        this.port1 = { postMessage:function(){}, onmessage: null, close:function(){}, addEventListener:function(){}, start:function(){} };
        this.port2 = { postMessage:function(){}, onmessage: null, close:function(){}, addEventListener:function(){}, start:function(){} };
    };

    // === fetch ===
    window.fetch = function(){
        return Promise.resolve({
            json: function(){ return Promise.resolve({}); },
            text: function(){ return Promise.resolve(''); },
            blob: function(){ return Promise.resolve({}); },
            arrayBuffer: function(){ return Promise.resolve(new ArrayBuffer(0)); },
            status: 200, ok: true, statusText: 'OK',
            headers: { get: function(){ return null; }, forEach: function(){} },
        });
    };

    // === timers ===
    if (typeof setTimeout !== 'function') {
        window.setTimeout = function(fn, ms){ try{fn();}catch(e){} return 0; };
        window.setInterval = function(){ return 0; };
        window.clearTimeout = function(){};
        window.clearInterval = function(){};
    }

    // === console ===
    window.console = { log:function(){}, warn:function(){}, error:function(){}, info:function(){}, debug:function(){}, trace:function(){}, dir:function(){}, table:function(){} };

    // === Events ===
    window.Event = function(type){ this.type = type; };
    window.CustomEvent = function(type, opts){ this.type = type; this.detail = (opts||{}).detail; };

    // === document extensions ===
    document.createEvent = function(type) { return { initEvent: function(){} }; };
    document.createComment = function(){ return {}; };
    document.createDocumentFragment = function(){ return { appendChild: function(c){return c;}, querySelector: function(){return null;} }; };

    // === performance ===
    window.performance = { now: function(){ return Date.now(); }, timing: { navigationStart: Date.now()-1000 } };

    // === localStorage/sessionStorage ===
    var _store = {};
    window.localStorage = { getItem:function(k){return _store[k]||null;}, setItem:function(k,v){_store[k]=v;}, removeItem:function(k){delete _store[k];}, clear:function(){_store={};}, length:0, key:function(){return null;} };
    window.sessionStorage = { getItem:function(k){return _store[k]||null;}, setItem:function(k,v){_store[k]=v;}, removeItem:function(k){delete _store[k];}, clear:function(){_store={};}, length:0, key:function(){return null;} };

    // === requestAnimationFrame ===
    window.requestAnimationFrame = function(fn){ if(typeof setTimeout==='function')setTimeout(fn,16); else fn(); return 0; };
    window.cancelAnimationFrame = function(){};

    // === history ===
    window.history = { pushState:function(){}, replaceState:function(){}, go:function(){}, back:function(){}, forward:function(){}, length:1, state:null };

    // === matchMedia ===
    window.matchMedia = function(){ return { matches:false, media:'', addListener:function(){}, removeListener:function(){}, addEventListener:function(){}, removeEventListener:function(){} }; };

    // === postMessage ===
    window.postMessage = function(){};

    // === event handlers ===
    window.onmessage = null; window.onerror = null; window.onpopstate = null;
    window.onhashchange = null; window.onload = null; window.onunload = null;
    window.onbeforeunload = null; window.onresize = null;

    // === devicePixelRatio ===
    window.devicePixelRatio = 1;

    // 拦截加密模块 — 与 jsdom 方案相同
    window.__c = null;
    var _origDP = Object.defineProperty;
    Object.defineProperty = function(obj, prop, desc) {
        if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null) {
            if (desc.value.sm2 && desc.value.sm3 && desc.value.sm4) {
                window.__c = desc.value;
            }
        }
        return _origDP.call(Object, obj, prop, desc);
    };

    // Hook SM4
    window.__k = null;
    window.__nhsa_ready = true;
})();
"""

# Patch app.js - same patches as jsdom export_all.js
p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };'
i1 = src.index(p1)
patched = src[:i1 + len(p1)] + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";' + src[i1 + len(p1):]
off = len(';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";')

# Patch: export all modules
p_mod = '(_0x1210ab["l"] = !0x0),'
i_mod = src.index(p_mod)
i2 = i_mod if i_mod < i1 else i_mod + off
patched = patched[:i2 + len(p_mod)] + '(window["_m"+_0x518e77]=_0x1210ab["exports"]),' + patched[i2 + len(p_mod):]
off += len('(window["_m"+_0x518e77]=_0x1210ab["exports"]),')

# Patch: hook SM4
p3 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {'
i3raw = src.index(p3)
i3 = i3raw if i3raw < i1 else (i3raw + off - len('(window["_m"+_0x518e77]=_0x1210ab["exports"]),'))
patched = patched[:i3 + len(p3)] + 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;' + patched[i3 + len(p3):]

# Also hook doSignature key
p4 = 'function _0x379870(_0x114d61, _0x2fdcf9) {'
i4raw = src.index(p4)
i4 = i4raw if i4raw < i1 else i4raw + off
patched = patched[:i4 + len(p4)] + 'window.__ds_key=_0x2fdcf9;window.__ds_msg=_0x114d61;' + patched[i4 + len(p4):]

print(f"[iv8] app.js patched: {(len(patched)/1024/1024):.1f}MB", file=sys.stderr)

# Load in iv8
print("[iv8] Loading bridge + app.js...", file=sys.stderr)
with iv8.JSContext(mode="prod") as ctx:
    # 1. Load bridge
    ctx.eval(BRIDGE, name="bridge.js")
    print("[iv8] Bridge loaded", file=sys.stderr)

    # 2. Load patched app.js - wrap in try-catch so errors don't stop module loading
    wrapped = "try {\n" + patched + "\n} catch(e) { window.__iv8_error = e.message || String(e); }"
    try:
        ctx.eval(wrapped, name="app.js")
        err = ctx.eval("window.__iv8_error || 'none'")
        print(f"[iv8] app.js loaded (error: {err[:80] if err != 'none' else 'none'})", file=sys.stderr)
    except Exception as e:
        print(f"[iv8] app.js FATAL: {e}", file=sys.stderr)

    # 3. Drain event loop
    try:
        ctx.eval("__iv8__.eventLoop.drain()")
    except Exception:
        pass

    # 4. Check results
    crypto = ctx.eval("window.__c ? true : false")
    sm4_key = ctx.eval("window.__k ? JSON.stringify(Array.from(window.__k)) : 'null'")
    sm2 = ctx.eval("window.__c && window.__c.sm2 ? Object.keys(window.__c.sm2).slice(0,8).join(',') : 'none'")
    sm4 = ctx.eval("window.__c && window.__c.sm4 ? Object.keys(window.__c.sm4).slice(0,8).join(',') : 'none'")
    sm3 = ctx.eval("window.__c && window.__c.sm3 ? (typeof window.__c.sm3==='function'?'function':Object.keys(window.__c.sm3).slice(0,5).join(',')) : 'none'")

    print(f"[iv8] crypto exported: {crypto}", file=sys.stderr)
    print(f"[iv8] SM2 functions: {sm2}", file=sys.stderr)
    print(f"[iv8] SM4 functions: {sm4}", file=sys.stderr)
    print(f"[iv8] SM3: {sm3}", file=sys.stderr)
    print(f"[iv8] SM4 key: {sm4_key}", file=sys.stderr)

    # 5. Test SM4
    if crypto:
        try:
            test = ctx.eval("""
                (function(){
                    var k = window.__k;
                    var enc = window.__c.sm4.encrypt;
                    var pt = [116,101,115,116,49,50,51,52,53,54,55,56,57,48,49,50];
                    var encArr = enc(pt, k);
                    var hex = Array.from(encArr).map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2)}).join('');
                    var decArr = window.__c.sm4.decrypt(encArr, k);
                    return JSON.stringify({
                        encHex: hex,
                        decArr: JSON.stringify(decArr),
                        match: JSON.stringify(pt) === JSON.stringify(decArr)
                    });
                })()
            """)
            result = json.loads(test)
            print(f"[iv8] SM4 encrypt test: {result['encHex'][:32]}...", file=sys.stderr)
            print(f"[iv8] SM4 round-trip: {'PASS' if result['match'] else 'FAIL'}", file=sys.stderr)
        except Exception as e:
            print(f"[iv8] SM4 test error: {e}", file=sys.stderr)

    # 6. Verify selectByKeys encData
    try:
        verify = ctx.eval("""
            (function(){
                var k = window.__k;
                var enc = window.__c.sm4.encrypt;
                var pt = [123,34,107,101,121,115,34,58,34,34,125,5,5,5,5,5];
                var encArr = enc(pt, k);
                var hex = Array.from(encArr).map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2)}).join('');
                return hex;
            })()
        """)
        expected = "4A8E4673BB18D86FE780DACC31C49FE3"
        print(f"[iv8] selectByKeys encData: {verify}", file=sys.stderr)
        print(f"[iv8] Expected:            {expected}", file=sys.stderr)
        print(f"[iv8] Match: {verify.upper() == expected.upper()}", file=sys.stderr)
    except Exception as e:
        print(f"[iv8] Verify error: {e}", file=sys.stderr)

print("\n✅ iv8 test complete", file=sys.stderr)
