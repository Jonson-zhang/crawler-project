"""
iv8 完整 pipeline 测试 — 内部 SM4+SM2+SHA256 生成加密请求
"""
import iv8, json, hashlib
from pathlib import Path

HERE = Path(__file__).parent
src = (HERE / "config" / "app.js").read_text("utf-8")

# 3 patches
items = []
for p, ins in [
    ('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
     ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};'),
    ('(_0x1210ab["l"] = !0x0),',
     '(window["_m"+_0x518e77]=_0x1210ab["exports"]),'),
    ('function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {',
     'window.__k=_0x1a6c05;window.__kp=_0x2e1290;'),
]:
    items.append((src.index(p), len(p), ins))
items.sort()
patched = src
off = 0
for pos, plen, ins in items:
    ap = pos + off
    patched = patched[:ap + plen] + ins + patched[ap + plen:]
    off += len(ins)

print(f"[iv8] Patched: {len(patched)/1024/1024:.1f}MB", flush=True)

# Bridge — 修补 iv8 原生 document
bridge = r"""
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

# Test
with iv8.JSContext(mode="prod") as ctx:
    ctx.eval(bridge, name="bridge.js")
    print("[iv8] Bridge loaded", flush=True)
    ctx.eval(patched, name="app.js")
    print("[iv8] app.js loaded", flush=True)
    try: ctx.eval("__iv8__.eventLoop.drain()")
    except: pass

    mod_count = ctx.eval('Object.keys(window).filter(function(k){return k.startsWith("_m")}).length')
    has_sha = ctx.eval("window._m21bf && window._m21bf.SHA256 ? true : false")
    has_sm2 = ctx.eval("window._m4d09 ? true : false")
    has_c = ctx.eval("window.__c ? true : false")
    key_ok = ctx.eval("window.__k ? true : false")
    print(f"[iv8] Modules:{mod_count} SHA:{has_sha} SM2:{has_sm2} Crypto:{has_c} Key:{key_ok}", flush=True)

    # Full pipeline
    if has_c and key_ok and has_sm2 and has_sha:
        full_json = ctx.eval("""
            (function(){
                var sm4Enc = window.__c.sm4.encrypt;
                var doSig = window._m4d09.doSignature;
                var sha256 = window._m21bf.SHA256;
                var k = window.__k;
                var AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
                var SM2_KEY = '009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42';
                var ts = 1782831600;
                var nonce = 'test1234';

                var plain = JSON.stringify({keyword:'医院',pageNum:1,pageSize:10});
                var pb = [];
                for(var i = 0; i < plain.length; i++) pb.push(plain.charCodeAt(i));
                var pad = 16 - (pb.length % 16);
                for(var i = 0; i < pad; i++) pb.push(pad);
                var encArr = sm4Enc(pb, k);
                var encData = '';
                for(var i = 0; i < encArr.length; i++) encData += ('0' + (encArr[i] & 0xFF).toString(16)).slice(-2);

                var inner = {data:{encData:encData}, appCode:AC, version:'1.0.0', encType:'SM4', signType:'SM2', timestamp:ts};
                var innerJson = JSON.stringify(inner);
                var signHex = doSig(innerJson, SM2_KEY, {hash: true});
                var signBytes = [];
                for(var i = 0; i < signHex.length; i += 2) signBytes.push(parseInt(signHex.substr(i,2), 16));
                var signB64 = btoa(String.fromCharCode.apply(null, signBytes));

                var sigInput = String(ts) + nonce + String(ts);
                var shaResult = sha256(sigInput);
                var w = shaResult.words, s = shaResult.sigBytes, xTifSig = '';
                for(var i = 0; i < s; i++) xTifSig += ('0' + ((w[i>>>2]>>>(24-(i%4)*8))&0xff).toString(16)).slice(-2);

                return JSON.stringify({encData:encData, signData:signB64, signLen:signBytes.length, xTifSig:xTifSig, sigInput:sigInput});
            })()
        """)
        result = json.loads(full_json)
        print(f"\n[iv8] FULL PIPELINE RESULT:", flush=True)
        print(f"  encData: {result['encData'][:40]}...", flush=True)
        print(f"  signData: {result['signData'][:40]}... ({result['signLen']} bytes)", flush=True)
        print(f"  xTifSig: {result['xTifSig']}", flush=True)
        expected_sig = hashlib.sha256(result['sigInput'].encode()).hexdigest()
        print(f"  xTifSig match: {result['xTifSig'] == expected_sig}", flush=True)

        # Verify SM4 round-trip
        rt = ctx.eval("""
            (function(){
                var d = window.__c.sm4.decrypt;
                var k = window.__k;
                var h = '""" + result['encData'] + """';
                var arr = [];
                for(var i = 0; i < h.length; i += 2) arr.push(parseInt(h.substr(i,2), 16));
                var decArr = d(arr, k);
                var s = '';
                for(var i = 0; i < decArr.length; i++) s += String.fromCharCode(decArr[i]);
                var pad = s.charCodeAt(s.length - 1);
                return s.substring(0, s.length - pad);
            })()
        """)
        print(f"  SM4 round-trip: {rt}", flush=True)
    else:
        print(f"[iv8] Missing modules for full pipeline", flush=True)
