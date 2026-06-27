/**
 * Boss直聘 __zp_stoken__ 离线签名 (v3 - 直接 V8 执行，不用 vm 沙箱)
 * 用法: node sign_boss_direct.js <__a> <__c> <seed> <ts>
 *
 * 核心思路：不是在 vm 沙箱里模拟浏览器，而是直接把浏览器全局
 * 设置在 Node.js V8 引擎的 global 对象上。用 Function() 构造器
 * 创建一个闭包，在闭包内 eval 安全 JS——这样安全 JS 访问的
 * window/navigator/document 就是我们设置的版本。
 */
var fs = require('fs');
var crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// 这个函数会在一个干净的闭包里执行安全 JS
// 闭包内 global 已被替换为我们的浏览器对象
function executeSecurityJS(__a, __c, seed, ts) {
    // ──── 这段代码会作为 Function body 在独立的作用域里执行 ────

    // ========== Native toString ==========
    var mm = new Map();
    var rt = Function.prototype.toString;
    Function.prototype.toString = function() {
        return typeof this === 'function' && mm.get(this) || rt.call(this);
    };
    function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
    function mf(n) { var f = function() {}; sn(f, n); return f; }
    function mc(n) {
        var f = function() {};
        sn(f, n);
        return f;
    }

    var ST = Symbol.toStringTag;

    // ========== 浏览器构造函数（完整的原型链） ==========
    function EvtTgt() {}
    sn(EvtTgt, 'EventTarget');

    function Navigator() {}
    Navigator.prototype = Object.create(EvtTgt.prototype);
    Navigator.prototype.constructor = Navigator;
    Navigator.prototype[ST] = 'Navigator';
    sn(Navigator, 'Navigator');

    function Document() {}
    Document.prototype = Object.create(EvtTgt.prototype);
    Document.prototype.constructor = Document;
    Document.prototype[ST] = 'HTMLDocument';
    sn(Document, 'Document');

    function HTMLEl() {}
    HTMLEl.prototype = Object.create(EvtTgt.prototype);
    HTMLEl.prototype.constructor = HTMLEl;
    HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.offsetHeight = 720;
    HTMLEl.prototype.clientWidth = 1280; HTMLEl.prototype.clientHeight = 720;
    HTMLEl.prototype.style = {};
    HTMLEl.prototype.appendChild = mf('appendChild');
    HTMLEl.prototype.setAttribute = mf('setAttribute');
    HTMLEl.prototype.getAttribute = function() { return null; };
    sn(HTMLEl.prototype.getAttribute, 'getAttribute');
    HTMLEl.prototype.getBoundingClientRect = function() {
        return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
    };
    sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect');
    HTMLEl.prototype[ST] = 'HTMLElement';
    sn(HTMLEl, 'HTMLElement');

    function HTMLHtmlEl() {}
    HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype);
    HTMLHtmlEl.prototype.constructor = HTMLHtmlEl;
    HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement';
    sn(HTMLHtmlEl, 'HTMLHtmlElement');

    function HTMLBodyEl() {}
    HTMLBodyEl.prototype = Object.create(HTMLEl.prototype);
    HTMLBodyEl.prototype.constructor = HTMLBodyEl;
    HTMLBodyEl.prototype[ST] = 'HTMLBodyElement';
    sn(HTMLBodyEl, 'HTMLBodyElement');

    function HTMLHeadEl() {}
    HTMLHeadEl.prototype = Object.create(HTMLEl.prototype);
    HTMLHeadEl.prototype.constructor = HTMLHeadEl;
    HTMLHeadEl.prototype[ST] = 'HTMLHeadElement';
    sn(HTMLHeadEl, 'HTMLHeadElement');

    function HTMLCanvasEl() {}
    HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype);
    HTMLCanvasEl.prototype.constructor = HTMLCanvasEl;
    HTMLCanvasEl.prototype.width = 300; HTMLCanvasEl.prototype.height = 150;
    HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement';
    sn(HTMLCanvasEl, 'HTMLCanvasElement');

    function HTMLIFrameEl() {}
    HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype);
    HTMLIFrameEl.prototype.constructor = HTMLIFrameEl;
    HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement';
    sn(HTMLIFrameEl, 'HTMLIFrameElement');

    function HTMLScriptEl() {}
    HTMLScriptEl.prototype = Object.create(HTMLEl.prototype);
    HTMLScriptEl.prototype.constructor = HTMLScriptEl;
    HTMLScriptEl.prototype[ST] = 'HTMLScriptElement';
    sn(HTMLScriptEl, 'HTMLScriptElement');

    function Location() {}
    Location.prototype[ST] = 'Location';
    sn(Location, 'Location');

    function Screen() {}
    Screen.prototype[ST] = 'Screen';
    sn(Screen, 'Screen');

    function History() {}
    History.prototype[ST] = 'History';
    sn(History, 'History');

    function Storage_() {}
    Storage_.prototype[ST] = 'Storage';
    sn(Storage_, 'Storage');

    function Performance_() {}
    Performance_.prototype[ST] = 'Performance';
    sn(Performance_, 'Performance');

    function PluginArray_() {}
    PluginArray_.prototype[ST] = 'PluginArray';
    sn(PluginArray_, 'PluginArray');

    function MimeTypeArray_() {}
    MimeTypeArray_.prototype[ST] = 'MimeTypeArray';
    sn(MimeTypeArray_, 'MimeTypeArray');

    function Plugin_() {}
    Plugin_.prototype.item = mf('item');
    Plugin_.prototype.namedItem = mf('namedItem');
    Plugin_.prototype[ST] = 'Plugin';
    sn(Plugin_, 'Plugin');

    function MimeType_() {}
    MimeType_.prototype[ST] = 'MimeType';
    sn(MimeType_, 'MimeType');

    // ========== Navigator ==========
    var nav = new Navigator();
    nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
    nav.appVersion = '5.0 (Windows)';
    nav.platform = 'Win32';
    nav.language = 'zh-CN';
    nav.languages = ['zh-CN', 'zh'];
    nav.cookieEnabled = true;
    nav.webdriver = false;
    nav.hardwareConcurrency = 8;
    nav.maxTouchPoints = 0;
    nav.vendor = '';
    nav.vendorSub = '';
    nav.productSub = '20100101';
    nav.doNotTrack = '1';
    nav.onLine = true;
    nav.deviceMemory = undefined;
    nav.webkitTemporaryStorage = undefined;

    var pls = new PluginArray_();
    pls.length = 5;
    pls.refresh = mf('refresh');
    pls.item = mf('item');
    pls.namedItem = mf('namedItem');
    var plgnames = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'];
    for (var i = 0; i < 5; i++) {
        var p = new Plugin_();
        p.name = plgnames[i];
        p.filename = 'internal-pdf-viewer';
        p.description = 'Portable Document Format';
        p.length = 2;
        var mt0 = new MimeType_(); mt0.type = 'application/pdf'; mt0.suffixes = 'pdf'; mt0.description = 'Portable Document Format'; mt0.enabledPlugin = p;
        var mt1 = new MimeType_(); mt1.type = 'text/pdf'; mt1.suffixes = 'pdf'; mt1.description = 'Portable Document Format'; mt1.enabledPlugin = p;
        p[0] = mt0; p[1] = mt1;
        pls[i] = p;
    }
    nav.plugins = pls;

    var mts = new MimeTypeArray_();
    mts.length = 2; mts.item = mf('item'); mts.namedItem = mf('namedItem');
    var mmt0 = new MimeType_(); mmt0.type = 'application/pdf'; mmt0.suffixes = 'pdf'; mmt0.description = 'Portable Document Format'; mmt0.enabledPlugin = pls[0];
    var mmt1 = new MimeType_(); mmt1.type = 'text/pdf'; mmt1.suffixes = 'pdf'; mmt1.description = 'Portable Document Format'; mmt1.enabledPlugin = pls[0];
    mts[0] = mmt0; mts[1] = mmt1;
    nav.mimeTypes = mts;

    // ========== Document ==========
    var doc = new Document();
    doc.createElement = function(tag) {
        if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.style = {}; f.src = ''; f.setAttribute = mf('setAttribute'); f.getAttribute = function() { return null; }; f.contentWindow = null; return f; }
        if (tag === 'canvas') return new HTMLCanvasEl();
        if (tag === 'script') { var s = new HTMLScriptEl(); s.src = ''; s.type = 'text/javascript'; s.setAttribute = mf('setAttribute'); return s; }
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
    doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';
    doc.visibilityState = 'visible'; doc.title = 'BOSS直聘'; doc.referrer = '';
    doc.all = undefined;
    Object.defineProperty(doc, 'cookie', {
        get: function() { return '__a=' + __a + ';__c=' + __c + ';__g=-'; },
        set: function(v) {},
        configurable: true, enumerable: true
    });

    // ========== Location / Screen / History ==========
    var loc = new Location();
    loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
    loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs';
    loc.protocol = 'https:'; loc.origin = 'https://www.zhipin.com'; loc.port = '';
    loc.search = '?city=101010100&query=python'; loc.hash = '';

    var scr = new Screen();
    scr.width = 2560; scr.height = 1440; scr.availWidth = 2560; scr.availHeight = 1440;
    scr.colorDepth = 24; scr.pixelDepth = 24;

    var hist = new History();
    hist.length = 1; hist.pushState = mf('pushState'); hist.replaceState = mf('replaceState');
    hist.back = mf('back'); hist.forward = mf('forward'); hist.go = mf('go');

    function makeStorage() {
        var s = new Storage_();
        s.getItem = mf('getItem'); s.setItem = mf('setItem'); s.removeItem = mf('removeItem');
        s.clear = mf('clear'); s.key = mf('key'); s.length = 0;
        return s;
    }

    var perf = new Performance_();
    perf.now = function() { return Date.now(); }; sn(perf.now, 'now');
    perf.memory = {};

    // ========== This = Window ==========
    var win = this;
    win.window = win; win.self = win; win.top = win; win.parent = win; win.globalThis = win;
    win.navigator = nav; win.document = doc; win.location = loc;
    win.screen = scr; win.history = hist;
    win.localStorage = makeStorage(); win.sessionStorage = makeStorage();
    win.performance = perf;
    win.console = { log: function() {}, error: function() {}, warn: function() {}, info: function() {} };

    // Crypto
    win.crypto = {
        getRandomValues: function(arr) {
            var b = crypto_random_bytes(arr.length);
            for (var i = 0; i < arr.length; i++) arr[i] = b[i];
            return arr;
        },
        subtle: null
    };
    sn(win.crypto.getRandomValues, 'getRandomValues');

    win.btoa = function(s) { return btoa_impl(s); }; sn(win.btoa, 'btoa');
    win.atob = function(s) { return atob_impl(s); }; sn(win.atob, 'atob');

    // Window properties
    win.innerWidth = 2560; win.innerHeight = 1440; win.outerWidth = 2560; win.outerHeight = 1440;
    win.devicePixelRatio = 1; win.screenX = 0; win.screenY = 0; win.scrollX = 0; win.scrollY = 0;
    win.name = ''; win.closed = false; win.length = 0; win.opener = null;
    win.origin = 'https://www.zhipin.com'; win.isSecureContext = true;
    win.postMessage = mf('postMessage'); win.addEventListener = mf('addEventListener');
    win.removeEventListener = mf('removeEventListener'); win.dispatchEvent = mf('dispatchEvent');
    win.fetch = mf('fetch'); win.requestAnimationFrame = mf('requestAnimationFrame');
    win.matchMedia = function() { return { matches: false, media: '' }; }; sn(win.matchMedia, 'matchMedia');
    win.getComputedStyle = function() { return {}; }; sn(win.getComputedStyle, 'getComputedStyle');
    win.getSelection = function() { return null; }; sn(win.getSelection, 'getSelection');
    win.print = mf('print'); win.open = mf('open'); win.close = mf('close');
    win.focus = mf('focus'); win.blur = mf('blur'); win.stop = mf('stop');
    win.scroll = mf('scroll'); win.scrollTo = mf('scrollTo'); win.scrollBy = mf('scrollBy');
    win.alert = mf('alert'); win.confirm = mf('confirm'); win.prompt = mf('prompt');

    win.XMLHttpRequest = mc('XMLHttpRequest');
    win.MutationObserver = mc('MutationObserver');
    win.Image = mc('Image');
    win.Event = mc('Event');
    win.CSSRuleList = mc('CSSRuleList');

    // Anti-automation
    win._phantom = undefined;
    win.callphantom = undefined;
    win.__phantomas = undefined;

    // Browser-specific constructors
    var extraCls = ['Blob', 'CDATASection', 'CSSRule', 'CSSStyleDeclaration', 'CSSStyleSheet',
        'CanvasRenderingContext2D', 'CloseEvent', 'Comment', 'CompositionEvent', 'CustomEvent',
        'DOMException', 'DOMImplementation', 'DOMParser', 'DOMRect', 'DataTransfer', 'DeviceMotionEvent',
        'DocumentFragment', 'DragEvent', 'Element', 'ErrorEvent', 'EventSource', 'File', 'FileList',
        'FileReader', 'FocusEvent', 'FormData', 'HashChangeEvent', 'Headers', 'HTMLAllCollection',
        'HTMLAnchorElement', 'HTMLAreaElement', 'HTMLAudioElement', 'HTMLBRElement', 'HTMLBaseElement',
        'HTMLButtonElement', 'HTMLCollection', 'HTMLDListElement', 'HTMLDataElement', 'HTMLDataListElement',
        'HTMLDetailsElement', 'HTMLDialogElement', 'HTMLDirectoryElement', 'HTMLDivElement',
        'HTMLEmbedElement', 'HTMLFieldSetElement', 'HTMLFontElement', 'HTMLFormControlsCollection',
        'HTMLFormElement', 'HTMLFrameElement', 'HTMLFrameSetElement', 'HTMLHRElement', 'HTMLHeadingElement',
        'HTMLImageElement', 'HTMLInputElement', 'HTMLLIElement', 'HTMLLabelElement', 'HTMLLegendElement',
        'HTMLLinkElement', 'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement', 'HTMLMenuElement',
        'HTMLMetaElement', 'HTMLMeterElement', 'HTMLModElement', 'HTMLOListElement', 'HTMLObjectElement',
        'HTMLOptGroupElement', 'HTMLOptionElement', 'HTMLOptionsCollection', 'HTMLOutputElement',
        'HTMLParagraphElement', 'HTMLParamElement', 'HTMLPictureElement', 'HTMLPreElement',
        'HTMLProgressElement', 'HTMLQuoteElement', 'HTMLSelectElement', 'HTMLSlotElement',
        'HTMLSourceElement', 'HTMLSpanElement', 'HTMLStyleElement', 'HTMLTableCaptionElement',
        'HTMLTableCellElement', 'HTMLTableColElement', 'HTMLTableElement', 'HTMLTableRowElement',
        'HTMLTableSectionElement', 'HTMLTemplateElement', 'HTMLTextAreaElement', 'HTMLTimeElement',
        'HTMLTitleElement', 'HTMLTrackElement', 'HTMLUListElement', 'HTMLUnknownElement', 'HTMLVideoElement',
        'InputEvent', 'IntersectionObserver', 'KeyboardEvent', 'MediaList', 'MessageChannel',
        'MessageEvent', 'MouseEvent', 'MutationRecord', 'NodeList', 'Notification',
        'PageTransitionEvent', 'Path2D', 'PerformanceEntry', 'PerformanceNavigation',
        'PerformanceObserver', 'PerformanceResourceTiming', 'PointerEvent', 'PopStateEvent',
        'ProcessingInstruction', 'ProgressEvent', 'PromiseRejectionEvent',
        'RTCPeerConnection', 'RadioNodeList', 'Range', 'ReadableStream', 'Request', 'ResizeObserver',
        'Response', 'SVGAElement', 'SVGCircleElement', 'SVGDefsElement', 'SVGDescElement', 'SVGElement',
        'SVGEllipseElement', 'SVGFilterElement', 'SVGGElement', 'SVGGraphicsElement', 'SVGImageElement',
        'SVGLineElement', 'SVGLinearGradientElement', 'SVGMetadataElement', 'SVGNumber', 'SVGPathElement',
        'SVGPolygonElement', 'SVGPolylineElement', 'SVGRect', 'SVGSVGElement', 'SVGScriptElement',
        'SVGStopElement', 'SVGStyleElement', 'SVGSwitchElement', 'SVGSymbolElement', 'SVGTSpanElement',
        'SVGTextElement', 'SVGTitleElement', 'SVGUseElement', 'Selection', 'ShadowRoot', 'SharedWorker',
        'StorageEvent', 'SubmitEvent', 'SubtleCrypto', 'Text', 'TextDecoder', 'TextEncoder', 'Touch',
        'TouchEvent', 'TouchList', 'TransitionEvent', 'TreeWalker', 'UIEvent', 'URL', 'URLSearchParams',
        'ValidityState', 'VisualViewport', 'WebSocket', 'WheelEvent', 'Worker', 'WritableStream',
        'XMLDocument', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload', 'XMLSerializer',
        'XPathEvaluator', 'XPathResult', 'XSLTProcessor'
    ];
    extraCls.forEach(function(n) { if (typeof win[n] === 'undefined') win[n] = mc(n); });

    // ──── 执行安全 JS ────
    eval(security_js_code);

    if (typeof ABC === 'undefined') {
        return { error: 'ABC not defined' };
    }

    var token = new ABC().z(seed, ts);
    return { token: token };
}

// ──── Node.js 入口 ────
var __a = process.argv[2];
var __c = process.argv[3];
var seed = process.argv[4];
var ts = parseInt(process.argv[5]);

// 通过 Function 构造器在独立作用域执行，隐藏所有 Node.js 全局
var fn = new Function(
    '__a', '__c', 'seed', 'ts',
    'security_js_code',
    'crypto_random_bytes',
    'btoa_impl',
    'atob_impl',
    executeSecurityJS.toString().replace(/^function executeSecurityJS\([^)]*\) \{/, '').replace(/\}[^}]*$/, '')
);

var result = fn(
    __a, __c, seed, ts,
    code,
    // crypto_random_bytes
    function(arrLen) {
        var b = crypto.randomBytes(arrLen);
        return b;
    },
    // btoa_impl
    function(s) { return Buffer.from(s).toString('base64'); },
    // atob_impl
    function(s) { return Buffer.from(s, 'base64').toString(); }
);

if (result.error) {
    process.stderr.write(result.error + '\n');
    process.exit(1);
}

process.stdout.write(result.token);
