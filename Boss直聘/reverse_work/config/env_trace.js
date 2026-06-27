/**
 * env_trace.js — Proxy-based VMP environment access tracer
 *
 * 核心思路来自 v_jstools/cilame 框架：
 *   1. Proxy 拦截所有全局对象的 get/set → 记录 VMP 访问了哪些属性
 *   2. Function.prototype.toString 保护 → native code
 *   3. 关键构造函数原型链修复 → typeof/instanceof 正确
 *   4. 在 Node.js vm 沙箱中执行 → 隔离环境
 *
 * 输出：
 *   - 控制台打印所有属性访问日志
 *   - 最后保存到 prop_access_log.json
 */
var vm = require('vm');
var fs = require('fs');

var seed = process.argv[2] || 'scanEnv';
var ts = parseInt(process.argv[3] || '1700000000000');
var seccode = fs.readFileSync(__dirname + '/security-11f5a2fc.js', 'utf8');

// ===== 1. 属性访问日志 =====
var accessLog = [];
var valueSnapshot = {};  // 第一次访问时记录值
var callLog = [];

function logProp(type, path, val, extra) {
    accessLog.push({ type: type, path: path, ts: Date.now(),
        value: typeof val === 'function' ? '[fn:' + (val.name || 'anon') + ']' : String(val).substring(0, 120),
        extra: extra });
    if (!(path in valueSnapshot)) {
        try {
            valueSnapshot[path] = { type: typeof val, value: String(val).substring(0, 200) };
        } catch(e) {
            valueSnapshot[path] = { type: 'error', value: e.message };
        }
    }
}

function _deepProxy(obj, name, depth) {
    if (!obj || typeof obj !== 'object' && typeof obj !== 'function') return obj;
    if (obj.__proxied) return obj;
    if (depth > 5) return obj; // limit nesting

    var handler = {
        get: function(target, prop) {
            if (typeof prop === 'string' && prop !== '__proxied') {
                logProp('get', name + '.' + prop, target[prop]);
            }
            var result = target[prop];
            if (result && typeof result === 'object' && !result.__proxied) {
                return _deepProxy(result, name + '.' + prop, depth + 1);
            }
            return result;
        },
        set: function(target, prop, val) {
            if (typeof prop === 'string') {
                logProp('set', name + '.' + prop, val);
            }
            target[prop] = val;
            return true;
        },
        apply: function(target, thisArg, args) {
            callLog.push({ fn: name, args: (args || []).map(function(a) { return String(a).substring(0, 60); }) });
            return Reflect.apply(target, thisArg, args);
        }
    };

    var proxy = new Proxy(obj, handler);
    Object.defineProperty(proxy, '__proxied', { value: true });
    return proxy;
}

