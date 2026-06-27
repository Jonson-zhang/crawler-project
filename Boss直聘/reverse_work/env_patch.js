/**
 * Boss直聘 浏览器环境补丁 (用于vm沙箱)
 * 所有浏览器对象都有正确的原型链 + native toString
 */

// -- Native toString protection --
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) {
    mm.set(o, 'function ' + n + '() { [native code] }');
    if (o.prototype) o.prototype.constructor = o;
}
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = {}; sn(f, n); return f; }

// -- Constructor hierarchy --
function EventTarget(){} sn(EventTarget,'EventTarget');

function Window(){}
Window.prototype = new EventTarget(); sn(Window,'Window');

function Navigator(){}
Navigator.prototype = new EventTarget(); sn(Navigator,'Navigator');

function Document(){}
Document.prototype = new EventTarget(); sn(Document,'Document');

function HTMLElement(){}
HTMLElement.prototype = new EventTarget();
['offsetWidth','offsetHeight','clientWidth','clientHeight'].forEach(function(k){HTMLElement.prototype[k]=1920});
HTMLElement.prototype.offsetHeight=1080; HTMLElement.prototype.clientHeight=1080;
HTMLElement.prototype.style={}; HTMLElement.prototype.className=''; HTMLElement.prototype.id='';
HTMLElement.prototype.innerHTML=''; HTMLElement.prototype.textContent='';
HTMLElement.prototype.appendChild=mf('appendChild');
HTMLElement.prototype.removeChild=mf('removeChild');
HTMLElement.prototype.setAttribute=mf('setAttribute');
HTMLElement.prototype.getAttribute=function(){return null};
sn(HTMLElement.prototype.getAttribute,'getAttribute');
HTMLElement.prototype.getBoundingClientRect=function(){return{top:0,left:0,width:1920,height:1080,right:1920,bottom:1080}};
sn(HTMLElement.prototype.getBoundingClientRect,'getBoundingClientRect');
sn(HTMLElement,'HTMLElement');

function HTMLHtmlElement(){}
HTMLHtmlElement.prototype = new HTMLElement(); sn(HTMLHtmlElement,'HTMLHtmlElement');

function HTMLHeadElement(){}
HTMLHeadElement.prototype = new HTMLElement(); sn(HTMLHeadElement,'HTMLHeadElement');

function HTMLBodyElement(){}
HTMLBodyElement.prototype = new HTMLElement(); sn(HTMLBodyElement,'HTMLBodyElement');

function HTMLCanvasElement(){}
HTMLCanvasElement.prototype = new HTMLElement();
HTMLCanvasElement.prototype.width=300; HTMLCanvasElement.prototype.height=150;
HTMLCanvasElement.prototype.getContext=function(t){return t==='2d'?makeCtx():null};
sn(HTMLCanvasElement.prototype.getContext,'getContext');
HTMLCanvasElement.prototype.toDataURL=function(){return'data:image/png;base64,test'};
sn(HTMLCanvasElement.prototype.toDataURL,'toDataURL');
sn(HTMLCanvasElement,'HTMLCanvasElement');

function Location(){}
sn(Location,'Location');
function Screen(){}
sn(Screen,'Screen');
function History(){}
sn(History,'History');
function Storage(){}
sn(Storage,'Storage');
function Performance(){}
sn(Performance,'Performance');

function CanvasRenderingContext2D(){}
// methods added in makeCtx()

// -- Canvas 2D context --
function makeCtx(){
    var ctx = new CanvasRenderingContext2D();
    ['fillText','fillRect','clearRect','strokeText','strokeRect','beginPath','closePath',
     'moveTo','lineTo','arc','bezierCurveTo','fill','stroke','clip','save','restore',
     'scale','rotate','translate','transform','setTransform','putImageData',
     'drawImage','createPattern'].forEach(function(m){ctx[m]=mf(m)});
    ctx.measureText=function(t){return{width:t.length*10}};
    ctx.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};
    ctx.createLinearGradient=function(){return{addColorStop:mf('addColorStop')}};
    ctx.createRadialGradient=function(){return{addColorStop:mf('addColorStop')}};
    ctx.toDataURL=function(){return'data:image/png;base64,test'};
    ctx.canvas=null;
    return ctx;
}

// -- Plugin objects --
var pluginsArr=[];
['Chrome PDF Plugin','Chrome PDF Viewer','Native Client'].forEach(function(n,i){
    var p={name:n,filename:'internal-pdf-viewer',description:'',length:i===0?2:1};
    p[0]={type:'application/pdf',suffixes:'pdf',description:''};
    p[1]={type:'text/pdf',suffixes:'pdf',description:''};
    pluginsArr.push(p);
});
var plugins={length:pluginsArr.length,refresh:mf('refresh')};
plugins.item=mf('PluginArray.item');plugins.namedItem=mf('PluginArray.namedItem');
pluginsArr.forEach(function(p,i){plugins[i]=p});
var mimeTypes={length:2};mimeTypes.item=mf('MimeTypeArray.item');mimeTypes.namedItem=mf('MimeTypeArray.namedItem');
mimeTypes[0]={type:'application/pdf',suffixes:'pdf',description:'',enabledPlugin:plugins[0]};
mimeTypes[1]={type:'text/pdf',suffixes:'pdf',description:'',enabledPlugin:plugins[0]};

