/**
 * sign_boss_final.js — 终极方案
 * 在 Node.js global 上直接 eval security JS + 浏览器精确指纹
 * 避免 vm 沙箱的 typeof/instanceof/prototype 问题
 */
var fs = require('fs');
var crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// Save Node.js globals we need to keep
var _process = process, _require = require, _Buffer = Buffer;
var __a = process.argv[2], __c = process.argv[3];
var seed = process.argv[4], ts = parseInt(process.argv[5]);

// ===== Native toString protection =====
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); Object.defineProperty(f, 'name', {value: n}); return f; }
function mc(n) { var f = function() {}; f.prototype = {constructor: f}; sn(f, n); Object.defineProperty(f, 'name', {value: n}); return f; }
var ST = Symbol.toStringTag;

// ===== Browser constructors =====
function EventTarget(){} sn(EventTarget,'EventTarget'); Object.defineProperty(EventTarget,'name',{value:'EventTarget'});
function Navigator(){} Navigator.prototype=Object.create(EventTarget.prototype); Navigator.prototype[ST]='Navigator'; sn(Navigator,'Navigator'); Object.defineProperty(Navigator,'name',{value:'Navigator'});
function HTMLDocument(){} HTMLDocument.prototype=Object.create(EventTarget.prototype); HTMLDocument.prototype[ST]='HTMLDocument'; sn(HTMLDocument,'HTMLDocument'); Object.defineProperty(HTMLDocument,'name',{value:'HTMLDocument'});
function HTMLElement(){} HTMLElement.prototype=Object.create(EventTarget.prototype); HTMLElement.prototype[ST]='HTMLElement'; sn(HTMLElement,'HTMLElement'); Object.defineProperty(HTMLElement,'name',{value:'HTMLElement'});
function HTMLHtmlElement(){} HTMLHtmlElement.prototype=Object.create(HTMLElement.prototype); HTMLHtmlElement.prototype[ST]='HTMLHtmlElement'; sn(HTMLHtmlElement,'HTMLHtmlElement'); Object.defineProperty(HTMLHtmlElement,'name',{value:'HTMLHtmlElement'});
function HTMLBodyElement(){} HTMLBodyElement.prototype=Object.create(HTMLElement.prototype); HTMLBodyElement.prototype[ST]='HTMLBodyElement'; sn(HTMLBodyElement,'HTMLBodyElement'); Object.defineProperty(HTMLBodyElement,'name',{value:'HTMLBodyElement'});
function HTMLHeadElement(){} HTMLHeadElement.prototype=Object.create(HTMLElement.prototype); HTMLHeadElement.prototype[ST]='HTMLHeadElement'; sn(HTMLHeadElement,'HTMLHeadElement'); Object.defineProperty(HTMLHeadElement,'name',{value:'HTMLHeadElement'});
function HTMLCanvasElement(){} HTMLCanvasElement.prototype=Object.create(HTMLElement.prototype); HTMLCanvasElement.prototype[ST]='HTMLCanvasElement'; sn(HTMLCanvasElement,'HTMLCanvasElement'); Object.defineProperty(HTMLCanvasElement,'name',{value:'HTMLCanvasElement'});
function HTMLIFrameElement(){} HTMLIFrameElement.prototype=Object.create(HTMLElement.prototype); HTMLIFrameElement.prototype[ST]='HTMLIFrameElement'; sn(HTMLIFrameElement,'HTMLIFrameElement'); Object.defineProperty(HTMLIFrameElement,'name',{value:'HTMLIFrameElement'});
function HTMLScriptElement(){} HTMLScriptElement.prototype=Object.create(HTMLElement.prototype); HTMLScriptElement.prototype[ST]='HTMLScriptElement'; sn(HTMLScriptElement,'HTMLScriptElement'); Object.defineProperty(HTMLScriptElement,'name',{value:'HTMLScriptElement'});
function Location(){} Location.prototype[ST]='Location'; sn(Location,'Location'); Object.defineProperty(Location,'name',{value:'Location'});
function Screen(){} Screen.prototype[ST]='Screen'; sn(Screen,'Screen'); Object.defineProperty(Screen,'name',{value:'Screen'});
function History(){} History.prototype[ST]='History'; sn(History,'History'); Object.defineProperty(History,'name',{value:'History'});
function Storage(){} Storage.prototype[ST]='Storage'; sn(Storage,'Storage'); Object.defineProperty(Storage,'name',{value:'Storage'});
function Performance(){} Performance.prototype[ST]='Performance'; sn(Performance,'Performance'); Object.defineProperty(Performance,'name',{value:'Performance'});
function PluginArray(){} PluginArray.prototype[ST]='PluginArray'; sn(PluginArray,'PluginArray'); Object.defineProperty(PluginArray,'name',{value:'PluginArray'});
function MimeTypeArray(){} MimeTypeArray.prototype[ST]='MimeTypeArray'; sn(MimeTypeArray,'MimeTypeArray'); Object.defineProperty(MimeTypeArray,'name',{value:'MimeTypeArray'});
function Plugin(){} Plugin.prototype[ST]='Plugin'; sn(Plugin,'Plugin'); Object.defineProperty(Plugin,'name',{value:'Plugin'});
function MimeType(){} MimeType.prototype[ST]='MimeType'; sn(MimeType,'MimeType'); Object.defineProperty(MimeType,'name',{value:'MimeType'});
function MemoryInfo(){} MemoryInfo.prototype[ST]='MemoryInfo'; sn(MemoryInfo,'MemoryInfo'); Object.defineProperty(MemoryInfo,'name',{value:'MemoryInfo'});
function SubtleCrypto(){} SubtleCrypto.prototype[ST]='SubtleCrypto'; sn(SubtleCrypto,'SubtleCrypto'); Object.defineProperty(SubtleCrypto,'name',{value:'SubtleCrypto'});
function Crypto(){} Crypto.prototype[ST]='Crypto'; sn(Crypto,'Crypto'); Object.defineProperty(Crypto,'name',{value:'Crypto'});

