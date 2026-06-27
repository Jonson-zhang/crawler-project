/**
 * Find VMP Environment Detection Points
 *
 * Strategy: Binary search over global objects to identify
 * which ones trigger different VMP code paths.
 */
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

var _dateCount = 0, _dateBase = 1782478485106;
function FakeDate() {
    if (arguments.length > 0) {
        var args = [null].concat(Array.prototype.slice.call(arguments));
        return new (Function.prototype.bind.apply(Date, args))();
    }
    return new Date(_dateBase);
}
FakeDate.now = function() { _dateCount++; return _dateBase + Math.floor(_dateCount / 30); };
FakeDate.parse = Date.parse; FakeDate.UTC = Date.UTC; FakeDate.prototype = Date.prototype;

var _mathSeed = 42;
var FixedMath = Object.create(Math);
FixedMath.random = function() { _mathSeed = (_mathSeed * 16807 + 0) % 2147483647; return (_mathSeed - 1) / 2147483646; };
var _perfCounter = 0;

// Build a full-featured sandbox with ALL browser objects included
function makeFullEnv() {
    var s = {
        Object, Array, Function, String, Number, Boolean, Date: FakeDate, Math: FixedMath,
        RegExp, Error, TypeError, SyntaxError, ReferenceError, RangeError,
        parseInt, parseFloat, isNaN, isFinite,
        encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
        JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
        ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
        Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
        BigInt, NaN, Infinity, undefined, Proxy, Reflect,
        setTimeout, setInterval, clearTimeout, clearInterval,
        crypto: { getRandomValues: function(a) { for (var i = 0; i < a.length; i++) a[i] = i % 256; return a; } },
        btoa: function(s) { return Buffer.from(s).toString('base64'); },
        atob: function(s) { return Buffer.from(s, 'base64').toString(); },
        console: { log: function(){}, error: function(){}, warn: function(){}, info: function(){} },
    };
    s.window = s; s.self = s; s.top = s; s.parent = s; s.globalThis = s;
    s.process = undefined; s.module = undefined; s.require = undefined;
    s._phantom = undefined; s.callphantom = undefined;
    s.Buffer = undefined;
    return s;
}

