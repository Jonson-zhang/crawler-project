/**
 * Deterministic token test - fixes crypto.getRandomValues
 * to verify whether token variance is from randomness or environment.
 */
var vm = require('vm');
var fs = require('fs');
var _crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Generate a fixed random seed ONCE
var _randSeed = Buffer.alloc(256);
for (var i = 0; i < 256; i++) _randSeed[i] = i * 7 + 13;

var _randIdx = 0;
var _fixedCrypto = {
    getRandomValues: function(arr) {
        for (var i = 0; i < arr.length; i++) {
            arr[i] = _randSeed[_randIdx % 256];
            _randIdx++;
        }
        return arr;
    }
};

// ===== Build sandbox (same as before) =====
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

function EvtTgt(){} sn(EvtTgt, 'EventTarget');
function Nav_(){} Nav_.prototype = Object.create(EvtTgt.prototype); Nav_.prototype[ST] = 'Navigator'; sn(Nav_, 'Navigator');
function Doc_(){} Doc_.prototype = Object.create(EvtTgt.prototype); Doc_.prototype[ST] = 'HTMLDocument'; sn(Doc_, 'Document');
function HTMLEl(){} HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.style = {};
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; }; sn(HTMLEl.prototype.getAttribute, 'getAttribute');
HTMLEl.prototype.getBoundingClientRect = function() { return {x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0}; };
sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect'); sn(HTMLEl, 'HTMLElement');
function HTMLHtmlEl(){} HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype); HTMLHtmlEl.prototype[ST]='HTMLHtmlElement'; sn(HTMLHtmlEl,'HTMLHtmlElement');
function HTMLBodyEl(){} HTMLBodyEl.prototype = Object.create(HTMLEl.prototype); HTMLBodyEl.prototype[ST]='HTMLBodyElement'; sn(HTMLBodyEl,'HTMLBodyElement');
function HTMLHeadEl(){} HTMLHeadEl.prototype = Object.create(HTMLEl.prototype); HTMLHeadEl.prototype[ST]='HTMLHeadElement'; sn(HTMLHeadEl,'HTMLHeadElement');
function HTMLCanvasEl(){} HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype); HTMLCanvasEl.prototype.width=300;HTMLCanvasEl.prototype.height=150;HTMLCanvasEl.prototype[ST]='HTMLCanvasElement';sn(HTMLCanvasEl,'HTMLCanvasElement');
function HTMLIFrameEl(){} HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype); HTMLIFrameEl.prototype[ST]='HTMLIFrameElement';sn(HTMLIFrameEl,'HTMLIFrameElement');
function HTMLScriptEl(){} HTMLScriptEl.prototype = Object.create(HTMLEl.prototype); HTMLScriptEl.prototype[ST]='HTMLScriptElement';sn(HTMLScriptEl,'HTMLScriptElement');
function Loc_(){} Loc_.prototype[ST]='Location';sn(Loc_,'Location');
function Scr_(){} Scr_.prototype[ST]='Screen';sn(Scr_,'Screen');
function Hist_(){} Hist_.prototype[ST]='History';sn(Hist_,'History');
function Stor_(){} Stor_.prototype[ST]='Storage';sn(Stor_,'Storage');
function Perf_(){} Perf_.prototype[ST]='Performance';sn(Perf_,'Performance');
function PlArr_(){} PlArr_.prototype[ST]='PluginArray';sn(PlArr_,'PluginArray');
function MtArr_(){} MtArr_.prototype[ST]='MimeTypeArray';sn(MtArr_,'MimeTypeArray');
function Plg_(){} Plg_.prototype.item=mf('item');Plg_.prototype.namedItem=mf('namedItem');Plg_.prototype[ST]='Plugin';sn(Plg_,'Plugin');
function Mt_(){} Mt_.prototype[ST]='MimeType';sn(Mt_,'MimeType');

var nav = new Nav_();
nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appCodeName='Mozilla';nav.appName='Netscape';nav.appVersion='5.0 (Windows)';nav.platform='Win32';
nav.product='Gecko';nav.oscpu='Windows NT 10.0; Win64; x64';nav.buildID='20181001000000';
nav.vendor='';nav.vendorSub='';nav.productSub='20100101';
nav.language='en-US';nav.languages=['en-US','en'];
nav.cookieEnabled=true;nav.webdriver=false;nav.hardwareConcurrency=16;nav.maxTouchPoints=0;
nav.doNotTrack='1';nav.onLine=true;nav.pdfViewerEnabled=true;nav.globalPrivacyControl=false;
nav.deviceMemory=undefined;nav.webkitTemporaryStorage=undefined;

var pls=new PlArr_();pls.length=5;pls.refresh=mf('refresh');pls.item=mf('item');pls.namedItem=mf('namedItem');
['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'].forEach(function(nm,i){
    var p=new Plg_();p.name=nm;p.filename='internal-pdf-viewer';p.description='Portable Document Format';p.length=2;
    var m0=new Mt_();m0.type='application/pdf';m0.suffixes='pdf';m0.description='Portable Document Format';m0.enabledPlugin=p;
    var m1=new Mt_();m1.type='text/pdf';m1.suffixes='pdf';m1.description='Portable Document Format';m1.enabledPlugin=p;
    p[0]=m0;p[1]=m1;pls[i]=p;
});
nav.plugins=pls;
var mts=new MtArr_();mts.length=2;mts.item=mf('item');mts.namedItem=mf('namedItem');
var mm0=new Mt_();mm0.type='application/pdf';mm0.suffixes='pdf';mm0.description='Portable Document Format';mm0.enabledPlugin=pls[0];
var mm1=new Mt_();mm1.type='text/pdf';mm1.suffixes='pdf';mm1.description='Portable Document Format';mm1.enabledPlugin=pls[0];
mts[0]=mm0;mts[1]=mm1;nav.mimeTypes=mts;

