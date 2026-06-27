/**
 * VMP state trace injector for security-7c91433f.js
 *
 * Injects logging into the 3-layer VMP to capture state transitions.
 * The VMP structure:
 *   p = state variable (3 layers encoded: p&31, (p>>5)&31, (p>>10)&31)
 *   l(p, ...) = VMP interpreter
 *
 * Usage: node -e "require('./config/inject_trace.js')('7c91433f')"
 * Then compare browser trace vs Node.js trace to find divergence point.
 */

var fs = require('fs');
var modName = process.argv[2] || '7c91433f';
var code = fs.readFileSync(__dirname + '/security-' + modName + '.js', 'utf8');

// Strategy: We need to log every p-assignment inside the VMP.
// The VMP pattern is: p = <number> or p = <condition> ? <num1> : <num2>
// We inject: __trace.push({old:p, new:<value>, stack:...}) after each assignment.

// First, let's create a simpler approach:
// Instead of parsing AST, we'll run the security JS in a vm and hook the
// state variable 'p' at the JavaScript engine level via Proxy.

// But the simplest approach: wrap the function l() to log its calls
// and inject at key points.

// Actually, the most practical way is to:
// 1. Add a global trace array
// 2. Replace all `p=NUMBER` patterns with `(p=NUMBER,__trace_p(p,__trace_state++,NUMBER))`
// 3. But regex on this is risky...

// Let's try the hook approach instead - run the security JS and hook the
// state variable via Proxy at the scope level.

// For now, let's just create a wrapper that captures all calls to l()
// and logs the state transitions.

var traceCode = `
// ===== VMP Trace Hook =====
global.__vmp_trace = [];
global.__vmp_state_idx = 0;
global.__vmp_enter_depth = 0;
global.__vmp_max_depth = 0;

// Hook: track every invocation of the main VMP function
// We'll patch the code to add trace after each p assignment

// Simple approach: wrap eval'd code to capture the global after execution
global.__capture_p_assignments = true;
`;

// More practical: Instead of complex injection, let's create a
// standalone trace script that patches the security JS to log at
// the function boundary level.

// The key insight from articles: the VMP calls itself via:
//   l.apply(this, [nextState].concat(Array.prototype.slice.call(arguments)))
// So we can trace by hooking Function.prototype.apply

var hookScript = `
/**
 * Trace script - hooks the VMP recursive calls to capture state flow
 *
 * Run: node config/trace_vmp.js <seed> <ts>
 */

var fs = require('fs');
var _crypto = require('crypto');

// ===== Minimal Browser Environment =====
// (same as sign_boss_v5.js but with VMP tracing)

var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }

var ST = Symbol.toStringTag;
var _trace_log = [];
var _trace_enabled = true;

// ===== VMP Tracer =====
// Hook Function.prototype.apply to capture all VMP state transitions
var _orig_apply = Function.prototype.apply;
var _vmp_fn = null;  // will be set when we detect the main VMP function

Function.prototype.apply = function(thisArg, args) {
    var result = _orig_apply.call(this, thisArg, args);

    // Check if this is the VMP interpreter 'l' function
    // It will have a very distinctive structure
    if (this.length > 200 || (this.toString().length > 100000)) {
        // This is likely the big VMP function
        if (!_vmp_fn) _vmp_fn = this;

        if (_trace_enabled && args && args.length > 0) {
            _trace_log.push({
                p: args[0],          // current state
                args_len: args.length,
                depth: _trace_log.length
            });
            if (_trace_log.length < 200) {
                process.stderr.write('[VMP] state p=' + args[0] + ' (0x' + args[0].toString(16) + ')\\n');
            }
        }
    }

    return result;
};

// We need to be smarter - the VMP doesn't use .apply() for state transitions.
// Let's hook at a different level.

// Actually, let's use a completely different approach:
// Inject into the security JS code itself via regex replacement.

// The pattern is: p=NUMBER or p=condition?N1:N2
// We'll replace: p=(\d+) with p=__log_p($1)
// and: p=([^;]*)\?(\d+):(\d+) with p=__log_cond($1,$2,$3)

// But first, let's just try running the VMP and see if we can observe the states.
`;

