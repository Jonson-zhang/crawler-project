/**
 * Run traced security JS and capture VMP state sequence
 * Uses minimal env (v17-style) to maximize compatibility
 */
var fs = require('fs');
var seed = process.argv[2] || 'test123';
var ts = parseInt(process.argv[3] || '1700000000000');
var __a = process.argv[4] || '0';
var __c = process.argv[5] || '0';

var seccode = fs.readFileSync(__dirname + '/security-traced-2026.js', 'utf8');
var outputFile = process.argv[6] || (__dirname + '/vmp_trace_output.txt');

// Capture console.log to trace file
var traceLines = [];
var _realConsoleLog = console.log.bind(console);

// Override the global console.log to capture VMP traces
// The security JS (through eval) will use global.console.log
// which we set to call back to Node's real console
global._realLog = function() {
    var args = Array.prototype.slice.call(arguments);
    var line = args.join(' ');
    if (line.startsWith('VMP:')) {
        traceLines.push(line);
    }
    _realConsoleLog.apply(console, args);
};

global.btoa = function(s) { return Buffer.from(s).toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };
global.console = {
    log: global._realLog,
    error: function(){}, warn: function(){}, info: function(){}, debug: function(){}
};

// Minimal environment (v17 style)
Function.prototype.toString = function () { return ""; };

global.location = {
    hostname: "www.zhipin.com",
    host: "www.zhipin.com",
    href: "https://www.zhipin.com/web/common/security-check.html?seed=" + encodeURIComponent(seed) + "&ts=" + ts + "&name=11f5a2fc&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer=",
    protocol: "https:",
    origin: "https://www.zhipin.com",
    pathname: "/web/common/security-check.html",
    search: "?seed=" + encodeURIComponent(seed) + "&ts=" + ts + "&name=11f5a2fc&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer=",
    port: "",
    hash: "",
    ancestorOrigins: {}
};

global.document = {
    location: {},
    cookie: "__a=" + __a + ";__c=" + __c + ";__g=-",
    createElement: function (tag) {
        if (tag === 'canvas') {
            return {
                getContext: function (type) {
                    if (type === "2d") {
                        return { fillRect: function(){}, fillText: function(){}, measureText: function(t){return{width:t.length*6}} };
                    }
                    if (type === "webgl" || type === "experimental-webgl") {
                        return {
                            getParameter: function(p) { var v={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32,37445:'ANGLE',37446:'Google Inc.'}; return v[p]||0; },
                            getExtension: function(n) { if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445}; return {}; },
                            getSupportedExtensions: function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax']; }
                        };
                    }
                    return null;
                },
                toDataURL: function () { return "data:image/png;base64,iVBORw0KGgo="; },
                width: 300, height: 150, style: {}
            };
        }
        if (tag === 'iframe') { return { contentWindow: global }; }
        return { style: {}, appendChild: function(){}, setAttribute: function(){}, getAttribute: function(){return null} };
    },
    getElementById: function () { return null; },
    getElementsByTagName: function () { return { item: function(){return null}, length: 0 }; },
    addEventListener: function(){},
    body: { appendChild: function(){}, style: {}, offsetWidth: 1920 },
    documentElement: { style: {}, appendChild: function(){} },
    head: { appendChild: function(){}, getElementsByTagName: function(){return []} },
    hidden: false,
    visibilityState: "visible",
    readyState: "complete",
    characterSet: "UTF-8",
    title: "BOSS直聘",
    referrer: "",
    domain: "www.zhipin.com",
    all: undefined
};

global.navigator = {
    cookieEnabled: true, language: "zh-CN", languages: ["zh-CN", "zh"],
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    appVersion: "5.0", appCodeName: "Mozilla", appName: "Netscape",
    platform: "Win32", product: "Gecko", productSub: "20030107",
    vendor: "Google Inc.", vendorSub: "", webdriver: false,
    doNotTrack: null, hardwareConcurrency: 32, maxTouchPoints: 0,
    deviceMemory: 32, onLine: true, pdfViewerEnabled: true,
    plugins: { length: 5, item: function(){return null}, namedItem: function(){return null}, refresh: function(){} },
    mimeTypes: { length: 2, item: function(){return null}, namedItem: function(){return null} },
    javaEnabled: function(){return false}, taintEnabled: function(){return false},
};

