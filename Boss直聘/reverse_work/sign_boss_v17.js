/**
 * sign_boss_v17.js — 4reverse.js 路线
 * Function.prototype.toString = "" + 直接 global 挂属性 + 直接 eval
 */
var fs = require('fs');
var seed = process.argv[2] || 'test';
var ts = parseInt(process.argv[3] || '1700000000000');
var __a = process.argv[4] || '0', __c = process.argv[5] || '0';
var seccode = fs.readFileSync(__dirname + '/config/security-11f5a2fc.js', 'utf8');

// === 1. Function.prototype.toString → "" ===
var _origToString = Function.prototype.toString;
Function.prototype.toString = function () { return ""; };

// === 2. location with seed/ts in query ===
global.location = {
    hostname: "www.zhipin.com",
    host: "www.zhipin.com",
    href: "https://www.zhipin.com/web/common/security-check.html?seed=" + encodeURIComponent(seed) + "&name=11f5a2fc&ts=" + ts + "&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer=",
    protocol: "https:",
    origin: "https://www.zhipin.com",
    pathname: "/web/common/security-check.html",
    search: "?seed=" + encodeURIComponent(seed) + "&name=11f5a2fc&ts=" + ts + "&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer=",
    port: "",
    hash: "",
    ancestorOrigins: {}
};

// === 3. document ===
global.document = {
    location: {},
    cookie: "__a=" + __a + ";__c=" + __c + ";__g=-",
    createElement: function (tag) {
        if (tag === 'canvas') {
            return {
                getContext: function (type) {
                    if (type === "2d") { return { fillRect: function(){}, fillText: function(){}, measureText: function(t){return{width:t.length*6}} }; }
                    if (type === "webgl" || type === "experimental-webgl") {
                        return {
                            getParameter: function(p) { var v={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32,37445:'ANGLE',37446:'Google Inc.'}; return v[p]||0; },
                            getExtension: function(n) { if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445}; return {}; },
                            getSupportedExtensions: function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax']; }
                        };
                    }
                    return null;
                },
                toDataURL: function () { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; },
                width: 300, height: 150, style: {}
            };
        }
        if (tag === 'iframe') { return { contentWindow: global }; }
        return { style: {}, appendChild: function(){}, setAttribute: function(){}, getAttribute: function(){return null} };
    },
    getElementById: function () { return null; },
    getElementsByTagName: function () { return { item: function(){return null}, length: 0 }; },
    getElementsByClassName: function () { return []; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function(){},
    body: { appendChild: function(){}, style: {}, offsetWidth: 1920, offsetHeight: 1080 },
    documentElement: { style: {}, appendChild: function(){} },
    head: { appendChild: function(){}, getElementsByTagName: function(){return []} },
    hidden: false,
    visibilityState: "visible",
    readyState: "complete",
    characterSet: "UTF-8",
    title: "BOSS直聘",
    referrer: "",
    domain: "www.zhipin.com",
    URL: "https://www.zhipin.com/web/geek/jobs",
    all: undefined
};

// === 4. navigator ===
global.navigator = {
    cookieEnabled: true,
    language: "zh-CN",
    languages: ["zh-CN", "zh"],
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    appVersion: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    appCodeName: "Mozilla",
    appName: "Netscape",
    platform: "Win32",
    product: "Gecko",
    productSub: "20030107",
    vendor: "Google Inc.",
    vendorSub: "",
    webdriver: false,
    doNotTrack: null,
    hardwareConcurrency: 32,
    maxTouchPoints: 0,
    deviceMemory: 32,
    onLine: true,
    pdfViewerEnabled: true,
    webkitTemporaryStorage: {},
    plugins: { length: 5, item: function(){return null}, namedItem: function(){return null}, refresh: function(){} },
    mimeTypes: { length: 2, item: function(){return null}, namedItem: function(){return null} },
    javaEnabled: function(){return false},
    taintEnabled: function(){return false},
    sendBeacon: function(){return false},
};

// === 5. screen ===
global.screen = {
    width: 2195, height: 1235, availWidth: 2195, availHeight: 1187,
    colorDepth: 32, pixelDepth: 32,
    orientation: { type: "landscape-primary", angle: 0 }
};

// === 6. localStorage / sessionStorage ===
var _lsObj = {};
global.localStorage = {
    setItem: function (a, b) { _lsObj[a] = b; },
    getItem: function (a) { return _lsObj[a] || null; },
    key: function(n) { var keys=Object.keys(_lsObj); return n>=0&&n<keys.length?keys[n]:null; },
    removeItem: function(a) { delete _lsObj[a]; },
    clear: function() { _lsObj = {}; },
    length: 0
};
global.sessionStorage = {
    setItem: function(){}, getItem: function(){return null}, key: function(){return null},
    removeItem: function(){}, clear: function(){}, length: 0
};

// === 7. window ===
global.window = global;
global.self = global;
global.top = global;
global.parent = global;
global.globalThis = global;
global.innerWidth = 2195; global.innerHeight = 1100;
global.outerWidth = 2195; global.outerHeight = 1187;
global.devicePixelRatio = 1.75; global.screenX = 2195; global.screenY = 0;
global.name = ''; global.closed = false; global.length = 0; global.opener = null;