// ===== Override global with browser objects =====
// Canvas, WebGL
HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl') {
        var gl = {}; gl[ST] = 'WebGLRenderingContext';
        var params = {7936:'WebKit', 7937:'WebKit WebGL', 3379:16384, 34921:16, 35661:32};
        gl.getParameter = function(p) { return params[p] || 0; }; sn(gl.getParameter, 'getParameter');
        gl.getExtension = function(n) { if (n==='WEBGL_debug_renderer_info') return {UNMASKED_VENDOR_WEBGL:37446, UNMASKED_RENDERER_WEBGL:37445}; return {}; }; sn(gl.getExtension, 'getExtension');
        gl.getSupportedExtensions = function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth','EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']; }; sn(gl.getSupportedExtensions, 'getSupportedExtensions');
        gl.getShaderPrecisionFormat = function() { return {rangeMin:127,rangeMax:127,precision:23}; }; sn(gl.getShaderPrecisionFormat, 'getShaderPrecisionFormat');
        return gl;
    }
    if (type === '2d') {
        var c2d = {}; c2d[ST] = 'CanvasRenderingContext2D';
        c2d.font = '10px sans-serif'; c2d.measureText = function(t) { return {width: t.length * 6}; }; sn(c2d.measureText, 'measureText');
        c2d.getImageData = function() { return {data: new Uint8ClampedArray(400), width: 10, height: 10}; }; sn(c2d.getImageData, 'getImageData');
        return c2d;
    }
    return null;
}; sn(HTMLCanvasElement.prototype.getContext, 'getContext');
HTMLCanvasElement.prototype.width = 300; HTMLCanvasElement.prototype.height = 150;

