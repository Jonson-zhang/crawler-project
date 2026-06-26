/**
 * Boss直聘 __zp_stoken__ 离线签名 (最终版)
 * 用法: node sign_boss.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// ===== 所有定义都在闭包内，确保 instanceof 正确 =====
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }

// 这个 map 保存所有类的引用
var classes = {};

// ===== 浏览器类层次 =====
function defineClass(name, parent) {
    var c = function() {};
    if (parent) {
        c.prototype = Object.create(parent.prototype);
        c.prototype.constructor = c;
    }
    sn(c, name);
    classes[name] = c;
    return c;
}
var EvtTarget = defineClass('EventTarget');
var Window = defineClass('Window', EvtTarget);
var Navigator = defineClass('Navigator', EvtTarget);
var Document = defineClass('Document', EvtTarget);
var HTMLElement = defineClass('HTMLElement', EvtTarget);
var HTMLHtmlElement = defineClass('HTMLHtmlElement', HTMLElement);
var HTMLHeadElement = defineClass('HTMLHeadElement', HTMLElement);
var HTMLBodyElement = defineClass('HTMLBodyElement', HTMLElement);
var HTMLCanvasElement = defineClass('HTMLCanvasElement', HTMLElement);
var HTMLIFrameElement = defineClass('HTMLIFrameElement', HTMLElement);
var HTMLScriptElement = defineClass('HTMLScriptElement', HTMLElement);
var HTMLImageElement = defineClass('HTMLImageElement', HTMLElement);
var CanvasRenderingContext2D = defineClass('CanvasRenderingContext2D');
var Location = defineClass('Location');
var Screen = defineClass('Screen');
var History = defineClass('History');
var Storage = defineClass('Storage');
var Performance = defineClass('Performance');

// HTMLElement 属性
var hProto = HTMLElement.prototype;
hProto.offsetWidth=1920;hProto.offsetHeight=1080;hProto.clientWidth=1920;hProto.clientHeight=1080;
hProto.style={};hProto.className='';hProto.id='';hProto.innerHTML='';hProto.textContent='';
hProto.appendChild=mf('appendChild');hProto.removeChild=mf('removeChild');
hProto.setAttribute=mf('setAttribute');hProto.getAttribute=function(){return null};sn(hProto.getAttribute,'getAttribute');
hProto.getBoundingClientRect=function(){return{top:0,left:0,width:1920,height:1080,right:1920,bottom:1080}};
sn(hProto.getBoundingClientRect,'getBoundingClientRect');
hProto.focus=mf('focus');hProto.blur=mf('blur');hProto.click=mf('click');

// Canvas 元素
var cProto=HTMLCanvasElement.prototype;
cProto.width=300;cProto.height=150;
cProto.getContext=function(type){
    if(type!=='2d')return null;
    var ctx = new CanvasRenderingContext2D();
    ['fillText','fillRect','clearRect','strokeText','beginPath','closePath','moveTo','lineTo','arc','fill','stroke','clip','save','restore','scale','rotate','translate','transform','setTransform'].forEach(function(m){ctx[m]=mf(m)});
    ctx.measureText=function(t){return{width:t.length*10}};
    ctx.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};
    ctx.putImageData=mf('putImageData');ctx.drawImage=mf('drawImage');ctx.createPattern=mf('createPattern');
    ctx.createLinearGradient=function(){return{addColorStop:mf('addColorStop')}};
    ctx.createRadialGradient=function(){return{addColorStop:mf('addColorStop')}};
    ctx.toDataURL=function(){return'data:image/png;base64,test'};
    ctx.canvas=null;
    return ctx;
};sn(cProto.getContext,'getContext');
cProto.toDataURL=function(){return'data:image/png;base64,test'};sn(cProto.toDataURL,'toDataURL');

// ===== Navigator =====
var nav = new Navigator();
nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion='5.0 (Windows)';nav.platform='Win32';nav.language='zh-CN';
nav.languages=['zh-CN','zh'];nav.cookieEnabled=true;nav.webdriver=false;
nav.hardwareConcurrency=8;nav.maxTouchPoints=0;
nav.vendor='';nav.vendorSub='';nav.productSub='20100101';
nav.doNotTrack='1';nav.onLine=true;
nav.deviceMemory=undefined;nav.webkitTemporaryStorage=undefined;
// plugins
var pls={length:3,refresh:mf('PluginArray.refresh')};
pls.item=mf('PluginArray.item');pls.namedItem=mf('PluginArray.namedItem');
for(var i=0;i<3;i++){pls[i]={name:'Plugin'+i,filename:'plugin'+i+'.dll',description:'',length:1};pls[i][0]={type:'application/pdf',suffixes:'pdf',description:''}}
nav.plugins=pls;
// mimeTypes
var mts={length:2};mts.item=mf('MimeTypeArray.item');mts.namedItem=mf('MimeTypeArray.namedItem');
mts[0]={type:'application/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]};
mts[1]={type:'text/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]};
nav.mimeTypes=mts;

// ===== Document =====
var doc = new Document();
doc.createElement=function(tag){
    if(tag==='iframe'){var f=new HTMLIFrameElement();f.style={};f.contentWindow=null;f.src='about:blank';f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};return f}
    if(tag==='canvas')return new HTMLCanvasElement();
    if(tag==='script'){var s=new HTMLScriptElement();s.src='';s.type='';s.onload=null;s.onerror=null;s.onreadystatechange=null;s.parentNode=null;s.setAttribute=mf('setAttribute');return s}
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
doc.getElementById=function(){return new HTMLElement()};sn(doc.getElementById,'getElementById');
doc.getElementsByClassName=function(){return[]};sn(doc.getElementsByClassName,'getElementsByClassName');
doc.querySelector=function(){return new HTMLElement()};sn(doc.querySelector,'querySelector');
doc.querySelectorAll=function(){return[]};sn(doc.querySelectorAll,'querySelectorAll');
doc.addEventListener=mf('addEventListener');
doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';
doc.visibilityState='visible';doc.title='BOSS直聘';doc.referrer='';
// cookie getter
var docCookie='';
Object.defineProperty(doc,'cookie',{
    get: function(){return docCookie||('__a=16364972.1782458175..1782458175.2.1.2.2;__c=1782458175;__g=-')},
    set: function(v){docCookie=v},
    configurable:true,enumerable:true
});

// ===== Location =====
var loc = new Location();
loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname='www.zhipin.com';loc.host='www.zhipin.com';loc.pathname='/web/geek/jobs';
loc.protocol='https:';loc.origin='https://www.zhipin.com';loc.port='';
loc.search='?city=101010100&query=python';loc.hash='';

// ===== Screen =====
var scr = new Screen();
scr.width=1920;scr.height=1080;scr.availWidth=1920;scr.availHeight=1040;
scr.colorDepth=24;scr.pixelDepth=24;

// ===== History =====
var hist = new History();
hist.length=1;hist.pushState=mf('pushState');hist.replaceState=mf('replaceState');
hist.back=mf('back');hist.forward=mf('forward');hist.go=mf('go');

// ===== Storage =====
function makeStorage(){
    var s=new Storage();
    s.getItem=mf('getItem');s.setItem=mf('setItem');s.removeItem=mf('removeItem');
    s.clear=mf('clear');s.key=mf('key');s.length=0;
    return s;
}

// ===== Performance =====
var perf = new Performance();
perf.now=function(){return Date.now()};sn(perf.now,'now');
var nowTs=Date.now();
perf.timing={navigationStart:nowTs,fetchStart:nowTs,domainLookupStart:nowTs,domainLookupEnd:nowTs,connectStart:nowTs,connectEnd:nowTs,requestStart:nowTs,responseStart:nowTs,responseEnd:nowTs,domLoading:nowTs,domInteractive:nowTs,domContentLoadedEventStart:nowTs,domContentLoadedEventEnd:nowTs,domComplete:nowTs,loadEventStart:nowTs,loadEventEnd:nowTs};

// ===== Crypto =====
var cryptoFn = function(arr){
    var b = require('crypto').randomBytes(arr.length);
    for(var i=0;i<arr.length;i++)arr[i]=b[i];
    return arr;
};
sn(cryptoFn,'getRandomValues');

// ===== XMLHttpRequest =====
var XHR = function(){};
XHR.prototype.open=mf('open');XHR.prototype.send=mf('send');
XHR.prototype.setRequestHeader=mf('setRequestHeader');XHR.prototype.abort=mf('abort');
XHR.prototype.getResponseHeader=function(){return null};XHR.prototype.getAllResponseHeaders=function(){return''};
XHR.prototype.readyState=0;XHR.prototype.status=0;XHR.prototype.responseText='';XHR.prototype.DONE=4;
sn(XHR,'XMLHttpRequest');

// ===== MutationObserver =====
var MO = function(cb){this.observe=mf('observe');this.disconnect=mf('disconnect');this.takeRecords=mf('takeRecords')};
sn(MO,'MutationObserver');

// ===== 其他通用浏览器类 =====
var genericClasses=[
'Blob','CDATASection','CSSRule','CSSRuleList','CSSStyleDeclaration','CSSStyleSheet',
'CloseEvent','Comment','CompositionEvent','Crypto','CustomEvent','DOMException',
'DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent',
'DocumentFragment','DocumentType','ErrorEvent','Event','EventSource',
'File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers',
'HTMLAllCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement',
'HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLCollection','HTMLDListElement',
'HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement',
'HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement',
'HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement',
'HTMLHeadingElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement',
'HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMediaElement',
'HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement',
'HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement',
'HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement',
'HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement',
'HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleSheet',
'HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement',
'HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement',
'HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement',
'HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','ImageData',
'InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel',
'MessageEvent','MessagePort','MimeType','MimeTypeArray','MouseEvent',
'MutationRecord','NamedNodeMap','Node','NodeFilter','NodeIterator','NodeList',
'Notification','PageTransitionEvent','Path2D','PerformanceEntry',
'PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming',
'PerformanceTiming','Plugin','PluginArray','PointerEvent','PopStateEvent',
'ProcessingInstruction','ProgressEvent','PromiseRejectionEvent',
'RTCPeerConnection','RadioNodeList','Range','ReadableStream','Request',
'ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement',
'SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement',
'SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement',
'SVGMetadataElement','SVGNumber','SVGPathElement','SVGPolygonElement','SVGPolylineElement',
'SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement',
'SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement',
'SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent',
'SubtleCrypto','Text','TextDecoder','TextEncoder','Touch','TouchEvent','TouchList',
'TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState',
'VisualViewport','WebSocket','WheelEvent','Worker','WritableStream',
'XMLDocument','XMLHttpRequestEventTarget','XMLSerializer','XPathEvaluator',
'XPathResult','XSLTProcessor'
].reduce(function(acc,n){
    acc[n]=mc(n);
    return acc;
},{});

// ===== 构建 sandbox =====
var sandbox = Object.assign({}, genericClasses, {
    Object, Array, Function, String, Number, Boolean, Date, Math,
    RegExp, Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
});

// 类定义
Object.assign(sandbox, {
    EventTarget: EvtTarget, Window: Window, Navigator: Navigator,
    Document: Document, HTMLElement: HTMLElement, HTMLHtmlElement: HTMLHtmlElement,
    HTMLHeadElement: HTMLHeadElement, HTMLBodyElement: HTMLBodyElement,
    HTMLCanvasElement: HTMLCanvasElement, HTMLIFrameElement: HTMLIFrameElement,
    HTMLScriptElement: HTMLScriptElement, HTMLImageElement: HTMLImageElement,
    CanvasRenderingContext2D: CanvasRenderingContext2D,
    Location: Location, Screen: Screen, History: History,
    Storage: Storage, Performance: Performance,
    XMLHttpRequest: XHR, MutationObserver: MO,
    Image: function(){return new HTMLImageElement()},
});

// 浏览器对象
Object.assign(sandbox, {
    window: null, // set below
    self: null, top: null, parent: null, globalThis: null,
    console: {log:function(){},error:function(){},warn:function(){},info:function(){}},
    navigator: nav, document: doc, location: loc, screen: scr, history: hist,
    localStorage: makeStorage(), sessionStorage: makeStorage(),
    performance: perf,
    crypto: {getRandomValues:cryptoFn,subtle:null},
    btoa: function(s){return Buffer.from(s).toString('base64')},
    atob: function(s){return Buffer.from(s,'base64').toString()},
});
// 自引用
sandbox.window=sandbox;sandbox.self=sandbox;sandbox.top=sandbox;sandbox.parent=sandbox;sandbox.globalThis=sandbox;
// native toString for btoa/atob
sn(sandbox.btoa,'btoa');sn(sandbox.atob,'atob');
// window 属性
sandbox.innerWidth=1920;sandbox.innerHeight=1080;sandbox.outerWidth=1920;sandbox.outerHeight=1080;
sandbox.devicePixelRatio=1;sandbox.screenX=0;sandbox.screenY=0;sandbox.scrollX=0;sandbox.scrollY=0;
sandbox.name='';sandbox.closed=false;sandbox.length=0;sandbox.opener=null;
sandbox.origin='https://www.zhipin.com';sandbox.isSecureContext=true;
sandbox.postMessage=mf('postMessage');sandbox.addEventListener=mf('addEventListener');
sandbox.removeEventListener=mf('removeEventListener');sandbox.dispatchEvent=mf('dispatchEvent');
sandbox.fetch=mf('fetch');
sandbox.matchMedia=function(){return{matches:false,media:'',addListener:mf('addListener')}};sn(sandbox.matchMedia,'matchMedia');
sandbox.getComputedStyle=function(){return{}};sn(sandbox.getComputedStyle,'getComputedStyle');
sandbox.getSelection=function(){return null};sn(sandbox.getSelection,'getSelection');
sandbox.requestAnimationFrame=mf('requestAnimationFrame');
sandbox.eval=function(s){return vm.runInContext(s,vm.createContext(sandbox))};
sandbox.print=mf('print');sandbox.open=mf('open');sandbox.close=mf('close');
sandbox.focus=mf('focus');sandbox.blur=mf('blur');sandbox.stop=mf('stop');
sandbox.scroll=mf('scroll');sandbox.scrollTo=mf('scrollTo');sandbox.scrollBy=mf('scrollBy');
sandbox.alert=mf('alert');sandbox.confirm=mf('confirm');sandbox.prompt=mf('prompt');
sandbox.Audio=mf('Audio');
sandbox.origin='https://www.zhipin.com';

// ===== 执行 =====
var ctx = vm.createContext(sandbox);
try {
    new vm.Script(code).runInContext(ctx);
    if (typeof sandbox.ABC !== 'undefined') {
        var seed = process.argv[4];
        var ts = parseInt(process.argv[5]);
        process.stdout.write(new sandbox.ABC().z(seed, ts));
    } else {
        process.stderr.write('ABC not defined\n');
        process.exit(1);
    }
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