global.screen = { width: 2195, height: 1235, availWidth: 2195, availHeight: 1187, colorDepth: 32, pixelDepth: 32 };
global.window = global; global.self = global; global.top = global; global.parent = global;
global.innerWidth = 2195; global.innerHeight = 1100;
global.outerWidth = 2195; global.outerHeight = 1187;
global.devicePixelRatio = 1.75; global.screenX = 2195; global.screenY = 0;
global.name = ''; global.closed = false; global.length = 0; global.opener = null;

global.localStorage = { setItem: function(){}, getItem: function(){return null}, key: function(){return null}, removeItem: function(){}, clear: function(){}, length: 0 };
global.sessionStorage = { setItem: function(){}, getItem: function(){return null}, key: function(){return null}, removeItem: function(){}, clear: function(){}, length: 0 };

global.history = { length: 1, pushState: function(){}, replaceState: function(){}, back: function(){}, forward: function(){}, go: function(){} };

var _perfNow = Date.now();
global.performance = {
    now: function() { return Date.now() - _perfNow; },
    memory: { jsHeapSizeLimit: 4294967296, totalJSHeapSize: 41938737, usedJSHeapSize: 34705941 },
    navigation: { type: 0, redirectCount: 0 },
    timing: { navigationStart: _perfNow, fetchStart: _perfNow, domLoading: _perfNow },
    timeOrigin: _perfNow,
    getEntriesByType: function(){return []}
};

global.crypto = {
    getRandomValues: function(a) { for (var i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); return a; },
    subtle: {},
    randomUUID: function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; }
};

global.btoa = function(s) { return Buffer.from(s).toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString('binary'); };
// IMPORTANT: console.log must pass through to our trace capture
global.console = {
    log: function() { console.log.apply(console, arguments); },
    error: function(){}, warn: function(){}, info: function(){}, debug: function(){}
};

// Constructors
global.CSSRuleList = function(){};
global.MutationObserver = function(){ this.observe = function(){}; this.disconnect = function(){}; };
global.XMLHttpRequest = function(){}; global.Event = function(){}; global.Image = function(){};
global.matchMedia = function(){ return { matches: false, media: '' }; };
global.fetch = function(){};
global.getComputedStyle = function(){ return {}; };
global.getSelection = function(){ return null; };
global.addEventListener = function(){};
global.removeEventListener = function(){};
global.dispatchEvent = function(){};
global.postMessage = function(){};

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

global.Intl = {};
global.AbortController = function(){};
global.AbortSignal = function(){};

// Run
try {
    eval(seccode);
} catch(e) {
    console.error = _realConsoleLog;
    _realConsoleLog('Eval error:', e.message, 'at line', e.lineNumber);
    process.exit(1);
}

if (typeof global.ABC === 'undefined') {
    console.error = _realConsoleLog;
    _realConsoleLog('ABC not defined');
    process.exit(1);
}

// Generate token (with timezone offset matching browser: UTC+8 → offset=0)
var tz = 60 * (480 + new Date().getTimezoneOffset()) * 1000;
_realConsoleLog('Timezone offset:', tz, 'ms');
var effectiveTs = parseInt(ts) + tz;
_realConsoleLog('Effective ts:', effectiveTs);

var token = new global.ABC().z(seed, effectiveTs);
_realConsoleLog('Token length:', token.length);
_realConsoleLog('Token prefix:', token.substring(0, 6));

// Save trace
var traceText = traceLines.join('\n');
fs.writeFileSync(outputFile, traceText);
_realConsoleLog('Trace saved:', traceLines.length, 'states →', outputFile);

// Also save token
fs.writeFileSync(__dirname + '/vmp_trace_token.txt', token);
_realConsoleLog('Token saved to vmp_trace_token.txt');

process.stdout.write(token);
