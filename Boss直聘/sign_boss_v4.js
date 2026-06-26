/**
 * Boss直聘 __zp_stoken__ 离线签名 (v4 - 直接 V8 global)
 * 用法: node sign_boss_v4.js <__a> <__c> <seed> <ts>
 *
 * 策略：直接在 Node.js V8 global 上设置浏览器全局，eval 安全 JS，
 * 然后生成 token。不用 vm 沙箱——vm 破坏了 instanceof 和原型链。
 */
// 保存 Node.js process 引用（eval 前覆盖 global.process 会丢失）
var _process = process;
var _stderrWrite = process.stderr.write.bind(process.stderr);
var _stdoutWrite = process.stdout.write.bind(process.stdout);
var fs = require('fs');
var _crypto = require('crypto');

var __a = process.argv[2];
var __c = process.argv[3];
var seed = process.argv[4];
var ts = parseInt(process.argv[5]);

// 保存 Node.js 关键全局（不要删，会崩）
var _save = { process, require, module, exports, __dirname, __filename, Buffer };

// ========== Native toString ==========
var mm = new Map();
var rt = Function.prototype.toString;
global.Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

// ========== 构造函数 ==========
function EvtTgt() {} sn(EvtTgt, 'EventTarget');
function Navigator_() {} Navigator_.prototype = Object.create(EvtTgt.prototype); Navigator_.prototype.constructor = Navigator_; Navigator_.prototype[ST] = 'Navigator'; sn(Navigator_, 'Navigator');
function Document_() {} Document_.prototype = Object.create(EvtTgt.prototype); Document_.prototype.constructor = Document_; Document_.prototype[ST] = 'HTMLDocument'; sn(Document_, 'Document');
function HTMLEl() {} HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype.constructor = HTMLEl; HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.offsetHeight = 720; HTMLEl.prototype.style = {}; HTMLEl.prototype.appendChild = mf('appendChild'); HTMLEl.prototype.setAttribute = mf('setAttribute'); HTMLEl.prototype.getAttribute = function() { return null; }; sn(HTMLEl.prototype.getAttribute, 'getAttribute'); HTMLEl.prototype.getBoundingClientRect = function() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }; }; sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect'); HTMLEl.prototype[ST] = 'HTMLElement'; sn(HTMLEl, 'HTMLElement');
function HTMLHtmlEl() {} HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype); HTMLHtmlEl.prototype.constructor = HTMLHtmlEl; HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement'; sn(HTMLHtmlEl, 'HTMLHtmlElement');
function HTMLBodyEl() {} HTMLBodyEl.prototype = Object.create(HTMLEl.prototype); HTMLBodyEl.prototype.constructor = HTMLBodyEl; HTMLBodyEl.prototype[ST] = 'HTMLBodyElement'; sn(HTMLBodyEl, 'HTMLBodyElement');
function HTMLHeadEl() {} HTMLHeadEl.prototype = Object.create(HTMLEl.prototype); HTMLHeadEl.prototype.constructor = HTMLHeadEl; HTMLHeadEl.prototype[ST] = 'HTMLHeadElement'; sn(HTMLHeadEl, 'HTMLHeadElement');
function HTMLCanvasEl() {} HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype); HTMLCanvasEl.prototype.constructor = HTMLCanvasEl; HTMLCanvasEl.prototype.width = 300; HTMLCanvasEl.prototype.height = 150; HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement'; sn(HTMLCanvasEl, 'HTMLCanvasElement');
function HTMLIFrameEl() {} HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype); HTMLIFrameEl.prototype.constructor = HTMLIFrameEl; HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement'; sn(HTMLIFrameEl, 'HTMLIFrameElement');
function HTMLScriptEl() {} HTMLScriptEl.prototype = Object.create(HTMLEl.prototype); HTMLScriptEl.prototype.constructor = HTMLScriptEl; HTMLScriptEl.prototype[ST] = 'HTMLScriptElement'; sn(HTMLScriptEl, 'HTMLScriptElement');
function Location_() {} Location_.prototype[ST] = 'Location'; sn(Location_, 'Location');
function Screen_() {} Screen_.prototype[ST] = 'Screen'; sn(Screen_, 'Screen');
function History_() {} History_.prototype[ST] = 'History'; sn(History_, 'History');
function Storage_() {} Storage_.prototype[ST] = 'Storage'; sn(Storage_, 'Storage');
function Performance_() {} Performance_.prototype[ST] = 'Performance'; sn(Performance_, 'Performance');
function PluginArray_() {} PluginArray_.prototype[ST] = 'PluginArray'; sn(PluginArray_, 'PluginArray');
function MimeTypeArray_() {} MimeTypeArray_.prototype[ST] = 'MimeTypeArray'; sn(MimeTypeArray_, 'MimeTypeArray');
function Plugin_() {} Plugin_.prototype.item = mf('item'); Plugin_.prototype.namedItem = mf('namedItem'); Plugin_.prototype[ST] = 'Plugin'; sn(Plugin_, 'Plugin');
function MimeType_() {} MimeType_.prototype[ST] = 'MimeType'; sn(MimeType_, 'MimeType');

