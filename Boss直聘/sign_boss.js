/**
 * Boss直聘 __zp_stoken__ 离线签名
 * 用法: node sign_boss.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm');
var fs = require('fs');
var env = require('./env_patch');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// 注入 __a / __c cookie
globalThis._zp_cookie = '__a=' + (process.argv[2] || '0') + '; __c=' + (process.argv[3] || '0') + '; __g=-';

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

// Browser constructors (200+)
var browserCls = [
    'Audio','BarProp','Blob','BroadcastChannel','CDATASection','CSS','CSSAnimation','CSSConditionRule',
    'CSSCounterStyleRule','CSSFontFaceRule','CSSGroupingRule','CSSImportRule','CSSKeyframeRule',
    'CSSKeyframesRule','CSSLayerBlockRule','CSSLayerStatementRule','CSSMediaRule','CSSNamespaceRule',
    'CSSNestedDeclarations','CSSPageRule','CSSRule','CSSRuleList','CSSScopeRule','CSSStyleDeclaration',
    'CSSStyleRule','CSSStyleSheet','CSSSupportsRule','CanvasGradient','CanvasPattern',
    'CanvasRenderingContext2D','CharacterData','ClipboardEvent','CloseEvent','Comment',
    'CompositionEvent','CountQueuingStrategy','Crypto','CustomElementRegistry','CustomEvent',
    'DOMException','DOMImplementation','DOMMatrix','DOMMatrixReadOnly','DOMParser','DOMPoint',
    'DOMPointReadOnly','DOMQuad','DOMRect','DOMRectList','DOMRectReadOnly','DOMStringList',
    'DOMStringMap','DOMTokenList','DataTransfer','DataTransferItem','DataTransferItemList','DataView',
    'DeviceMotionEvent','DeviceMotionEventAcceleration','DeviceMotionEventRotationRate',
    'DeviceOrientationEvent','Document','DocumentFragment','DocumentType','DragEvent','Element',
    'ElementInternals','ErrorEvent','Event','EventSource','EventTarget','External','File','FileList',
    'FileReader','FocusEvent','FontFace','FormData','FormDataEvent','GPU','GPUAdapter','GPUCommandEncoder',
    'GPUDevice','GPUQueue','HashChangeEvent','Headers','History','HTMLAllCollection','HTMLAnchorElement',
    'HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLBodyElement',
    'HTMLButtonElement','HTMLCanvasElement','HTMLCollection','HTMLDListElement','HTMLDataElement',
    'HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement',
    'HTMLElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection',
    'HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadElement',
    'HTMLHeadingElement','HTMLHtmlElement','HTMLIFrameElement','HTMLImageElement','HTMLInputElement',
    'HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement',
    'HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement',
    'HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement',
    'HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement',
    'HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLScriptElement',
    'HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement',
    'HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement',
    'HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement',
    'HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement',
    'HTMLVideoElement','IdleDeadline','Image','ImageBitmap','ImageData','InputEvent',
    'IntersectionObserver','IntersectionObserverEntry','KeyboardEvent','KeyframeEffect','Location',
    'MathMLElement','MediaList','MediaRecorder','MediaSource','MediaStream','MessageChannel',
    'MessageEvent','MessagePort','MimeType','MimeTypeArray','MouseEvent','MutationObserver',
    'MutationRecord','NamedNodeMap','Navigator','NavigatorUAData','NetworkInformation','Node',
    'NodeFilter','NodeIterator','NodeList','Notification','OffscreenCanvas','PageTransitionEvent',
    'Path2D','Performance','PerformanceEntry','PerformanceMark','PerformanceMeasure',
    'PerformanceNavigation','PerformanceObserver','PerformanceObserverEntryList',
    'PerformanceResourceTiming','PerformanceServerTiming','PerformanceTiming','PermissionStatus',
    'Permissions','Plugin','PluginArray','PointerEvent','PopStateEvent','ProcessingInstruction',
    'ProgressEvent','PromiseRejectionEvent','RTCCertificate','RTCPeerConnection','RadioNodeList',
    'Range','ReadableByteStreamController','ReadableStream','ReadableStreamBYOBReader',
    'ReadableStreamBYOBRequest','ReadableStreamDefaultController','ReadableStreamDefaultReader',
    'Report','ReportingObserver','Request','ResizeObserver','Response','SVGAElement','SVGAngle',
    'SVGAnimateElement','SVGAnimateMotionElement','SVGAnimateTransformElement','SVGAnimatedAngle',
    'SVGAnimatedBoolean','SVGAnimatedEnumeration','SVGAnimatedInteger','SVGAnimatedLength',
    'SVGAnimatedNumber','SVGAnimatedPreserveAspectRatio','SVGAnimatedRect','SVGAnimatedString',
    'SVGAnimationElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement',
    'SVGEllipseElement','SVGFEBlendElement','SVGFEColorMatrixElement','SVGFEComponentTransferElement',
    'SVGFECompositeElement','SVGFEConvolveMatrixElement','SVGFEDiffuseLightingElement',
    'SVGFEDisplacementMapElement','SVGFEDistantLightElement','SVGFEDropShadowElement','SVGFEFloodElement',
    'SVGFEFuncAElement','SVGFEFuncBElement','SVGFEFuncGElement','SVGFEFuncRElement',
    'SVGFEGaussianBlurElement','SVGFEImageElement','SVGFEMergeElement','SVGFEMergeNodeElement',
    'SVGFEMorphologyElement','SVGFEOffsetElement','SVGFEPointLightElement',
    'SVGFESpecularLightingElement','SVGFESpotLightElement','SVGFETileElement','SVGFETurbulenceElement',
    'SVGFilterElement','SVGForeignObjectElement','SVGGElement','SVGGraphicsElement','SVGImageElement',
    'SVGLength','SVGLineElement','SVGLinearGradientElement','SVGMPathElement','SVGMarkerElement',
    'SVGMaskElement','SVGMatrix','SVGMetadataElement','SVGNumber','SVGPathElement','SVGPatternElement',
    'SVGPoint','SVGPolygonElement','SVGPolylineElement','SVGPreserveAspectRatio',
    'SVGRadialGradientElement','SVGRect','SVGRectElement','SVGSVGElement','SVGScriptElement',
    'SVGSetElement','SVGStopElement','SVGStringList','SVGStyleElement','SVGSwitchElement',
    'SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTextPositioningElement',
    'SVGTitleElement','SVGTransform','SVGUseElement','SVGViewElement','Screen','Selection',
    'ServiceWorkerRegistration','ShadowRoot','SharedWorker','SourceBuffer','Storage',
    'StorageEvent','SubmitEvent','SubtleCrypto','Touch','TouchEvent','TouchList','TrackEvent',
    'TransformStream','TransformStreamDefaultController','TransitionEvent','TreeWalker','UIEvent',
    'URL','URLSearchParams','ValidityState','VTTCue','VisualViewport','WebSocket','WheelEvent',
    'Window','Worker','WritableStream','WritableStreamDefaultController','WritableStreamDefaultWriter',
    'XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer',
    'XPathEvaluator','XPathExpression','XPathResult','XSLTProcessor'
];
browserCls.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = env.mc(n); });

// Core browser objects
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox; sandbox._zp_cookie = globalThis._zp_cookie;
sandbox.console = { log: env.mf('log'), error: env.mf('error'), warn: env.mf('warn'), info: env.mf('info') };
sandbox.navigator = env.nav;
sandbox.document = env.doc;
sandbox.location = env.loc;
sandbox.screen = env.scr;
sandbox.history = env.hist;
sandbox.localStorage = env.makeStorage();
sandbox.sessionStorage = env.makeStorage();
sandbox.performance = env.perf;
sandbox.crypto = {
    getRandomValues: function(arr) {
        var b = require('crypto').randomBytes(arr.length);
        for (var i = 0; i < arr.length; i++) arr[i] = b[i];
        return arr;
    },
    subtle: null
};
env.sn(sandbox.crypto.getRandomValues, 'getRandomValues');

sandbox.btoa = function(s) { return Buffer.from(s).toString('base64'); }; env.sn(sandbox.btoa, 'btoa');
sandbox.atob = function(s) { return Buffer.from(s, 'base64').toString(); }; env.sn(sandbox.atob, 'atob');

// Window extras
Object.keys(env.win).forEach(function(k) { sandbox[k] = env.win[k]; });
sandbox.frames = sandbox;
sandbox.postMessage = env.mf('postMessage');
sandbox.addEventListener = env.mf('addEventListener');
sandbox.removeEventListener = env.mf('removeEventListener');
sandbox.dispatchEvent = env.mf('dispatchEvent');
sandbox.fetch = env.mf('fetch');
sandbox.getComputedStyle = function() { return {}; }; env.sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.matchMedia = function() { return { matches: false, media: '', addListener: env.mf('addListener'), addEventListener: env.mf('addEventListener'), removeEventListener: env.mf('removeEventListener') }; };
env.sn(sandbox.matchMedia, 'matchMedia');
sandbox.getSelection = function() { return null; }; env.sn(sandbox.getSelection, 'getSelection');
sandbox.requestAnimationFrame = env.mf('requestAnimationFrame');
sandbox.cancelAnimationFrame = env.mf('cancelAnimationFrame');
sandbox.print = env.mf('print');
sandbox.open = env.mf('open');
sandbox.close = env.mf('close');
sandbox.focus = env.mf('focus');
sandbox.blur = env.mf('blur');
sandbox.stop = env.mf('stop');
sandbox.scroll = env.mf('scroll');
sandbox.scrollTo = env.mf('scrollTo');
sandbox.scrollBy = env.mf('scrollBy');
sandbox.alert = env.mf('alert');
sandbox.confirm = env.mf('confirm');
sandbox.prompt = env.mf('prompt');
sandbox.XMLHttpRequest = function() {
    this.open = env.mf('open'); this.send = env.mf('send');
    this.setRequestHeader = env.mf('setRequestHeader'); this.abort = env.mf('abort');
    this.getResponseHeader = function() { return null; }; this.getAllResponseHeaders = function() { return ''; };
    this.readyState = 0; this.status = 0; this.responseText = ''; this.responseXML = null;
    this.DONE = 4; this.UNSENT = 0; this.OPENED = 1; this.HEADERS_RECEIVED = 2; this.LOADING = 3;
};
env.sn(sandbox.XMLHttpRequest, 'XMLHttpRequest');
sandbox.MutationObserver = function(cb) { this.observe = env.mf('observe'); this.disconnect = env.mf('disconnect'); this.takeRecords = env.mf('takeRecords'); };
env.sn(sandbox.MutationObserver, 'MutationObserver');
sandbox.Image = function() { return new sandbox.HTMLImageElement(); };
sandbox.eval = function(s) { return vm.runInContext(s, vm.createContext(sandbox)); };

// Run security JS
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
    process.stderr.write(e.stack && e.stack.substring(0, 300) + '\n');
    process.exit(1);
}
