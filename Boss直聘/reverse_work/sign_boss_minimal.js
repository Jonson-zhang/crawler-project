/**
 * sign_boss_minimal.js — Community-style minimal environment
 * Based on chencchen/webcrawler 4reverse.js approach
 *
 * Usage: node sign_boss_minimal.js <seed> <ts>
 */
var fs = require('fs');
var seed = process.argv[2] || 'test123';
var ts = parseInt(process.argv[3] || '1700000000000');
var seccode = fs.readFileSync(__dirname + '/config/security-11f5a2fc.js', 'utf8');

// Community's 4reverse.js-style minimal env
Function.prototype.toString = function () { return ""; };

global.location = {
    hostname: "www.zhipin.com",
    host: "www.zhipin.com",
    href: "https://www.zhipin.com/web/common/security-check.html?seed=" + encodeURIComponent(seed) + "&ts=" + ts + "&name=11f5a2fc&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer=",
    protocol: "https:",
    origin: "https://www.zhipin.com",
    pathname: "/web/common/security-check.html",
    search: "?seed=" + encodeURIComponent(seed) + "&ts=" + ts + "&name=11f5a2fc",
    port: "",
    hash: ""
};

global.document = {
    location: {},
    cookie: "",
    createElement: function (tag) {
        if (tag === 'canvas') {
            return {
                getContext: function () { return null; },
                toDataURL: function () { return "data:image/png;base64,"; },
                width: 300, height: 150
            };
        }
        return {};
    },
    getElementById: function () { return null; },
    getElementsByTagName: function () { return []; },
    addEventListener: function () { },
    body: {},
    head: {},
    documentElement: {},
    hidden: false,
    visibilityState: "visible",
    readyState: "complete",
    characterSet: "UTF-8",
    title: ""
};

global.navigator = {
    cookieEnabled: true,
    language: "zh-CN",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    appVersion: "5.0",
    platform: "Win32",
    plugins: { length: 5 },
    mimeTypes: { length: 2 },
    webdriver: false,
    hardwareConcurrency: 16,
    deviceMemory: 8,
    vendor: "",
    maxTouchPoints: 0,
    doNotTrack: "1",
    onLine: true
};

global.screen = { width: 1920, height: 1080, colorDepth: 24, pixelDepth: 24 };
global.window = global;
global.self = global;
global.top = global;
global.parent = global;
global.innerWidth = 1920;
global.innerHeight = 976;
global.outerWidth = 1920;
global.outerHeight = 1037;
global.devicePixelRatio = 1;
global.screenX = 0;
global.screenY = 0;
global.name = '';
global.closed = false;
global.length = 0;

global.localStorage = {
    setItem: function () { },
    getItem: function () { return null; },
    key: function () { return null; },
    removeItem: function () { },
    clear: function () { },
    length: 0
};

global.sessionStorage = {
    setItem: function () { },
    getItem: function () { return null; },
    key: function () { return null; },
    removeItem: function () { },
    clear: function () { },
    length: 0
};

global.history = { length: 1, pushState: function () { }, replaceState: function () { } };

var _perfNow = Date.now();
global.performance = {
    now: function () { return Date.now() - _perfNow; },
    memory: {
        jsHeapSizeLimit: 4294967296,
        totalJSHeapSize: 41938737,
        usedJSHeapSize: 34705941
    },
    navigation: { type: 0, redirectCount: 0 },
    timing: {
        navigationStart: _perfNow,
        fetchStart: _perfNow,
        domainLookupStart: _perfNow,
        domainLookupEnd: _perfNow,
        connectStart: _perfNow,
        connectEnd: _perfNow,
        requestStart: _perfNow,
        responseStart: _perfNow,
        responseEnd: _perfNow,
        domLoading: _perfNow,
        domInteractive: _perfNow,
        domContentLoadedEventStart: _perfNow,
        domContentLoadedEventEnd: _perfNow,
        domComplete: _perfNow,
        loadEventStart: _perfNow,
        loadEventEnd: _perfNow
    },
    timeOrigin: _perfNow,
    getEntriesByType: function () { return []; }
};

global.crypto = {
    getRandomValues: function (a) {
        for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
        return a;
    },
    subtle: {},
    randomUUID: function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    }
};

global.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };
global.atob = function (s) { return Buffer.from(s, 'base64').toString('binary'); };

global.console = {
    log: function () { },
    error: function () { },
    warn: function () { },
    info: function () { }
};

global.CSSRuleList = function () { };
global.MutationObserver = function () { this.observe = function () { }; this.disconnect = function () { }; };
global.XMLHttpRequest = function () { };
global.Event = function () { };
global.Image = function () { };
global.matchMedia = function () { return { matches: false }; };
global.fetch = function () { };
global.getComputedStyle = function () { return {}; };
global.getSelection = function () { return null; };
global.addEventListener = function () { };
global.removeEventListener = function () { };
global.dispatchEvent = function () { };
global.postMessage = function () { };

global.OfflineAudioContext = function () {
    return {
        createOscillator: function () {
            return {
                frequency: { setValueAtTime: function () { } },
                type: "sine",
                start: function () { },
                stop: function () { },
                connect: function () { }
            };
        },
        createDynamicsCompressor: function () { return { connect: function () { } }; },
        createGain: function () {
            return {
                connect: function () { },
                gain: { setValueAtTime: function () { }, value: 0 }
            };
        },
        destination: {},
        startRendering: function () {
            return { then: function (f) { f(""); } };
        },
        sampleRate: 44100
    };
};

global.Intl = {};
global.AbortController = function () { };
global.AbortSignal = function () { };

global.requestAnimationFrame = function () { };
global.setTimeout = setTimeout;
global.setInterval = setInterval;
global.clearTimeout = clearTimeout;
global.clearInterval = clearInterval;

global.unescape = decodeURIComponent;
global.escape = encodeURIComponent;
global.decodeURIComponent = decodeURIComponent;
global.encodeURIComponent = encodeURIComponent;

global.eval = eval;

// ===== Execute =====
try {
    eval(seccode);
} catch (e) {
    process.stderr.write('Eval error: ' + e.message + '\n');
    process.exit(1);
}

if (typeof global.ABC === 'undefined') {
    process.stderr.write('ABC not defined after eval\n');
    process.exit(1);
}

var token = new global.ABC().z(seed, ts);
process.stderr.write('Token len: ' + token.length + '\n');
process.stderr.write('Prefix: ' + token.substring(0, 20) + '\n');
process.stdout.write(token);
