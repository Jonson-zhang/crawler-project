/**
 * sign_boss_determ.js — Deterministic token generation
 *
 * 关键假设：固定 Math.random 和 Date.now 可以消除 VMP 分支的不确定性
 * 如果两次运行产生完全相同的 token → 确定性达成
 * 如果 token 与浏览器一致 → code=0
 */
var fs = require('fs');
var seed = process.argv[2] || 'test';
var ts = parseInt(process.argv[3] || '1700000000000');
var seccode = fs.readFileSync(__dirname + '/config/security-11f5a2fc.js', 'utf8');

// ===== FIX Math.random (seeded PRNG) =====
var _randomSeed = 42;
var _origRandom = Math.random;
Math.random = function () {
    _randomSeed = (_randomSeed * 16807 + 0) % 2147483647;
    return (_randomSeed - 1) / 2147483646;
};

// ===== FIX Date.now() =====
var _timeBase = ts;
var _timeCounter = 0;
var _origNow = Date.now;
Date.now = function () { return _timeBase + (_timeCounter++); };

// ===== ENV =====
Function.prototype.toString = function () { return ''; };

global.location = {
    hostname: 'www.zhipin.com',
    host: 'www.zhipin.com',
    href: 'https://www.zhipin.com/web/common/security-check.html?seed=' + encodeURIComponent(seed) + '&ts=' + ts + '&name=11f5a2fc',
    protocol: 'https:', origin: 'https://www.zhipin.com',
    pathname: '/web/common/security-check.html',
    search: '?seed=' + encodeURIComponent(seed) + '&ts=' + ts + '&name=11f5a2fc',
    port: '', hash: ''
};

global.document = {
    location: {}, cookie: '',
    createElement: function (tag) {
        if (tag === 'canvas') return { getContext: function () { return null; }, toDataURL: function () { return 'data:image/png;base64,'; }, width: 300, height: 150 };
        if (tag === 'iframe') return { contentWindow: global };
        return { style: {}, appendChild: function () { } };
    },
    getElementById: function () { return null; },
    getElementsByTagName: function () { return { item: function () { return null; }, length: 0 }; },
    addEventListener: function () { }, body: {}, head: {}, documentElement: {},
    hidden: false, visibilityState: 'visible', readyState: 'complete', characterSet: 'UTF-8',
    title: '', all: undefined
};

global.navigator = {
    cookieEnabled: true, language: 'zh-CN', languages: ['zh-CN', 'zh'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    platform: 'Win32', vendor: 'Google Inc.', vendorSub: '',
    plugins: { length: 5, item: function () { return null; }, namedItem: function () { return null; }, refresh: function () { } },
    mimeTypes: { length: 2, item: function () { return null; }, namedItem: function () { return null; } },
    webdriver: false, hardwareConcurrency: 16, maxTouchPoints: 0,
    deviceMemory: 8, doNotTrack: null, onLine: true
};

global.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 };
global.window = global; global.self = global; global.top = global; global.parent = global;
global.innerWidth = 1920; global.innerHeight = 955;
global.outerWidth = 1920; global.outerHeight = 1040;
global.devicePixelRatio = 1; global.screenX = 0; global.screenY = 0;

var _ls = {};
global.localStorage = {
    setItem: function (a, b) { _ls[a] = b; },
    getItem: function (a) { return _ls[a] || null; },
    key: function () { return null; }, length: 0
};
global.sessionStorage = { setItem: function () { }, getItem: function () { return null; }, length: 0 };
global.history = { length: 1 };

var _perfBase = ts;
global.performance = {
    now: function () { return Date.now() - _perfBase; },
    memory: { jsHeapSizeLimit: 4294967296, totalJSHeapSize: 41938737, usedJSHeapSize: 34705941 },
    navigation: { type: 0, redirectCount: 0 },
    timing: { navigationStart: ts, fetchStart: ts, domLoading: ts, domComplete: ts },
    timeOrigin: ts,
    getEntriesByType: function () { return []; }
};

global.crypto = {
    getRandomValues: function (a) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; },
    subtle: {},
    randomUUID: function () { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; }
};

global.btoa = function (s) { return Buffer.from(s, 'binary').toString('base64'); };
global.atob = function (s) { return Buffer.from(s, 'base64').toString('binary'); };
global.console = { log: function () { }, error: function () { }, warn: function () { } };
global.MutationObserver = function () { this.observe = function () { }; };
global.XMLHttpRequest = function () { }; global.Event = function () { }; global.Image = function () { };
global.matchMedia = function () { return { matches: false }; }; global.fetch = function () { };
global.Intl = {}; global.AbortController = function () { }; global.AbortSignal = function () { };
global.addEventListener = function () { }; global.removeEventListener = function () { };
global.getComputedStyle = function () { return {}; }; global.getSelection = function () { return null; };
global.OfflineAudioContext = function () {
    return {
        createOscillator: function () { return { frequency: { setValueAtTime: function () { } }, type: 'sine', start: function () { }, stop: function () { }, connect: function () { } }; },
        createDynamicsCompressor: function () { return { connect: function () { } }; },
        createGain: function () { return { connect: function () { }, gain: { setValueAtTime: function () { }, value: 0 } }; },
        destination: {},
        startRendering: function () { return { then: function (f) { f(''); } }; },
        sampleRate: 44100
    };
};
global.eval = eval;

// ===== Run =====
var _origConsole = console;
try { eval(seccode); } catch (e) { process.stderr.write('Eval error: ' + e.message + '\n'); process.exit(1); }
if (typeof ABC === 'undefined') { process.stderr.write('ABC not defined\n'); process.exit(1); }

// Run twice to test determinism
_randomSeed = 42; _timeCounter = 0;
var t1 = new ABC().z(seed, ts);

_randomSeed = 42; _timeCounter = 0;
var t2 = new ABC().z(seed, ts);

process.stderr.write('Run1: len=' + t1.length + ' prefix=' + t1.substring(0, 20) + '\n');
process.stderr.write('Run2: len=' + t2.length + ' prefix=' + t2.substring(0, 20) + '\n');
process.stderr.write('IDENTICAL: ' + (t1 === t2 ? 'YES ✅' : 'NO ❌') + '\n');

if (t1 === t2) {
    process.stderr.write('\n=== Token is DETERMINISTIC ===\n');
} else {
    process.stderr.write('\n=== Token is NON-DETERMINISTIC ===\n');
}

process.stdout.write(t1);