// Define ALL browser objects that might be checked
var BROWSER_GLOBALS = {
    navigator: { userAgent: 'x', webdriver: false, hardwareConcurrency: 8, language: 'en-US', languages: ['en-US', 'en'], platform: 'Win32' },
    document: { cookie: '', createElement: function() { return { style: {} }; }, body: {}, documentElement: {}, getElementsByTagName: function() { return []; } },
    location: { href: 'https://www.zhipin.com', hostname: 'www.zhipin.com', protocol: 'https:' },
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
    history: { length: 1, pushState: function(){}, replaceState: function(){} },
    localStorage: { getItem: function() { return null; }, setItem: function(){}, removeItem: function(){}, clear: function(){}, length: 0 },
    sessionStorage: { getItem: function() { return null; }, setItem: function(){}, removeItem: function(){}, clear: function(){}, length: 0 },
    performance: { now: function() { return _perfCounter++; }, memory: {} },
    XMLHttpRequest: function(){},
    Image: function(){},
    MutationObserver: function(){ this.observe = function(){}; this.disconnect = function(){}; },
    Event: function(){},
    CustomEvent: function(){},
    EventTarget: function(){},
    addEventListener: function(){},
    removeEventListener: function(){},
    dispatchEvent: function(){},
    fetch: function(){},
    Worker: function(){},
    WebSocket: function(){},
    Blob: function(){},
    File: function(){},
    FileReader: function(){},
    FileList: function(){},
    FormData: function(){},
    TextDecoder: function(){ return { decode: function() { return ''; } }; },
    TextEncoder: function(){ return { encode: function() { return []; } }; },
    URL: function(){},
    URLSearchParams: function(){},
    DOMParser: function(){ return { parseFromString: function() { return {}; } }; },
    Headers: function(){},
    Request: function(){},
    Response: function(){},
    Notification: function(){},
    TouchEvent: function(){},
    DeviceMotionEvent: function(){},
    WebGLRenderingContext: function(){},
    CanvasRenderingContext2D: function(){},
    PluginArray: function(){},
    MimeTypeArray: function(){},
    Plugin: function(){},
    MimeType: function(){},
    SharedWorker: function(){},
    MessageChannel: function(){},
    MessagePort: function(){},
    MessageEvent: function(){},
    CloseEvent: function(){},
    StorageEvent: function(){},
    ProgressEvent: function(){},
    ErrorEvent: function(){},
    HashChangeEvent: function(){},
    PopStateEvent: function(){},
    PromiseRejectionEvent: function(){},
    TransitionEvent: function(){},
    AnimationEvent: function(){},
    KeyboardEvent: function(){},
    MouseEvent: function(){},
    WheelEvent: function(){},
    PointerEvent: function(){},
    CompositionEvent: function(){},
    DragEvent: function(){},
    FocusEvent: function(){},
    InputEvent: function(){},
    IntersectionObserver: function(){},
    ResizeObserver: function(){},
    MutationRecord: function(){},
    NodeList: function(){},
    HTMLCollection: function(){},
    Node: function(){},
    Element: function(){},
    HTMLElement: function(){},
    HTMLHtmlElement: function(){},
    HTMLHeadElement: function(){},
    HTMLBodyElement: function(){},
    HTMLDivElement: function(){},
    HTMLSpanElement: function(){},
    HTMLAnchorElement: function(){},
    HTMLImageElement: function(){},
    HTMLInputElement: function(){},
    HTMLButtonElement: function(){},
    HTMLFormElement: function(){},
    HTMLScriptElement: function(){},
    HTMLStyleElement: function(){},
    HTMLLinkElement: function(){},
    HTMLMetaElement: function(){},
    HTMLTitleElement: function(){},
    HTMLCanvasElement: function(){},
    HTMLVideoElement: function(){},
    HTMLAudioElement: function(){},
    HTMLIFrameElement: function(){},
    HTMLTextAreaElement: function(){},
    HTMLSelectElement: function(){},
    HTMLOptionElement: function(){},
    HTMLTableElement: function(){},
    HTMLTableRowElement: function(){},
    HTMLTableCellElement: function(){},
    HTMLTableSectionElement: function(){},
    HTMLUListElement: function(){},
    HTMLOListElement: function(){},
    HTMLLIElement: function(){},
    HTMLParagraphElement: function(){},
    HTMLHeadingElement: function(){},
    HTMLBRElement: function(){},
    HTMLHRElement: function(){},
    HTMLPreElement: function(){},
    HTMLQuoteElement: function(){},
    HTMLDListElement: function(){},
    HTMLDataElement: function(){},
    HTMLDataListElement: function(){},
    HTMLDetailsElement: function(){},
    HTMLDialogElement: function(){},
    HTMLDirectoryElement: function(){},
    HTMLEmbedElement: function(){},
    HTMLFieldSetElement: function(){},
    HTMLFontElement: function(){},
    HTMLFrameElement: function(){},
    HTMLFrameSetElement: function(){},
    HTMLHtmlElement: function(){},
    HTMLLabelElement: function(){},
    HTMLLegendElement: function(){},
    HTMLMapElement: function(){},
    HTMLMarqueeElement: function(){},
    HTMLMediaElement: function(){},
    HTMLMenuElement: function(){},
    HTMLMeterElement: function(){},
    HTMLModElement: function(){},
    HTMLObjectElement: function(){},
    HTMLOptGroupElement: function(){},
    HTMLOutputElement: function(){},
    HTMLParamElement: function(){},
    HTMLPictureElement: function(){},
    HTMLProgressElement: function(){},
    HTMLSlotElement: function(){},
    HTMLSourceElement: function(){},
    HTMLTableCaptionElement: function(){},
    HTMLTableColElement: function(){},
    HTMLTemplateElement: function(){},
    HTMLTimeElement: function(){},
    HTMLTrackElement: function(){},
    HTMLUnknownElement: function(){},
    Selection: function(){},
    Range: function(){},
    TreeWalker: function(){},
    NodeIterator: function(){},
    NodeFilter: function(){},
    ShadowRoot: function(){},
    DocumentFragment: function(){},
    Comment: function(){},
    Text: function(){},
    CDATASection: function(){},
    ProcessingInstruction: function(){},
    SVGElement: function(){},
    SVGSVGElement: function(){},
    SVGPathElement: function(){},
    SVGCircleElement: function(){},
    SVGRectElement: function(){},
    SVGLineElement: function(){},
    SVGEllipseElement: function(){},
    SVGPolygonElement: function(){},
    SVGPolylineElement: function(){},
    SVGTextElement: function(){},
    SVGTSpanElement: function(){},
    SVGUseElement: function(){},
    SVGGElement: function(){},
    SVGDefsElement: function(){},
    SVGLinearGradientElement: function(){},
    SVGRadialGradientElement: function(){},
    SVGStopElement: function(){},
    SVGFilterElement: function(){},
    SVGImageElement: function(){},
    SVGScriptElement: function(){},
    SVGStyleElement: function(){},
    SVGTitleElement: function(){},
    SVGDescElement: function(){},
    SVGMetadataElement: function(){},
    SVGSwitchElement: function(){},
    SVGSymbolElement: function(){},
    CSSStyleDeclaration: function(){},
    CSSRule: function(){},
    CSSRuleList: function(){},
    CSSStyleSheet: function(){},
    MediaList: function(){},
    StyleSheet: function(){},
    DOMRect: function(){},
    DOMRectList: function(){},
    DOMException: function(){},
    DOMImplementation: function(){},
    DOMTokenList: function(){},
    NamedNodeMap: function(){},
    Attr: function(){},
    DataTransfer: function(){},
    ValidityState: function(){},
    XPathEvaluator: function(){},
    XPathResult: function(){},
    XSLTProcessor: function(){},
    XMLSerializer: function(){},
    XMLDocument: function(){},
    XMLHttpRequestUpload: function(){},
    XMLHttpRequestEventTarget: function(){},
    Path2D: function(){},
    ImageData: function(){},
    TextMetrics: function(){},
    CanvasGradient: function(){},
    CanvasPattern: function(){},
    SubtleCrypto: function(){},
    Crypto: function(){},
    RTCPeerConnection: function(){},
    WritableStream: function(){},
    ReadableStream: function(){},
    ByteLengthQueuingStrategy: function(){},
    CountQueuingStrategy: function(){},
    VisualViewport: function(){},
    ScreenOrientation: function(){},
    OffscreenCanvas: function(){},
    AudioContext: function(){},
    OfflineAudioContext: function(){},
    CSS: {},
    matchMedia: function() { return { matches: false, media: '' }; },
    getComputedStyle: function() { return {}; },
    getSelection: function() { return null; },
    innerWidth: 1920, innerHeight: 1080, outerWidth: 1920, outerHeight: 1080,
    devicePixelRatio: 1, screenX: 0, screenY: 0, scrollX: 0, scrollY: 0,
    name: '', closed: false, length: 0, opener: null, origin: 'https://www.zhipin.com',
    isSecureContext: true, pageXOffset: 0, pageYOffset: 0,
    postMessage: function(){},
    requestAnimationFrame: function(){},
    cancelAnimationFrame: function(){},
    print: function(){}, open: function(){}, close: function(){},
    focus: function(){}, blur: function(){}, stop: function(){},
    scroll: function(){}, scrollTo: function(){}, scrollBy: function(){},
    alert: function(){}, confirm: function(){}, prompt: function(){},
    captureEvents: function(){}, releaseEvents: function(){},
    // Firefox-specific
    InstallTrigger: null,
    // Chrome-specific
    chrome: undefined,
};