// ========== Navigator ==========
var nav = new Navigator_();
nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion = '5.0 (Windows)'; nav.platform = 'Win32'; nav.language = 'zh-CN'; nav.languages = ['zh-CN', 'zh'];
nav.cookieEnabled = true; nav.webdriver = false; nav.hardwareConcurrency = 8; nav.maxTouchPoints = 0;
nav.vendor = ''; nav.productSub = '20100101'; nav.doNotTrack = '1'; nav.onLine = true;
nav.deviceMemory = undefined; nav.webkitTemporaryStorage = undefined;

var pls = new PluginArray_(); pls.length = 5; pls.refresh = mf('refresh'); pls.item = mf('item'); pls.namedItem = mf('namedItem');
['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'].forEach(function(nm, i) {
    var p = new Plugin_(); p.name = nm; p.filename = 'internal-pdf-viewer'; p.description = 'Portable Document Format'; p.length = 2;
    var m0 = new MimeType_(); m0.type = 'application/pdf'; m0.suffixes = 'pdf'; m0.description = 'Portable Document Format'; m0.enabledPlugin = p;
    var m1 = new MimeType_(); m1.type = 'text/pdf'; m1.suffixes = 'pdf'; m1.description = 'Portable Document Format'; m1.enabledPlugin = p;
    p[0] = m0; p[1] = m1; pls[i] = p;
});
nav.plugins = pls;
var mts = new MimeTypeArray_(); mts.length = 2; mts.item = mf('item'); mts.namedItem = mf('namedItem');
var mm0 = new MimeType_(); mm0.type = 'application/pdf'; mm0.suffixes = 'pdf'; mm0.description = 'Portable Document Format'; mm0.enabledPlugin = pls[0];
var mm1 = new MimeType_(); mm1.type = 'text/pdf'; mm1.suffixes = 'pdf'; mm1.description = 'Portable Document Format'; mm1.enabledPlugin = pls[0];
mts[0] = mm0; mts[1] = mm1; nav.mimeTypes = mts;

// ========== Document ==========
var doc = new Document_();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.style = {}; f.setAttribute = mf('setAttribute'); f.getAttribute = function() { return null; }; f.contentWindow = null; f.src = ''; return f; }
    if (tag === 'canvas') return new HTMLCanvasEl();
    if (tag === 'script') { var s = new HTMLScriptEl(); s.src = ''; s.type = 'text/javascript'; s.setAttribute = mf('setAttribute'); return s; }
    return new HTMLEl();
}; sn(doc.createElement, 'createElement');
doc.createElementNS = function(ns, tag) { return doc.createElement(tag); }; sn(doc.createElementNS, 'createElementNS');
doc.body = new HTMLBodyEl(); doc.documentElement = new HTMLHtmlEl(); doc.head = new HTMLHeadEl();
doc.getElementsByTagName = function(t) { if (t === 'head') return { item: function() { return doc.head; }, length: 1 }; return { item: function() { return null; }, length: 0 }; };
sn(doc.getElementsByTagName, 'getElementsByTagName');
doc.getElementById = function() { return new HTMLEl(); }; sn(doc.getElementById, 'getElementById');
doc.getElementsByClassName = function() { return []; }; sn(doc.getElementsByClassName, 'getElementsByClassName');
doc.querySelector = function() { return new HTMLEl(); }; sn(doc.querySelector, 'querySelector');
doc.querySelectorAll = function() { return []; }; sn(doc.querySelectorAll, 'querySelectorAll');
doc.addEventListener = mf('addEventListener');
doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible'; doc.title = 'BOSS直聘'; doc.referrer = '';
doc.all = undefined;
Object.defineProperty(doc, 'cookie', { get: function() { return '__a=' + __a + ';__c=' + __c + ';__g=-'; }, set: function() {}, configurable: true, enumerable: true });

