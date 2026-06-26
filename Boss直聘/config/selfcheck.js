/**
 * Self-check: compare VM environment against browser values
 * Usage: node selfcheck.js
 */
var vm = require('vm'), fs = require('fs'), _crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

function EvtTgt(){} sn(EvtTgt,'EventTarget');

function Navigator_(){}
Navigator_.prototype = Object.create(EvtTgt.prototype);
Navigator_.prototype[ST] = 'Navigator'; sn(Navigator_,'Navigator');

function Document_(){}
Document_.prototype = Object.create(EvtTgt.prototype);
Document_.prototype[ST] = 'HTMLDocument'; sn(Document_,'Document');

function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype);
HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1920; HTMLEl.prototype.offsetHeight = 1080;
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; };
sn(HTMLEl.prototype.getAttribute, 'getAttribute');
sn(HTMLEl, 'HTMLElement');

function HTMLHtmlEl(){}
HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype);
HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement'; sn(HTMLHtmlEl,'HTMLHtmlElement');

function HTMLBodyEl(){}
HTMLBodyEl.prototype = Object.create(HTMLEl.prototype);
HTMLBodyEl.prototype[ST] = 'HTMLBodyElement'; sn(HTMLBodyEl,'HTMLBodyElement');

function HTMLHeadEl(){}
HTMLHeadEl.prototype = Object.create(HTMLEl.prototype);
HTMLHeadEl.prototype[ST] = 'HTMLHeadElement'; sn(HTMLHeadEl,'HTMLHeadElement');

function HTMLCanvasEl(){}
HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype);
HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement'; sn(HTMLCanvasEl,'HTMLCanvasElement');
HTMLCanvasEl.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl') return makeWebGL();
    if (type === '2d') return make2D();
    return null;
};
sn(HTMLCanvasEl.prototype.getContext, 'getContext');

function HTMLIFrameEl(){}
HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype);
HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement'; sn(HTMLIFrameEl,'HTMLIFrameElement');

function HTMLScriptEl(){}
HTMLScriptEl.prototype = Object.create(HTMLEl.prototype);
HTMLScriptEl.prototype[ST] = 'HTMLScriptElement'; sn(HTMLScriptEl,'HTMLScriptElement');

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

function PluginArray_(){}
PluginArray_.prototype[ST] = 'PluginArray'; sn(PluginArray_,'PluginArray');

function MimeTypeArray_(){}
MimeTypeArray_.prototype[ST] = 'MimeTypeArray'; sn(MimeTypeArray_,'MimeTypeArray');

function Plugin_(){}
Plugin_.prototype[ST] = 'Plugin'; sn(Plugin_,'Plugin');

function MimeType_(){}
MimeType_.prototype[ST] = 'MimeType'; sn(MimeType_,'MimeType');

function MemoryInfo_(){}
MemoryInfo_.prototype[ST] = 'MemoryInfo'; sn(MemoryInfo_,'MemoryInfo');

// ===== WebGL =====
function makeWebGL() {
    var ctx = {};
    ctx[ST] = 'WebGLRenderingContext';
    var params = {
        7936: 'WebKit', 7937: 'WebKit WebGL', 7938: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',
        3379: 16384, 3386: [16384, 16384], 34921: 16, 35661: 32,
        37445: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)',
        37446: 'Google Inc. (NVIDIA)',
    };
    ctx.getParameter = function(p) { return params[p] || 0; };
    sn(ctx.getParameter, 'getParameter');
    ctx.getExtension = function(n) {
        if (n === 'WEBGL_debug_renderer_info') return { UNMASKED_VENDOR_WEBGL: 37446, UNMASKED_RENDERER_WEBGL: 37445 };
        if (n === 'EXT_texture_filter_anisotropic') return {};
        return {};
    };
    sn(ctx.getExtension, 'getExtension');
    ctx.getSupportedExtensions = function() {
        return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth',
            'EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB',
            'OES_standard_derivatives','OES_texture_float','OES_texture_float_linear',
            'OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object',
            'WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb',
            'WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture',
            'WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw'];
    };
    sn(ctx.getSupportedExtensions, 'getSupportedExtensions');
    ctx.getShaderPrecisionFormat = function() { return { rangeMin: 127, rangeMax: 127, precision: 23 }; };
    sn(ctx.getShaderPrecisionFormat, 'getShaderPrecisionFormat');
    ['clear','enable','disable','viewport','useProgram','bindBuffer','bufferData','drawArrays',
     'bindTexture','activeTexture','linkProgram','attachShader','compileShader','shaderSource',
     'createShader','createProgram','createTexture','createBuffer','createFramebuffer',
     'bindFramebuffer','framebufferTexture2D'].forEach(function(m){ctx[m] = mf(m)});
    return ctx;
}