// -- Document --
var doc = new Document();
doc.createElement=function(tag){
    if(tag==='iframe'){var f=new HTMLHtmlElement();f.style={};f.contentWindow=globalThis;f.src='';f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};return f}
    if(tag==='canvas')return new HTMLCanvasElement();
    if(tag==='script'){var s=new HTMLElement();s.src='';s.onload=null;s.onreadystatechange=null;s.parentNode=null;return s}
    return new HTMLElement();
};sn(doc.createElement,'createElement');
doc.createElementNS=function(ns,tag){return doc.createElement(tag)};sn(doc.createElementNS,'createElementNS');
doc.body=new HTMLBodyElement();
doc.documentElement=new HTMLHtmlElement();doc.documentElement.tagName='HTML';
doc.head=new HTMLHeadElement();
doc.getElementsByTagName=function(t){
    if(t==='head')return{item:function(i){return doc.head},length:1};
    return{item:function(){return null},length:0};
};sn(doc.getElementsByTagName,'getElementsByTagName');
doc.hidden=false;doc.readyState='complete';doc.referrer='';doc.title='BOSS直聘';
doc.visibilityState='visible';doc.characterSet='UTF-8';
Object.defineProperty(doc,'cookie',{get:function(){return globalThis._zp_cookie||''},set:function(v){},configurable:true,enumerable:true});

// -- Navigator --
var nav = new Navigator();
nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion='5.0 (Windows)';nav.platform='Win32';nav.language='zh-CN';
nav.languages=['zh-CN','zh'];nav.cookieEnabled=true;nav.webdriver=false;
nav.hardwareConcurrency=8;nav.maxTouchPoints=0;
nav.vendor='';nav.vendorSub='';nav.productSub='20100101';
nav.doNotTrack='1';nav.onLine=true;
nav.deviceMemory=undefined;nav.webkitTemporaryStorage=undefined;
nav.plugins=plugins;nav.mimeTypes=mimeTypes;

// -- Location --
var loc = new Location();
loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname='www.zhipin.com';loc.host='www.zhipin.com';loc.pathname='/web/geek/jobs';
loc.protocol='https:';loc.origin='https://www.zhipin.com';loc.port='';
loc.search='?city=101010100&query=python';loc.hash='';

// -- Screen --
var scr = new Screen();
scr.width=1920;scr.height=1080;scr.availWidth=1920;scr.availHeight=1040;
scr.colorDepth=24;scr.pixelDepth=24;

// -- History --
var hist = new History();
hist.length=1;hist.pushState=mf('pushState');hist.replaceState=mf('replaceState');
hist.back=mf('back');hist.forward=mf('forward');hist.go=mf('go');

// -- Storage --
function makeStorage(){
    var s=new Storage();
    s.getItem=mf('getItem');s.setItem=mf('setItem');s.removeItem=mf('removeItem');
    s.clear=mf('clear');s.key=mf('key');s.length=0;
    return s;
}

// -- Performance --
var perf = new Performance();
perf.now=function(){return Date.now()};sn(perf.now,'now');
var ts=Date.now();
perf.timing={navigationStart:ts,fetchStart:ts,domainLookupStart:ts,domainLookupEnd:ts,connectStart:ts,connectEnd:ts,requestStart:ts,responseStart:ts,responseEnd:ts,domLoading:ts,domInteractive:ts,domContentLoadedEventStart:ts,domContentLoadedEventEnd:ts,domComplete:ts,loadEventStart:ts,loadEventEnd:ts};

// -- Crypto --
var crypto_mod = null; try{ crypto_mod = require('crypto'); }catch(e){}
var cryptoObj = {};
cryptoObj.getRandomValues = function(arr){ var b=crypto_mod.randomBytes(arr.length); for(var i=0;i<arr.length;i++)arr[i]=b[i]; return arr; };
sn(cryptoObj.getRandomValues,'getRandomValues');
cryptoObj.subtle = null;

// -- Window-level --
var win = {};
win.innerWidth=1920;win.innerHeight=1080;win.outerWidth=1920;win.outerHeight=1080;
win.devicePixelRatio=1;win.screenX=0;win.screenY=0;win.scrollX=0;win.scrollY=0;
win.name='';win.closed=false;win.length=0;win.opener=null;win.origin='https://www.zhipin.com';
win.isSecureContext=true;win.status='';

// -- Output to global --
module.exports = {
    mm: mm, sn: sn, mf: mf, mc: mc,
    Window: Window, Navigator: Navigator, Document: Document,
    HTMLElement: HTMLElement, HTMLHtmlElement: HTMLHtmlElement,
    HTMLHeadElement: HTMLHeadElement, HTMLBodyElement: HTMLBodyElement,
    HTMLCanvasElement: HTMLCanvasElement, Location: Location,
    Screen: Screen, History: History, Storage: Storage, Performance: Performance,
    CanvasRenderingContext2D: CanvasRenderingContext2D,
    doc: doc, nav: nav, loc: loc, scr: scr, hist: hist,
    Storage: Storage, makeStorage: makeStorage,
    perf: perf, cryptoObj: cryptoObj, win: win,
};
