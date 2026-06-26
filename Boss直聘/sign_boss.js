/**
 * Boss直聘 __zp_stoken__ 离线签名 (v1.0)
 * 用法: node sign_boss.js <__a> <__c> <seed> <ts>
 */
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

// ===== Window =====
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = { log: mf('log'), error: mf('error'), warn: mf('warn'), info: mf('info') };

// ===== Navigator (Firefox 135 on Windows) =====
// Build realistic Plugin objects
var pluginsArr = [];
['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client'].forEach(function(name, i) {
    var p = {
        name: name, filename: 'internal-pdf-viewer', description: '',
        length: i === 0 ? 2 : 1
    };
    p.item = function(idx) { return null; }; sn(p.item, 'item');
    p.namedItem = function(nm) { return null; }; sn(p.namedItem, 'namedItem');
    pluginsArr.push(p);
});
var plugins = {
    length: pluginsArr.length, item: mf('item'), namedItem: mf('namedItem'), refresh: mf('refresh')
};
pluginsArr.forEach(function(p, i) { plugins[i] = p; });

var mimeTypes = { length: 2, item: mf('item'), namedItem: mf('namedItem') };
mimeTypes[0] = { type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: plugins[0] };

sandbox.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    appVersion: '5.0 (Windows)', platform: 'Win32', language: 'zh-CN',
    languages: ['zh-CN', 'zh'], cookieEnabled: true, webdriver: false,
    hardwareConcurrency: 8, maxTouchPoints: 0, vendor: '', vendorSub: '',
    productSub: '20100101', doNotTrack: '1', onLine: true,
    deviceMemory: 8, webkitTemporaryStorage: undefined,
    plugins: plugins, mimeTypes: mimeTypes,
};
sn(sandbox.navigator.plugins.item, 'item');
sn(sandbox.navigator.plugins.namedItem, 'namedItem');
sn(sandbox.navigator.plugins.refresh, 'refresh');

// ===== Screen =====
sandbox.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 };

