/**
 * sign_boss_v5.js — 全部对象在 vm sandbox 内创建
 * 用法: node sign_boss_v5.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm');
var fs = require('fs');
var _crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math, RegExp, Error, TypeError,
    SyntaxError, ReferenceError, RangeError, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Int32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    console: { log: function(){}, error: function(){}, warn: function(){} },
};

// ── Native toString protection ──
var mm = new Map();
var rt = Function.prototype.toString;
sandbox.Function = function() { var f = function(){}; return f; };
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

// ── 所有浏览器类 ──
function EvtTgt(){}
sn(EvtTgt, 'EventTarget');

function Nav_(){}
Nav_.prototype = Object.create(EvtTgt.prototype); Nav_.prototype[ST] = 'Navigator'; sn(Nav_, 'Navigator');

function Doc_(){}
Doc_.prototype = Object.create(EvtTgt.prototype); Doc_.prototype[ST] = 'HTMLDocument'; sn(Doc_, 'Document');

function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.style = {};
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; };
sn(HTMLEl.prototype.getAttribute, 'getAttribute');
HTMLEl.prototype.getBoundingClientRect = function() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
};
sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect');
sn(HTMLEl, 'HTMLElement');

function HTMLHtmlEl(){}
HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype); HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement'; sn(HTMLHtmlEl, 'HTMLHtmlElement');

function HTMLBodyEl(){}
HTMLBodyEl.prototype = Object.create(HTMLEl.prototype); HTMLBodyEl.prototype[ST] = 'HTMLBodyElement'; sn(HTMLBodyEl, 'HTMLBodyElement');

function HTMLHeadEl(){}
HTMLHeadEl.prototype = Object.create(HTMLEl.prototype); HTMLHeadEl.prototype[ST] = 'HTMLHeadElement'; sn(HTMLHeadEl, 'HTMLHeadElement');

function HTMLCanvasEl(){}
HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype); HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement';
HTMLCanvasEl.prototype.width = 300; HTMLCanvasEl.prototype.height = 150; sn(HTMLCanvasEl, 'HTMLCanvasElement');

function HTMLIFrameEl(){}
HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype); HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement'; sn(HTMLIFrameEl, 'HTMLIFrameElement');

function HTMLScriptEl(){}
HTMLScriptEl.prototype = Object.create(HTMLEl.prototype); HTMLScriptEl.prototype[ST] = 'HTMLScriptElement'; sn(HTMLScriptEl, 'HTMLScriptElement');

function Loc_(){}
Loc_.prototype[ST] = 'Location'; sn(Loc_, 'Location');

function Scr_(){}
Scr_.prototype[ST] = 'Screen'; sn(Scr_, 'Screen');

function Hist_(){}
Hist_.prototype[ST] = 'History'; sn(Hist_, 'History');

function Stor_(){}
Stor_.prototype[ST] = 'Storage'; sn(Stor_, 'Storage');

function Perf_(){}
Perf_.prototype[ST] = 'Performance'; sn(Perf_, 'Performance');

function PlArr_(){}
PlArr_.prototype[ST] = 'PluginArray'; sn(PlArr_, 'PluginArray');

function MtArr_(){}
MtArr_.prototype[ST] = 'MimeTypeArray'; sn(MtArr_, 'MimeTypeArray');

function Plg_(){}
Plg_.prototype.item = mf('item'); Plg_.prototype.namedItem = mf('namedItem');
Plg_.prototype[ST] = 'Plugin'; sn(Plg_, 'Plugin');

function Mt_(){}
Mt_.prototype[ST] = 'MimeType'; sn(Mt_, 'MimeType');

// ── Navigator ──
var nav = new Nav_();
nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion = '5.0 (Windows)'; nav.platform = 'Win32'; nav.language = 'zh-CN';
nav.languages = ['zh-CN', 'zh']; nav.cookieEnabled = true; nav.webdriver = false;
nav.hardwareConcurrency = 8; nav.maxTouchPoints = 0; nav.vendor = '';
nav.productSub = '20100101'; nav.doNotTrack = '1'; nav.onLine = true;
nav.deviceMemory = undefined; nav.webkitTemporaryStorage = undefined;

var pls = new PlArr_();
pls.length = 5; pls.refresh = mf('refresh'); pls.item = mf('item'); pls.namedItem = mf('namedItem');
['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'].forEach(function(nm, i) {
    var p = new Plg_();
    p.name = nm; p.filename = 'internal-pdf-viewer'; p.description = 'Portable Document Format'; p.length = 2;
    var m0 = new Mt_(); m0.type = 'application/pdf'; m0.suffixes = 'pdf'; m0.description = 'Portable Document Format'; m0.enabledPlugin = p;
    var m1 = new Mt_(); m1.type = 'text/pdf'; m1.suffixes = 'pdf'; m1.description = 'Portable Document Format'; m1.enabledPlugin = p;
    p[0] = m0; p[1] = m1; pls[i] = p;
});
nav.plugins = pls;

var mts = new MtArr_();
mts.length = 2; mts.item = mf('item'); mts.namedItem = mf('namedItem');
var mm0 = new Mt_(); mm0.type = 'application/pdf'; mm0.suffixes = 'pdf'; mm0.description = 'Portable Document Format'; mm0.enabledPlugin = pls[0];
var mm1 = new Mt_(); mm1.type = 'text/pdf'; mm1.suffixes = 'pdf'; mm1.description = 'Portable Document Format'; mm1.enabledPlugin = pls[0];
mts[0] = mm0; mts[1] = mm1; nav.mimeTypes = mts;

// ── Document ──
var doc = new Doc_();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.style = {}; f.setAttribute = mf('setAttribute'); f.getAttribute = function() { return null; }; f.contentWindow = sandbox; return f; }
    if (tag === 'canvas') return new HTMLCanvasEl();
    if (tag === 'script') { var s = new HTMLScriptEl(); s.src = ''; s.setAttribute = mf('setAttribute'); return s; }
    return new HTMLEl();
};
sn(doc.createElement, 'createElement');
doc.createElementNS = function(ns, tag) { return doc.createElement(tag); };
sn(doc.createElementNS, 'createElementNS');
doc.body = new HTMLBodyEl();
doc.documentElement = new HTMLHtmlEl();
doc.head = new HTMLHeadEl();
doc.getElementsByTagName = function(t) {
    if (t === 'head') return { item: function() { return doc.head; }, length: 1 };
    return { item: function() { return null; }, length: 0 };
};
sn(doc.getElementsByTagName, 'getElementsByTagName');
doc.getElementById = function() { return new HTMLEl(); };
sn(doc.getElementById, 'getElementById');
doc.getElementsByClassName = function() { return []; };
sn(doc.getElementsByClassName, 'getElementsByClassName');
doc.querySelector = function() { return new HTMLEl(); };
sn(doc.querySelector, 'querySelector');
doc.querySelectorAll = function() { return []; };
sn(doc.querySelectorAll, 'querySelectorAll');
doc.addEventListener = mf('addEventListener');
doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible'; doc.title = 'BOSS直聘';
doc.all = undefined;

var _docCookie = '';
Object.defineProperty(doc, 'cookie', {
    get: function() { return _docCookie || ('__a=' + (process.argv[2] || '0') + ';__c=' + (process.argv[3] || '0') + ';__g=-'); },
    set: function(v) { _docCookie = v; },
    configurable: true, enumerable: true
});

// ── Location / Screen / History ──
var loc = new Loc_();
loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs';
loc.protocol = 'https:'; loc.origin = 'https://www.zhipin.com';
loc.port = ''; loc.search = '?city=101010100&query=python'; loc.hash = '';

var scr = new Scr_();
scr.width = 1600; scr.height = 900; scr.availWidth = 1600; scr.availHeight = 860;
scr.colorDepth = 24; scr.pixelDepth = 24;

var hist = new Hist_();
hist.length = 1; hist.pushState = mf('pushState'); hist.replaceState = mf('replaceState');
hist.back = mf('back'); hist.forward = mf('forward'); hist.go = mf('go');

function mkStor() {
    var s = new Stor_();
    s.getItem = function(key) { return null; };
    sn(s.getItem, 'getItem');
    s.setItem = mf('setItem'); s.removeItem = mf('removeItem');
    s.clear = mf('clear'); s.key = mf('key'); s.length = 0;
    return s;
}

var perf = new Perf_();
perf.now = function() { return Date.now(); };
sn(perf.now, 'now');
perf.memory = {};

// ── Crypto ──
var cryptoFn = function(arr) {
    var b = _crypto.randomBytes(arr.length);
    for (var i = 0; i < arr.length; i++) arr[i] = b[i];
    return arr;
};
sn(cryptoFn, 'getRandomValues');

// ── Btoa/Atob ──
var btoaFn = function(s) { return Buffer.from(s).toString('base64'); };
sn(btoaFn, 'btoa');
var atobFn = function(s) { return Buffer.from(s, 'base64').toString(); };
sn(atobFn, 'atob');

// ── 挂载到 sandbox ──
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = mkStor(); sandbox.sessionStorage = mkStor(); sandbox.performance = perf;
sandbox.crypto = { getRandomValues: cryptoFn, subtle: null };
sandbox.btoa = btoaFn; sandbox.atob = atobFn;
sandbox.innerWidth = 1600; sandbox.innerHeight = 900; sandbox.outerWidth = 1600; sandbox.outerHeight = 900;
sandbox.devicePixelRatio = 1; sandbox.screenX = 0; sandbox.screenY = 0;
sandbox.name = ''; sandbox.closed = false; sandbox.length = 0; sandbox.opener = null;
sandbox.origin = 'https://www.zhipin.com'; sandbox.isSecureContext = true;
sandbox.postMessage = mf('postMessage'); sandbox.addEventListener = mf('addEventListener');
sandbox.removeEventListener = mf('removeEventListener'); sandbox.dispatchEvent = mf('dispatchEvent');
sandbox.fetch = mf('fetch'); sandbox.requestAnimationFrame = mf('requestAnimationFrame');
sandbox.matchMedia = function() { return { matches: false, media: '' }; };
sn(sandbox.matchMedia, 'matchMedia');
sandbox.getComputedStyle = function() { return {}; };
sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.getSelection = function() { return null; };
sn(sandbox.getSelection, 'getSelection');
sandbox.print = mf('print'); sandbox.open = mf('open'); sandbox.close = mf('close');
sandbox.focus = mf('focus'); sandbox.blur = mf('blur'); sandbox.stop = mf('stop');
sandbox.scroll = mf('scroll'); sandbox.scrollTo = mf('scrollTo'); sandbox.scrollBy = mf('scrollBy');
sandbox.alert = mf('alert'); sandbox.confirm = mf('confirm'); sandbox.prompt = mf('prompt');
sandbox.XMLHttpRequest = mc('XMLHttpRequest');
sandbox.MutationObserver = mc('MutationObserver');
sandbox.Image = mc('Image');
sandbox.Event = mc('Event');
sandbox.CSSRuleList = mc('CSSRuleList');
sandbox.process = undefined; sandbox.module = undefined; sandbox.require = undefined;
sandbox._phantom = undefined; sandbox.callphantom = undefined;

// 200+ extra browser constructors
var extraCls = [
    'Blob', 'CSSRule', 'CSSStyleDeclaration', 'CSSStyleSheet', 'CanvasRenderingContext2D',
    'CloseEvent', 'Comment', 'CompositionEvent', 'CustomEvent', 'DOMException', 'DOMImplementation',
    'DOMParser', 'DOMRect', 'DataTransfer', 'DeviceMotionEvent', 'DocumentFragment', 'DragEvent',
    'Element', 'ErrorEvent', 'EventSource', 'File', 'FileList', 'FileReader', 'FocusEvent', 'FormData',
    'HashChangeEvent', 'Headers', 'HTMLCollection', 'HTMLAnchorElement', 'HTMLAreaElement',
    'HTMLAudioElement', 'HTMLBRElement', 'HTMLBaseElement', 'HTMLButtonElement', 'HTMLDListElement',
    'HTMLDataElement', 'HTMLDataListElement', 'HTMLDetailsElement', 'HTMLDialogElement',
    'HTMLDirectoryElement', 'HTMLDivElement', 'HTMLEmbedElement', 'HTMLFieldSetElement',
    'HTMLFontElement', 'HTMLFormControlsCollection', 'HTMLFormElement', 'HTMLFrameElement',
    'HTMLFrameSetElement', 'HTMLHRElement', 'HTMLHeadingElement', 'HTMLImageElement',
    'HTMLInputElement', 'HTMLLIElement', 'HTMLLabelElement', 'HTMLLegendElement', 'HTMLLinkElement',
    'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement', 'HTMLMenuElement', 'HTMLMetaElement',
    'HTMLMeterElement', 'HTMLModElement', 'HTMLOListElement', 'HTMLObjectElement', 'HTMLOptGroupElement',
    'HTMLOptionElement', 'HTMLOptionsCollection', 'HTMLOutputElement', 'HTMLParagraphElement',
    'HTMLParamElement', 'HTMLPictureElement', 'HTMLPreElement', 'HTMLProgressElement', 'HTMLQuoteElement',
    'HTMLSelectElement', 'HTMLSlotElement', 'HTMLSourceElement', 'HTMLSpanElement', 'HTMLStyleElement',
    'HTMLTableCaptionElement', 'HTMLTableCellElement', 'HTMLTableColElement', 'HTMLTableElement',
    'HTMLTableRowElement', 'HTMLTableSectionElement', 'HTMLTemplateElement', 'HTMLTextAreaElement',
    'HTMLTimeElement', 'HTMLTitleElement', 'HTMLTrackElement', 'HTMLUListElement', 'HTMLUnknownElement',
    'HTMLVideoElement', 'InputEvent', 'IntersectionObserver', 'KeyboardEvent', 'MediaList',
    'MessageChannel', 'MessageEvent', 'MouseEvent', 'MutationRecord', 'NodeList', 'Notification',
    'PageTransitionEvent', 'Path2D', 'PerformanceEntry', 'PerformanceNavigation', 'PerformanceObserver',
    'PerformanceResourceTiming', 'PointerEvent', 'PopStateEvent', 'ProcessingInstruction',
    'ProgressEvent', 'Range', 'ReadableStream', 'Request', 'ResizeObserver', 'Response',
    'SVGAElement', 'SVGCircleElement', 'SVGDefsElement', 'SVGDescElement', 'SVGElement',
    'SVGEllipseElement', 'SVGFilterElement', 'SVGGElement', 'SVGGraphicsElement', 'SVGImageElement',
    'SVGLineElement', 'SVGLinearGradientElement', 'SVGMetadataElement', 'SVGPathElement',
    'SVGPolygonElement', 'SVGPolylineElement', 'SVGRect', 'SVGSVGElement', 'SVGScriptElement',
    'SVGStopElement', 'SVGStyleElement', 'SVGSwitchElement', 'SVGSymbolElement', 'SVGTSpanElement',
    'SVGTextElement', 'SVGTitleElement', 'SVGUseElement', 'Selection', 'ShadowRoot', 'SharedWorker',
    'StorageEvent', 'SubmitEvent', 'Text', 'TextDecoder', 'TextEncoder', 'TouchEvent', 'TransitionEvent',
    'TreeWalker', 'UIEvent', 'URL', 'URLSearchParams', 'ValidityState', 'VisualViewport', 'WebSocket',
    'WheelEvent', 'Worker', 'XMLDocument', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload',
    'XMLSerializer', 'XPathEvaluator', 'XPathResult', 'XSLTProcessor'
];
extraCls.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

// ── 执行 ──
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
