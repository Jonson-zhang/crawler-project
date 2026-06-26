/**
 * sign_boss_v15.js — 最干净的补环境
 *
 * 核心修复:
 *   1. Function.prototype.toString patch 在 vm.Script 内部执行
 *   2. 所有浏览器构造函数也在 vm.Script 内部定义
 *   3. sn(), mf(), mc() 使用沙箱内的 Map
 *   4. 环境值全部从 MCP 浏览器采集
 *
 * 用法: node sign_boss_v15.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm'), fs = require('fs');

var seed = process.argv[4] || 'test';
var ts = parseInt(process.argv[5] || '1700000000000');
var __a = process.argv[2] || '0', __c = process.argv[3] || '0';

var securityCode = fs.readFileSync(__dirname + '/config/security-11f5a2fc.js', 'utf8');

// 完整的沙箱代码——全部在一个 vm.Script 里执行
// 所有变量定义在沙箱内部，包括 toString patch 和环境构造函数
var sandboxCode = `
// ===== 1. Native toString protection (INSIDE sandbox) =====
var _mm = new Map();
var _rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && _mm.get(this) || _rt.call(this);
};
function _sn(o, n) { _mm.set(o, ''); }
function _mf(n) { var f = function() {}; _sn(f, n); Object.defineProperty(f, 'name', {value: n}); return f; }
function _mc(n) { var f = function() {}; f.prototype = {constructor: f}; _sn(f, n); Object.defineProperty(f, 'name', {value: n}); return f; }
var _ST = Symbol.toStringTag;

// ===== 2. Browser constructors (INSIDE sandbox) =====
function EvtTgt(){} _sn(EvtTgt, 'EventTarget');
function Navigator(){} Navigator.prototype = Object.create(EvtTgt.prototype); Navigator.prototype[_ST] = 'Navigator'; _sn(Navigator, 'Navigator');
function HTMLDocument(){} HTMLDocument.prototype = Object.create(EvtTgt.prototype); HTMLDocument.prototype[_ST] = 'HTMLDocument'; _sn(HTMLDocument, 'HTMLDocument');
function HTMLElement(){} HTMLElement.prototype = Object.create(EvtTgt.prototype); HTMLElement.prototype[_ST] = 'HTMLElement'; _sn(HTMLElement, 'HTMLElement');
function Performance(){} Performance.prototype[_ST] = 'Performance'; _sn(Performance, 'Performance');
function Screen(){} Screen.prototype[_ST] = 'Screen'; _sn(Screen, 'Screen');
function PluginArray(){}
PluginArray.prototype[_ST] = 'PluginArray'; PluginArray.prototype.item = _mf('item');
PluginArray.prototype.namedItem = _mf('namedItem'); PluginArray.prototype.refresh = _mf('refresh');
_sn(PluginArray, 'PluginArray');
function MimeTypeArray(){}
MimeTypeArray.prototype[_ST] = 'MimeTypeArray'; MimeTypeArray.prototype.item = _mf('item');
MimeTypeArray.prototype.namedItem = _mf('namedItem'); _sn(MimeTypeArray, 'MimeTypeArray');
function Plugin(){} Plugin.prototype[_ST] = 'Plugin'; _sn(Plugin, 'Plugin');
function MimeType(){} MimeType.prototype[_ST] = 'MimeType'; _sn(MimeType, 'MimeType');
function MemoryInfo(){}
MemoryInfo.prototype[_ST] = 'MemoryInfo';
Object.defineProperty(MemoryInfo.prototype, 'jsHeapSizeLimit', {get: function(){return 4294967296}, enumerable: true, configurable: true});
Object.defineProperty(MemoryInfo.prototype, 'totalJSHeapSize', {get: function(){return 41938737}, enumerable: true, configurable: true});
Object.defineProperty(MemoryInfo.prototype, 'usedJSHeapSize', {get: function(){return 34705941}, enumerable: true, configurable: true});
_sn(MemoryInfo, 'MemoryInfo');
function SubtleCrypto(){}
SubtleCrypto.prototype[_ST] = 'SubtleCrypto';
['decrypt','deriveBits','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey'].forEach(function(m){SubtleCrypto.prototype[m] = _mf(m);});
_sn(SubtleCrypto, 'SubtleCrypto');
function Crypto(){}
Crypto.prototype[_ST] = 'Crypto';
Crypto.prototype.getRandomValues = function(a) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; };
_sn(Crypto.prototype.getRandomValues, 'getRandomValues');
Object.defineProperty(Crypto.prototype, 'subtle', {get: function(){return new SubtleCrypto();}, enumerable: true, configurable: true});
Crypto.prototype.randomUUID = function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; };
_sn(Crypto.prototype.randomUUID, 'randomUUID');
_sn(Crypto, 'Crypto');

// ===== 3. Navigator (prototype getters) =====
var NP = Navigator.prototype;
function dNav(p, v) { Object.defineProperty(NP, p, {get: function(){return v}, enumerable: true, configurable: true}); }
dNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
dNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
dNav('appCodeName', 'Mozilla'); dNav('appName', 'Netscape'); dNav('platform', 'Win32');
dNav('product', 'Gecko'); dNav('vendor', 'Google Inc.'); dNav('vendorSub', '');
dNav('productSub', '20030107'); dNav('language', 'zh-CN'); dNav('languages', ['zh-CN', 'zh']);
dNav('cookieEnabled', true); dNav('webdriver', false); dNav('onLine', true);
dNav('hardwareConcurrency', 32); dNav('maxTouchPoints', 0); dNav('deviceMemory', 32);
dNav('pdfViewerEnabled', true); dNav('doNotTrack', null); dNav('webkitTemporaryStorage', {});

// Plugins (browser-exact)
function getPls() {
    var ns = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'];
    var pa = Object.create(PluginArray.prototype); pa.length = 5;
    for (var i = 0; i < 5; i++) {
        var p = Object.create(Plugin.prototype);
        Object.defineProperty(p, 'name', {get: function(){return this._n || ''}, enumerable: true, configurable: true});
        Object.defineProperty(p, 'filename', {get: function(){return 'internal-pdf-viewer'}, enumerable: true, configurable: true});
        Object.defineProperty(p, 'description', {get: function(){return 'Portable Document Format'}, enumerable: true, configurable: true});
        Object.defineProperty(p, 'length', {get: function(){return 2}, enumerable: true, configurable: true});
        p._n = ns[i]; p.item = _mf('item'); p.namedItem = _mf('namedItem');
        var m0 = Object.create(MimeType.prototype);
        Object.defineProperty(m0, 'type', {get: function(){return 'application/pdf'}, enumerable: true, configurable: true});
        Object.defineProperty(m0, 'suffixes', {get: function(){return 'pdf'}, enumerable: true, configurable: true});
        Object.defineProperty(m0, 'description', {get: function(){return 'Portable Document Format'}, enumerable: true, configurable: true});
        Object.defineProperty(m0, 'enabledPlugin', {get: function(){return p}, enumerable: true, configurable: true});
        var m1 = Object.create(MimeType.prototype);
        Object.defineProperty(m1, 'type', {get: function(){return 'text/pdf'}, enumerable: true, configurable: true});
        Object.defineProperty(m1, 'suffixes', {get: function(){return 'pdf'}, enumerable: true, configurable: true});
        Object.defineProperty(m1, 'description', {get: function(){return 'Portable Document Format'}, enumerable: true, configurable: true});
        Object.defineProperty(m1, 'enabledPlugin', {get: function(){return p}, enumerable: true, configurable: true});
        p[0] = m0; p[1] = m1;
        Object.defineProperty(p, 'application/pdf', {get: function(){return m0}, configurable: true});
        Object.defineProperty(p, 'text/pdf', {get: function(){return m1}, configurable: true});
        pa[i] = p;
    }
    return pa;
}
Object.defineProperty(NP, 'plugins', {get: getPls, enumerable: true, configurable: true});
Object.defineProperty(NP, 'mimeTypes', {get: function(){
    var p = getPls(); var mt = Object.create(MimeTypeArray.prototype); mt.length = 2;
    mt[0] = p[0][0]; mt[1] = p[0][1]; return mt;
}, enumerable: true, configurable: true});
var nav = new Navigator();

// ===== 4. Document =====
var doc = new HTMLDocument();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = Object.create(HTMLElement.prototype); f.contentWindow = window; return f; }
    if (tag === 'canvas') {
        var c = Object.create(HTMLElement.prototype); c[_ST] = 'HTMLCanvasElement';
        c.width = 300; c.height = 150; c.style = {};
        c.getContext = function(t) {
            if (t === 'webgl' || t === 'experimental-webgl') {
                var gl = {}; gl[_ST] = 'WebGLRenderingContext';
                var pp = {7936: 'WebKit', 7937: 'WebKit WebGL', 3379: 16384, 34921: 16, 35661: 32,
                    37445: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)',
                    37446: 'Google Inc. (NVIDIA)'};
                gl.getParameter = function(p) { return pp[p] || 0; }; _sn(gl.getParameter, 'getParameter');
                gl.getExtension = function(n) {
                    if (n === 'WEBGL_debug_renderer_info') return {UNMASKED_VENDOR_WEBGL: 37446, UNMASKED_RENDERER_WEBGL: 37445};
                    return {};
                }; _sn(gl.getExtension, 'getExtension');
                gl.getSupportedExtensions = function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth','EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']; };
                _sn(gl.getSupportedExtensions, 'getSupportedExtensions');
                gl.getShaderPrecisionFormat = function() { return {rangeMin: 127, rangeMax: 127, precision: 23}; };
                _sn(gl.getShaderPrecisionFormat, 'getShaderPrecisionFormat');
                return gl;
            }
            if (t === '2d') {
                var c2 = {}; c2[_ST] = 'CanvasRenderingContext2D'; c2.font = '10px sans-serif';
                c2.measureText = function(txt) { return {width: txt.length * 6}; }; _sn(c2.measureText, 'measureText');
                c2.getImageData = function() { return {data: new Uint8ClampedArray(400), width: 10, height: 10}; };
                _sn(c2.getImageData, 'getImageData');
                return c2;
            }
            return null;
        }; _sn(c.getContext, 'getContext');
        c.toDataURL = function() { return 'data:image/png;base64,'; }; _sn(c.toDataURL, 'toDataURL');
        return c;
    }
    if (tag === 'script') return {setAttribute: function(){}, getAttribute: function(){return null}};
    return new HTMLElement();
}; _sn(doc.createElement, 'createElement');
doc.body = new HTMLElement(); doc.head = new HTMLElement(); doc.documentElement = new HTMLElement();
doc.body.appendChild = _mf('appendChild'); doc.body.removeChild = _mf('removeChild');
Object.defineProperty(HTMLDocument.prototype, 'cookie', {
    get: function(){return '__a=${__a};__c=${__c};__g=-';},
    set: function(){}, configurable: true, enumerable: true
});
doc.all = undefined; doc.hidden = false; doc.readyState = 'complete';
doc.characterSet = 'UTF-8'; doc.visibilityState = 'visible'; doc.title = 'BOSS直聘';
doc.getElementsByTagName = function(t) { return {item: function(){return null}, length: 0}; };
_sn(doc.getElementsByTagName, 'getElementsByTagName');
doc.getElementById = function() { return new HTMLElement(); }; _sn(doc.getElementById, 'getElementById');
doc.addEventListener = _mf('addEventListener');

// ===== 5. Screen =====
var SP = Screen.prototype;
Object.defineProperty(SP, 'width', {get: function(){return 2195}, enumerable: true, configurable: true});
Object.defineProperty(SP, 'height', {get: function(){return 1235}, enumerable: true, configurable: true});
Object.defineProperty(SP, 'availWidth', {get: function(){return 2195}, enumerable: true, configurable: true});
Object.defineProperty(SP, 'availHeight', {get: function(){return 1187}, enumerable: true, configurable: true});
Object.defineProperty(SP, 'colorDepth', {get: function(){return 32}, enumerable: true, configurable: true});
Object.defineProperty(SP, 'pixelDepth', {get: function(){return 32}, enumerable: true, configurable: true});
var scr = new Screen();

// ===== 6. Performance =====
var mi = new MemoryInfo();
var perf = new Performance();
perf.now = function() { return Date.now(); }; _sn(perf.now, 'now');
perf.memory = mi; perf.navigation = {type: 0, redirectCount: 0};
perf.timing = { navigationStart: Date.now(), fetchStart: Date.now() };
perf.getEntriesByType = _mf('getEntriesByType'); perf.timeOrigin = Date.now();

// ===== 7. Storage =====
function makeLS() {
    var keys = ['ka-uid','c5jbelwo','ab_guid','__a','__c','__g','__l','zp_token','last_login','guide_version','refresh_token','welcome_shown'];
    var entries = {}; for (var i = 0; i < keys.length; i++) entries[keys[i]] = 'val_' + i;
    return {
        getItem: function(k) { return entries[k] || null; },
        setItem: function(k, v) { entries[k] = v; },
        removeItem: function(k) { delete entries[k]; },
        clear: function() { entries = {}; },
        key: function(n) { return n >= 0 && n < keys.length ? keys[n] : null; },
        length: keys.length
    };
}

// ===== 8. Crypto =====
var cryptoObj = new Crypto();

// ===== 9. Mount ALL to globalThis =====
globalThis.window = globalThis; globalThis.self = globalThis; globalThis.top = globalThis; globalThis.parent = globalThis;
globalThis.navigator = nav; globalThis.document = doc; globalThis.screen = scr;
globalThis.performance = perf; globalThis.crypto = cryptoObj;
globalThis.location = {
    hostname: 'www.zhipin.com', host: 'www.zhipin.com', pathname: '/web/geek/jobs',
    href: 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',
    protocol: 'https:', origin: 'https://www.zhipin.com', port: '',
    search: '?city=101010100&query=python', hash: ''
};
globalThis.history = {length: 1, pushState: _mf('pushState'), replaceState: _mf('replaceState'), back: _mf('back'), forward: _mf('forward'), go: _mf('go')};
globalThis.localStorage = makeLS(); globalThis.sessionStorage = makeLS();
globalThis.btoa = function(s) { var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; var out = ''; for (var i = 0; i < s.length; i += 3) { var a = s.charCodeAt(i) || 0, b = s.charCodeAt(i + 1) || 0, c = s.charCodeAt(i + 2) || 0; out += chars[a >> 2] + chars[((a & 3) << 4) | (b >> 4)] + (i + 1 < s.length ? chars[((b & 15) << 2) | (c >> 6)] : '=') + (i + 2 < s.length ? chars[c & 63] : '='); } return out; };
_sn(globalThis.btoa, 'btoa');
globalThis.atob = function(s) { var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; var out = ''; for (var i = 0; i < s.length; i++) { if (s[i] === '=') break; var idx = chars.indexOf(s[i]); if (idx < 0) continue; out += String.fromCharCode(idx); } return out; };
_sn(globalThis.atob, 'atob');
globalThis.innerWidth = 2195; globalThis.innerHeight = 1100;
globalThis.outerWidth = 2195; globalThis.outerHeight = 1187;
globalThis.devicePixelRatio = 1.75; globalThis.screenX = 2195; globalThis.screenY = 0;
globalThis.CSSRuleList = _mc('CSSRuleList');
globalThis.console = {log: function(){}, error: function(){}, warn: function(){}, info: function(){}};
globalThis.fetch = _mf('fetch'); globalThis.postMessage = _mf('postMessage');
globalThis.addEventListener = _mf('addEventListener'); globalThis.removeEventListener = _mf('removeEventListener');
globalThis.dispatchEvent = _mf('dispatchEvent');
globalThis.matchMedia = function() { return {matches: false, media: ''}; }; _sn(globalThis.matchMedia, 'matchMedia');
globalThis.getComputedStyle = function() { return {}; }; _sn(globalThis.getComputedStyle, 'getComputedStyle');
globalThis.getSelection = function() { return null; };
globalThis.XMLHttpRequest = _mc('XMLHttpRequest'); globalThis.MutationObserver = _mc('MutationObserver');
globalThis.Image = _mc('Image'); globalThis.Event = _mc('Event');
globalThis.Intl = {}; globalThis.AbortController = _mc('AbortController'); globalThis.AbortSignal = _mc('AbortSignal');
// Extra constructors
['Blob','CSSStyleDeclaration','CSSStyleSheet','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLSerializer','XSLTProcessor'].forEach(function(n) { if (typeof globalThis[n] === 'undefined') globalThis[n] = _mc(n); });

// ===== 10. Run security JS INSIDE sandbox =====
var __code = ${JSON.stringify(securityCode)};
eval(__code);

if (typeof ABC === 'undefined') throw new Error('ABC not defined');
var __seed = ${JSON.stringify(seed)};
var __ts = ${JSON.stringify(ts)};
var __token = new ABC().z(__seed, parseInt(__ts));
__token;  // last expression is the return value
`;

// Create context with basic globals (passed through to sandbox)
var sbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math, RegExp,
    Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array,
    Uint8ClampedArray, BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
};

var ctx = vm.createContext(sbox);
try {
    var token = vm.runInContext(sandboxCode, ctx);
    if (typeof token !== 'string') throw new Error('Token not a string: ' + typeof token);
    process.stdout.write(token);
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