function make2D() {
    var ctx = {};
    ctx[ST] = 'CanvasRenderingContext2D';
    ctx.measureText = function(t) { return { width: t.length * 6 }; };
    sn(ctx.measureText, 'measureText');
    ctx.getImageData = function(x,y,w,h) { return { data: new Uint8ClampedArray(w*h*4), width: w, height: h }; };
    sn(ctx.getImageData, 'getImageData');
    ['fillText','fillRect','clearRect','save','restore','scale','rotate','translate',
     'beginPath','moveTo','lineTo','stroke'].forEach(function(m){ctx[m] = mf(m)});
    ctx.font = '10px sans-serif';
    return ctx;
}

// ===== Navigator (prototype getters) =====
var NP = Navigator_.prototype;
function defNav(p, val) { Object.defineProperty(NP, p, { get: function() { return val; }, enumerable: true, configurable: true }); }

defNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appCodeName', 'Mozilla'); defNav('appName', 'Netscape'); defNav('platform', 'Win32');
defNav('product', 'Gecko'); defNav('vendor', 'Google Inc.'); defNav('vendorSub', '');
defNav('productSub', '20030107'); defNav('language', 'zh-CN'); defNav('languages', ['zh-CN', 'zh']);
defNav('cookieEnabled', true); defNav('webdriver', false); defNav('onLine', true);
defNav('hardwareConcurrency', 32); defNav('maxTouchPoints', 0); defNav('deviceMemory', 32);
defNav('pdfViewerEnabled', true); defNav('doNotTrack', null);
defNav('webkitTemporaryStorage', {});

// Plugins/MimeTypes
Object.defineProperty(NP, 'plugins', {
    get: function() {
        var pa = Object.create(PluginArray_.prototype);
        pa.length = 5; pa.item = mf('item'); pa.namedItem = mf('namedItem'); pa.refresh = mf('refresh');
        pa[Symbol.iterator] = function() { var arr=this, i=0; return {next:function(){return i<arr.length?{value:arr[i++],done:false}:{done:true}}}; };
        var names = ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
        for (var i = 0; i < 5; i++) {
            var p = Object.create(Plugin_.prototype);
            p.name = names[i]; p.filename = 'internal-pdf-viewer'; p.description = 'Portable Document Format'; p.length = 2;
            p.item = mf('item'); p.namedItem = mf('namedItem');
            var m0 = Object.create(MimeType_.prototype); m0.type = 'application/pdf'; m0.suffixes = 'pdf'; m0.description = 'Portable Document Format'; m0.enabledPlugin = p;
            var m1 = Object.create(MimeType_.prototype); m1.type = 'text/pdf'; m1.suffixes = 'pdf'; m1.description = 'Portable Document Format'; m1.enabledPlugin = p;
            p[0] = m0; p[1] = m1;
            pa[i] = p;
        }
        return pa;
    },
    enumerable:true, configurable:true
});
Object.defineProperty(NP, 'mimeTypes', {
    get: function() {
        var mt = Object.create(MimeTypeArray_.prototype);
        mt.length = 2; mt.item = mf('item'); mt.namedItem = mf('namedItem');
        return mt;
    },
    enumerable:true, configurable:true
});
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
    get: function() { return '__a=0;__c=0;__g=-'; },
    set: function(v) {},
    configurable:true, enumerable:true
});
doc.all = undefined; doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';

// ===== Location / Screen =====
var loc = new Location_();
loc.href = 'https://www.zhipin.com/web/geek/jobs'; loc.hostname = 'www.zhipin.com';

