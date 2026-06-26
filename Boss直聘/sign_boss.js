/**
 * Boss直聘 __zp_stoken__ 离线签名 (v2.0)
 * 用法: node sign_boss.js <__a> <__c> <seed> <ts>
 *
 * 注意: JS 文件 (7c91433f.js) 每天凌晨可能更换，需配合主流程动态下载。
 * 文件名由 API code=37 响应中的 zpData.name 字段指定。
 */
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// ===== Native toString protection =====
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = {}; f.prototype.constructor = f; sn(f, n); return f; }

// ===== Browser class constructors =====
var brCls = [
'Blob','CDATASection','CSSRule','CSSRuleList','CSSStyleDeclaration','CSSStyleSheet',
'CanvasGradient','CanvasPattern','CanvasRenderingContext2D','CloseEvent','Comment',
'CompositionEvent','Crypto','CustomEvent','DOMException','DOMImplementation','DOMParser',
'DOMRect','DOMRectList','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent',
'Element','ErrorEvent','Event','EventSource','EventTarget','File','FileList','FileReader',
'FocusEvent','FormData','HashChangeEvent','Headers','HTMLAllCollection','HTMLAnchorElement',
'HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement',
'HTMLCollection','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement',
'HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement',
'HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement',
'HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLIFrameElement','HTMLImageElement',
'HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement',
'HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement',
'HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement',
'HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement',
'HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement',
'HTMLScriptElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement',
'HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement',
'HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement',
'HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement',
'HTMLUnknownElement','HTMLVideoElement','Image','ImageData','InputEvent',
'IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MessagePort',
'MimeType','MimeTypeArray','MouseEvent','MutationObserver','MutationRecord','NamedNodeMap',
'Navigator','Node','NodeFilter','NodeIterator','NodeList','Notification','PageTransitionEvent',
'Path2D','Performance','PerformanceEntry','PerformanceNavigation','PerformanceObserver',
'PerformanceResourceTiming','PerformanceTiming','Plugin','PluginArray','PointerEvent',
'PopStateEvent','ProcessingInstruction','ProgressEvent','PromiseRejectionEvent',
'RTCPeerConnection','RadioNodeList','Range','ReadableStream','Request','ResizeObserver',
'Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement',
'SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement',
'SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGNumber','SVGPathElement',
'SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement',
'SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement',
'SVGTextElement','SVGTitleElement','SVGUseElement','Screen','Selection','ShadowRoot',
'StorageEvent','SubmitEvent','SubtleCrypto','Text','TextDecoder','TextEncoder','Touch',
'TouchEvent','TouchList','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams',
'ValidityState','VisualViewport','WebSocket','WheelEvent','Window','Worker','WritableStream',
'XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer',
'XPathEvaluator','XPathResult','XSLTProcessor'
];

// ===== Built sandbox with proper prototype chain =====
var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math,
    RegExp, Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    eval: function(s) { return vm.runInContext(s, vm.createContext(sandbox)); },
};

// All browser classes
brCls.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

// ===== Object.prototype.toString fix =====
// Set Symbol.toStringTag on all browser constructors so that
// Object.prototype.toString.call(new Foo()) returns "[object Foo]"
var toStringTag = Symbol.toStringTag;
Object.keys(sandbox).forEach(function(k) {
    var v = sandbox[k];
    if (typeof v === 'function' && /^[A-Z]/.test(k) && v.prototype) {
        try { v.prototype[toStringTag] = k; } catch(e) {}
    }
});

// ===== Proper prototype hierarchy =====
function EvtTgt(){} sn(EvtTgt,'EventTarget'); EvtTgt.prototype[toStringTag] = 'EventTarget';

function Navigator(){} Navigator.prototype = Object.create(EvtTgt.prototype); Navigator.prototype.constructor = Navigator; sn(Navigator,'Navigator'); Navigator.prototype[toStringTag] = 'Navigator';

function Document(){} Document.prototype = Object.create(EvtTgt.prototype); Document.prototype.constructor = Document; sn(Document,'Document'); Document.prototype[toStringTag] = 'HTMLDocument';