// ========== Location / Screen / History ==========
var loc = new Location_(); loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python'; loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs'; loc.protocol = 'https:'; loc.origin = 'https://www.zhipin.com';
var scr = new Screen_(); scr.width = 2560; scr.height = 1440; scr.availWidth = 2560; scr.availHeight = 1440; scr.colorDepth = 24; scr.pixelDepth = 24;
var hist = new History_(); hist.length = 1; hist.pushState = mf('pushState'); hist.replaceState = mf('replaceState');
function mkStor() { var s = new Storage_(); s.getItem = mf('getItem'); s.setItem = mf('setItem'); s.removeItem = mf('removeItem'); s.clear = mf('clear'); s.key = mf('key'); s.length = 0; return s; }
var perf = new Performance_(); perf.now = function() { return Date.now(); }; sn(perf.now, 'now'); perf.memory = {};

// ========== 设到 global (模拟浏览器) ==========
global.window = global; global.self = global; global.top = global; global.parent = global; global.globalThis = global;
global.console = { log: function() {}, error: function() {}, warn: function() {}, info: function() {} };
global.navigator = nav; global.document = doc; global.location = loc;
global.screen = scr; global.history = hist;
global.localStorage = mkStor(); global.sessionStorage = mkStor(); global.performance = perf;
global.crypto = { getRandomValues: function(arr) { var b = _crypto.randomBytes(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; }, subtle: null };
sn(global.crypto.getRandomValues, 'getRandomValues');
global.btoa = function(s) { return Buffer.from(s).toString('base64'); }; sn(global.btoa, 'btoa');
global.atob = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(global.atob, 'atob');
global.innerWidth = 2560; global.innerHeight = 1440; global.outerWidth = 2560; global.outerHeight = 1440;
global.devicePixelRatio = 1; global.screenX = 0; global.screenY = 0; global.scrollX = 0; global.scrollY = 0;
global.name = ''; global.closed = false; global.length = 0; global.opener = null;
global.origin = 'https://www.zhipin.com'; global.isSecureContext = true;
global.postMessage = mf('postMessage'); global.addEventListener = mf('addEventListener');
global.removeEventListener = mf('removeEventListener');
global.fetch = mf('fetch'); global.requestAnimationFrame = mf('requestAnimationFrame');
global.matchMedia = function() { return { matches: false }; }; sn(global.matchMedia, 'matchMedia');
global.getComputedStyle = function() { return {}; }; sn(global.getComputedStyle, 'getComputedStyle');
global.getSelection = function() { return null; }; sn(global.getSelection, 'getSelection');
global.print = mf('print'); global.open = mf('open'); global.close = mf('close');
global.focus = mf('focus'); global.blur = mf('blur'); global.stop = mf('stop');
global.scroll = mf('scroll'); global.scrollTo = mf('scrollTo'); global.scrollBy = mf('scrollBy');
global.alert = mf('alert'); global.confirm = mf('confirm'); global.prompt = mf('prompt');
global.XMLHttpRequest = mc('XMLHttpRequest'); global.MutationObserver = mc('MutationObserver');
global.Image = mc('Image'); global.Event = mc('Event'); global.CSSRuleList = mc('CSSRuleList');
// Anti-automation
global._phantom = undefined; global.callphantom = undefined; global.__phantomas = undefined;
// Stub Node.js
global.process = { env: {}, argv: [], version: '', platform: '', pid: 0 };
global.module = undefined; global.exports = undefined; global.require = undefined;
global.__dirname = undefined; global.__filename = undefined;

// 200+ extra browser constructors
['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLAllCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLCollection','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','PromiseRejectionEvent','RTCPeerConnection','RadioNodeList','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGNumber','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','SubtleCrypto','Text','TextDecoder','TextEncoder','Touch','TouchEvent','TouchList','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','WritableStream','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'].forEach(function(n) { if (!(n in global)) global[n] = mc(n); });

// ========== 执行安全 JS ==========
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');
var token = null;
try {
    eval(code);
    if (typeof global.ABC !== 'undefined') {
        token = new global.ABC().z(seed, ts);
        _stdoutWrite(token);
    } else {
        _stderrWrite('ABC not defined\n');
        _process.exit(1);
    }
} catch(e) {
    _stderrWrite('Error: ' + e.message + '\n');
    _process.exit(1);
}