// Write the actual trace script
var traceScriptContent = hookScript + `

// ===== Rest of environment setup =====
function EvtTgt(){} sn(EvtTgt, 'EventTarget');

function Nav_(){}
Nav_.prototype = Object.create(EvtTgt.prototype); Nav_.prototype[ST] = 'Navigator'; sn(Nav_, 'Navigator');

function Doc_(){}
Doc_.prototype = Object.create(EvtTgt.prototype); Doc_.prototype[ST] = 'HTMLDocument'; sn(Doc_, 'Document');

function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.style = {};
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; };
sn(HTMLEl.prototype.getAttribute, 'getAttribute');
HTMLEl.prototype.getBoundingClientRect = function() {
    return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
};
sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect');
sn(HTMLEl, 'HTMLElement');

function HTMLHtmlEl(){}
HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype); HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement'; sn(HTMLHtmlEl, 'HTMLHtmlElement');

function HTMLBodyEl(){}
HTMLBodyEl.prototype = Object.create(HTMLEl.prototype); HTMLBodyEl.prototype[ST] = 'HTMLBodyElement'; sn(HTMLBodyEl, 'HTMLBodyElement');

function HTMLHeadEl(){}
HTMLHeadEl.prototype = Object.create(HTMLEl.prototype); HTMLHeadEl.prototype[ST] = 'HTMLHeadElement'; sn(HTMLHeadEl, 'HTMLHeadElement');

function HTMLCanvasEl(){}
HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype); HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement';
HTMLCanvasEl.prototype.width = 300; HTMLCanvasEl.prototype.height = 150; sn(HTMLCanvasEl, 'HTMLCanvasElement');

function HTMLIFrameEl(){}
HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype); HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement'; sn(HTMLIFrameEl, 'HTMLIFrameElement');

function HTMLScriptEl(){}
HTMLScriptEl.prototype = Object.create(HTMLEl.prototype); HTMLScriptEl.prototype[ST] = 'HTMLScriptElement'; sn(HTMLScriptEl, 'HTMLScriptElement');

function Loc_(){}
Loc_.prototype[ST] = 'Location'; sn(Loc_, 'Location');

function Scr_(){}
Scr_.prototype[ST] = 'Screen'; sn(Scr_, 'Screen');

function Hist_(){}
Hist_.prototype[ST] = 'History'; sn(Hist_, 'History');

function Stor_(){}
Stor_.prototype[ST] = 'Storage'; sn(Stor_, 'Storage');

function Perf_(){}
Perf_.prototype[ST] = 'Performance'; sn(Perf_, 'Performance');

function PlArr_(){}
PlArr_.prototype[ST] = 'PluginArray'; sn(PlArr_, 'PluginArray');

function MtArr_(){}
MtArr_.prototype[ST] = 'MimeTypeArray'; sn(MtArr_, 'MimeTypeArray');

function Plg_(){}
Plg_.prototype.item = mf('item'); Plg_.prototype.namedItem = mf('namedItem');
Plg_.prototype[ST] = 'Plugin'; sn(Plg_, 'Plugin');

function Mt_(){}
Mt_.prototype[ST] = 'MimeType'; sn(Mt_, 'MimeType');

// Navigator
var nav = new Nav_();
nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion = '5.0 (Windows)'; nav.platform = 'Win32'; nav.language = 'zh-CN';
nav.languages = ['zh-CN', 'zh']; nav.cookieEnabled = true; nav.webdriver = false;
nav.hardwareConcurrency = 8; nav.maxTouchPoints = 0; nav.vendor = '';
nav.productSub = '20100101'; nav.doNotTrack = '1'; nav.onLine = true;
nav.deviceMemory = undefined; nav.webkitTemporaryStorage = undefined;

var pls = new PlArr_();
pls.length = 5; pls.refresh = mf('refresh'); pls.item = mf('item'); pls.namedItem = mf('namedItem');
['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'].forEach(function(nm, i) {
    var p = new Plg_();
    p.name = nm; p.filename = 'internal-pdf-viewer'; p.description = 'Portable Document Format'; p.length = 2;
    var m0 = new Mt_(); m0.type = 'application/pdf'; m0.suffixes = 'pdf'; m0.description = 'Portable Document Format'; m0.enabledPlugin = p;
    var m1 = new Mt_(); m1.type = 'text/pdf'; m1.suffixes = 'pdf'; m1.description = 'Portable Document Format'; m1.enabledPlugin = p;
    p[0] = m0; p[1] = m1; pls[i] = p;
});
nav.plugins = pls;

var mts = new MtArr_();
mts.length = 2; mts.item = mf('item'); mts.namedItem = mf('namedItem');
var mm0 = new Mt_(); mm0.type = 'application/pdf'; mm0.suffixes = 'pdf'; mm0.description = 'Portable Document Format'; mm0.enabledPlugin = pls[0];
var mm1 = new Mt_(); mm1.type = 'text/pdf'; mm1.suffixes = 'pdf'; mm1.description = 'Portable Document Format'; mm1.enabledPlugin = pls[0];
mts[0] = mm0; mts[1] = mm1; nav.mimeTypes = mts;

// Document
var doc = new Doc_();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.style = {}; f.setAttribute = mf('setAttribute'); f.getAttribute = function() { return null; }; f.contentWindow = globalThis; return f; }
    if (tag === 'canvas') return new HTMLCanvasEl();
    if (tag === 'script') { var s = new HTMLScriptEl(); s.src = ''; s.setAttribute = mf('setAttribute'); return s; }
    return new HTMLEl();
};
sn(doc.createElement, 'createElement');
doc.createElementNS = function(ns, tag) { return doc.createElement(tag); };
sn(doc.createElementNS, 'createElementNS');
doc.body = new HTMLBodyEl();
doc.documentElement = new HTMLHtmlEl();
doc.head = new HTMLHeadEl();
doc.getElementsByTagName = function(t) {
    if (t === 'head') return { item: function() { return doc.head; }, length: 1 };
    return { item: function() { return null; }, length: 0 };
};
sn(doc.getElementsByTagName, 'getElementsByTagName');
doc.getElementById = function() { return new HTMLEl(); };
sn(doc.getElementById, 'getElementById');
doc.getElementsByClassName = function() { return []; };
sn(doc.getElementsByClassName, 'getElementsByClassName');
doc.querySelector = function() { return new HTMLEl(); };
sn(doc.querySelector, 'querySelector');
doc.querySelectorAll = function() { return []; };
sn(doc.querySelectorAll, 'querySelectorAll');
doc.addEventListener = mf('addEventListener');
doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible'; doc.title = 'BOSS直聘';
doc.all = undefined;

var _docCookie = '';
Object.defineProperty(doc, 'cookie', {
    get: function() { return _docCookie || ('__a=' + (process.argv[2] || '0') + ';__c=' + (process.argv[3] || '0') + ';__g=-'); },
    set: function(v) { _docCookie = v; },
    configurable: true, enumerable: true
});

// Location / Screen / History
var loc = new Loc_();
loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs';
loc.protocol = 'https:'; loc.origin = 'https://www.zhipin.com';
loc.port = ''; loc.search = '?city=101010100&query=python'; loc.hash = '';

var scr = new Scr_();
scr.width = 1600; scr.height = 900; scr.availWidth = 1600; scr.availHeight = 860;
scr.colorDepth = 24; scr.pixelDepth = 24;

var hist = new Hist_();
hist.length = 1; hist.pushState = mf('pushState'); hist.replaceState = mf('replaceState');
hist.back = mf('back'); hist.forward = mf('forward'); hist.go = mf('go');

function mkStor() {
    var s = new Stor_();
    s.getItem = function(key) { return null; };
    sn(s.getItem, 'getItem');
    s.setItem = mf('setItem'); s.removeItem = mf('removeItem');
    s.clear = mf('clear'); s.key = mf('key'); s.length = 0;
    return s;
}

var perf = new Perf_();
perf.now = function() { return Date.now(); };
sn(perf.now, 'now');
perf.memory = {};

// Crypto
var cryptoFn = function(arr) {
    var b = _crypto.randomBytes(arr.length);
    for (var i = 0; i < arr.length; i++) arr[i] = b[i];
    return arr;
};
sn(cryptoFn, 'getRandomValues');

var btoaFn = function(s) { return Buffer.from(s).toString('base64'); };
sn(btoaFn, 'btoa');
var atobFn = function(s) { return Buffer.from(s, 'base64').toString(); };
sn(atobFn, 'atob');

// ===== Set up globalThis =====
globalThis.window = globalThis; globalThis.self = globalThis; globalThis.top = globalThis; globalThis.parent = globalThis;
globalThis.navigator = nav; globalThis.document = doc; globalThis.location = loc;
globalThis.screen = scr; globalThis.history = hist;
globalThis.localStorage = mkStor(); globalThis.sessionStorage = mkStor(); globalThis.performance = perf;
globalThis.crypto = { getRandomValues: cryptoFn, subtle: null };
globalThis.btoa = btoaFn; globalThis.atob = atobFn;
globalThis.innerWidth = 1600; globalThis.innerHeight = 900; globalThis.outerWidth = 1600; globalThis.outerHeight = 900;
globalThis.devicePixelRatio = 1; globalThis.screenX = 0; globalThis.screenY = 0;
globalThis.name = ''; globalThis.closed = false; globalThis.length = 0; globalThis.opener = null;
globalThis.origin = 'https://www.zhipin.com'; globalThis.isSecureContext = true;
globalThis.postMessage = mf('postMessage'); globalThis.addEventListener = mf('addEventListener');
globalThis.removeEventListener = mf('removeEventListener'); globalThis.dispatchEvent = mf('dispatchEvent');
globalThis.fetch = mf('fetch'); globalThis.requestAnimationFrame = mf('requestAnimationFrame');
globalThis.matchMedia = function() { return { matches: false, media: '' }; };
sn(globalThis.matchMedia, 'matchMedia');
globalThis.getComputedStyle = function() { return {}; };
sn(globalThis.getComputedStyle, 'getComputedStyle');
globalThis.getSelection = function() { return null; };
sn(globalThis.getSelection, 'getSelection');
globalThis.print = mf('print'); globalThis.open = mf('open'); globalThis.close = mf('close');
globalThis.focus = mf('focus'); globalThis.blur = mf('blur'); globalThis.stop = mf('stop');
globalThis.scroll = mf('scroll'); globalThis.scrollTo = mf('scrollTo'); globalThis.scrollBy = mf('scrollBy');
globalThis.alert = mf('alert'); globalThis.confirm = mf('confirm'); globalThis.prompt = mf('prompt');
globalThis.XMLHttpRequest = mc('XMLHttpRequest');
globalThis.MutationObserver = mc('MutationObserver');
globalThis.Image = mc('Image');
globalThis.Event = mc('Event');
globalThis.CSSRuleList = mc('CSSRuleList');
globalThis.console = { log: function(){}, error: function(){}, warn: function(){}, info: function(){} };
globalThis.process = undefined; globalThis.module = undefined; globalThis.require = undefined;
globalThis._phantom = undefined; globalThis.callphantom = undefined;

// 200+ browser constructors
var extraCls = [
    'Blob', 'CSSRule', 'CSSStyleDeclaration', 'CSSStyleSheet', 'CanvasRenderingContext2D',
    'CloseEvent', 'Comment', 'CompositionEvent', 'CustomEvent', 'DOMException', 'DOMImplementation',
    'DOMParser', 'DOMRect', 'DataTransfer', 'DeviceMotionEvent', 'DocumentFragment', 'DragEvent',
    'Element', 'ErrorEvent', 'EventSource', 'File', 'FileList', 'FileReader', 'FocusEvent', 'FormData',
    'HashChangeEvent', 'Headers', 'HTMLCollection', 'HTMLAnchorElement', 'HTMLAreaElement',
    'HTMLAudioElement', 'HTMLBRElement', 'HTMLBaseElement', 'HTMLButtonElement', 'HTMLDListElement',
    'HTMLDataElement', 'HTMLDataListElement', 'HTMLDetailsElement', 'HTMLDialogElement',
    'HTMLDirectoryElement', 'HTMLDivElement', 'HTMLEmbedElement', 'HTMLFieldSetElement',
    'HTMLFontElement', 'HTMLFormControlsCollection', 'HTMLFormElement', 'HTMLFrameElement',
    'HTMLFrameSetElement', 'HTMLHRElement', 'HTMLHeadingElement', 'HTMLImageElement',
    'HTMLInputElement', 'HTMLLIElement', 'HTMLLabelElement', 'HTMLLegendElement', 'HTMLLinkElement',
    'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement', 'HTMLMenuElement', 'HTMLMetaElement',
    'HTMLMeterElement', 'HTMLModElement', 'HTMLOListElement', 'HTMLObjectElement', 'HTMLOptGroupElement',
    'HTMLOptionElement', 'HTMLOptionsCollection', 'HTMLOutputElement', 'HTMLParagraphElement',
    'HTMLParamElement', 'HTMLPictureElement', 'HTMLPreElement', 'HTMLProgressElement', 'HTMLQuoteElement',
    'HTMLSelectElement', 'HTMLSlotElement', 'HTMLSourceElement', 'HTMLSpanElement', 'HTMLStyleElement',
    'HTMLTableCaptionElement', 'HTMLTableCellElement', 'HTMLTableColElement', 'HTMLTableElement',
    'HTMLTableRowElement', 'HTMLTableSectionElement', 'HTMLTemplateElement', 'HTMLTextAreaElement',
    'HTMLTimeElement', 'HTMLTitleElement', 'HTMLTrackElement', 'HTMLUListElement', 'HTMLUnknownElement',
    'HTMLVideoElement', 'InputEvent', 'IntersectionObserver', 'KeyboardEvent', 'MediaList',
    'MessageChannel', 'MessageEvent', 'MouseEvent', 'MutationRecord', 'NodeList', 'Notification',
    'PageTransitionEvent', 'Path2D', 'PerformanceEntry', 'PerformanceNavigation', 'PerformanceObserver',
    'PerformanceResourceTiming', 'PointerEvent', 'PopStateEvent', 'ProcessingInstruction',
    'ProgressEvent', 'Range', 'ReadableStream', 'Request', 'ResizeObserver', 'Response',
    'SVGAElement', 'SVGCircleElement', 'SVGDefsElement', 'SVGDescElement', 'SVGElement',
    'SVGEllipseElement', 'SVGFilterElement', 'SVGGElement', 'SVGGraphicsElement', 'SVGImageElement',
    'SVGLineElement', 'SVGLinearGradientElement', 'SVGMetadataElement', 'SVGPathElement',
    'SVGPolygonElement', 'SVGPolylineElement', 'SVGRect', 'SVGSVGElement', 'SVGScriptElement',
    'SVGStopElement', 'SVGStyleElement', 'SVGSwitchElement', 'SVGSymbolElement', 'SVGTSpanElement',
    'SVGTextElement', 'SVGTitleElement', 'SVGUseElement', 'Selection', 'ShadowRoot', 'SharedWorker',
    'StorageEvent', 'SubmitEvent', 'Text', 'TextDecoder', 'TextEncoder', 'TouchEvent', 'TransitionEvent',
    'TreeWalker', 'UIEvent', 'URL', 'URLSearchParams', 'ValidityState', 'VisualViewport', 'WebSocket',
    'WheelEvent', 'Worker', 'XMLDocument', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload',
    'XMLSerializer', 'XPathEvaluator', 'XPathResult', 'XSLTProcessor'
];
extraCls.forEach(function(n) { if (!(n in globalThis)) globalThis[n] = mc(n); });

// ===== Read security JS =====
var code = fs.readFileSync(__dirname + '/security-' + modName + '.js', 'utf8');

// ===== Inject trace into VMP p= assignments =====
// The VMP pattern is: p = <number>  or  p = <cond> ? <num1> : <num2>
// We replace with: p = __t(<number>)  or  p = __tc(<cond>, <num1>, <num2>)

var _trace_state = [];
var _trace_idx = 0;
var __t = function(v) {
    _trace_state.push({idx: _trace_idx++, p: v});
    return v;
};
var __tc = function(cond, t, f) {
    var v = cond ? t : f;
    _trace_state.push({idx: _trace_idx++, p: v, cond: true});
    return v;
};

// Replace all p=NUMBER patterns (but not p=~, p=T, p=U etc)
// The patterns are: p=NUMBER (possibly preceded by void 0 ? ... : NUMBER)
var originalCode = code;
var injectedCode = code;

// Pattern 1: Replace standalone "p=NUMBER" (integer assignments)
// These are the state transitions within case bodies
// Example: p=11403  or  p=0  or  ;p=13760
// We need to be careful not to replace within strings or variable declarations
injectedCode = injectedCode.replace(/;p=(\d+)([;}])/g, ';p=__t($1)$2');
// But also match the beginning of assignment
injectedCode = injectedCode.replace(/([^a-zA-Z_$.])p=(\d+)([;}])/g, '$1p=__t($2)$3');

// Pattern 2: Replace conditional p assignments
// p = cond ? NUM1 : NUM2
injectedCode = injectedCode.replace(/p=([^;?]*)\?(\d+):(\d+)([;}])/g, 'p=__tc($1,$2,$3)$4');

// Also handle: p = void N?N1:N2
injectedCode = injectedCode.replace(/p=void (\d+)\?(\d+):(\d+)/g, 'p=__tc(void $1,$2,$3)');

var injectedCount = 0;
// Count how many replacements we made
var origMatch = originalCode.match(/;p=\d+[;}]/g);
var injMatch = injectedCode.match(/;p=__t\(\d+\)[;}]/g);
process.stderr.write('[inject] p=N -> __t(N): ' + (injMatch ? injMatch.length : 0) + ' replacements\\n');

// ===== Also inject window.s capture (VMP stores start timestamp) =====
// Add a hook before: var S=new Date;window.s=S.getTime()
injectedCode = injectedCode.replace(
    'window.s=S.getTime()',
    'window.s=S.getTime();globalThis.__vmp_start_time=window.s'
);

// ===== Execute the patched code =====
process.stderr.write('[exec] Running patched security JS...\\n');
try {
    eval(injectedCode);
} catch(e) {
    process.stderr.write('[ERROR] ' + e.message + '\\n');
    process.stderr.write('[ERROR] at line: ' + e.lineNumber + '\\n');
}

// ===== Check ABC availability =====
if (typeof ABC === 'undefined') {
    process.stderr.write('ABC not defined after eval\\n');
    // Try on globalThis
    if (typeof globalThis.ABC !== 'undefined') {
        globalThis.ABC = globalThis.ABC;
        process.stderr.write('ABC found on globalThis\\n');
    } else {
        process.exit(1);
    }
}

// ===== Generate token with trace =====
var seed = process.argv[4];
var ts = parseInt(process.argv[5]);

if (!seed || !ts) {
    process.stderr.write('Usage: node config/trace_vmp.js <__a> <__c> <seed> <ts>\\n');
    process.stderr.write('Using test values...\\n');
    seed = 'test_seed_value_44_chars_long_xxxxxx';
    ts = Math.floor(Date.now());
}

// Save start time (emulate window.s)
globalThis.__vmp_start_time = Date.now();

process.stderr.write('[trace] Starting with seed=' + seed.substring(0,20) + '... ts=' + ts + '\\n');
process.stderr.write('[trace] window.s=' + (globalThis.__vmp_start_time || 'undefined') + '\\n');

_trace_state = [];
_trace_idx = 0;

var token = new ABC().z(seed, ts);

process.stderr.write('[trace] Token: len=' + token.length + ' preview=' + token.substring(0, 50) + '...\\n');
process.stderr.write('[trace] Captured ' + _trace_state.length + ' state transitions\\n');

// Output token to stdout
process.stdout.write(token);

// Save trace to stderr for analysis
if (_trace_state.length > 0) {
    var sampleRate = Math.max(1, Math.floor(_trace_state.length / 100));
    process.stderr.write('[trace] Sampled states (every ' + sampleRate + '):\\n');
    for (var i = 0; i < Math.min(_trace_state.length, 100); i += sampleRate) {
        process.stderr.write('  [' + _trace_state[i].idx + '] p=' + _trace_state[i].p + '\\n');
    }
    // Save full trace
    fs.writeFileSync(__dirname + '/trace_dump.json', JSON.stringify(_trace_state));
    process.stderr.write('[trace] Full trace saved to trace_dump.json\\n');
}
`;

fs.writeFileSync(__dirname + '/trace_vmp.js', traceScriptContent);
console.log('Created: config/trace_vmp.js');
console.log('Usage: node config/trace_vmp.js <__a> <__c> <seed> <ts>');