function runWithEnv(envDesc, testName) {
    _dateCount = 0; _mathSeed = 42; _perfCounter = 0;
    var s = makeFullEnv();
    for (var k in envDesc) { s[k] = envDesc[k]; }
    var ctx = vm.createContext(s);
    new vm.Script(code).runInContext(ctx);
    if (typeof s.ABC === 'undefined') return { len: -1, error: 'ABC undefined' };
    var t = new s.ABC().z('VsbTBCOID71h+OzSxBLPKa6ThkqrBFYaqfGa+QWt9qQ=', 1782478485106);
    return { len: t.length, prefix: t.substring(0, 30) };
}

// Baseline: ALL browser globals
var result = runWithEnv(BROWSER_GLOBALS, 'FULL');
console.log('FULL env: len=' + result.len + ' prefix=' + result.prefix);

// Now test: what happens when we remove specific groups?
// Test removing ALL browser globals except navigator+document+location+screen
var minimal = {
    navigator: BROWSER_GLOBALS.navigator,
    document: BROWSER_GLOBALS.document,
    location: BROWSER_GLOBALS.location,
    screen: BROWSER_GLOBALS.screen,
    history: BROWSER_GLOBALS.history,
    localStorage: BROWSER_GLOBALS.localStorage,
    sessionStorage: BROWSER_GLOBALS.sessionStorage,
    performance: BROWSER_GLOBALS.performance,
};
result = runWithEnv(minimal, 'MINIMAL');
console.log('MINIMAL env: len=' + result.len + ' prefix=' + result.prefix);