function HTMLElement(){} HTMLElement.prototype = Object.create(EvtTgt.prototype); HTMLElement.prototype.constructor = HTMLElement; HTMLElement.prototype.offsetWidth=1920; HTMLElement.prototype.offsetHeight=1080; HTMLElement.prototype.clientWidth=1920; HTMLElement.prototype.clientHeight=1080; HTMLElement.prototype.style={}; HTMLElement.prototype.className=''; HTMLElement.prototype.id=''; HTMLElement.prototype.innerHTML=''; HTMLElement.prototype.textContent=''; HTMLElement.prototype.appendChild=mf('appendChild'); HTMLElement.prototype.removeChild=mf('removeChild'); HTMLElement.prototype.setAttribute=mf('setAttribute'); HTMLElement.prototype.getAttribute=function(){return null}; sn(HTMLElement.prototype.getAttribute,'getAttribute'); HTMLElement.prototype.getBoundingClientRect=function(){return{x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0}}; sn(HTMLElement.prototype.getBoundingClientRect,'getBoundingClientRect'); sn(HTMLElement,'HTMLElement'); HTMLElement.prototype[toStringTag] = 'HTMLElement';

function HTMLHtmlElement(){} HTMLHtmlElement.prototype = Object.create(HTMLElement.prototype); HTMLHtmlElement.prototype.constructor = HTMLHtmlElement; HTMLHtmlElement.prototype.tagName='HTML'; sn(HTMLHtmlElement,'HTMLHtmlElement'); HTMLHtmlElement.prototype[toStringTag] = 'HTMLHtmlElement';

function HTMLHeadElement(){} HTMLHeadElement.prototype = Object.create(HTMLElement.prototype); HTMLHeadElement.prototype.constructor = HTMLHeadElement; sn(HTMLHeadElement,'HTMLHeadElement'); HTMLHeadElement.prototype[toStringTag] = 'HTMLHeadElement';

function HTMLBodyElement(){} HTMLBodyElement.prototype = Object.create(HTMLElement.prototype); HTMLBodyElement.prototype.constructor = HTMLBodyElement; sn(HTMLBodyElement,'HTMLBodyElement'); HTMLBodyElement.prototype[toStringTag] = 'HTMLBodyElement';

function HTMLCanvasElement(){} HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype); HTMLCanvasElement.prototype.constructor = HTMLCanvasElement; HTMLCanvasElement.prototype.width=300; HTMLCanvasElement.prototype.height=150; HTMLCanvasElement.prototype.getContext=function(t){if(t==='2d'){var c={};c[toStringTag]='CanvasRenderingContext2D';['fillText','fillRect','clearRect','save','restore','scale','rotate','translate'].forEach(function(m){c[m]=mf(m)});c.measureText=function(t){return{width:t.length*10}};c.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};c.toDataURL=function(){return'data:image/png;base64,test'};return c}return null}; sn(HTMLCanvasElement.prototype.getContext,'getContext'); HTMLCanvasElement.prototype.toDataURL=function(){return'data:image/png;base64,test'}; sn(HTMLCanvasElement.prototype.toDataURL,'toDataURL'); sn(HTMLCanvasElement,'HTMLCanvasElement'); HTMLCanvasElement.prototype[toStringTag] = 'HTMLCanvasElement';

function HTMLIFrameElement(){} HTMLIFrameElement.prototype = Object.create(HTMLElement.prototype); HTMLIFrameElement.prototype.constructor = HTMLIFrameElement; sn(HTMLIFrameElement,'HTMLIFrameElement'); HTMLIFrameElement.prototype[toStringTag] = 'HTMLIFrameElement';

function HTMLScriptElement(){} HTMLScriptElement.prototype = Object.create(HTMLElement.prototype); HTMLScriptElement.prototype.constructor = HTMLScriptElement; sn(HTMLScriptElement,'HTMLScriptElement'); HTMLScriptElement.prototype[toStringTag] = 'HTMLScriptElement';

function Location(){} sn(Location,'Location'); Location.prototype[toStringTag] = 'Location';
function Screen(){} sn(Screen,'Screen'); Screen.prototype[toStringTag] = 'Screen';
function History(){} sn(History,'History'); History.prototype[toStringTag] = 'History';
function Storage(){} sn(Storage,'Storage'); Storage.prototype[toStringTag] = 'Storage';
function Performance(){} sn(Performance,'Performance'); Performance.prototype[toStringTag] = 'Performance';
function PluginArray_f(){} sn(PluginArray_f,'PluginArray'); PluginArray_f.prototype[toStringTag] = 'PluginArray';
function MimeTypeArray_f(){} sn(MimeTypeArray_f,'MimeTypeArray'); MimeTypeArray_f.prototype[toStringTag] = 'MimeTypeArray';