// Navigator (prototype getters, Chrome 148 exact)
var NP = Navigator.prototype;
function dNav(p, v) { Object.defineProperty(NP, p, {get: function() { return v; }, enumerable: true, configurable: true}); }
dNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
dNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
dNav('appCodeName', 'Mozilla'); dNav('appName', 'Netscape'); dNav('platform', 'Win32');
dNav('product', 'Gecko'); dNav('vendor', 'Google Inc.'); dNav('vendorSub', '');
dNav('productSub', '20030107'); dNav('language', 'zh-CN'); dNav('languages', ['zh-CN', 'zh']);
dNav('cookieEnabled', true); dNav('webdriver', false); dNav('onLine', true);
dNav('hardwareConcurrency', 32); dNav('maxTouchPoints', 0);
dNav('deviceMemory', 32); dNav('pdfViewerEnabled', true);
dNav('doNotTrack', null); dNav('webkitTemporaryStorage', {});

// plugins (named MimeType access)
function getPls() {
    var ns = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'];
    var pa = Object.create(PluginArray.prototype); pa.length = 5;
    for (var i = 0; i < 5; i++) {
        var p = Object.create(Plugin.prototype);
        Object.defineProperty(p, 'name', {get:function(){return this._n}, enumerable:true,configurable:true});
        Object.defineProperty(p, 'filename', {get:function(){return 'internal-pdf-viewer'}, enumerable:true,configurable:true});
        Object.defineProperty(p, 'description', {get:function(){return 'Portable Document Format'}, enumerable:true,configurable:true});
        Object.defineProperty(p, 'length', {get:function(){return 2}, enumerable:true,configurable:true});
        p._n = ns[i]; p.item = mf('item'); p.namedItem = mf('namedItem');
        var m0 = Object.create(MimeType.prototype);
        Object.defineProperty(m0, 'type', {get:function(){return 'application/pdf'}, enumerable:true,configurable:true});
        Object.defineProperty(m0, 'suffixes', {get:function(){return 'pdf'}, enumerable:true,configurable:true});
        Object.defineProperty(m0, 'description', {get:function(){return 'Portable Document Format'}, enumerable:true,configurable:true});
        m0.enabledPlugin = p;
        var m1 = Object.create(MimeType.prototype);
        Object.defineProperty(m1, 'type', {get:function(){return 'text/pdf'}, enumerable:true,configurable:true});
        Object.defineProperty(m1, 'suffixes', {get:function(){return 'pdf'}, enumerable:true,configurable:true});
        Object.defineProperty(m1, 'description', {get:function(){return 'Portable Document Format'}, enumerable:true,configurable:true});
        m1.enabledPlugin = p;
        p[0] = m0; p[1] = m1;
        Object.defineProperty(p, 'application/pdf', {get:function(){return m0}, enumerable:false,configurable:true});
        Object.defineProperty(p, 'text/pdf', {get:function(){return m1}, enumerable:false,configurable:true});
        pa[i] = p;
    }
    return pa;
}
Object.defineProperty(NP, 'plugins', {get: getPls, enumerable:true, configurable:true});
Object.defineProperty(NP, 'mimeTypes', {get: function() {
    var p = getPls(); var mt = Object.create(MimeTypeArray.prototype); mt.length = 2;
    mt.item = mf('item'); mt.namedItem = mf('namedItem'); mt[0] = p[0][0]; mt[1] = p[0][1]; return mt;
}, enumerable:true, configurable:true});
var nav = new Navigator();

// Document
var doc = new HTMLDocument();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameElement(); f.contentWindow = global; return f; }
    if (tag === 'canvas') return new HTMLCanvasElement();
    if (tag === 'script') return new HTMLScriptElement();
    return new HTMLElement();
}; sn(doc.createElement, 'createElement');
doc.body = new HTMLBodyElement(); doc.documentElement = new HTMLHtmlElement(); doc.head = new HTMLHeadElement();
Object.defineProperty(HTMLDocument.prototype, 'cookie', {get: function() { return '__a=' + __a + ';__c=' + __c + ';__g=-'; }, set: function(){}, configurable: true, enumerable: true});
doc.all = undefined; doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible'; doc.title = 'BOSS直聘';