// ===== 2. vm 沙箱 =====
var sandboxCode = `
// === Mount all ===
var __propLog = [];
var __tsBase = ${ts};

// === Function.prototype.toString 保护 ===
var _snMap = new Map();
var _origToString = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && _snMap.has(this) ? _snMap.get(this) : _origToString.call(this);
};
function _sn(obj, nativeStr) { _snMap.set(obj, nativeStr); }
function _mf(name) {
    var f = function() {};
    Object.defineProperty(f, 'name', { value: name });
    _sn(f, 'function ' + name + '() { [native code] }');
    return f;
}
function _mc(name) {
    var f = function() {};
    f.prototype = { constructor: f };
    Object.defineProperty(f, 'name', { value: name });
    _sn(f, 'function ' + name + '() { [native code] }');
    return f;
}

// === Browser constructors (原型链完整) ===
function EvtTgt(){}
_sn(EvtTgt, 'function EventTarget() { [native code] }');

function Navigator(){}
Navigator.prototype = Object.create(EvtTgt.prototype);
Navigator.prototype[Symbol.toStringTag] = 'Navigator';
_sn(Navigator, 'function Navigator() { [native code] }');

function HTMLDocument(){}
HTMLDocument.prototype = Object.create(EvtTgt.prototype);
HTMLDocument.prototype[Symbol.toStringTag] = 'HTMLDocument';
_sn(HTMLDocument, 'function HTMLDocument() { [native code] }');

function HTMLElement(){}
HTMLElement.prototype = Object.create(EvtTgt.prototype);
HTMLElement.prototype[Symbol.toStringTag] = 'HTMLElement';
_sn(HTMLElement, 'function HTMLElement() { [native code] }');

function SVGElement(){}
SVGElement.prototype[Symbol.toStringTag] = 'SVGElement';
_sn(SVGElement, 'function SVGElement() { [native code] }');

function Performance(){}
Performance.prototype[Symbol.toStringTag] = 'Performance';
_sn(Performance, 'function Performance() { [native code] }');

function Screen(){}
Screen.prototype[Symbol.toStringTag] = 'Screen';
_sn(Screen, 'function Screen() { [native code] }');

function PluginArray(){}
PluginArray.prototype[Symbol.toStringTag] = 'PluginArray';
PluginArray.prototype.item = _mf('item');
PluginArray.prototype.namedItem = _mf('namedItem');
PluginArray.prototype.refresh = _mf('refresh');
_sn(PluginArray, 'function PluginArray() { [native code] }');

function MimeTypeArray(){}
MimeTypeArray.prototype[Symbol.toStringTag] = 'MimeTypeArray';
MimeTypeArray.prototype.item = _mf('item');
MimeTypeArray.prototype.namedItem = _mf('namedItem');
_sn(MimeTypeArray, 'function MimeTypeArray() { [native code] }');

function Plugin(){}
Plugin.prototype[Symbol.toStringTag] = 'Plugin';
Plugin.prototype.item = _mf('item');
Plugin.prototype.namedItem = _mf('namedItem');
_sn(Plugin, 'function Plugin() { [native code] }');

function MimeType(){}
MimeType.prototype[Symbol.toStringTag] = 'MimeType';
_sn(MimeType, 'function MimeType() { [native code] }');

function Crypto(){}
Crypto.prototype[Symbol.toStringTag] = 'Crypto';
_sn(Crypto, 'function Crypto() { [native code] }');

function SubtleCrypto(){}
SubtleCrypto.prototype[Symbol.toStringTag] = 'SubtleCrypto';
_sn(SubtleCrypto, 'function SubtleCrypto() { [native code] }');

function MemoryInfo(){}
MemoryInfo.prototype[Symbol.toStringTag] = 'MemoryInfo';
_sn(MemoryInfo, 'function MemoryInfo() { [native code] }');

// === Navigator with Proxy getters ===
var _NV = new Navigator();
var NP = Navigator.prototype;
function defNav(prop, val) {
    Object.defineProperty(NP, prop, {
        get: function() { __propLog.push('navigator.' + prop); return val; },
        set: function(v) { __propLog.push('navigator.' + prop + '=set'); },
        enumerable: true, configurable: true
    });
}
defNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appCodeName', 'Mozilla');
defNav('appName', 'Netscape');
defNav('platform', 'Win32');
defNav('product', 'Gecko');
defNav('productSub', '20030107');
defNav('vendor', 'Google Inc.');
defNav('vendorSub', '');
defNav('language', 'zh-CN');
defNav('languages', ['zh-CN', 'zh']);
defNav('cookieEnabled', true);
defNav('webdriver', false);
defNav('onLine', true);
defNav('doNotTrack', null);
defNav('hardwareConcurrency', 12);
defNav('maxTouchPoints', 0);
// deviceMemory: Camoufox returns undefined, don't define it
defNav('pdfViewerEnabled', true);
defNav('javaEnabled', function() { __propLog.push('navigator.javaEnabled()'); return false; });
defNav('taintEnabled', function() { __propLog.push('navigator.taintEnabled()'); return false; });
defNav('sendBeacon', function() { __propLog.push('navigator.sendBeacon()'); return false; });

// Plugins - with full property logging (IIFE to fix closure)
var _pls = [];
for (var _i = 0; _i < 5; _i++) (function(i) {
    var p = new Plugin();
    var _pn = 'plugin[' + i + ']';
    Object.defineProperty(p, 'name', { get: function() { __propLog.push(_pn + '.name'); return ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'][i]; }, enumerable: true });
    Object.defineProperty(p, 'filename', { get: function() { __propLog.push(_pn + '.filename'); return 'internal-pdf-viewer'; }, enumerable: true });
    Object.defineProperty(p, 'description', { get: function() { __propLog.push(_pn + '.description'); return 'Portable Document Format'; }, enumerable: true });
    Object.defineProperty(p, 'length', { get: function() { __propLog.push(_pn + '.length'); return 2; }, enumerable: true });
    var m0 = new MimeType();
    Object.defineProperty(m0, 'type', { get: function() { __propLog.push('mimeType[' + i + '][0].type'); return 'application/pdf'; }, enumerable: true });
    Object.defineProperty(m0, 'suffixes', { get: function() { __propLog.push('mimeType[' + i + '][0].suffixes'); return 'pdf'; }, enumerable: true });
    Object.defineProperty(m0, 'description', { get: function() { __propLog.push('mimeType[' + i + '][0].description'); return 'Portable Document Format'; }, enumerable: true });
    Object.defineProperty(m0, 'enabledPlugin', { get: function() { __propLog.push('mimeType[' + i + '][0].enabledPlugin'); return p; }, enumerable: true });
    var m1 = new MimeType();
    Object.defineProperty(m1, 'type', { get: function() { __propLog.push('mimeType[' + i + '][1].type'); return 'text/pdf'; }, enumerable: true });
    Object.defineProperty(m1, 'suffixes', { get: function() { __propLog.push('mimeType[' + i + '][1].suffixes'); return 'pdf'; }, enumerable: true });
    Object.defineProperty(m1, 'description', { get: function() { __propLog.push('mimeType[' + i + '][1].description'); return 'Portable Document Format'; }, enumerable: true });
    Object.defineProperty(m1, 'enabledPlugin', { get: function() { __propLog.push('mimeType[' + i + '][1].enabledPlugin'); return p; }, enumerable: true });
    p[0] = m0; p[1] = m1;
    Object.defineProperty(p, 'application/pdf', { get: function() { __propLog.push('plugin.' + i + '.[\"application/pdf\"]'); return m0; }, configurable: true });
    Object.defineProperty(p, 'text/pdf', { get: function() { __propLog.push('plugin.' + i + '.[\"text/pdf\"]'); return m1; }, configurable: true });
    _pls.push(p);
})(_i);
// PluginArray — proper constructor
var _plsArr = Object.create(PluginArray.prototype);
for (var _k = 0; _k < 5; _k++) _plsArr[_k] = _pls[_k];
_plsArr = new Proxy(_plsArr, {
    get: function(t, p) { if (typeof p === 'string') __propLog.push('navigator.plugins.' + p); return t[p]; }
});
Object.defineProperty(_plsArr, 'length', { get: function() { __propLog.push('navigator.plugins.length'); return 5; }, enumerable: true, configurable: true });
_plsArr.item = function(i) { __propLog.push('navigator.plugins.item(' + i + ')'); return i >= 0 && i < 5 ? _pls[i] : null; };
_plsArr.namedItem = function(n) { __propLog.push('navigator.plugins.namedItem(' + n + ')'); return null; };
_plsArr.refresh = function() { __propLog.push('navigator.plugins.refresh()'); };

var _mtArr = Object.create(MimeTypeArray.prototype);
_mtArr[0] = _pls[0][0]; _mtArr[1] = _pls[0][1];
_mtArr = new Proxy(_mtArr, {
    get: function(t, p) { if (typeof p === 'string') __propLog.push('navigator.mimeTypes.' + p); return t[p]; }
});
Object.defineProperty(_mtArr, 'length', { get: function() { __propLog.push('navigator.mimeTypes.length'); return 2; }, enumerable: true, configurable: true });
_mtArr.item = function(i) { __propLog.push('navigator.mimeTypes.item(' + i + ')'); return i < 2 ? _pls[0][i] : null; };
_mtArr.namedItem = function(n) { __propLog.push('navigator.mimeTypes.namedItem(' + n + ')'); return null; };

Object.defineProperty(NP, 'plugins', {
    get: function() { __propLog.push('navigator.plugins'); return _plsArr; },
    enumerable: true, configurable: true
});
Object.defineProperty(NP, 'mimeTypes', {
    get: function() { __propLog.push('navigator.mimeTypes'); return _mtArr; },
    enumerable: true, configurable: true
});

// mimeTypes 需要有遍历协议
var _nav = new Navigator();

// === Screen ===
var _scr = new Screen();
var SP = Screen.prototype;
function defScr(prop, val) {
    Object.defineProperty(SP, prop, {
        get: function() { __propLog.push('screen.' + prop); return val; },
        enumerable: true, configurable: true
    });
}
defScr('width', 1280); defScr('height', 720);
defScr('availWidth', 1280); defScr('availHeight', 680);
defScr('colorDepth', 24); defScr('pixelDepth', 24);
Object.defineProperty(SP, 'orientation', {
    get: function() { __propLog.push('screen.orientation'); return { type: 'landscape-primary', angle: 0 }; },
    enumerable: true, configurable: true
});

// === Document ===
var _doc = new HTMLDocument();
_doc.createElement = function(tag) {
    __propLog.push('document.createElement(' + tag + ')');
    if (tag === 'canvas') {
        return {
            getContext: function(type) {
                __propLog.push('canvas.getContext(' + type + ')');
                if (type === 'webgl' || type === 'experimental-webgl') {
                    return {
                        getParameter: function(p) { __propLog.push('webgl.getParameter'); var v={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32,37445:'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)',37446:'Google Inc. (NVIDIA)'}; return v[p]||0; },
                        getExtension: function(n) { __propLog.push('webgl.getExtension'); if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445}; return {}; },
                        getSupportedExtensions: function() { __propLog.push('webgl.getSupportedExtensions()'); return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_frag_depth','EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']; },
                        getShaderPrecisionFormat: function() { __propLog.push('webgl.getShaderPrecisionFormat'); return {rangeMin:127,rangeMax:127,precision:23}; }
                    };
                }
                if (type === '2d') {
                    return {
                        fillRect: function(){}, fillText: function(){},
                        measureText: function(t) { __propLog.push('ctx.measureText'); return {width: t.length * 6}; },
                        getImageData: function() { __propLog.push('ctx.getImageData'); return {data: new Uint8ClampedArray(400), width: 10, height: 10}; }
                    };
                }
                __propLog.push('canvas.getContext(' + type + ') = null');
                return null;
            },
            toDataURL: function(type) { __propLog.push('canvas.toDataURL'); return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='; },
            width: 300, height: 150, style: {}
        };
    }
    if (tag === 'iframe') { return { contentWindow: globalThis }; }
    return { style: {}, appendChild: function(){}, setAttribute: function(){}, getAttribute: function(){return null} };
};
_sn(_doc.createElement, 'createElement');
_doc.getElementById = function(id) { __propLog.push('document.getElementById'); return null; };
_sn(_doc.getElementById, 'getElementById');
_doc.getElementsByTagName = function(t) { __propLog.push('document.getElementsByTagName(' + t + ')'); return { item: function(){return null}, length: 0 }; };
_sn(_doc.getElementsByTagName, 'getElementsByTagName');
_doc.getElementsByClassName = function(c) { __propLog.push('document.getElementsByClassName'); return []; };
_doc.querySelector = function(s) { __propLog.push('document.querySelector'); return null; };
_doc.querySelectorAll = function(s) { __propLog.push('document.querySelectorAll'); return []; };
_doc.addEventListener = _mf('addEventListener');
_doc.body = new HTMLElement();
_doc.body.appendChild = _mf('appendChild');
_doc.head = new HTMLElement();
_doc.head.getElementsByTagName = function(){return []};
_doc.documentElement = new HTMLElement();
Object.defineProperty(HTMLDocument.prototype, 'cookie', {
    get: function() { __propLog.push('document.cookie'); return '__a=0;__c=0;__g=-'; },
    set: function(v) { __propLog.push('document.cookie=set'); }, configurable: true, enumerable: true
});
_doc.all = undefined;
_doc.hidden = false;
_doc.visibilityState = 'visible';
_doc.readyState = 'complete';
_doc.characterSet = 'UTF-8';
_doc.title = 'BOSS直聘';
_doc.referrer = '';
_doc.domain = 'www.zhipin.com';
_doc.URL = 'https://www.zhipin.com/web/geek/jobs';
_doc.contentType = 'text/html';
_doc.designMode = 'off';
_doc.dir = 'ltr';

// === Performance ===
var _perf = new Performance();
var _mi = new MemoryInfo();
Object.defineProperty(MemoryInfo.prototype, 'jsHeapSizeLimit', { get: function() { return 4294967296; }, enumerable: true, configurable: true });
Object.defineProperty(MemoryInfo.prototype, 'totalJSHeapSize', { get: function() { return 41938737; }, enumerable: true, configurable: true });
Object.defineProperty(MemoryInfo.prototype, 'usedJSHeapSize', { get: function() { return 34705941; }, enumerable: true, configurable: true });
_perf.now = function() { return Date.now() - __tsBase; }; _sn(_perf.now, 'now');
_perf.memory = _mi;
_perf.navigation = { type: 0, redirectCount: 0 };
_perf.timing = {
    navigationStart: __tsBase, fetchStart: __tsBase, domainLookupStart: __tsBase, domainLookupEnd: __tsBase,
    connectStart: __tsBase, connectEnd: __tsBase, requestStart: __tsBase, responseStart: __tsBase, responseEnd: __tsBase,
    domLoading: __tsBase, domInteractive: __tsBase, domContentLoadedEventStart: __tsBase, domContentLoadedEventEnd: __tsBase,
    domComplete: __tsBase, loadEventStart: __tsBase, loadEventEnd: __tsBase
};
_perf.timeOrigin = __tsBase;
_perf.getEntriesByType = _mf('getEntriesByType');

// Crypto
var _subtle = new SubtleCrypto();
['decrypt','deriveBits','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey'].forEach(function(m){ _subtle[m] = _mf(m); });
var _crypto = new Crypto();
_crypto.getRandomValues = function(a) { __propLog.push('crypto.getRandomValues()'); for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; };
_sn(_crypto.getRandomValues, 'getRandomValues');
Object.defineProperty(Crypto.prototype, 'subtle', { get: function() { __propLog.push('crypto.subtle'); return _subtle; }, enumerable: true, configurable: true });
_crypto.randomUUID = function() { __propLog.push('crypto.randomUUID()'); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; };
_sn(_crypto.randomUUID, 'randomUUID');

// === LocalStorage — Proxy to log ALL accesses ===
var _lsObj = {};
var _ls = new Proxy({
    setItem: function(k, v) { __propLog.push('localStorage.setItem(\"' + k + '\")'); _lsObj[k] = v; },
    getItem: function(k) { __propLog.push('localStorage.getItem(\"' + k + '\")'); return _lsObj[k] || null; },
    removeItem: function(k) { __propLog.push('localStorage.removeItem(\"' + k + '\")'); delete _lsObj[k]; },
    clear: function() { __propLog.push('localStorage.clear()'); _lsObj = {}; },
    key: function(n) { __propLog.push('localStorage.key(' + n + ')'); var keys = Object.keys(_lsObj); return n >= 0 && n < keys.length ? keys[n] : null; },
}, {
    get: function(t, p) { var r = t[p]; if (typeof p === 'string' && p !== 'setItem' && p !== 'getItem') __propLog.push('localStorage.' + p); return r; }
});
Object.defineProperty(_ls, 'length', { get: function() { __propLog.push('localStorage.length'); return Object.keys(_lsObj).length; }, enumerable: true, configurable: true });

var _ss = new Proxy({
    setItem: function(k, v) { __propLog.push('sessionStorage.setItem(\"' + k + '\")'); },
    getItem: function(k) { __propLog.push('sessionStorage.getItem(\"' + k + '\")'); return null; },
    removeItem: function(k) { __propLog.push('sessionStorage.removeItem(\"' + k + '\")'); },
    clear: function() { __propLog.push('sessionStorage.clear()'); },
    key: function(n) { __propLog.push('sessionStorage.key(' + n + ')'); return null; },
}, { get: function(t, p) { var r = t[p]; if (typeof p === 'string') __propLog.push('sessionStorage.' + p); return r; } });
Object.defineProperty(_ss, 'length', { get: function() { __propLog.push('sessionStorage.length'); return 0; }, enumerable: true, configurable: true });

// === History ===
var _hist = { length: 1, scrollRestoration: 'auto', state: null,
    pushState: _mf('pushState'), replaceState: _mf('replaceState'),
    back: _mf('back'), forward: _mf('forward'), go: _mf('go') };

// === OfflineAudioContext ===
function OAC() {
    return {
        createOscillator: function() { __propLog.push('OAC.createOscillator'); return { frequency: { setValueAtTime: function(){} }, type: 'sine', start: function(){}, stop: function(){}, connect: function(){} }; },
        createDynamicsCompressor: function() { __propLog.push('OAC.createDynamicsCompressor'); return { connect: function(){} }; },
        createGain: function() { __propLog.push('OAC.createGain'); return { connect: function(){}, gain: { setValueAtTime: function(){}, value: 0 } }; },
        destination: {},
        startRendering: function() { __propLog.push('OAC.startRendering'); return { then: function(f) { f(''); } }; },
        sampleRate: 44100
    };
}

globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.top = globalThis;
globalThis.parent = globalThis;
globalThis.navigator = _nav;
globalThis.document = _doc;
globalThis.screen = _scr;
globalThis.performance = _perf;
globalThis.crypto = _crypto;
globalThis.localStorage = _ls;
globalThis.sessionStorage = _ss;
globalThis.history = _hist;
globalThis.location = {
    hostname: 'www.zhipin.com', host: 'www.zhipin.com',
    href: 'https://www.zhipin.com/web/common/security-check.html?seed=${seed}&ts=${ts}&name=11f5a2fc',
    protocol: 'https:', origin: 'https://www.zhipin.com',
    pathname: '/web/common/security-check.html',
    search: '?seed=${seed}&ts=${ts}&name=11f5a2fc', port: '', hash: ''
};
globalThis.innerWidth = 1920; globalThis.innerHeight = 955;
globalThis.outerWidth = 1920; globalThis.outerHeight = 1040;
globalThis.devicePixelRatio = 1;
globalThis.screenX = 0; globalThis.screenY = 0;
globalThis.name = ''; globalThis.closed = false; globalThis.length = 0;
globalThis.OfflineAudioContext = OAC;
globalThis.btoa = function(s) { return Buffer.from(s, 'binary').toString('base64'); };
globalThis.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };

// Extra constructors
[
    'AbortController','AbortSignal','Blob','CSSStyleDeclaration','Comment','CustomEvent',
    'DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DocumentFragment','DragEvent',
    'Element','ErrorEvent','Event','EventSource','File','FileList','FileReader','FocusEvent','FormData',
    'Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLFormElement',
    'HTMLImageElement','HTMLInputElement','HTMLLabelElement','HTMLParagraphElement','HTMLSelectElement',
    'HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTextAreaElement','HTMLUListElement',
    'HTMLUnknownElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel',
    'MessageEvent','MouseEvent','MutationObserver','MutationRecord','NodeList','Notification','PageTransitionEvent',
    'Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent',
    'Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGAnimateElement',
    'SVGCircleElement','SVGClipPathElement','SVGDefsElement','SVGDescElement','SVGEllipseElement',
    'SVGFEBlendElement','SVGFEColorMatrixElement','SVGFEComponentTransferElement','SVGFECompositeElement',
    'SVGFEConvolveMatrixElement','SVGFEDiffuseLightingElement','SVGFEDisplacementMapElement',
    'SVGFEDistantLightElement','SVGFEFloodElement','SVGFEGaussianBlurElement','SVGFEImageElement',
    'SVGFEMergeElement','SVGFEMorphologyElement','SVGFEOffsetElement','SVGFEPointLightElement',
    'SVGFESpecularLightingElement','SVGFESpotLightElement','SVGFETileElement','SVGFETurbulenceElement',
    'SVGFilterElement','SVGForeignObjectElement','SVGGElement','SVGImageElement','SVGLineElement',
    'SVGLinearGradientElement','SVGMarkerElement','SVGMaskElement','SVGMetadataElement','SVGPathElement',
    'SVGPatternElement','SVGPolygonElement','SVGPolylineElement','SVGRadialGradientElement','SVGRectElement',
    'SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement',
    'SVGTSpanElement','SVGTextElement','SVGTextPathElement','SVGTitleElement','SVGUseElement','SVGViewElement',
    'Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder',
    'TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState',
    'VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget',
    'XMLSerializer','XSLTProcessor'
].forEach(function(n) {
    if (typeof globalThis[n] === 'undefined') {
        globalThis[n] = _mc(n);
    }
});

// === Run security JS ===
var __code = ${JSON.stringify(seccode)};
eval(__code);

if (typeof ABC === 'undefined') throw new Error('ABC not defined');

var __seed = ${JSON.stringify(seed)};
var __ts = ${JSON.stringify(ts)};
var __token = new ABC().z(__seed, __ts);

// Return data
__token + '|||' + JSON.stringify(__propLog);
`;

