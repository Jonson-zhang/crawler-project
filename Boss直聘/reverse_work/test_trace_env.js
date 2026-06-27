// test_trace_env.js - Trace WHAT the VMP reads by adding getter proxies
var test_full_env = require('fs').readFileSync(__dirname + '/test_full_env.js', 'utf8');
// Load the core (we just want to reuse the sandbox creation)

var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

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
};

var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; sn(f, n); return f; }

// Track all property accesses
var accessed = {};

// Core env (same as test_full_env.js but with access tracking on key objects)
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = { log: mf('log'), error: mf('error'), warn: mf('warn') };

// navigator with Proxy
sandbox._nav = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    appVersion: '5.0 (Windows)', platform: 'Win32', language: 'zh-CN',
    languages: ['zh-CN', 'zh'], cookieEnabled: true, webdriver: false,
    hardwareConcurrency: 8, maxTouchPoints: 0,
    vendor: '', vendorSub: '', productSub: '20100101', doNotTrack: '1', onLine: true,
    plugins: { length: 5, item: mf('item'), namedItem: mf('namedItem'), refresh: mf('refresh') },
    mimeTypes: { length: 2, item: mf('item'), namedItem: mf('namedItem') }
};
sandbox.navigator = new Proxy(sandbox._nav, {
    get: function(t, p) { var k = 'nav.' + p; accessed[k] = (accessed[k] || 0) + 1; return t[p]; }
});

// document with Proxy tracking
sandbox._doc = {
    cookie: 'ab_guid=test; __a=16364972.1782458175..1782458175.2.1.2.2; __c=1782458175; __g=-',
    createElement: mf('createElement'), body: { appendChild: mf('appendChild') },
    documentElement: { appendChild: mf('appendChild') },
    getElementsByTagName: function() { return { item: mf('item'), length: 0 }; },
    hidden: false, readyState: 'complete', referrer: '', title: 'BOSS直聘',
    visibilityState: 'visible', characterSet: 'UTF-8'
};
sandbox.document = new Proxy(sandbox._doc, {
    get: function(t, p) { if (typeof p !== 'symbol') { var k = 'doc.' + p; accessed[k] = (accessed[k] || 0) + 1; } return t[p]; }
});

sandbox.location = {
    href: 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',
    hostname: 'www.zhipin.com', host: 'www.zhipin.com', pathname: '/web/geek/jobs',
    protocol: 'https:', origin: 'https://www.zhipin.com', port: '', search: '', hash: ''
};
sandbox.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 };
sandbox.history = { length: 1, pushState: mf('pushState'), replaceState: mf('replaceState') };
sandbox.localStorage = { getItem: mf('getItem'), setItem: mf('setItem'), removeItem: mf('removeItem'), clear: mf('clear'), length: 0, key: mf('key') };
sandbox.sessionStorage = { getItem: mf('getItem'), setItem: mf('setItem'), removeItem: mf('removeItem'), clear: mf('clear'), length: 0, key: mf('key') };
sandbox.performance = { now: mf('now'), timing: { navigationStart: Date.now() } };
sandbox.crypto = {
    getRandomValues: function(arr) { var b = require('crypto').randomBytes(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; },
    subtle: null
};
sn(sandbox.crypto.getRandomValues, 'getRandomValues');
sandbox.btoa = function(s) { return Buffer.from(s).toString('base64'); }; sn(sandbox.btoa, 'btoa');
sandbox.atob = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(sandbox.atob, 'atob');
sandbox.eval = function(s) { return vm.runInContext(s, vm.createContext(sandbox)); };

// 200+ browser constructors
['Audio','Blob','BroadcastChannel','CDATASection','CSSAnimation','CSSConditionRule','CSSCounterStyleRule','CSSFontFaceRule','CSSGroupingRule','CSSImportRule','CSSKeyframeRule','CSSKeyframesRule','CSSMediaRule','CSSNamespaceRule','CSSPageRule','CSSRule','CSSRuleList','CSSScopeRule','CSSStyleDeclaration','CSSStyleRule','CSSStyleSheet','CanvasGradient','CanvasPattern','CanvasRenderingContext2D','CharacterData','CloseEvent','Comment','CompositionEvent','Crypto','CustomElementRegistry','CustomEvent','DOMException','DOMImplementation','DOMMatrix','DOMParser','DOMPoint','DOMQuad','DOMRect','DOMRectList','DOMRectReadOnly','DOMStringList','DOMStringMap','DOMTokenList','DataTransfer','DataView','DeviceMotionEvent','DeviceOrientationEvent','Document','DocumentFragment','DocumentType','DragEvent','Element','ElementInternals','ErrorEvent','Event','EventSource','EventTarget','External','File','FileList','FileReader','FocusEvent','FontFace','FormData','HashChangeEvent','Headers','History','HTMLAllCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLBodyElement','HTMLButtonElement','HTMLCanvasElement','HTMLCollection','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormElement','HTMLFrameElement','HTMLHRElement','HTMLHeadElement','HTMLHeadingElement','HTMLHtmlElement','HTMLIFrameElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLScriptElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','Image','ImageData','InputEvent','IntersectionObserver','KeyboardEvent','Location','MediaList','MessageChannel','MessageEvent','MessagePort','MimeType','MimeTypeArray','MouseEvent','MutationObserver','MutationRecord','NamedNodeMap','Navigator','NetworkInformation','Node','NodeFilter','NodeIterator','NodeList','Notification','PageTransitionEvent','Path2D','Performance','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PerformanceTiming','Plugin','PluginArray','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','PromiseRejectionEvent','RTCPeerConnection','RadioNodeList','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGNumber','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Screen','Selection','ShadowRoot','SharedWorker','Storage','StorageEvent','SubmitEvent','SubtleCrypto','Text','TextDecoder','TextEncoder','Touch','TouchEvent','TouchList','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Window','Worker','WritableStream','XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'].forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

sandbox.innerWidth = 1920; sandbox.innerHeight = 1080;
sandbox.outerWidth = 1920; sandbox.outerHeight = 1080;
sandbox.devicePixelRatio = 1; sandbox.screenX = 0; sandbox.screenY = 0;
sandbox.name = ''; sandbox.length = 0; sandbox.frames = sandbox;
sandbox.postMessage = mf('postMessage');
sandbox.addEventListener = mf('addEventListener');
sandbox.removeEventListener = mf('removeEventListener');
sandbox.fetch = mf('fetch');
sandbox.getComputedStyle = function() { return {}; }; sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.matchMedia = function() { return { matches: false, media: '', addListener: mf('addListener') }; }; sn(sandbox.matchMedia, 'matchMedia');
sandbox.origin = 'https://www.zhipin.com';
sandbox.isSecureContext = true;
sandbox.requestAnimationFrame = mf('requestAnimationFrame');

var ctx = vm.createContext(sandbox);
try {
    new vm.Script(code).runInContext(ctx);
    if (typeof sandbox.ABC !== 'undefined') {
        var token = new sandbox.ABC().z('test_seed', 1782456800000);
        console.log('len:', token.length);

        // Show what was accessed
        var sorted = Object.entries(accessed).sort(function(a, b) { return b[1] - a[1]; });
        console.log('\nTop 40 accessed:');
        sorted.slice(0, 40).forEach(function(e) { console.log(e[0].padEnd(35), e[1]); });
    }
} catch(e) {
    console.log('ERR:', e.message, e.stack && e.stack.substring(0, 200));
}