// Location / Screen / Performance
var loc = new Location(); loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs'; loc.protocol = 'https:';

var SP = Screen.prototype;
Object.defineProperty(SP, 'width', {get:function(){return 2195}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'height', {get:function(){return 1235}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'availWidth', {get:function(){return 2195}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'availHeight', {get:function(){return 1187}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'colorDepth', {get:function(){return 32}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'pixelDepth', {get:function(){return 32}, enumerable:true,configurable:true});
var scr = new Screen();

var mi = new MemoryInfo();
Object.defineProperty(MemoryInfo.prototype, 'jsHeapSizeLimit', {get:function(){return 4294967296}, enumerable:true,configurable:true});
Object.defineProperty(MemoryInfo.prototype, 'totalJSHeapSize', {get:function(){return 41938737}, enumerable:true,configurable:true});
Object.defineProperty(MemoryInfo.prototype, 'usedJSHeapSize', {get:function(){return 34705941}, enumerable:true,configurable:true});
var perf = new Performance();
perf.now = function() { return Date.now(); }; sn(perf.now, 'now');
perf.memory = mi;

// Crypto
var subtle = new SubtleCrypto();
['decrypt','deriveBits','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey'].forEach(function(m) { SubtleCrypto.prototype[m] = mf(m); });
var cryptoObj = new Crypto();
Crypto.prototype.getRandomValues = function(arr) { var b = crypto.randomBytes(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; };
sn(Crypto.prototype.getRandomValues, 'getRandomValues');
Object.defineProperty(Crypto.prototype, 'subtle', {get:function(){return subtle}, enumerable:true,configurable:true});
Crypto.prototype.randomUUID = function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; }; sn(Crypto.prototype.randomUUID, 'randomUUID');

// ===== Override Node.js global with browser objects =====
global.window = global; global.self = global; global.top = global; global.parent = global; global.globalThis = global;
global.navigator = nav; global.document = doc; global.location = loc;
global.screen = scr; global.history = {length: 1};
global.localStorage = {getItem: function(){return null}, setItem: function(){}, key: function(){return null}, length: 0};
global.sessionStorage = {getItem: function(){return null}, setItem: function(){}, key: function(){return null}, length: 0};
global.performance = perf;
global.crypto = cryptoObj;
global.btoa = function(s) { return Buffer.from(s).toString('base64'); }; sn(global.btoa, 'btoa');
global.atob = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(global.atob, 'atob');
global.innerWidth = 2195; global.innerHeight = 1100;
global.outerWidth = 2195; global.outerHeight = 1187;
global.devicePixelRatio = 1.75; global.screenX = 2195; global.screenY = 0;
global.CSSRuleList = mc('CSSRuleList');
global.console = {log: function(){}, error: function(){}, warn: function(){}, info: function(){}};
global.fetch = mf('fetch'); global.postMessage = mf('postMessage');
global.addEventListener = mf('addEventListener');
global.matchMedia = function() { return {matches: false, media: ''}; }; sn(global.matchMedia, 'matchMedia');
global.getComputedStyle = function() { return {}; }; sn(global.getComputedStyle, 'getComputedStyle');
global.getSelection = function() { return null; };
global.Intl = {};
global.AbortController = mc('AbortController'); global.AbortSignal = mc('AbortSignal');

// 200+ extra browser constructors (use mc — now with .name fix)
['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'].forEach(function(n) {
    if (typeof global[n] === 'undefined') global[n] = mc(n);
});

// ===== Execute security JS =====
try {
    eval(code);
    if (typeof ABC === 'undefined') throw new Error('ABC not defined');
    var result = new ABC().z(seed, ts);
    process.stdout.write(result);
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