var doc=new Doc_();
doc.createElement=function(tag){if(tag==='iframe'){var f=new HTMLIFrameEl();f.style={};f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};f.contentWindow=null;return f}if(tag==='canvas')return new HTMLCanvasEl();if(tag==='script'){var s=new HTMLScriptEl();s.src='';s.setAttribute=mf('setAttribute');return s}return new HTMLEl()};sn(doc.createElement,'createElement');
doc.createElementNS=function(ns,tag){return doc.createElement(tag)};sn(doc.createElementNS,'createElementNS');
doc.body=new HTMLBodyEl();doc.documentElement=new HTMLHtmlEl();doc.head=new HTMLHeadEl();
doc.getElementsByTagName=function(t){if(t==='head')return{item:function(){return doc.head},length:1};return{item:function(){return null},length:0}};sn(doc.getElementsByTagName,'getElementsByTagName');
doc.getElementById=function(){return new HTMLEl()};sn(doc.getElementById,'getElementById');
doc.getElementsByClassName=function(){return[]};sn(doc.getElementsByClassName,'getElementsByClassName');
doc.querySelector=function(){return new HTMLEl()};sn(doc.querySelector,'querySelector');
doc.querySelectorAll=function(){return[]};sn(doc.querySelectorAll,'querySelectorAll');
doc.addEventListener=mf('addEventListener');
doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';doc.visibilityState='visible';doc.title='BOSS直聘';doc.referrer='';doc.all=undefined;
var _dc='';Object.defineProperty(doc,'cookie',{get:function(){return _dc||('__a=t;__c=t;__g=-')},set:function(v){_dc=v},configurable:true,enumerable:true});

var loc=new Loc_();loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';loc.hostname='www.zhipin.com';loc.host='www.zhipin.com';loc.pathname='/web/geek/jobs';loc.protocol='https:';loc.origin='https://www.zhipin.com';
var scr=new Scr_();scr.width=5120;scr.height=1440;scr.availWidth=5120;scr.availHeight=1392;scr.colorDepth=24;scr.pixelDepth=24;
var hist=new Hist_();hist.length=1;hist.pushState=mf('pushState');hist.replaceState=mf('replaceState');
function mkStor(){var s=new Stor_();s.getItem=mf('getItem');s.setItem=mf('setItem');s.removeItem=mf('removeItem');s.clear=mf('clear');s.key=mf('key');s.length=0;return s}
var perf=new Perf_();perf.now=function(){return 1000000};sn(perf.now,'now');perf.memory={};

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
    crypto: _fixedCrypto,
    btoa: function(s) { return Buffer.from(s).toString('base64'); },
    atob: function(s) { return Buffer.from(s, 'base64').toString(); },
    console: { log: function(){}, error: function(){}, warn: function(){} },
    navigator: nav, document: doc, location: loc, screen: scr, history: hist,
    localStorage: mkStor(), sessionStorage: mkStor(), performance: perf,
};
sn(sandbox.crypto.getRandomValues, 'getRandomValues');
sn(sandbox.btoa, 'btoa'); sn(sandbox.atob, 'atob');

// Sandbox self-ref
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.innerWidth = 1884; sandbox.innerHeight = 1332; sandbox.outerWidth = 1884; sandbox.outerHeight = 1392;
sandbox.devicePixelRatio = 1; sandbox.screenX = 0; sandbox.screenY = 0;
sandbox.name = ''; sandbox.closed = false; sandbox.length = 0; sandbox.opener = null;
sandbox.origin = 'https://www.zhipin.com'; sandbox.isSecureContext = true;
sandbox.postMessage = mf('postMessage'); sandbox.addEventListener = mf('addEventListener');
sandbox.removeEventListener = mf('removeEventListener');
sandbox.fetch = mf('fetch'); sandbox.requestAnimationFrame = mf('requestAnimationFrame');
sandbox.matchMedia = function(){return{matches:false}}; sn(sandbox.matchMedia,'matchMedia');
sandbox.getComputedStyle = function(){return{}}; sn(sandbox.getComputedStyle,'getComputedStyle');
sandbox.getSelection = function(){return null}; sn(sandbox.getSelection,'getSelection');
sandbox.XMLHttpRequest = mc('XMLHttpRequest'); sandbox.MutationObserver = mc('MutationObserver');
sandbox.Image = mc('Image'); sandbox.Event = mc('Event'); sandbox.CSSRuleList = mc('CSSRuleList');
sandbox.process = undefined; sandbox.module = undefined; sandbox.require = undefined;
sandbox._phantom = undefined; sandbox.callphantom = undefined;

var extraCls = [
    'Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'
];
extraCls.forEach(function(n){if(!(n in sandbox))sandbox[n]=mc(n)});

// ===== Run twice with same seed =====
var ctx = vm.createContext(sandbox);
new vm.Script(code).runInContext(ctx);

var seed = 'VsbTBCOID71h+OzSxBLPKa6ThkqrBFYaqfGa+QWt9qQ=';
var ts = 1782478485106;
var token = new sandbox.ABC().z(seed, ts);

// Reset random state and run again
_randIdx = 0;
var token2 = new sandbox.ABC().z(seed, ts);

process.stdout.write('Run 1: ' + token + '\n');
process.stdout.write('Run 2: ' + token2 + '\n');
process.stderr.write('IDENTICAL: ' + (token === token2) + '\n');
process.stderr.write('LEN: ' + token.length + '\n');
process.stderr.write('PREFIX: ' + token.substring(0, 60) + '\n');