// Override sandbox classes with proper prototyped versions
sandbox.EventTarget = EvtTgt; sandbox.Navigator = Navigator; sandbox.Document = Document;
sandbox.HTMLElement = HTMLElement; sandbox.HTMLHtmlElement = HTMLHtmlElement;
sandbox.HTMLHeadElement = HTMLHeadElement; sandbox.HTMLBodyElement = HTMLBodyElement;
sandbox.HTMLCanvasElement = HTMLCanvasElement; sandbox.HTMLIFrameElement = HTMLIFrameElement;
sandbox.HTMLScriptElement = HTMLScriptElement; sandbox.Location = Location;
sandbox.Screen = Screen; sandbox.History = History; sandbox.Storage = Storage;
sandbox.Performance = Performance;

// ===== Navigator =====
var nav = new Navigator();
nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion='5.0 (Windows)';nav.platform='Win32';nav.language='zh-CN';
nav.languages=['zh-CN','zh'];nav.cookieEnabled=true;nav.webdriver=false;
nav.hardwareConcurrency=8;nav.maxTouchPoints=0;
nav.vendor='';nav.vendorSub='';nav.productSub='20100101';
nav.doNotTrack='1';nav.onLine=true;
nav.deviceMemory=undefined;nav.webkitTemporaryStorage=undefined;

// Plugins (5 PDF viewers — FireFox on Windows)
var plgnames=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
var pls=Object.create(PluginArray_f.prototype);pls.length=5;pls.refresh=mf('refresh');pls.item=mf('item');pls.namedItem=mf('namedItem');
for(var i=0;i<5;i++){
    var p={name:plgnames[i],filename:'internal-pdf-viewer',description:'Portable Document Format',length:2};
    p.item=mf('item');p.namedItem=mf('namedItem');
    p[0]={type:'application/pdf',suffixes:'pdf',description:'Portable Document Format',enabledPlugin:p};
    p[1]={type:'text/pdf',suffixes:'pdf',description:'Portable Document Format',enabledPlugin:p};
    pls[i]=p;
}
nav.plugins=pls;

// MimeTypes
var mts=Object.create(MimeTypeArray_f.prototype);mts.length=2;mts.item=mf('item');mts.namedItem=mf('namedItem');
mts[0]={type:'application/pdf',suffixes:'pdf',description:'Portable Document Format',enabledPlugin:pls[0]};
mts[1]={type:'text/pdf',suffixes:'pdf',description:'Portable Document Format',enabledPlugin:pls[0]};
nav.mimeTypes=mts;

// ===== Document =====
var doc = new Document();
doc.createElement=function(tag){
    if(tag==='iframe'){var f=new HTMLIFrameElement();f.style={};f.setAttribute=mf('setAttribute');f.src='about:blank';f.contentWindow=null;return f}
    if(tag==='canvas')return new HTMLCanvasElement();
    if(tag==='script'){var s=new HTMLScriptElement();s.src='';s.type='text/javascript';s.setAttribute=mf('setAttribute');return s}
    return new HTMLElement();
};sn(doc.createElement,'createElement');
doc.createElementNS=function(ns,tag){return doc.createElement(tag)};sn(doc.createElementNS,'createElementNS');
doc.body=new HTMLBodyElement();
doc.documentElement=new HTMLHtmlElement();
doc.head=new HTMLHeadElement();
doc.getElementsByTagName=function(t){if(t==='head')return{item:function(i){return doc.head},length:1};return{item:function(){return null},length:0}};
sn(doc.getElementsByTagName,'getElementsByTagName');
doc.getElementById=function(){return new HTMLElement()};sn(doc.getElementById,'getElementById');
doc.getElementsByClassName=function(){return[]};sn(doc.getElementsByClassName,'getElementsByClassName');
doc.querySelector=function(){return new HTMLElement()};sn(doc.querySelector,'querySelector');
doc.querySelectorAll=function(){return[]};sn(doc.querySelectorAll,'querySelectorAll');
doc.addEventListener=mf('addEventListener');
doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';
doc.visibilityState='visible';doc.title='BOSS直聘';doc.referrer='';
doc.domain='www.zhipin.com';doc.URL='https://www.zhipin.com/web/geek/jobs';
Object.defineProperty(doc,'cookie',{
    get: function(){ return '__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-'; },
    set: function(v){},
    configurable:true, enumerable:true
});

// ===== Location / Screen / History / Storage =====
var loc = new Location();
loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname='www.zhipin.com';loc.host='www.zhipin.com';loc.pathname='/web/geek/jobs';
loc.protocol='https:';loc.origin='https://www.zhipin.com';loc.port='';
loc.search='?city=101010100&query=python';loc.hash='';

