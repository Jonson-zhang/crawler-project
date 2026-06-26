/**
 * Boss直聘 补环境 v7 — 浏览器精确版
 *
 * 关键发现：
 * 1. Navigator 属性全在 prototype 上（getters），不在实例
 * 2. Chrome 环境（webkitTemporaryStorage, deviceMemory 等存在）
 * 3. Object.keys(navigator) 返回 [] ！！！
 *
 * 用法: node sign_boss_v7.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm');
var fs = require('fs');
var _crypto = require('crypto');
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
function EvtTgt(){} sn(EvtTgt,'EventTarget'); EvtTgt.prototype[ST]='EventTarget';

function Navigator_(){}
Navigator_.prototype = Object.create(EvtTgt.prototype);
Navigator_.prototype.constructor = Navigator_;
Navigator_.prototype[ST] = 'Navigator';
sn(Navigator_, 'Navigator');

function Document_(){}
Document_.prototype = Object.create(EvtTgt.prototype);
Document_.prototype.constructor = Document_;
Document_.prototype[ST] = 'HTMLDocument';
sn(Document_, 'Document');

function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype);
HTMLEl.prototype.constructor = HTMLEl;
HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1920;
HTMLEl.prototype.offsetHeight = 1080;
HTMLEl.prototype.clientWidth = 1920;
HTMLEl.prototype.clientHeight = 1080;
HTMLEl.prototype.style = {};
HTMLEl.prototype.className = '';
HTMLEl.prototype.id = '';
HTMLEl.prototype.innerHTML = '';
HTMLEl.prototype.textContent = '';
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.removeChild = mf('removeChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; }; sn(HTMLEl.prototype.getAttribute, 'getAttribute');
HTMLEl.prototype.getBoundingClientRect = function() { return {top:0,left:0,right:1920,bottom:1080,width:1920,height:1080}; }; sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect');
HTMLEl.prototype.focus = mf('focus');
sn(HTMLEl, 'HTMLElement');

function HTMLHtmlEl(){}
HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype);
HTMLHtmlEl.prototype.constructor = HTMLHtmlEl;
HTMLHtmlEl.prototype.tagName = 'HTML';
HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement';
sn(HTMLHtmlEl, 'HTMLHtmlElement');

function HTMLBodyEl(){}
HTMLBodyEl.prototype = Object.create(HTMLEl.prototype);
HTMLBodyEl.prototype.constructor = HTMLBodyEl;
HTMLBodyEl.prototype.tagName = 'BODY';
HTMLBodyEl.prototype[ST] = 'HTMLBodyElement';
sn(HTMLBodyEl, 'HTMLBodyElement');

function HTMLHeadEl(){}
HTMLHeadEl.prototype = Object.create(HTMLEl.prototype);
HTMLHeadEl.prototype.constructor = HTMLHeadEl;
HTMLHeadEl.prototype.tagName = 'HEAD';
HTMLHeadEl.prototype[ST] = 'HTMLHeadElement';
sn(HTMLHeadEl, 'HTMLHeadElement');

function HTMLCanvasEl(){}
HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype);
HTMLCanvasEl.prototype.constructor = HTMLCanvasEl;
HTMLCanvasEl.prototype.width = 300;
HTMLCanvasEl.prototype.height = 150;
HTMLCanvasEl.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
        return makeWebGLContext();
    }
    var ctx = Object.create(CanvasRenderingContext2D_.prototype);
    ctx[ST] = 'CanvasRenderingContext2D';
    return ctx;
}; sn(HTMLCanvasEl.prototype.getContext, 'getContext');
HTMLCanvasEl.prototype.toDataURL = function() { return 'data:image/png;base64,test'; }; sn(HTMLCanvasEl.prototype.toDataURL, 'toDataURL');
HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement';
sn(HTMLCanvasEl, 'HTMLCanvasElement');

function CanvasRenderingContext2D_(){}
CanvasRenderingContext2D_.prototype[ST] = 'CanvasRenderingContext2D';
sn(CanvasRenderingContext2D_, 'CanvasRenderingContext2D');
['fillText','fillRect','clearRect','save','restore','scale','rotate','translate','beginPath','moveTo','lineTo','stroke','arc','fill','clip','createLinearGradient','createPattern','drawImage','putImageData','createImageData','getImageData'].forEach(function(m){ CanvasRenderingContext2D_.prototype[m] = mf(m); });
CanvasRenderingContext2D_.prototype.measureText = function(t) { return {width: t.length * 10}; };

function HTMLIFrameEl(){}
HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype);
HTMLIFrameEl.prototype.constructor = HTMLIFrameEl;
HTMLIFrameEl.prototype.src = '';
HTMLIFrameEl.prototype.contentWindow = null;
HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement';
sn(HTMLIFrameEl, 'HTMLIFrameElement');

function HTMLScriptEl(){}
HTMLScriptEl.prototype = Object.create(HTMLEl.prototype);
HTMLScriptEl.prototype.constructor = HTMLScriptEl;
HTMLScriptEl.prototype.src = '';
HTMLScriptEl.prototype.type = 'text/javascript';
HTMLScriptEl.prototype[ST] = 'HTMLScriptElement';
sn(HTMLScriptEl, 'HTMLScriptElement');

function Location_(){}
Location_.prototype[ST] = 'Location';
sn(Location_, 'Location');

function Screen_(){}
Screen_.prototype[ST] = 'Screen';
sn(Screen_, 'Screen');

function History_(){}
History_.prototype[ST] = 'History';
sn(History_, 'History');

function Storage_(){}
Storage_.prototype[ST] = 'Storage';
sn(Storage_, 'Storage');

function Performance_(){}
Performance_.prototype[ST] = 'Performance';
sn(Performance_, 'Performance');

function PluginArray_(){}
PluginArray_.prototype[ST] = 'PluginArray';
sn(PluginArray_, 'PluginArray');

function MimeTypeArray_(){}
MimeTypeArray_.prototype[ST] = 'MimeTypeArray';
sn(MimeTypeArray_, 'MimeTypeArray');

function Plugin_(){}
Plugin_.prototype[ST] = 'Plugin';
sn(Plugin_, 'Plugin');

function MimeType_(){}
MimeType_.prototype[ST] = 'MimeType';
sn(MimeType_, 'MimeType');

function XMLHttpRequest_(){}
XMLHttpRequest_.prototype[ST] = 'XMLHttpRequest';
sn(XMLHttpRequest_, 'XMLHttpRequest');

// WebGL context
function makeWebGLContext() {
    var gl = {};
    gl[ST] = 'WebGLRenderingContext';
    ['clear','clearColor','enable','disable','depthFunc','depthMask','blendFunc','viewport','scissor','cullFace','frontFace','lineWidth','activeTexture','bindTexture','generateMipmap','bindBuffer','bufferData','useProgram','drawArrays','flush','hint','enableVertexAttribArray','disableVertexAttribArray','uniform1i','uniform1f','attachShader','bindAttribLocation','linkProgram','validateProgram','compileShader','shaderSource','bindFramebuffer','framebufferTexture2D','createShader','createProgram','createTexture','createBuffer','createFramebuffer'].forEach(function(m){ gl[m] = mf(m); });
    gl.getParameter = mf('getParameter');
    gl.getExtension = mf('getExtension');
    gl.getSupportedExtensions = function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_frag_depth','EXT_texture_filter_anisotropic','EXT_sRGB','OES_element_index_uint','OES_standard_derivatives','OES_texture_float','OES_texture_half_float','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']; }; sn(gl.getSupportedExtensions, 'getSupportedExtensions');
    gl.getShaderPrecisionFormat = function() { return {rangeMin:127,rangeMax:127,precision:23}; };
    sn(gl.getShaderPrecisionFormat, 'getShaderPrecisionFormat');
    return gl;
}

// ===== Navigator === PROPERTIES AS PROTOTYPE GETTERS =====
var NP = Navigator_.prototype;
function defNav(prop, val) {
    Object.defineProperty(NP, prop, {
        get: function() { return val; },
        enumerable: true, configurable: true
    });
}

// -- String/id properties --
defNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appCodeName', 'Mozilla');
defNav('appName', 'Netscape');
defNav('platform', 'Win32');
defNav('product', 'Gecko');
defNav('vendor', 'Google Inc.');
defNav('vendorSub', '');
defNav('productSub', '20030107');
defNav('language', 'zh-CN');
defNav('languages', ['zh-CN', 'zh']);

// -- Boolean/number properties --
defNav('cookieEnabled', true);
defNav('webdriver', false);
defNav('onLine', true);
defNav('hardwareConcurrency', 32);
defNav('maxTouchPoints', 0);
defNav('deviceMemory', 32);  // UPDATED: 32
defNav('pdfViewerEnabled', true);

// -- Undefined/non-existent in Firefox --
// buildID, oscpu: undefined in Chrome
defNav('doNotTrack', null);

// -- Objects (stubs) --
var navObjs = {
    'webkitTemporaryStorage': {},
    'webkitPersistentStorage': {},
    'connection': {},
    'bluetooth': {},
    'usb': {},
    'xr': {},
    'keyboard': {},
    'locks': {},
    'wakeLock': {},
    'serial': {},
    'hid': {},
    'clipboard': {},
    'credentials': {},
    'mediaDevices': {},
    'mediaCapabilities': {},
    'mediaSession': {},
    'permissions': {},
    'serviceWorker': {},
    'storage': {},
    'geolocation': {},
    'virtualKeyboard': {},
    'userActivation': {},
    'scheduling': {},
    'gpu': {},
    'login': {},
    'ink': {},
    'devicePosture': {},
    'presentation': {},
    'storageBuckets': {},
    'userAgentData': { brands: [], mobile: false, platform: 'Windows' },
    'managed': {},
    'windowControlsOverlay': { visible: false },
    'protectedAudience': {},
    'share': mf('share'),
    'canShare': mf('canShare'),
    'getBattery': mf('getBattery'),
    'getUserMedia': mf('getUserMedia'),
    'requestMIDIAccess': mf('requestMIDIAccess'),
    'requestMediaKeySystemAccess': mf('requestMediaKeySystemAccess'),
    'webkitGetUserMedia': mf('webkitGetUserMedia'),
    'getInstalledRelatedApps': mf('getInstalledRelatedApps'),
};

Object.keys(navObjs).forEach(function(k) {
    Object.defineProperty(NP, k, {
        get: function() { return navObjs[k]; },
        enumerable: true, configurable: true
    });
});

// -- Functions on prototype --
['javaEnabled','sendBeacon','getGamepads','vibrate','taintEnabled'].forEach(function(k) {
    Object.defineProperty(NP, k, {
        get: function() { return mf(k); },
        enumerable: true, configurable: true
    });
});
// taintEnabled should be undefined in Chrome
Object.defineProperty(NP, 'taintEnabled', {
    get: function() { return undefined; },
    enumerable: true, configurable: true
});

// -- Plugins/MimeTypes (lazy, need actual objects not stubs) --
var _plugins = null;
var _mimeTypes = null;
function buildPlugins() {
    if (_plugins) return;
    var names = ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
    _plugins = Object.create(PluginArray_.prototype);
    _plugins.length = 5;
    _plugins.refresh = mf('refresh');
    _plugins.item = mf('item');
    _plugins.namedItem = mf('namedItem');
    for (var i = 0; i < 5; i++) {
        var p = Object.create(Plugin_.prototype);
        p.name = names[i];
        p.filename = 'internal-pdf-viewer';
        p.description = 'Portable Document Format';
        p.length = 2;
        p.item = mf('item');
        p.namedItem = mf('namedItem');
        var mt0 = Object.create(MimeType_.prototype);
        mt0.type = 'application/pdf';
        mt0.suffixes = 'pdf';
        mt0.description = 'Portable Document Format';
        mt0.enabledPlugin = p;
        var mt1 = Object.create(MimeType_.prototype);
        mt1.type = 'text/pdf';
        mt1.suffixes = 'pdf';
        mt1.description = 'Portable Document Format';
        mt1.enabledPlugin = p;
        p[0] = mt0; p[1] = mt1;
        _plugins[i] = p;
    }
    _mimeTypes = Object.create(MimeTypeArray_.prototype);
    _mimeTypes.length = 2;
    _mimeTypes.item = mf('item');
    _mimeTypes.namedItem = mf('namedItem');
    var mmt0 = Object.create(MimeType_.prototype);
    mmt0.type = 'application/pdf'; mmt0.suffixes = 'pdf'; mmt0.description = 'Portable Document Format'; mmt0.enabledPlugin = _plugins[0];
    var mmt1 = Object.create(MimeType_.prototype);
    mmt1.type = 'text/pdf'; mmt1.suffixes = 'pdf'; mmt1.description = 'Portable Document Format'; mmt1.enabledPlugin = _plugins[0];
    _mimeTypes[0] = mmt0; _mimeTypes[1] = mmt1;
}
Object.defineProperty(NP, 'plugins', {get: function(){ buildPlugins(); return _plugins; }, enumerable:true, configurable:true});
Object.defineProperty(NP, 'mimeTypes', {get: function(){ buildPlugins(); return _mimeTypes; }, enumerable:true, configurable:true});

// Create navigator INSTANCE
var nav = new Navigator_();

// ===== Document =====
var doc = new Document_();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.contentWindow = sandbox; return f; }
    if (tag === 'canvas') return new HTMLCanvasEl();
    if (tag === 'script') { var s = new HTMLScriptEl(); return s; }
    return new HTMLEl();
}; sn(doc.createElement, 'createElement');
doc.createElementNS = function(ns, tag) { return doc.createElement(tag); }; sn(doc.createElementNS, 'createElementNS');
doc.body = new HTMLBodyEl();
doc.documentElement = new HTMLHtmlEl();
doc.head = new HTMLHeadEl();
doc.getElementsByTagName = function(t) { if (t === 'head') return { item: function() { return doc.head; }, length: 1 }; return { item: function() { return null; }, length: 0 }; };
sn(doc.getElementsByTagName, 'getElementsByTagName');
doc.getElementById = function() { return new HTMLEl(); }; sn(doc.getElementById, 'getElementById');
doc.getElementsByClassName = function() { return []; }; sn(doc.getElementsByClassName, 'getElementsByClassName');
doc.querySelector = function() { return new HTMLEl(); }; sn(doc.querySelector, 'querySelector');
doc.querySelectorAll = function() { return []; }; sn(doc.querySelectorAll, 'querySelectorAll');
doc.addEventListener = mf('addEventListener');
doc.hidden = false;
doc.readyState = 'complete';
doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible';
doc.title = 'BOSS直聘';
doc.referrer = '';
doc.domain = 'www.zhipin.com';
doc.URL = 'https://www.zhipin.com/web/geek/jobs';
doc.all = undefined;

var _docCookie = '';
Object.defineProperty(doc, 'cookie', {
    get: function() { return _docCookie || ('__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-'); },
    set: function(v) { _docCookie = v; },
    configurable: true, enumerable: true
});

// ===== Location =====
var loc = new Location_();
loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname = 'www.zhipin.com';
loc.host = 'www.zhipin.com';
loc.pathname = '/web/geek/jobs';
loc.protocol = 'https:';
loc.origin = 'https://www.zhipin.com';
loc.port = '';
loc.search = '?city=101010100&query=python';
loc.hash = '';

// ===== Screen (Chrome values) =====
var scr = new Screen_();
var SP = Screen_.prototype;
Object.defineProperty(SP, 'width', {get: function(){return 2195;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'height', {get: function(){return 1235;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'availWidth', {get: function(){return 2195;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'availHeight', {get: function(){return 1187;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'colorDepth', {get: function(){return 32;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'pixelDepth', {get: function(){return 32;}, enumerable:true,configurable:true});

// ===== History =====
var hist = new History_();
hist.length = 1;
hist.pushState = mf('pushState');
hist.replaceState = mf('replaceState');
hist.back = mf('back');
hist.forward = mf('forward');
hist.go = mf('go');

// ===== Storage =====
function mkStor() {
    var s = new Storage_();
    s.getItem = function(key) { return null; }; sn(s.getItem, 'getItem');
    s.setItem = mf('setItem');
    s.removeItem = mf('removeItem');
    s.clear = mf('clear');
    s.key = mf('key');
    s.length = 0;
    return s;
}

// ===== Performance =====
var perf = new Performance_();
perf.now = function() { return Date.now(); }; sn(perf.now, 'now');
perf.memory = {};
perf.timing = {
    navigationStart: Date.now(), fetchStart: Date.now(), domainLookupStart: Date.now(),
    domainLookupEnd: Date.now(), connectStart: Date.now(), connectEnd: Date.now(),
    requestStart: Date.now(), responseStart: Date.now(), responseEnd: Date.now(),
    domLoading: Date.now(), domInteractive: Date.now(), domContentLoadedEventStart: Date.now(),
    domContentLoadedEventEnd: Date.now(), domComplete: Date.now(), loadEventStart: Date.now(),
    loadEventEnd: Date.now()
};

// ===== Crypto =====
var cryptoFn = function(arr) { var b = _crypto.randomBytes(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; }; sn(cryptoFn, 'getRandomValues');

// ===== Base64 =====
var btoaFn = function(s) { return Buffer.from(s).toString('base64'); }; sn(btoaFn, 'btoa');
var atobFn = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(atobFn, 'atob');

// ===== Sandbox setup =====
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

// Mount sandbox
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox; sandbox.globalThis = sandbox;
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = mkStor(); sandbox.sessionStorage = mkStor(); sandbox.performance = perf;
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
sandbox.matchMedia = function() { return { matches: false, media: '' }; }; sn(sandbox.matchMedia, 'matchMedia');
sandbox.getComputedStyle = function() { return {}; }; sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.getSelection = function() { return null; }; sn(sandbox.getSelection, 'getSelection');
sandbox.print = mf('print'); sandbox.open = mf('open'); sandbox.close = mf('close');
sandbox.focus = mf('focus'); sandbox.blur = mf('blur'); sandbox.stop = mf('stop');
sandbox.scroll = mf('scroll'); sandbox.scrollTo = mf('scrollTo'); sandbox.scrollBy = mf('scrollBy');
sandbox.alert = mf('alert'); sandbox.confirm = mf('confirm'); sandbox.prompt = mf('prompt');
sandbox.XMLHttpRequest = mc('XMLHttpRequest'); sandbox.MutationObserver = mc('MutationObserver');
sandbox.Image = mc('Image'); sandbox.Event = mc('Event'); sandbox.CSSRuleList = mc('CSSRuleList');
sandbox.process = undefined; sandbox.module = undefined; sandbox.require = undefined;
sandbox._phantom = undefined; sandbox.callphantom = undefined;

var extraCls = ['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'];
extraCls.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

// Override sandbox constructors with proper types
sandbox.Navigator = Navigator_; sandbox.Document = Document_;
sandbox.HTMLElement = HTMLEl; sandbox.HTMLHtmlElement = HTMLHtmlEl;
sandbox.HTMLBodyElement = HTMLBodyEl; sandbox.HTMLHeadElement = HTMLHeadEl;
sandbox.HTMLCanvasElement = HTMLCanvasEl; sandbox.HTMLIFrameElement = HTMLIFrameEl;
sandbox.HTMLScriptElement = HTMLScriptEl;
sandbox.Location = Location_; sandbox.Screen = Screen_;
sandbox.History = History_; sandbox.Storage = Storage_;
sandbox.Performance = Performance_;
sandbox.PluginArray = PluginArray_; sandbox.MimeTypeArray = MimeTypeArray_;
sandbox.Plugin = Plugin_; sandbox.MimeType = MimeType_;
sandbox.EventTarget = EvtTgt;

// ===== Execute security JS =====
var ctx = vm.createContext(sandbox);
try {
    new vm.Script(code).runInContext(ctx);
    var seed = process.argv[4] || 'test_seed_44_chars_long_abcde12345678';
    var ts = parseInt(process.argv[5] || '1700000000000');
    var result = new sandbox.ABC().z(seed, ts);
    process.stdout.write(result);
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
