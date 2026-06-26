/**
 * Environment Sweep Test
 * Tests each key navigator/screen value to find which ones affect token length.
 * Token length is a proxy for "VMP code path" — browser=465, minimal=285.
 */
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

var _dateBase = 1782478485106;
var _dateCount = 0;

function FakeDate() {
    if (arguments.length > 0) {
        var args = [null].concat(Array.prototype.slice.call(arguments));
        return new (Function.prototype.bind.apply(Date, args))();
    }
    return new Date(_dateBase + Math.floor(_dateCount / 30));
}
FakeDate.now = function() {
    _dateCount++;
    return _dateBase + Math.floor(_dateCount / 30);
};
FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC; FakeDate.prototype = Date.prototype;

var _mathSeed = 42;
var FixedMath = Object.create(Math);
FixedMath.random = function() {
    _mathSeed = (_mathSeed * 16807 + 0) % 2147483647;
    return (_mathSeed - 1) / 2147483646;
};

var _perfCounter = 0;
var FakePerf = { now: function() { _perfCounter++; return _perfCounter; }, memory: {} };

var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

function EvtTgt(){} sn(EvtTgt,'EventTarget');

function Nav_(){} Nav_.prototype = Object.create(EvtTgt.prototype); Nav_.prototype[ST] = 'Navigator'; sn(Nav_,'Navigator');

function Doc_(){} Doc_.prototype = Object.create(EvtTgt.prototype); Doc_.prototype[ST] = 'HTMLDocument'; sn(Doc_,'Document');
function HTMLEl(){} HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.style = {};
HTMLEl.prototype.appendChild = mf('appendChild'); HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; }; sn(HTMLEl.prototype.getAttribute,'getAttribute');
HTMLEl.prototype.getBoundingClientRect = function() { return {x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0}; };
sn(HTMLEl.prototype.getBoundingClientRect,'getBoundingClientRect'); sn(HTMLEl,'HTMLElement');
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

var pls = new PlArr_(); pls.length=5; pls.refresh=mf('refresh'); pls.item=mf('item'); pls.namedItem=mf('namedItem');
['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'].forEach(function(nm,i) {
    var p = new Plg_(); p.name=nm; p.filename='internal-pdf-viewer'; p.description='Portable Document Format'; p.length=2;
    var m0=new Mt_(); m0.type='application/pdf'; m0.suffixes='pdf'; m0.description='Portable Document Format'; m0.enabledPlugin=p;
    var m1=new Mt_(); m1.type='text/pdf'; m1.suffixes='pdf'; m1.description='Portable Document Format'; m1.enabledPlugin=p;
    p[0]=m0; p[1]=m1; pls[i]=p;
});