// ===== Run in vm =====
var ctxObj = {
    Object, Array, Function, String, Number, Boolean, Date, Math, RegExp,
    Error, TypeError, SyntaxError, ReferenceError, RangeError, URIError,
    parseInt, parseFloat, isNaN, isFinite,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
    Uint8ClampedArray, BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    escape, unescape,  // cilame 框架 hook 的这些
};

var ctx = vm.createContext(ctxObj);
try {
    var result = vm.runInContext(sandboxCode, ctx, { timeout: 30000 });
    var parts = result.split('|||');
    var token = parts[0];
    var propLog = JSON.parse(parts[1]);

    console.error('Token len:', token.length);
    console.error('Token prefix:', token.substring(0, 20));
    console.error('Property accesses:', propLog.length);

    // Deduplicate and sort
    var unique = [];
    var seen = {};
    propLog.forEach(function(p) {
        if (!seen[p]) { seen[p] = true; unique.push(p); }
    });
    unique.sort();
    console.error('UNIQUE accesses:', unique.length);

    // Save
    fs.writeFileSync(__dirname + '/prop_access_log.json', JSON.stringify({ unique: unique, all: propLog, token: token }, null, 2));
    console.error('Saved to prop_access_log.json');

    // Print first 100
    console.error('\n=== First 100 unique accesses ===');
    unique.slice(0, 100).forEach(function(p) { console.error('  ' + p); });

    process.stdout.write(token);
    process.exit(0);
} catch (e) {
    console.error('VM error:', e.message);
    process.exit(1);
}
