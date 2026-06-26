/**
 * Boss直聘 JSVMP 补环境 (v3 - 精确文档对象)
 * Chrome 139, Windows 10, zh-CN
 */
(function(){
    var $t=Function.prototype.toString,$c=Function.prototype.call.bind($t),mm=new Map;
    var mt=function t(){return typeof this==='function'&&mm.get(this)||$c(this)};
    Object.defineProperty(Function.prototype,'toString',{enumerable:false,configurable:true,writable:true,value:mt});
    function sn(o,v){mm.set(o,v)}sn(Function.prototype.toString,'function toString() { [native code] }');
    global.setNative=function(f,n){Object.defineProperty(f,'name',{value:n||f.name||'',writable:false,enumerable:false,configurable:true});sn(f,'function '+(n||f.name||'')+'() { [native code] }')};
})();

window=globalThis;global.window=window;global.self=window;global.top=window;global.parent=window;

function Navigator(){}function Document(){}function HTMLElement(){}function HTMLHtmlElement(){}
function Location(){}function Screen(){}function History(){}function Storage(){}function Performance(){}
function EventTarget(){}function CanvasRenderingContext2D(){}

['Navigator','Document','HTMLElement','HTMLHtmlElement','Location','Screen','History','Storage','Performance','EventTarget','CanvasRenderingContext2D'].forEach(function(n){setNative(global[n],n)});

// --- navigator ---
navigator=new Navigator();
var navProto=Navigator.prototype;
navProto.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
navProto.appVersion=navProto.userAgent; navProto.platform='Win32'; navProto.language='zh-CN';
navProto.languages=['zh-CN','zh','en']; navProto.cookieEnabled=true; navProto.webdriver=false;
navProto.hardwareConcurrency=2; navProto.maxTouchPoints=1; navProto.vendor=''; navProto.vendorSub='';
navProto.productSub='20100101'; navProto.doNotTrack='1'; navProto.onLine=true;

// --- document ---
document=new Document();
docProto=Document.prototype;
docProto.addEventListener=function(){};
Object.defineProperty(docProto,'cookie',{get:function(){return'__a='+(global._zp_a||'0.0..0.1.1.1.1')+'; __c='+(global._zp_ts||'0')+'; __g=-'},set:function(){},enumerable:true,configurable:true});
docProto.referrer='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
docProto.title='「北京招聘」-BOSS直聘'; docProto.readyState='complete'; docProto.hidden=false;
docProto.visibilityState='visible'; docProto.characterSet='UTF-8';

// --- HTMLElement (full) ---
HTMLElement.prototype=new EventTarget();
['offsetWidth','offsetHeight','clientWidth','clientHeight'].forEach(function(k){HTMLElement.prototype[k]=1920});
HTMLElement.prototype.offsetHeight=1080;HTMLElement.prototype.clientHeight=1080;
HTMLElement.prototype.style={};HTMLElement.prototype.className='';HTMLElement.prototype.id='';
HTMLElement.prototype.innerHTML='';HTMLElement.prototype.textContent='';
HTMLElement.prototype.appendChild=function(){};setNative(HTMLElement.prototype.appendChild,'appendChild');
HTMLElement.prototype.removeChild=function(){};setNative(HTMLElement.prototype.removeChild,'removeChild');
HTMLElement.prototype.setAttribute=function(){};setNative(HTMLElement.prototype.setAttribute,'setAttribute');
HTMLElement.prototype.getAttribute=function(a){return null};setNative(HTMLElement.prototype.getAttribute,'getAttribute');
HTMLElement.prototype.getBoundingClientRect=function(){return{top:0,left:0,width:1920,height:1080,right:1920,bottom:1080}};setNative(HTMLElement.prototype.getBoundingClientRect,'getBoundingClientRect');
HTMLElement.prototype.focus=function(){};setNative(HTMLElement.prototype.focus,'focus');

HTMLHtmlElement.prototype=new HTMLElement();setNative(HTMLHtmlElement,'HTMLHtmlElement');
document.documentElement=new HTMLHtmlElement();document.body=new HTMLElement();document.head=new HTMLElement();

// createElement: 特殊处理 iframe → contentWindow
document.createElement=function(tag){
    var el=new HTMLElement();
    if(tag==='iframe'){
        // 模拟 iframe 的 contentWindow（指向 global）
        el.contentWindow=globalThis;
        el.contentDocument={body:document.body,documentElement:document.documentElement};
        el.style={};
    }
    return el;
};setNative(document.createElement,'createElement');
document.getElementById=function(id){return new HTMLElement()};setNative(document.getElementById,'getElementById');
document.getElementsByClassName=function(c){return[]};setNative(document.getElementsByClassName,'getElementsByClassName');
document.getElementsByTagName=function(t){return{item:function(){return null},length:0}};setNative(document.getElementsByTagName,'getElementsByTagName');
document.querySelector=function(s){return new HTMLElement()};setNative(document.querySelector,'querySelector');
document.querySelectorAll=function(s){return[]};setNative(document.querySelectorAll,'querySelectorAll');

// --- location ---
location=new Location();
['href','hostname','host','pathname'].forEach(function(k){Location.prototype[k]='https://www.zhipin.com/web/geek/jobs'});
Location.prototype.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
Location.prototype.protocol='https:';Location.prototype.port='';Location.prototype.pathname='/web/geek/jobs';
Location.prototype.search='?city=101010100&query=python';Location.prototype.hash='';Location.prototype.origin='https://www.zhipin.com';

// --- screen / history / storage / perf ---
screen=new Screen();Screen.prototype.width=1920;Screen.prototype.height=1080;Screen.prototype.availWidth=1920;Screen.prototype.availHeight=1040;Screen.prototype.colorDepth=24;Screen.prototype.pixelDepth=24;
history=new History();History.prototype.length=1;History.prototype.pushState=function(){};setNative(History.prototype.pushState,'pushState');History.prototype.replaceState=function(){};setNative(History.prototype.replaceState,'replaceState');
localStorage=new Storage();sessionStorage=new Storage();
['getItem','setItem','removeItem','clear','key'].forEach(function(k){
    Storage.prototype[k]=function(){return k==='getItem'||k==='key'?null:undefined};setNative(Storage.prototype[k],k);
});
Storage.prototype.length=0;
performance=new Performance();Performance.prototype.now=function(){return Date.now()};setNative(Performance.prototype.now,'now');

// --- crypto ---
try{window.crypto=globalThis.crypto||require('crypto');if(window.crypto.randomBytes&&!window.crypto.getRandomValues){
    window.crypto.getRandomValues=function(a){var b=require('crypto').randomBytes(a.length);for(var i=0;i<a.length;i++)a[i]=b[i];return a}
}}catch(e){}

// --- 挂载 ---
var w=window;var ws=['document','navigator','location','screen','history','localStorage','sessionStorage','performance'];
ws.forEach(function(k){w[k]=global[k]});
w.setTimeout=setTimeout;w.setInterval=setInterval;w.clearTimeout=clearTimeout;w.clearInterval=clearInterval;
w.Date=Date;w.Math=Math;w.parseInt=parseInt;w.parseFloat=parseFloat;w.JSON=JSON;
w.encodeURIComponent=encodeURIComponent;w.decodeURIComponent=decodeURIComponent;
w.btoa=function(s){return Buffer.from(s).toString('base64')};w.atob=function(s){return Buffer.from(s,'base64').toString()};
w.addEventListener=function(){};w.MutationObserver=function(){this.observe=function(){};this.disconnect=function(){}};