// === 8. history ===
global.history = { length: 1, scrollRestoration: "auto", state: null,
    pushState: function(){}, replaceState: function(){}, back: function(){}, forward: function(){}, go: function(){} };

// === 9. performance ===
var _perfNow = Date.now();
global.performance = {
    now: function() { return Date.now() - _perfNow; },
    memory: { jsHeapSizeLimit: 4294967296, totalJSHeapSize: 41938737, usedJSHeapSize: 34705941 },
    navigation: { type: 0, redirectCount: 0 },
    timing: { navigationStart: _perfNow, fetchStart: _perfNow, domainLookupStart: _perfNow,
        domainLookupEnd: _perfNow, connectStart: _perfNow, connectEnd: _perfNow,
        requestStart: _perfNow, responseStart: _perfNow, responseEnd: _perfNow,
        domLoading: _perfNow, domInteractive: _perfNow, domContentLoadedEventStart: _perfNow,
        domContentLoadedEventEnd: _perfNow, domComplete: _perfNow, loadEventStart: _perfNow, loadEventEnd: _perfNow },
    timeOrigin: _perfNow,
    getEntriesByType: function(){return []}
};

// === 10. crypto ===
global.crypto = {
    getRandomValues: function(a) { for (var i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); return a; },
    subtle: { digest: function(){}, encrypt: function(){}, decrypt: function(){}, sign: function(){},
        verify: function(){}, generateKey: function(){}, importKey: function(){}, exportKey: function(){},
        deriveKey: function(){}, deriveBits: function(){}, unwrapKey: function(){}, wrapKey: function(){} },
    randomUUID: function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; }
};

// === 11. Base64 ===
global.btoa = function(s) { return Buffer.from(s).toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };

// === 12. Console ===
global.console = { log: function(){}, error: function(){}, warn: function(){}, info: function(){}, debug: function(){} };

// === 13. Constructors ===
global.CSSRuleList = function(){};
global.MutationObserver = function(){ this.observe = function(){}; this.disconnect = function(){}; };
global.XMLHttpRequest = function(){};
global.Event = function(){};
global.Image = function(){};
global.matchMedia = function(){ return { matches: false, media: '' }; };
global.fetch = function(){};
global.getComputedStyle = function(){ return {}; };
global.getSelection = function(){ return null; };
global.addEventListener = function(){};
global.removeEventListener = function(){};
global.dispatchEvent = function(){};
global.postMessage = function(){};
global.requestAnimationFrame = function(){};
global.setTimeout = setTimeout;
global.setInterval = setInterval;
global.clearTimeout = clearTimeout;
global.clearInterval = clearInterval;
global.Intl = {};
global.AbortController = function(){};
global.AbortSignal = function(){};

// OfflineAudioContext
global.OfflineAudioContext = function () {
    return {
        createOscillator: function () { return { frequency: { setValueAtTime: function(){} }, type: "sine", start: function(){}, stop: function(){}, connect: function(){} }; },
        createDynamicsCompressor: function(){ return { connect: function(){} }; },
        createGain: function(){ return { connect: function(){}, gain: { setValueAtTime: function(){}, value: 0 } }; },
        destination: {},
        startRendering: function(){ return { then: function(f){ f(""); } }; },
        sampleRate: 44100
    };
};

global.unescape = decodeURIComponent;
global.escape = encodeURIComponent;
global.decodeURI = decodeURI;
global.decodeURIComponent = decodeURIComponent;
global.encodeURI = encodeURI;
global.encodeURIComponent = encodeURIComponent;

global.Object = Object;
global.Array = Array;
global.Function = Function;
global.String = String;
global.Number = Number;
global.Boolean = Boolean;
global.Date = Date;
global.Math = Math;
global.RegExp = RegExp;
global.Error = Error;
global.JSON = JSON;
global.parseFloat = parseFloat;
global.parseInt = parseInt;
global.isNaN = isNaN;
global.isFinite = isFinite;
global.Promise = Promise;
global.Symbol = Symbol;
global.Map = Map;
global.Set = Set;
global.WeakMap = WeakMap;
global.WeakSet = WeakSet;
global.ArrayBuffer = ArrayBuffer;
global.DataView = DataView;
global.Uint8Array = Uint8Array;
global.Int32Array = Int32Array;
global.NaN = NaN;
global.Infinity = Infinity;
global.undefined = undefined;
global.eval = eval;

// === 14. Hide Node.js (where possible) ===
// Already not in global in Node 24

// === 15. Execute security JS ===
try {
    eval(seccode);
} catch(e) {
    process.stderr.write('Eval error: ' + e.message + ' at line ' + e.lineNumber + '\n');
    process.exit(1);
}

if (typeof global.ABC === 'undefined') {
    process.stderr.write('ABC not defined\n');
    process.exit(1);
}

// === 16. Generate token ===
var tz = 60 * (480 + new Date().getTimezoneOffset()) * 1000;
var token = new global.ABC().z(seed, parseInt(ts) + tz);
process.stdout.write(token);