function buildSandbox(overrides) {
    var nav = new Nav_();
    // Default browser values
    var defaults = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
        appCodeName: 'Mozilla', appName: 'Netscape', appVersion: '5.0 (Windows)',
        platform: 'Win32', product: 'Gecko', oscpu: 'Windows NT 10.0; Win64; x64',
        buildID: '20181001000000', vendor: '', vendorSub: '', productSub: '20100101',
        language: 'en-US', languages: ['en-US','en'],
        cookieEnabled: true, webdriver: false, hardwareConcurrency: 8, maxTouchPoints: 0,
        doNotTrack: '1', onLine: true, pdfViewerEnabled: true, globalPrivacyControl: false,
    };

    var v = {};
    for (var k in defaults) v[k] = defaults[k];
    for (var k in (overrides || {})) v[k] = overrides[k];

    var NP = Nav_.prototype;
    for (var k in v) {
        (function(key, val) {
            Object.defineProperty(NP, key, {
                get: function() { return val; },
                enumerable: true, configurable: true
            });
        })(k, v[k]);
    }
    Object.defineProperty(NP, 'plugins', { get: function() { return pls; }, enumerable: true, configurable: true });
    Object.defineProperty(NP, 'mimeTypes', { get: function() {
        var mts = new MtArr_(); mts.length=2; mts.item=mf('item'); mts.namedItem=mf('namedItem');
        return mts;
    }, enumerable: true, configurable: true });

    var doc = new Doc_();
    doc.createElement = function(tag){if(tag==='iframe'){var f=new HTMLIFrameEl();f.style={};f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};f.contentWindow=null;return f}if(tag==='canvas')return new HTMLCanvasEl();if(tag==='script'){var s=new HTMLScriptEl();s.src='';s.setAttribute=mf('setAttribute');return s}return new HTMLEl()};sn(doc.createElement,'createElement');
    doc.createElementNS = function(ns,tag){return doc.createElement(tag)};sn(doc.createElementNS,'createElementNS');
    doc.body=new HTMLBodyEl();doc.documentElement=new HTMLHtmlEl();doc.head=new HTMLHeadEl();
    doc.getElementsByTagName=function(t){if(t==='head')return{item:function(){return doc.head},length:1};return{item:function(){return null},length:0}};sn(doc.getElementsByTagName,'getElementsByTagName');
    doc.getElementById=function(){return new HTMLEl()};sn(doc.getElementById,'getElementById');
    doc.getElementsByClassName=function(){return[]};sn(doc.getElementsByClassName,'getElementsByClassName');
    doc.querySelector=function(){return new HTMLEl()};sn(doc.querySelector,'querySelector');
    doc.querySelectorAll=function(){return[]};sn(doc.querySelectorAll,'querySelectorAll');
    doc.addEventListener=mf('addEventListener');
    doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';doc.visibilityState='visible';
    doc.title='BOSS直聘';doc.referrer='';doc.all=undefined;
    var _dc='';Object.defineProperty(doc,'cookie',{get:function(){return _dc},set:function(v){_dc=v},configurable:true,enumerable:true});

    var loc = new Loc_(); loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python'; loc.hostname='www.zhipin.com';
    loc.host='www.zhipin.com'; loc.pathname='/web/geek/jobs'; loc.protocol='https:'; loc.origin='https://www.zhipin.com';

    var scr = new Scr_(); scr.width=5120; scr.height=1440; scr.availWidth=5120; scr.availHeight=1392; scr.colorDepth=24; scr.pixelDepth=24;
    var hist = new Hist_(); hist.length=1; hist.pushState=mf('pushState'); hist.replaceState=mf('replaceState');
    function mkStor(){var s=new Stor_();s.getItem=mf('getItem');s.setItem=mf('setItem');s.removeItem=mf('removeItem');s.clear=mf('clear');s.key=mf('key');s.length=0;return s}

    var s = {
        Object, Array, Function, String, Number, Boolean, Date: FakeDate, Math: FixedMath,
        RegExp, Error, TypeError, SyntaxError, ReferenceError, RangeError,
        parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
        JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
        ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
        Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
        BigInt, NaN, Infinity, undefined, Proxy, Reflect,
        setTimeout, setInterval, clearTimeout, clearInterval,
        crypto: { getRandomValues: function(arr) { for(var i=0;i<arr.length;i++) arr[i]=i%256; return arr; } },
        btoa: function(s){return Buffer.from(s).toString('base64')},
        atob: function(s){return Buffer.from(s,'base64').toString()},
        console: { log:function(){}, error:function(){}, warn:function(){}, info:function(){} },
        navigator: nav, document: doc, location: loc, screen: scr, history: hist,
        localStorage: mkStor(), sessionStorage: mkStor(), performance: FakePerf,
    };
    sn(s.crypto.getRandomValues,'getRandomValues'); sn(s.btoa,'btoa'); sn(s.atob,'atob');
    s.window = s; s.self = s; s.top = s; s.parent = s; s.globalThis = s;
    s.innerWidth=1884; s.innerHeight=1332; s.outerWidth=1884; s.outerHeight=1392;
    s.devicePixelRatio=1; s.name=''; s.closed=false; s.length=0; s.opener=null;
    s.origin='https://www.zhipin.com'; s.isSecureContext=true;
    s.postMessage=mf('postMessage'); s.addEventListener=mf('addEventListener');
    s.removeEventListener=mf('removeEventListener');
    s.fetch=mf('fetch'); s.requestAnimationFrame=mf('requestAnimationFrame');
    s.matchMedia=function(){return{matches:false}}; sn(s.matchMedia,'matchMedia');
    s.getComputedStyle=function(){return{}}; sn(s.getComputedStyle,'getComputedStyle');
    s.getSelection=function(){return null}; sn(s.getSelection,'getSelection');
    s.XMLHttpRequest=mc('XMLHttpRequest'); s.MutationObserver=mc('MutationObserver');
    s.Image=mc('Image'); s.Event=mc('Event'); s.CSSRuleList=mc('CSSRuleList');
    s.process=undefined; s.module=undefined; s.require=undefined;
    s._phantom=undefined; s.callphantom=undefined;

    var extraCls=['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'];
    extraCls.forEach(function(n){if(!(n in s)) s[n]=mc(n)});

    return s;
}

var seed = 'VsbTBCOID71h+OzSxBLPKa6ThkqrBFYaqfGa+QWt9qQ=';
var ts = 1782478485106;

// Sweep tests
function runTest(name, overrides) {
    _dateCount = 0; _mathSeed = 42; _perfCounter = 0;
    var s = buildSandbox(overrides);
    var ctx = vm.createContext(s);
    try {
        new vm.Script(code).runInContext(ctx);
        var token = new s.ABC().z(seed, ts);
        console.log(name + ': len=' + token.length + ' prefix=' + token.substring(0, 30));
        return token.length;
    } catch(e) {
        console.log(name + ': ERROR ' + e.message);
        return -1;
    }
}

// Baseline with default values
runTest('baseline', {});

// Sweep individual properties
var sweeps = [
    ['language=zh-CN', {language:'zh-CN', languages:['zh-CN','zh']}],
    ['concurrency=16', {hardwareConcurrency:16}],
    ['concurrency=4', {hardwareConcurrency:4}],
    ['webdriver=true', {webdriver:true}],
    ['webdriver=undefined', {webdriver:undefined}],
    ['doNotTrack=null', {doNotTrack:null}],
    ['productSub=Mozilla', {productSub:'Gecko'}],
    ['vendor=Google', {vendor:'Google Inc.'}],
    ['platform=Linux', {platform:'Linux x86_64'}],
    ['pdfViewer=false', {pdfViewerEnabled:false}],
    ['nonFirefox UA', {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'}],
    ['language=zh-CN only', {language:'zh-CN', languages:['zh-CN']}],
];

sweeps.forEach(function(s) {
    runTest(s[0], s[1]);
});