// ===== Document with Canvas support =====
function makeCanvas() {
    var ctx = {
        fillText: mf('fillText'), fillRect: mf('fillRect'), clearRect: mf('clearRect'),
        strokeText: mf('strokeText'), strokeRect: mf('strokeRect'),
        beginPath: mf('beginPath'), closePath: mf('closePath'),
        moveTo: mf('moveTo'), lineTo: mf('lineTo'), arc: mf('arc'), bezierCurveTo: mf('bezierCurveTo'),
        fill: mf('fill'), stroke: mf('stroke'), clip: mf('clip'), save: mf('save'), restore: mf('restore'),
        scale: mf('scale'), rotate: mf('rotate'), translate: mf('translate'), transform: mf('transform'),
        setTransform: mf('setTransform'),
        measureText: function(t) { return { width: t.length * 10 }; },
        getImageData: function(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
        putImageData: mf('putImageData'),
        createLinearGradient: function() { return { addColorStop: mf('addColorStop') }; },
        createRadialGradient: function() { return { addColorStop: mf('addColorStop') }; },
        createPattern: mf('createPattern'),
        drawImage: mf('drawImage'),
        toDataURL: function() { return 'data:image/png;base64,test'; },
        canvas: null
    };
    return {
        style: {}, setAttribute: mf('setAttribute'),
        getContext: function(type) { return type === '2d' ? ctx : null; },
        toDataURL: function() { return 'data:image/png;base64,test'; },
        width: 300, height: 150,
        getBoundingClientRect: function() { return { x:0, y:0, width:300, height:150 }; }
    };
}
sn(makeCanvas().getContext, 'getContext');
sn(makeCanvas().toDataURL, 'toDataURL');

var docCreateEl = function(tag) {
    if (tag === 'iframe') {
        return { style: {}, setAttribute: mf('setAttribute'), getAttribute: function(){return null}, contentWindow: sandbox };
    }
    if (tag === 'canvas') { return makeCanvas(); }
    if (tag === 'script') {
        return { style: {}, setAttribute: mf('setAttribute'), getAttribute: function(){return null}, src: '', onload: null, onreadystatechange: null, parentNode: { removeChild: mf('removeChild') } };
    }
    return { style: {}, setAttribute: mf('setAttribute'), getAttribute: function(){return null} };
};
sn(docCreateEl, 'createElement');

sandbox.document = {
    createElement: docCreateEl,
    createElementNS: function(ns, tag) { return docCreateEl(tag); },
    body: { appendChild: mf('appendChild'), removeChild: mf('removeChild') },
    documentElement: { appendChild: mf('appendChild'), tagName: 'HTML' },
    head: { appendChild: mf('appendChild'), setAttribute: mf('setAttribute') },
    getElementsByTagName: function(tag) {
        if (tag === 'head') return { item: function(i) { return sandbox.document.head; }, length: 1 };
        return { item: function(){return null}, length: 0 };
    },
    hidden: false, readyState: 'complete', referrer: '', title: 'BOSS直聘',
    visibilityState: 'visible', characterSet: 'UTF-8', cookie: ''
};
sn(sandbox.document.createElementNS, 'createElementNS');

// Cookie getter (used by VMP)
Object.defineProperty(sandbox.document, 'cookie', {
    get: function() { return '__a=' + (process.argv[2] || '0') + '; __c=' + (process.argv[3] || '0') + '; __g=-'; },
    set: function(v) {},
    enumerable: true, configurable: true
});

// ===== Location =====
sandbox.location = {
    href: 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',
    hostname: 'www.zhipin.com', host: 'www.zhipin.com', pathname: '/web/geek/jobs',
    protocol: 'https:', origin: 'https://www.zhipin.com', port: '', search: '?city=101010100&query=python', hash: ''
};

// ===== History / Storage / Performance =====
sandbox.history = { length: 1, pushState: mf('pushState'), replaceState: mf('replaceState'), back: mf('back'), forward: mf('forward'), go: mf('go') };
sandbox.localStorage = { getItem: mf('getItem'), setItem: mf('setItem'), removeItem: mf('removeItem'), clear: mf('clear'), length: 0, key: mf('key') };
sandbox.sessionStorage = { getItem: mf('getItem'), setItem: mf('setItem'), removeItem: mf('removeItem'), clear: mf('clear'), length: 0, key: mf('key') };
sandbox.performance = {
    now: function() { return Date.now(); },
    timing: { navigationStart: Date.now(), fetchStart: Date.now(), domainLookupStart: Date.now(), domainLookupEnd: Date.now(), connectStart: Date.now(), connectEnd: Date.now(), requestStart: Date.now(), responseStart: Date.now(), responseEnd: Date.now(), domLoading: Date.now(), domInteractive: Date.now(), domContentLoadedEventStart: Date.now(), domContentLoadedEventEnd: Date.now(), domComplete: Date.now() }
};
sn(sandbox.performance.now, 'now');
sandbox.crypto = {
    getRandomValues: function(arr) { var b = require('crypto').randomBytes(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; },
    subtle: null
};
sn(sandbox.crypto.getRandomValues, 'getRandomValues');

sandbox.btoa = function(s) { return Buffer.from(s).toString('base64'); }; sn(sandbox.btoa, 'btoa');
sandbox.atob = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(sandbox.atob, 'atob');

// ===== 200+ Browser constructors =====
['Audio','Blob','BroadcastChannel','CDATASection','CSSAnimation','CSSConditionRule','CSSCounterStyleRule','CSSFontFaceRule','CSSGroupingRule','CSSImportRule','CSSKeyframeRule','CSSKeyframesRule','CSSMediaRule','CSSNamespaceRule','CSSPageRule','CSSRule','CSSRuleList','CSSScopeRule','CSSStyleDeclaration','CSSStyleRule','CSSStyleSheet','CanvasGradient','CanvasPattern','CanvasRenderingContext2D','CharacterData','CloseEvent','Comment','CompositionEvent','Crypto','CustomElementRegistry','CustomEvent','DOMException','DOMImplementation','DOMMatrix','DOMParser','DOMPoint','DOMQuad','DOMRect','DOMRectList','DOMRectReadOnly','DOMStringList','DOMStringMap','DOMTokenList','DataTransfer','DataView','DeviceMotionEvent','DeviceOrientationEvent','Document','DocumentFragment','DocumentType','DragEvent','Element','ElementInternals','ErrorEvent','Event','EventSource','EventTarget','External','File','FileList','FileReader','FocusEvent','FontFace','FormData','HashChangeEvent','Headers','History','HTMLAllCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLBodyElement','HTMLButtonElement','HTMLCanvasElement','HTMLCollection','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormElement','HTMLFrameElement','HTMLHRElement','HTMLHeadElement','HTMLHeadingElement','HTMLHtmlElement','HTMLIFrameElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLScriptElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','Image','ImageData','InputEvent','IntersectionObserver','KeyboardEvent','Location','MediaList','MessageChannel','MessageEvent','MessagePort','MimeType','MimeTypeArray','MouseEvent','MutationObserver','MutationRecord','NamedNodeMap','Navigator','NetworkInformation','Node','NodeFilter','NodeIterator','NodeList','Notification','PageTransitionEvent','Path2D','Performance','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PerformanceTiming','Plugin','PluginArray','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','PromiseRejectionEvent','RTCPeerConnection','RadioNodeList','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGNumber','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Screen','Selection','ShadowRoot','SharedWorker','Storage','StorageEvent','SubmitEvent','SubtleCrypto','Text','TextDecoder','TextEncoder','Touch','TouchEvent','TouchList','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Window','Worker','WritableStream','XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'].forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

// ===== Window extras =====
sandbox.innerWidth = 1920; sandbox.innerHeight = 1080; sandbox.outerWidth = 1920; sandbox.outerHeight = 1080;
sandbox.devicePixelRatio = 1; sandbox.screenX = 0; sandbox.screenY = 0;
sandbox.name = ''; sandbox.closed = false; sandbox.length = 0; sandbox.frames = sandbox;
sandbox.opener = null;
sandbox.postMessage = mf('postMessage');
sandbox.addEventListener = mf('addEventListener');
sandbox.removeEventListener = mf('removeEventListener');
sandbox.dispatchEvent = mf('dispatchEvent');
sandbox.fetch = mf('fetch');
sandbox.getComputedStyle = function() { return {}; }; sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.matchMedia = function() { return { matches: false, media: '', addListener: mf('addListener'), addEventListener: mf('addEventListener'), removeEventListener: mf('removeEventListener') }; };
sn(sandbox.matchMedia, 'matchMedia');
sandbox.origin = 'https://www.zhipin.com';
sandbox.isSecureContext = true;
sandbox.requestAnimationFrame = mf('requestAnimationFrame');
sandbox.cancelAnimationFrame = mf('cancelAnimationFrame');
sandbox.getSelection = function() { return null; }; sn(sandbox.getSelection, 'getSelection');
sandbox.XMLHttpRequest = function() { this.open = mf('open'); this.send = mf('send'); this.setRequestHeader = mf('setRequestHeader'); this.readyState = 4; this.status = 200; this.responseText = ''; }; sn(sandbox.XMLHttpRequest, 'XMLHttpRequest');

// ===== Run =====
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
