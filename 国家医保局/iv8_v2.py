"""
iv8 v2 — 修补原生 document 而非替换，适配 iv8 的全局 document
"""
import iv8, json
from pathlib import Path

HERE = Path(__file__).parent
src = (HERE / "config" / "app.js").read_text("utf-8")

# Patch
p1 = '_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };'
i1 = src.index(p1)
patched = src[:i1 + len(p1)] + ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};' + src[i1 + len(p1):]
off = len(';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};')
p2 = 'function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {'
i2raw = src.index(p2)
i2 = i2raw if i2raw < i1 else i2raw + off
patched = patched[:i2 + len(p2)] + 'window.__k=_0x1a6c05;window.__kp=_0x2e1290;' + patched[i2 + len(p2):]

# Bridge: patch the NATIVE document global (not replace window.document)
bridge = r"""
(function() {
    // Patch native document methods — iv8 provides a global `document`
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
    window.atob=function(s){var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',o='',i=0;while(i<s.length){var e=c.indexOf(s[i++]),n=c.indexOf(s[i++]),h=c.indexOf(s[i++]),r=c.indexOf(s[i++]);o+=String.fromCharCode(e<<2|n>>4);if(h!==64)o+=String.fromCharCode((15&n)<<4|h>>2);if(r!==64)o+=String.fromCharCode((3&h)<<6|r);}return o;};
    window.btoa=function(s){var c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',o='',i=0;while(i<s.length){var a=s.charCodeAt(i++),b=s.charCodeAt(i++),d=s.charCodeAt(i++);o+=c[a>>2]+c[(3&a)<<4|b>>4];o+=isNaN(b)?'=':c[(15&b)<<2|d>>6];o+=isNaN(d)?'=':c[63&d];}return o;};
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

# Main
with iv8.JSContext(mode="prod") as ctx:
    ctx.eval(bridge, name="bridge.js")
    print("[iv8] Bridge loaded", flush=True)

    try:
        ctx.eval(patched, name="app.js")
        print("[iv8] app.js loaded OK", flush=True)
    except Exception as e:
        print(f"[iv8] WARNING: {str(e)[:150]}", flush=True)

    try: ctx.eval("__iv8__.eventLoop.drain()")
    except: pass

    has_c = ctx.eval("window.__c ? true : false")
    print(f"[iv8] Crypto: {has_c}", flush=True)

    if ctx.eval("window.__k ? true : false"):
        key = ctx.eval(
            "Array.from(window.__k).map(function(b){return String.fromCharCode(b)}).join('')"
        )
        print(f"[iv8] SM4 key: {key}", flush=True)

        result = ctx.eval("""
            (function(){
                var k=window.__k;
                var enc=window.__c.sm4.encrypt;
                var pt=[123,34,107,101,121,115,34,58,34,34,125,5,5,5,5,5];
                var hex=Array.from(enc(pt,k)).map(function(b){return('0'+(b&0xFF).toString(16)).slice(-2)}).join('');
                return hex;
            })()
        """)
        ok = result.upper() == "4A8E4673BB18D86FE780DACC31C49FE3"
        print(f"[iv8] SM4 verify: {'PASS' if ok else 'FAIL'} ({result})", flush=True)
    else:
        print("[iv8] SM4 key NOT captured", flush=True)