var scr = new Screen();
scr.width=2560;scr.height=1440;scr.availWidth=2560;scr.availHeight=1440;
scr.colorDepth=24;scr.pixelDepth=24;

var hist = new History();
hist.length=1;hist.pushState=mf('pushState');hist.replaceState=mf('replaceState');
hist.back=mf('back');hist.forward=mf('forward');hist.go=mf('go');

function makeStorage(){
    var s = new Storage();
    s.getItem=mf('getItem');s.setItem=mf('setItem');s.removeItem=mf('removeItem');
    s.clear=mf('clear');s.key=mf('key');s.length=0;
    return s;
}

var perf = new Performance();
perf.now=function(){return Date.now()};sn(perf.now,'now');
var nowTs=Date.now();
perf.timing={navigationStart:nowTs,fetchStart:nowTs,domainLookupStart:nowTs,domainLookupEnd:nowTs,connectStart:nowTs,connectEnd:nowTs,requestStart:nowTs,responseStart:nowTs,responseEnd:nowTs,domLoading:nowTs,domInteractive:nowTs,domContentLoadedEventStart:nowTs,domContentLoadedEventEnd:nowTs,domComplete:nowTs,loadEventStart:nowTs,loadEventEnd:nowTs};

var cryptoFn = function(arr){
    var b = require('crypto').randomBytes(arr.length);
    for(var i=0;i<arr.length;i++)arr[i]=b[i];
    return arr;
};
sn(cryptoFn,'getRandomValues');

// XHR / MO
var XHR = function(){this.open=mf('open');this.send=mf('send');this.setRequestHeader=mf('setRequestHeader');this.readyState=0;this.status=0;this.responseText='';this.DONE=4};sn(XHR,'XMLHttpRequest');
var MO = function(cb){this.observe=mf('observe');this.disconnect=mf('disconnect')};sn(MO,'MutationObserver');

// ===== Window =====
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = { log: function(){}, error: function(){}, warn: function(){}, info: function(){} };
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = makeStorage(); sandbox.sessionStorage = makeStorage();
sandbox.performance = perf;
sandbox.crypto = {getRandomValues:cryptoFn,subtle:null};
sandbox.btoa = function(s){return Buffer.from(s).toString('base64')};sn(sandbox.btoa,'btoa');
sandbox.atob = function(s){return Buffer.from(s,'base64').toString()};sn(sandbox.atob,'atob');
sandbox.XMLHttpRequest = XHR; sandbox.MutationObserver = MO;
sandbox.Image = function(){return new sandbox.HTMLImageElement()};
sandbox.innerWidth=2560;sandbox.innerHeight=1440;sandbox.outerWidth=2560;sandbox.outerHeight=1440;
sandbox.devicePixelRatio=1;sandbox.screenX=0;sandbox.screenY=0;sandbox.scrollX=0;sandbox.scrollY=0;
sandbox.name='';sandbox.closed=false;sandbox.length=0;sandbox.opener=null;
sandbox.origin='https://www.zhipin.com';sandbox.isSecureContext=true;
sandbox.postMessage=mf('postMessage');sandbox.addEventListener=mf('addEventListener');
sandbox.removeEventListener=mf('removeEventListener');sandbox.dispatchEvent=mf('dispatchEvent');
sandbox.fetch=mf('fetch');sandbox.requestAnimationFrame=mf('requestAnimationFrame');
sandbox.matchMedia=function(){return{matches:false}};sn(sandbox.matchMedia,'matchMedia');
sandbox.getComputedStyle=function(){return{}};sn(sandbox.getComputedStyle,'getComputedStyle');
sandbox.getSelection=function(){return null};sn(sandbox.getSelection,'getSelection');
sandbox.print=mf('print');sandbox.open=mf('open');sandbox.close=mf('close');
sandbox.focus=mf('focus');sandbox.blur=mf('blur');sandbox.stop=mf('stop');
sandbox.scroll=mf('scroll');sandbox.scrollTo=mf('scrollTo');sandbox.scrollBy=mf('scrollBy');
sandbox.alert=mf('alert');sandbox.confirm=mf('confirm');sandbox.prompt=mf('prompt');

// ===== Anti-automation markers (must be undefined!) =====
sandbox._phantom = undefined;
sandbox.callphantom = undefined;
sandbox.__phantomas = undefined;
sandbox.Buffer = undefined;
sandbox.process = undefined;
sandbox.require = undefined;
sandbox.module = undefined;
sandbox.exports = undefined;
sandbox.__dirname = undefined;
sandbox.__filename = undefined;
sandbox.global = sandbox; // global === window in browser

// ===== Execute =====
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
