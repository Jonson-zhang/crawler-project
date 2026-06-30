"""
用文章参数 + iv8 内部 SM4/SM2 + 文章截图中完全一致的 headers 测试
"""
import iv8, json, hashlib, time, random, string, subprocess, sys
from pathlib import Path

HERE = Path(__file__).parent

# 1. Build patched app.js (与 iv8_v2.py 相同的 3 patches)
src = (HERE / "config" / "app.js").read_text("utf-8")
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
    patched = patched[:ap+plen] + ins + patched[ap+plen:]
    off += len(ins)

# 2. Bridge (from iv8_v2.py — hardcoded to avoid r-string issues)
bridge = """
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

    var _loc = {
        href:'https://fuwu.nhsa.gov.cn/nationalHallSt/', host:'fuwu.nhsa.gov.cn',
        protocol:'https:', origin:'https://fuwu.nhsa.gov.cn',
        pathname:'/nationalHallSt/',search:'',hash:'',
        port:'', assign:function(){}, replace:function(){}, reload:function(){},
    };
    if (!window.location || !window.location.href) window.location = _loc;
    if (!navigator.platform) navigator.platform='Win32';
    navigator.serviceWorker={register:function(){return Promise.resolve({});},ready:Promise.resolve({})};
    window.screen={width:1920,height:1080}; window.innerWidth=1920;window.innerHeight=1080;
    window.parent=window;window.top=window;window.self=window;
    window.crypto={getRandomValues:function(arr){for(var i=0;i<arr.length;i++)arr[i]=Math.floor(Math.random()*256);return arr;},subtle:{}};
    var _cs='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    window.atob=function(s){var o='',i=0;while(i<s.length){var e=_cs.indexOf(s[i++]),n=_cs.indexOf(s[i++]),h=_cs.indexOf(s[i++]),r=_cs.indexOf(s[i++]);o+=String.fromCharCode(e<<2|n>>4);if(h!==64)o+=String.fromCharCode((15&n)<<4|h>>2);if(r!==64)o+=String.fromCharCode((3&h)<<6|r);}return o;};
    window.btoa=function(s){var o='',i=0;while(i<s.length){var a=s.charCodeAt(i++),b=s.charCodeAt(i++),d=s.charCodeAt(i++);o+=_cs[a>>2]+_cs[(3&a)<<4|b>>4];o+=isNaN(b)?'=':_cs[(15&b)<<2|d>>6];o+=isNaN(d)?'=':_cs[63&d];}return o;};
    window.__utf8_encode=function(str){var utf8=[];for(var i=0;i<str.length;i++){var c=str.charCodeAt(i);if(c<0x80){utf8.push(c);}else if(c<0x800){utf8.push(0xc0|(c>>6),0x80|(c&0x3f));}else if(c<0xd800||c>=0xe000){utf8.push(0xe0|(c>>12),0x80|((c>>6)&0x3f),0x80|(c&0x3f));}else{i++;var c2=str.charCodeAt(i);c=0x10000+(((c&0x3ff)<<10)|(c2&0x3ff));utf8.push(0xf0|(c>>18),0x80|((c>>12)&0x3f),0x80|((c>>6)&0x3f),0x80|(c&0x3f));}}return new Uint8Array(utf8);};
    window.TextEncoder=function(){};
    window.TextEncoder.prototype.encode=function(s){return window.__utf8_encode(s);};
    var XHR=window.XMLHttpRequest=function(){this.readyState=0;this.status=0;this.responseText='';this.onreadystatechange=null;};
    XHR.prototype.open=function(m,u){this._url=u;this.readyState=1;};
    XHR.prototype.setRequestHeader=function(){};
    XHR.prototype.send=function(b){this.readyState=4;this.status=200;if(this.onreadystatechange)try{this.onreadystatechange();}catch(e){}};
    XHR.prototype.addEventListener=function(){};XHR.prototype.getAllResponseHeaders=function(){return'';};
    XHR.UNSENT=0;XHR.OPENED=1;XHR.DONE=4;
    window.WebSocket=function(){this.readyState=0;};WebSocket.prototype.send=function(){};WebSocket.prototype.close=function(){};
    window.Worker=function(){this.onmessage=null;this.onerror=null;};
    Worker.prototype.postMessage=function(){};Worker.prototype.terminate=function(){};
    window.MessageChannel=function(){var s={postMessage:function(){},onmessage:null,close:function(){}};this.port1=s;this.port2=s;};
    window.fetch=function(){return Promise.resolve({json:function(){return Promise.resolve({});},text:function(){return Promise.resolve('');},status:200,ok:true,headers:{get:function(){return null;}}});};
    window.console={log:function(){},warn:function(){},error:function(){},info:function(){},debug:function(){},trace:function(){}};
    window.Event=function(t){this.type=t;};window.CustomEvent=function(t,o){this.type=t;this.detail=(o||{}).detail;};
    window.performance={now:function(){return Date.now();}};
    var _s={};window.localStorage={getItem:function(k){return _s[k]||null;},setItem:function(k,v){_s[k]=v;}};
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

# 3. Load in iv8
with iv8.JSContext(mode="prod") as ctx:
    ctx.eval(bridge, name="bridge.js")
    print("[iv8] Bridge loaded", flush=True)
    ctx.eval(patched, name="app.js")
    print("[iv8] app.js loaded", flush=True)
    try: ctx.eval("__iv8__.eventLoop.drain()")
    except: pass

    AC = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
    SM2_KEY = "009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42"
    ts = int(time.time())
    nonce = ''.join(random.choice(string.ascii_letters+string.digits) for _ in range(8))
    x_tif_sig = hashlib.sha256(f'{ts}{nonce}{ts}'.encode()).hexdigest()

    # Article params
    params_str = json.dumps({"addr":"","regnCode":"110000","medinsName":"","medinsLvCode":"","medinsTypeCode":"","openElec":"","pageNum":1,"pageSize":10,"queryDataSource":"es"})

    # Internal SM4 encrypt
    enc_data = ctx.eval(f"""
        (function(){{
            var k=window.__k, enc=window.__c.sm4.encrypt;
            var utf8=window.__utf8_encode({json.dumps(params_str)});
            var pb=Array.from(utf8);
            var pad=16-(pb.length%16);
            for(var i=0;i<pad;i++)pb.push(pad);
            var a=enc(pb,k), hex='';
            for(var i=0;i<a.length;i++)hex+=('0'+(a[i]&0xFF).toString(16)).slice(-2);
            return hex;
        }})()
    """)

    # Internal SM2 sign
    inner = json.dumps({"data":{"encData":enc_data},"appCode":AC,"version":"1.0.0","encType":"SM4","signType":"SM2","timestamp":ts})
    sign_result = ctx.eval(f"""
        (function(){{
            var doSig=window._m4d09.doSignature;
            var hex=doSig({json.dumps(inner)},'{SM2_KEY}',{{hash:true}});
            var bytes=[],b64;
            for(var i=0;i<hex.length;i+=2)bytes.push(parseInt(hex.substr(i,2),16));
            try{{b64=btoa(String.fromCharCode.apply(null,bytes));}}catch(e){{b64='';}}
            return JSON.stringify({{hexLen:hex.length,byteLen:bytes.length,b64Len:b64.length,b64:b64}});
        }})()
    """)
    sig_info = json.loads(sign_result)
    print(f"[iv8] SM4 encData: {enc_data[:40]}...", flush=True)
    print(f"[iv8] SM2 sign: {sig_info['hexLen']}hex→{sig_info['byteLen']}B→{sig_info['b64Len']}b64", flush=True)

    # Send to API
    body_obj = {"data":{"data":{"encData":enc_data},"appCode":AC,"version":"1.0.0","encType":"SM4","signType":"SM2","timestamp":ts,"signData":sig_info["b64"]}}
    body_json = json.dumps(body_obj, separators=(",",":"))

    node_js = f'''
    const https=require('https');
    const body={json.dumps(body_json)};
    const req=https.request({{
        hostname:'fuwu.nhsa.gov.cn',port:443,
        path:'/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital',
        method:'POST',
        headers:{{
            'Accept':'application/json','Content-Type':'application/json',
            'channel':'web','x-tif-paasid':'undefined',
            'x-tif-signature':'{x_tif_sig}','x-tif-timestamp':'{ts}','x-tif-nonce':'{nonce}',
            'contentType':'application/x-www-form-urlencoded',
            'X-Tingyun':'c=B|4Nl_NnGbjwY;x=dbaf776fd2154ec1',
            'Origin':'https://fuwu.nhsa.gov.cn','Referer':'https://fuwu.nhsa.gov.cn/nationalHallSt/',
            'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
            'sec-ch-ua':'"Chromium";v="21"," Not;A Brand";v="99"',
            'sec-ch-ua-mobile':'?0','sec-ch-ua-platform':'"Windows"',
            'Content-Length':Buffer.byteLength(body),
        }},rejectUnauthorized:false,
    }},(res)=>{{let d='';res.on('data',c=>d+=c);res.on('end',()=>{{const r=JSON.parse(d);console.log('Code:'+r.code+' Msg:'+r.message);if(r.code===0){{try{{const sm4=require('sm-crypto').sm4;const SM4_KEY=Buffer.from('C3AE5873D08418DA','ascii').toString('hex');const dec=sm4.decrypt(r.data.data.encData,SM4_KEY,{{mode:'cbc',iv:'00000000000000000000000000000000'}});console.log('Decrypted:'+dec.substring(0,500));}}catch(e){{}}}}}});}});
    req.on('error',e=>console.error('Error:'+e.message));req.write(body);req.end();
    '''
    print(f"[test] Sending with internal SM4+SM2+correct params...", flush=True)
    r = subprocess.run(["node","-e",node_js], capture_output=True, text=True, cwd=str(HERE), timeout=20)
    print(r.stdout.strip(), flush=True)
    if r.stderr: print(f"Stderr: {r.stderr[:200]}", flush=True)