// Test: MINIMAL + constructor functions (XMLHttpRequest, Image, etc.)
var withConstructors = Object.assign({}, minimal);
['XMLHttpRequest','Image','MutationObserver','Event','EventTarget',
 'Blob','File','FileReader','Worker','WebSocket','CustomEvent',
 'addEventListener','removeEventListener','fetch'].forEach(function(k) {
    withConstructors[k] = BROWSER_GLOBALS[k];
});
result = runWithEnv(withConstructors, '+CONSTRUCTORS');
console.log('+CONSTRUCTORS: len=' + result.len + ' prefix=' + result.prefix);

// Test: just add navigator.userAgent as Mozilla Firefox accurately
var ffExact = Object.assign({}, BROWSER_GLOBALS);
ffExact.navigator = BROWSER_GLOBALS.navigator;
// Make navigator properties getters on prototype
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }

function buildProtoNav() {
    function NavProto(){} sn(NavProto,'Navigator');
    var NP = NavProto.prototype;
    function dg(name, value) {
        Object.defineProperty(NP, name, { get: function() { return value; }, enumerable: true, configurable: true });
    }
    dg('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0');
    dg('appVersion', '5.0 (Windows)'); dg('platform', 'Win32');
    dg('appCodeName', 'Mozilla'); dg('appName', 'Netscape'); dg('product', 'Gecko');
    dg('oscpu', 'Windows NT 10.0; Win64; x64'); dg('buildID', '20181001000000');
    dg('language', 'en-US'); dg('languages', ['en-US', 'en']);
    dg('cookieEnabled', true); dg('webdriver', false);
    dg('hardwareConcurrency', 8); dg('maxTouchPoints', 0);
    dg('vendor', ''); dg('vendorSub', ''); dg('productSub', '20100101');
    dg('doNotTrack', '1'); dg('onLine', true);
    dg('pdfViewerEnabled', true); dg('globalPrivacyControl', false);
    return new NavProto();
}

result = runWithEnv(BROWSER_GLOBALS, 'FULL-v2');
console.log('FULL-v2: len=' + result.len + ' prefix=' + result.prefix);

console.log('\n--- Testing individual objects ---');
// Test which objects change token length when added to minimal env
var objectsToTest = [
    'XMLHttpRequest', 'Image', 'MutationObserver', 'Event', 'CustomEvent',
    'EventTarget', 'Blob', 'File', 'FileReader', 'Worker', 'WebSocket',
    'CSSRuleList', 'PluginArray', 'MimeTypeArray',
    'SharedWorker', 'MessageChannel', 'MessagePort', 'Notification',
    'addEventListener', 'removeEventListener', 'dispatchEvent', 'fetch',
    'requestAnimationFrame', 'postMessage', 'matchMedia', 'getComputedStyle',
    'innerWidth', 'outerWidth', 'devicePixelRatio',
    'HTMLAnchorElement', 'HTMLDivElement', 'HTMLCanvasElement', 'HTMLImageElement',
    'HTMLElement', 'Node', 'Element', 'DocumentFragment', 'ShadowRoot',
    'CSSStyleDeclaration', 'CSSRule', 'CSSStyleSheet'
];

var baselineResult = runWithEnv(minimal, 'baseline-check');
var baselineLen = baselineResult.len;

objectsToTest.forEach(function(name) {
    var testEnv = Object.assign({}, minimal);
    testEnv[name] = BROWSER_GLOBALS[name];

    _dateCount = 0; _mathSeed = 42; _perfCounter = 0;
    var s = makeFullEnv();
    for (var k in testEnv) { s[k] = testEnv[k]; }
    var ctx = vm.createContext(s);
    new vm.Script(code).runInContext(ctx);
    if (typeof s.ABC === 'undefined') { console.log('  ' + name + ': ABC undefined'); return; }
    var t = new s.ABC().z('VsbTBCOID71h+OzSxBLPKa6ThkqrBFYaqfGa+QWt9qQ=', 1782478485106);
    if (t.length !== baselineLen) {
        console.log('  ' + name + ': len=' + t.length + ' (DIFF ' + (t.length - baselineLen) + ')');
    } else {
        // Only log if changed
    }
});
console.log('Baseline length:', baselineLen);
