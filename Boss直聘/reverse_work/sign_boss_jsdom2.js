/**
 * v2: jsdom prototype chain + v12 环境值 + canvas stub
 */
var { JSDOM } = require('jsdom');
var fs = require('fs');
var crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var seed = process.argv[2] || 'test_seed_44_chars_long_abcde12345678';
var ts = parseInt(process.argv[3] || '1700000000000');

var dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'https://www.zhipin.com',
    pretendToBeVisual: true,
});

var win = dom.window;

// === Canvas stub before any code runs ===
win.HTMLCanvasElement = function() {};
win.HTMLCanvasElement.prototype = Object.create(win.HTMLElement.prototype);
win.HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl') {
        return {
            getParameter: function(p) {
                var vals = { 7936: 'WebKit', 7937: 'WebKit WebGL', 3379: 16384, 34921: 16, 35661: 32 };
                return vals[p] || 0;
            },
            getExtension: function(n) {
                if (n === 'WEBGL_debug_renderer_info') return { UNMASKED_VENDOR_WEBGL: 37446, UNMASKED_RENDERER_WEBGL: 37445 };
                return {};
            },
            getSupportedExtensions: function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax']; },
        };
    }
    if (type === '2d') return { font: '10px sans-serif', measureText: function(t) { return {width: t.length*6}; } };
    return null;
};
win.HTMLCanvasElement.prototype.width = 300;
win.HTMLCanvasElement.prototype.height = 150;

// Patch document.createElement to handle canvas and iframe
var origCE = win.document.createElement.bind(win.document);
win.document.createElement = function(tag) {
    if (tag === 'canvas') {
        var c = new win.HTMLCanvasElement();
        c.style = {};
        return c;
    }
    if (tag === 'iframe') {
        var f = origCE('iframe');
        f.contentWindow = win;
        return f;
    }
    return origCE(tag);
};

// === Navigator: use jsdom's native navigator but override key values ===
var nav = win.navigator;
// Override via prototype getters
var NP = Object.getPrototypeOf(nav);
try {
    Object.defineProperty(NP, 'userAgent', {get: function(){return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'platform', {get: function(){return 'Win32'}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'language', {get: function(){return 'zh-CN'}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'languages', {get: function(){return ['zh-CN','zh']}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'hardwareConcurrency', {get: function(){return 32}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'deviceMemory', {get: function(){return 32}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'vendor', {get: function(){return 'Google Inc.'}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'webdriver', {get: function(){return false}, configurable:true, enumerable:true});
    Object.defineProperty(NP, 'doNotTrack', {get: function(){return null}, configurable:true, enumerable:true});
} catch(e) {}

// Set more values on the navigator instance directly
nav.cookieEnabled = true;
nav.onLine = true;
nav.maxTouchPoints = 0;
nav.productSub = '20030107';
nav.appCodeName = 'Mozilla';
nav.appName = 'Netscape';
nav.product = 'Gecko';
nav.webkitTemporaryStorage = {};

// === Crypto ===
var subtle = {};
['decrypt','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey','deriveBits'].forEach(function(m) { subtle[m] = function(){}; });
win.crypto = {
    getRandomValues: function(arr) { var b = crypto.randomBytes(arr.length); for (var i=0; i<arr.length; i++) arr[i] = b[i]; return arr; },
    randomUUID: function() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; },
};
Object.defineProperty(win.crypto, 'subtle', {get: function(){return subtle}, configurable:true});

// === Performance ===
win.performance = win.performance || {};
win.performance.now = function() { return Date.now(); };
win.performance.memory = {};
win.performance.navigation = { type: 0 };
win.performance.timing = {
    navigationStart: Date.now(), fetchStart: Date.now(), domainLookupStart: Date.now(),
    domainLookupEnd: Date.now(), connectStart: Date.now(), connectEnd: Date.now(),
    requestStart: Date.now(), responseStart: Date.now(), responseEnd: Date.now(),
    domLoading: Date.now(), domInteractive: Date.now(), domContentLoadedEventStart: Date.now(),
    domContentLoadedEventEnd: Date.now(), domComplete: Date.now(), loadEventStart: Date.now(),
    loadEventEnd: Date.now()
};

// === Screen ===
var scr = win.screen || {};
scr.width = 2195; scr.height = 1235;
scr.availWidth = 2195; scr.availHeight = 1187;
scr.colorDepth = 32; scr.pixelDepth = 32;

// === localStorage ===
win.localStorage = win.localStorage || {};
win.localStorage.getItem = function(k) { return null; };
win.localStorage.setItem = function() {};
win.localStorage.key = function(n) { return null; };
win.localStorage.length = 0;
win.sessionStorage = Object.assign({}, win.localStorage);

// === Base64 ===
win.btoa = function(s) { return Buffer.from(s).toString('base64'); };
win.atob = function(s) { return Buffer.from(s, 'base64').toString(); };

// === Window props ===
win.innerWidth = 2195; win.innerHeight = 1100;
win.outerWidth = 2195; win.outerHeight = 1187;
win.devicePixelRatio = 1.75;
win.screenX = 2195; win.screenY = 0;

// === CSSRuleList ===
win.CSSRuleList = function() {};

// === Suppress noise ===
win.console.log = function(){};
win.console.error = function(){};
win.console.warn = function(){};

// === Location ===
// kk.py sets location.search with seed and ts
win.location.search = '?seed=' + encodeURIComponent(seed) + '&ts=' + ts + '&name=7c91433f';
win.location.href = 'https://www.zhipin.com/web/common/security-check.html' + win.location.search;
win.location.hostname = 'www.zhipin.com';
win.location.host = 'www.zhipin.com';
win.location.protocol = 'https:';
win.location.origin = 'https://www.zhipin.com';
win.location.pathname = '/web/common/security-check.html';

// === Execute security JS in jsdom context ===
try {
    win.eval(code);
} catch(e) {
    process.stderr.write('Eval error: ' + e.message + '\n');
    process.exit(1);
}

if (typeof win.ABC === 'undefined') {
    process.stderr.write('ABC not defined\n');
    process.exit(1);
}

var timezoneOffset = 60 * (480 + new Date().getTimezoneOffset()) * 1000;
var computedTs = parseInt(ts) + timezoneOffset;

var token = new win.ABC().z(seed, computedTs);

process.stdout.write(encodeURIComponent(token));
