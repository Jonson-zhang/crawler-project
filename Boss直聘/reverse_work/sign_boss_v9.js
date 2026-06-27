/**
 * Boss直聘 v9 — Plugin/MimeType prototype getters + 全部 v8 修复
 *
 * v9 关键修复: Plugin.name/filename/description/length 必须是 PROTOTYPE GETTERS
 * （Chrome 浏览器行为），不是实例数据属性。VMP 用 Object.keys() 检测。
 *
 * 用法: node sign_boss_v9.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm'), fs = require('fs'), _crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

// ===== Constructor hierarchy =====
function EvtTgt(){} sn(EvtTgt,'EventTarget');
function Navigator_(){}
Navigator_.prototype = Object.create(EvtTgt.prototype);
Navigator_.prototype.constructor = Navigator_;
Navigator_.prototype[ST] = 'Navigator'; sn(Navigator_, 'Navigator');

function Document_(){}
Document_.prototype = Object.create(EvtTgt.prototype);
Document_.prototype.constructor = Document_;
Document_.prototype[ST] = 'HTMLDocument'; sn(Document_, 'Document');

function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype);
HTMLEl.prototype.constructor = HTMLEl;
HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1920; HTMLEl.prototype.offsetHeight = 1080;
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; }; sn(HTMLEl.prototype.getAttribute, 'getAttribute');
sn(HTMLEl, 'HTMLElement');

function HTMLCanvasEl(){}
HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype);
HTMLCanvasEl.prototype.constructor = HTMLCanvasEl;
HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement'; sn(HTMLCanvasEl,'HTMLCanvasElement');
HTMLCanvasEl.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl') return makeWebGL();
    if (type === '2d') return make2D();
    return null;
}; sn(HTMLCanvasEl.prototype.getContext, 'getContext');
HTMLCanvasEl.prototype.width = 300; HTMLCanvasEl.prototype.height = 150;

function HTMLIFrameEl(){}
HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype);
HTMLIFrameEl.prototype.constructor = HTMLIFrameEl;
HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement'; sn(HTMLIFrameEl,'HTMLIFrameElement');

function HTMLScriptEl(){}
HTMLScriptEl.prototype = Object.create(HTMLEl.prototype);
HTMLScriptEl.prototype.constructor = HTMLScriptEl;
HTMLScriptEl.prototype[ST] = 'HTMLScriptElement'; sn(HTMLScriptEl,'HTMLScriptElement');

function HTMLBodyEl(){}
HTMLBodyEl.prototype = Object.create(HTMLEl.prototype);
HTMLBodyEl.prototype.constructor = HTMLBodyEl;
HTMLBodyEl.prototype[ST] = 'HTMLBodyElement'; sn(HTMLBodyEl,'HTMLBodyElement');

function HTMLHeadEl(){}
HTMLHeadEl.prototype = Object.create(HTMLEl.prototype);
HTMLHeadEl.prototype.constructor = HTMLHeadEl;
HTMLHeadEl.prototype[ST] = 'HTMLHeadElement'; sn(HTMLHeadEl,'HTMLHeadElement');

function HTMLHtmlEl(){}
HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype);
HTMLHtmlEl.prototype.constructor = HTMLHtmlEl;
HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement'; sn(HTMLHtmlEl,'HTMLHtmlElement');

function Location_(){}
Location_.prototype[ST] = 'Location'; sn(Location_,'Location');
function Screen_(){}
Screen_.prototype[ST] = 'Screen'; sn(Screen_,'Screen');
function History_(){}
History_.prototype[ST] = 'History'; sn(History_,'History');
function Storage_(){}
Storage_.prototype[ST] = 'Storage'; sn(Storage_,'Storage');
function Performance_(){}
Performance_.prototype[ST] = 'Performance'; sn(Performance_,'Performance');

// ===== Plugin/MimeType: ALL properties as PROTOTYPE GETTERS =====
function PluginArray_(){}
PluginArray_.prototype[ST] = 'PluginArray';
PluginArray_.prototype.item = mf('item');
PluginArray_.prototype.namedItem = mf('namedItem');
PluginArray_.prototype.refresh = mf('refresh');
PluginArray_.prototype[Symbol.iterator] = function() {
    var arr = this, i = 0;
    return { next: function() { return i < arr.length ? {value: arr[i++], done: false} : {done: true}; } };
};
sn(PluginArray_, 'PluginArray');

function MimeTypeArray_(){}
MimeTypeArray_.prototype[ST] = 'MimeTypeArray';
MimeTypeArray_.prototype.item = mf('item');
MimeTypeArray_.prototype.namedItem = mf('namedItem');
MimeTypeArray_.prototype[Symbol.iterator] = function() {
    var arr = this, i = 0;
    return { next: function() { return i < arr.length ? {value: arr[i++], done: false} : {done: true}; } };
};
sn(MimeTypeArray_, 'MimeTypeArray');

function Plugin_(){}
// Plugin properties as prototype getters (CRITICAL: Object.keys(plugin) must return [])
Object.defineProperty(Plugin_.prototype, 'name', {get: function(){return this._name||''}, enumerable:true, configurable:true});
Object.defineProperty(Plugin_.prototype, 'filename', {get: function(){return this._filename||''}, enumerable:true, configurable:true});
Object.defineProperty(Plugin_.prototype, 'description', {get: function(){return this._description||''}, enumerable:true, configurable:true});
Object.defineProperty(Plugin_.prototype, 'length', {get: function(){return this._length||0}, enumerable:true, configurable:true});
Plugin_.prototype.item = mf('item');
Plugin_.prototype.namedItem = mf('namedItem');
Plugin_.prototype[ST] = 'Plugin';
sn(Plugin_, 'Plugin');

function MimeType_(){}
Object.defineProperty(MimeType_.prototype, 'type', {get: function(){return this._type||''}, enumerable:true, configurable:true});
Object.defineProperty(MimeType_.prototype, 'suffixes', {get: function(){return this._suffixes||''}, enumerable:true, configurable:true});
Object.defineProperty(MimeType_.prototype, 'description', {get: function(){return this._description||''}, enumerable:true, configurable:true});
Object.defineProperty(MimeType_.prototype, 'enabledPlugin', {get: function(){return this._enabledPlugin||null}, enumerable:true, configurable:true});
MimeType_.prototype[ST] = 'MimeType';
sn(MimeType_, 'MimeType');

function MemoryInfo_(){}
MemoryInfo_.prototype[ST] = 'MemoryInfo';
Object.defineProperty(MemoryInfo_.prototype, 'jsHeapSizeLimit', {get:function(){return 4294967296},enumerable:true,configurable:true});
Object.defineProperty(MemoryInfo_.prototype, 'totalJSHeapSize', {get:function(){return 41938737},enumerable:true,configurable:true});
Object.defineProperty(MemoryInfo_.prototype, 'usedJSHeapSize', {get:function(){return 34705941},enumerable:true,configurable:true});
sn(MemoryInfo_, 'MemoryInfo');

// ===== WebGL =====
function makeWebGL() {
    var ctx = {};
    ctx[ST] = 'WebGLRenderingContext';
    var params = {
        7936:'WebKit', 7937:'WebKit WebGL', 7938:'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
        3379:16384, 3386:[16384,16384], 34921:16, 35661:32,
        37445:'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)',
        37446:'Google Inc. (NVIDIA)',
    };
    ctx.getParameter = function(p) { return params[p] || 0; }; sn(ctx.getParameter,'getParameter');
    ctx.getExtension = function(n) {
        if (n === 'WEBGL_debug_renderer_info') return { UNMASKED_VENDOR_WEBGL:37446, UNMASKED_RENDERER_WEBGL:37445 };
        if (n === 'EXT_texture_filter_anisotropic') return {};
        return {};
    }; sn(ctx.getExtension,'getExtension');
    ctx.getSupportedExtensions = function() {
        return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth',
            'EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB',
            'OES_standard_derivatives','OES_texture_float','OES_texture_float_linear',
            'OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object',
            'WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb',
            'WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture',
            'WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw'];
    }; sn(ctx.getSupportedExtensions,'getSupportedExtensions');
    ctx.getShaderPrecisionFormat = function() { return {rangeMin:127,rangeMax:127,precision:23}; };
    sn(ctx.getShaderPrecisionFormat,'getShaderPrecisionFormat');
    ['clear','enable','disable','viewport'].forEach(function(m){ctx[m]=mf(m)});
    return ctx;
}

function make2D() {
    var ctx = {};
    ctx[ST] = 'CanvasRenderingContext2D';
    ctx.measureText = function(t) { return {width:t.length*6}; }; sn(ctx.measureText,'measureText');
    ctx.getImageData = function(x,y,w,h) { return {data:new Uint8ClampedArray(w*h*4),width:w,height:h}; };
    sn(ctx.getImageData,'getImageData');
    ['fillText','fillRect','clearRect','save','restore','scale','rotate'].forEach(function(m){ctx[m]=mf(m)});
    ctx.font = '10px sans-serif';
    return ctx;
}

// ===== Navigator (prototype getters) =====
var NP = Navigator_.prototype;
function defNav(p, val) { Object.defineProperty(NP, p, { get: function() { return val; }, enumerable: true, configurable: true }); }
defNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appCodeName','Mozilla'); defNav('appName','Netscape'); defNav('platform','Win32');
defNav('product','Gecko'); defNav('vendor','Google Inc.'); defNav('vendorSub','');
defNav('productSub','20030107'); defNav('language','zh-CN'); defNav('languages',['zh-CN','zh']);
defNav('cookieEnabled',true); defNav('webdriver',false); defNav('onLine',true);
defNav('hardwareConcurrency',32); defNav('maxTouchPoints',0); defNav('deviceMemory',32);
defNav('pdfViewerEnabled',true); defNav('doNotTrack',null); defNav('webkitTemporaryStorage',{});

// Plugins built once
var _pluginsCache = null;
function getPlugins() {
    if (_pluginsCache) return _pluginsCache;
    var names = ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
    var pa = Object.create(PluginArray_.prototype);
    pa.length = 5;
    for (var i = 0; i < 5; i++) {
        var p = Object.create(Plugin_.prototype);
        p._name = names[i];
        p._filename = 'internal-pdf-viewer';
        p._description = 'Portable Document Format';
        p._length = 2;
        var m0 = Object.create(MimeType_.prototype);
        m0._type = 'application/pdf'; m0._suffixes = 'pdf'; m0._description = 'Portable Document Format';
        m0._enabledPlugin = p;
        var m1 = Object.create(MimeType_.prototype);
        m1._type = 'text/pdf'; m1._suffixes = 'pdf'; m1._description = 'Portable Document Format';
        m1._enabledPlugin = p;
        p[0] = m0; p[1] = m1;
        pa[i] = p;
    }
    _pluginsCache = pa;
    return pa;
}
Object.defineProperty(NP, 'plugins', {get: getPlugins, enumerable:true, configurable:true});
Object.defineProperty(NP, 'mimeTypes', {get: function(){
    var mt = Object.create(MimeTypeArray_.prototype);
    mt.length = 2;
    var p = getPlugins();
    mt[0] = p[0] ? p[0][0] : null;
    mt[1] = p[0] ? p[0][1] : null;
    return mt;
}, enumerable:true, configurable:true});
var nav = new Navigator_();

// ===== Document =====
var doc = new Document_();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.contentWindow = sandbox; return f; }
    if (tag === 'canvas') return new HTMLCanvasEl();
    if (tag === 'script') return new HTMLScriptEl();
    return new HTMLEl();
}; sn(doc.createElement, 'createElement');
doc.body = new HTMLBodyEl(); doc.documentElement = new HTMLHtmlEl(); doc.head = new HTMLHeadEl();
Object.defineProperty(Document_.prototype, 'cookie', {
    get: function() { return '__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-'; },
    set: function(v) {},
    configurable:true, enumerable:true
});
doc.all = undefined; doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible'; doc.title = 'BOSS直聘';

// Location
var loc = new Location_();
loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs';
loc.protocol = 'https:'; loc.origin = 'https://www.zhipin.com';

// Screen
var SP = Screen_.prototype;
Object.defineProperty(SP, 'width', {get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP, 'height', {get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP, 'availWidth', {get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP, 'availHeight', {get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP, 'colorDepth', {get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP, 'pixelDepth', {get:function(){return 32},enumerable:true,configurable:true});
var scr = new Screen_();

// History / Storage
var hist = new History_(); hist.length = 1;

var memInfo = new MemoryInfo_();
var perf = new Performance_();
perf.now = function() { return Date.now(); }; sn(perf.now, 'now');
perf.memory = memInfo;

// Crypto
var cryptoFn = function(a) { var b = _crypto.randomBytes(a.length); for (var i=0;i<a.length;i++) a[i]=b[i]; return a; };
sn(cryptoFn, 'getRandomValues');
var btoaFn = function(s) { return Buffer.from(s).toString('base64'); }; sn(btoaFn, 'btoa');
var atobFn = function(s) { return Buffer.from(s,'base64').toString(); }; sn(atobFn, 'atob');

// ===== Sandbox =====
var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math, RegExp,
    Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Int32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    console: { log: function(){}, error: function(){}, warn: function(){} },
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.globalThis = sandbox;
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = { getItem: function() { return null; } };
sandbox.sessionStorage = { getItem: function() { return null; } };
sandbox.performance = perf;
sandbox.crypto = { getRandomValues: cryptoFn, subtle: null };
sandbox.btoa = btoaFn; sandbox.atob = atobFn;
sandbox.innerWidth = 2195; sandbox.innerHeight = 1100; sandbox.outerWidth = 2195; sandbox.outerHeight = 1187;
sandbox.devicePixelRatio = 1.75; sandbox.screenX = 2195; sandbox.screenY = 0;
sandbox.CSSRuleList = mc('CSSRuleList');
sandbox.XMLHttpRequest = mc('XMLHttpRequest'); sandbox.MutationObserver = mc('MutationObserver');
sandbox.Image = mc('Image'); sandbox.Event = mc('Event');
sandbox.fetch = mf('fetch'); sandbox.postMessage = mf('postMessage');
sandbox.addEventListener = mf('addEventListener'); sandbox.matchMedia = function() { return {matches:false}; };
sandbox.getComputedStyle = function() { return {}; }; sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.getSelection = function() { return null; };
sandbox.process = undefined; sandbox.module = undefined; sandbox.require = undefined;
sandbox._phantom = undefined; sandbox.callphantom = undefined;
['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'].forEach(function(n){if(!(n in sandbox))sandbox[n]=mc(n)});
sandbox.Navigator = Navigator_; sandbox.Document = Document_; sandbox.EventTarget = EvtTgt;
sandbox.HTMLElement = HTMLEl; sandbox.HTMLCanvasElement = HTMLCanvasEl;
sandbox.HTMLIFrameElement = HTMLIFrameEl; sandbox.HTMLScriptElement = HTMLScriptEl;
sandbox.PluginArray = PluginArray_; sandbox.MimeTypeArray = MimeTypeArray_;
sandbox.Plugin = Plugin_; sandbox.MimeType = MimeType_;
sandbox.Performance = Performance_; sandbox.MemoryInfo = MemoryInfo_;
sandbox.Location = Location_; sandbox.Screen = Screen_; sandbox.History = History_; sandbox.Storage = Storage_;

// ===== Execute =====
var ctx = vm.createContext(sandbox);
try {
    new vm.Script(code).runInContext(ctx);
    var seed = process.argv[4] || 'test';
    var ts = parseInt(process.argv[5] || '1700000000000');
    process.stdout.write(new sandbox.ABC().z(seed, ts));
} catch(e) {
    process.stderr.write('Error: '+e.message+'\n'); process.exit(1);
}