var SP = Screen_.prototype;
Object.defineProperty(SP, 'width', {get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP, 'height', {get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP, 'availWidth', {get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP, 'availHeight', {get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP, 'colorDepth', {get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP, 'pixelDepth', {get:function(){return 32},enumerable:true,configurable:true});
var scr = new Screen_();

// ===== History / Storage / Performance =====
var hist = new History_(); hist.length = 1;

var memInfo = new MemoryInfo_();
memInfo.jsHeapSizeLimit = 4294967296; memInfo.totalJSHeapSize = 41938737; memInfo.usedJSHeapSize = 34705941;
var perf = new Performance_();
perf.now = function() { return Date.now(); }; sn(perf.now, 'now');
perf.memory = memInfo;

// ===== Crypto / base64 =====
var cryptoFn = function(a) { var b = _crypto.randomBytes(a.length); for (var i = 0; i < a.length; i++) a[i] = b[i]; return a; };
sn(cryptoFn, 'getRandomValues');
var btoaFn = function(s) { return Buffer.from(s).toString('base64'); }; sn(btoaFn, 'btoa');
var atobFn = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(atobFn, 'atob');

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
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox; sandbox.globalThis = sandbox;
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = { getItem: function() { return null; } };
sandbox.sessionStorage = { getItem: function() { return null; } };
sandbox.performance = perf;
sandbox.crypto = { getRandomValues: cryptoFn, subtle: null };
sandbox.btoa = btoaFn; sandbox.atob = atobFn;
sandbox.innerWidth = 2195; sandbox.innerHeight = 1100;
sandbox.outerWidth = 2195; sandbox.outerHeight = 1187;
sandbox.devicePixelRatio = 1.75; sandbox.screenX = 2195; sandbox.screenY = 0;
sandbox.name = ''; sandbox.closed = false; sandbox.length = 0; sandbox.opener = null;
sandbox.origin = 'https://www.zhipin.com'; sandbox.isSecureContext = true;
sandbox.postMessage = mf('postMessage'); sandbox.addEventListener = mf('addEventListener');
sandbox.removeEventListener = mf('removeEventListener'); sandbox.dispatchEvent = mf('dispatchEvent');
sandbox.fetch = mf('fetch'); sandbox.requestAnimationFrame = mf('requestAnimationFrame');
sandbox.matchMedia = function() { return { matches: false, media: '' }; };
sn(sandbox.matchMedia, 'matchMedia');
sandbox.getComputedStyle = function() { return {}; }; sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.XMLHttpRequest = mc('XMLHttpRequest'); sandbox.MutationObserver = mc('MutationObserver');
sandbox.Image = mc('Image'); sandbox.Event = mc('Event'); sandbox.CSSRuleList = mc('CSSRuleList');
sandbox.process = undefined; sandbox.module = undefined; sandbox.require = undefined;
sandbox._phantom = undefined; sandbox.callphantom = undefined;
var extra = ['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D',
    'CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation',
    'DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent',
    'Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData',
    'Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement',
    'HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement',
    'HTMLStyleElement','HTMLTableElement','HTMLTemplateElement','HTMLTextAreaElement',
    'HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList',
    'MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification',
    'PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent',
    'PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response',
    'SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent',
    'Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent',
    'URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker',
    'XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer',
    'XPathEvaluator','XPathResult','XSLTProcessor'];
extra.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });
sandbox.Navigator = Navigator_; sandbox.Document = Document_; sandbox.EventTarget = EvtTgt;
sandbox.HTMLElement = HTMLEl; sandbox.HTMLCanvasElement = HTMLCanvasEl;
sandbox.HTMLIFrameElement = HTMLIFrameEl; sandbox.HTMLScriptElement = HTMLScriptEl;
sandbox.PluginArray = PluginArray_; sandbox.MimeTypeArray = MimeTypeArray_;
sandbox.Plugin = Plugin_; sandbox.MimeType = MimeType_;
sandbox.Performance = Performance_; sandbox.MemoryInfo = MemoryInfo_;
sandbox.Location = Location_; sandbox.Screen = Screen_; sandbox.History = History_; sandbox.Storage = Storage_;

// ===== Run security JS =====
var ctx = vm.createContext(sandbox);
new vm.Script(code).runInContext(ctx);

// ===== SELF-CHECK =====
console.log('\n=== Environment Self-Check ===');
var checks = [];

function check(label, actual, expected) {
    var match = (String(actual) === String(expected));
    checks.push({ label: label, actual: actual, expected: expected, match: match });
}

// Navigator
check('Object.keys(navigator).length', Object.keys(sandbox.navigator).length, 0);
check('navigator.plugins.length', sandbox.navigator.plugins.length, 5);
check('navigator.plugins[0].name', sandbox.navigator.plugins[0].name, 'PDF Viewer');
check('nav.plugins instanceof PluginArray', sandbox.navigator.plugins instanceof sandbox.PluginArray, true);
check('nav.mimeTypes instanceof MimeTypeArray', sandbox.navigator.mimeTypes instanceof sandbox.MimeTypeArray, true);
check('toString plugins', Object.prototype.toString.call(sandbox.navigator.plugins), '[object PluginArray]');
check('toString mimeTypes', Object.prototype.toString.call(sandbox.navigator.mimeTypes), '[object MimeTypeArray]');
check('toString Plugin', Object.prototype.toString.call(sandbox.navigator.plugins[0]), '[object Plugin]');
check('toString MimeType', Object.prototype.toString.call(sandbox.navigator.plugins[0][0]), '[object MimeType]');

// Screen
check('screen.width', sandbox.screen.width, 2195);
check('screen.height', sandbox.screen.height, 1235);
check('screen.availWidth', sandbox.screen.availWidth, 2195);
check('screen.availHeight', sandbox.screen.availHeight, 1187);
check('screen.colorDepth', sandbox.screen.colorDepth, 32);

// Performance
var pm = sandbox.performance.memory;
check('perf.memory typeof', typeof pm, 'object');
check('toString perf.memory', Object.prototype.toString.call(pm), '[object MemoryInfo]');
check('pm.jsHeapSizeLimit', pm.jsHeapSizeLimit, 4294967296);

// Document
check('document.cookie', String(sandbox.document.cookie), '__a=0;__c=0;__g=-');
check('typeof document.all', typeof sandbox.document.all, 'undefined');
check('hasOwnProperty cookie', sandbox.document.hasOwnProperty('cookie'), false);
check('cookie in doc', 'cookie' in sandbox.document, true);

// WebGL
var c = sandbox.document.createElement('canvas');
var gl = c.getContext('webgl');
check('webgl VENDOR', gl.getParameter(7936), 'WebKit');
var ext = gl.getExtension('WEBGL_debug_renderer_info');
check('webgl debug ext', !!ext, true);
if (ext) {
    check('webgl UNMASKED_VENDOR', gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), 'Google Inc. (NVIDIA)');
    check('webgl UNMASKED_RENDERER (via WEBGL_debug_renderer_info)', gl.getParameter(37445), 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)');
}
check('webgl MAX_TEXTURE_SIZE', gl.getParameter(3379), 16384);
check('webgl MAX_VERTEX_ATTRIBS', gl.getParameter(34921), 16);

// Window
check('window.innerWidth', sandbox.innerWidth, 2195);
check('window.devicePixelRatio', sandbox.devicePixelRatio, 1.75);
check('window.screenX', sandbox.screenX, 2195);

// Token
check('ABC exists', typeof sandbox.ABC, 'function');
var token = new sandbox.ABC().z('test', 1700000000000);
check('Token length >= 400', token.length >= 400, true);

console.log('\nCHECK | STATUS | ACTUAL | EXPECTED');
console.log('------|--------|--------|---------');
var ok = 0, fail = 0;
checks.forEach(function(c) {
    console.log(c.label + ' | ' + (c.match ? 'OK' : 'MISMATCH') + ' | ' +
        String(c.actual).substring(0, 50) + ' | ' + String(c.expected).substring(0, 50));
    if (c.match) ok++; else fail++;
});
console.log('\n' + ok + ' OK, ' + fail + ' MISMATCH');
