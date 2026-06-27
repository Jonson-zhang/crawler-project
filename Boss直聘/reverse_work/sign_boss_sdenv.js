/**
 * sign_boss_sdenv.js — sdenv-jsdom Token 生成
 */
var fs = require('fs');
var { JSDOM, VirtualConsole } = require('./config/node_modules/sdenv-jsdom');

var seed = process.argv[2] || 'test';
var ts = parseInt(process.argv[3] || '1700000000000');
var seccode = fs.readFileSync(__dirname + '/config/security-11f5a2fc.js', 'utf8');

var vc = new VirtualConsole();
var dom = new JSDOM(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BOSS直聘</title></head><body></body></html>',
    {
        url: 'https://www.zhipin.com/web/common/security-check.html?seed='
            + encodeURIComponent(seed) + '&ts=' + ts + '&name=11f5a2fc',
        referrer: 'https://www.zhipin.com/',
        contentType: 'text/html',
        virtualConsole: vc,
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
    }
);

var win = dom.window;

// ===== Minimal overrides =====
// Only patch what's explicitly different from a real browser

function patch(obj, prop, getter) {
    try {
        Object.defineProperty(obj, prop, {
            get: getter, configurable: true, enumerable: true,
        });
    } catch (e) {
        // sdenv proxy may reject — skip
    }
}

// Navigator
var NP = win.Navigator.prototype;
patch(NP, 'userAgent', function () { return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'; });
patch(NP, 'platform', function () { return 'Win32'; });
patch(NP, 'language', function () { return 'zh-CN'; });
patch(NP, 'languages', function () { return ['zh-CN', 'zh']; });
patch(NP, 'hardwareConcurrency', function () { return 16; });
patch(NP, 'vendor', function () { return 'Google Inc.'; });
patch(NP, 'webdriver', function () { return false; });
patch(NP, 'doNotTrack', function () { return null; });
patch(NP, 'onLine', function () { return true; });
patch(NP, 'maxTouchPoints', function () { return 0; });
patch(NP, 'cookieEnabled', function () { return true; });
patch(NP, 'deviceMemory', function () { return 8; });

// Screen
var SP = win.Screen.prototype;
patch(SP, 'width', function () { return 1920; });
patch(SP, 'height', function () { return 1080; });
patch(SP, 'availWidth', function () { return 1920; });
patch(SP, 'availHeight', function () { return 1040; });
patch(SP, 'colorDepth', function () { return 24; });
patch(SP, 'pixelDepth', function () { return 24; });

// Window
patch(win, 'innerWidth', function () { return 1920; });
patch(win, 'innerHeight', function () { return 955; });
patch(win, 'outerWidth', function () { return 1920; });
patch(win, 'outerHeight', function () { return 1040; });
patch(win, 'devicePixelRatio', function () { return 1; });
patch(win, 'screenX', function () { return 0; });
patch(win, 'screenY', function () { return 0; });

// Document
var DP = win.HTMLDocument.prototype;
patch(DP, 'readyState', function () { return 'complete'; });
patch(DP, 'characterSet', function () { return 'UTF-8'; });
patch(DP, 'hidden', function () { return false; });
patch(DP, 'visibilityState', function () { return 'visible'; });

// Performance
win.performance = win.performance || {};
win.performance.now = function () { return Date.now(); };
win.performance.memory = { jsHeapSizeLimit: 4294967296, totalJSHeapSize: 41938737, usedJSHeapSize: 34705941 };
win.performance.navigation = { type: 0, redirectCount: 0 };
win.performance.timeOrigin = Date.now();
win.performance.timing = { navigationStart: Date.now(), fetchStart: Date.now(), domLoading: Date.now(), domComplete: Date.now() };
win.performance.getEntriesByType = function () { return []; };

// Crypto
try { win.crypto.getRandomValues = function (a) { for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; }; } catch (e) { }

// OfflineAudioContext (sdenv may already have this)
if (!win.OfflineAudioContext) {
    win.OfflineAudioContext = function () {
        return { createOscillator: function () { return { frequency: { setValueAtTime: function () { } }, type: 'sine', start: function () { }, stop: function () { }, connect: function () { } }; }, createDynamicsCompressor: function () { return { connect: function () { } }; }, createGain: function () { return { connect: function () { }, gain: { setValueAtTime: function () { }, value: 0 } }; }, destination: {}, startRendering: function () { return { then: function (f) { f(''); } }; }, sampleRate: 44100 };
    };
}

// History
if (win.history) {
    win.history.pushState = win.history.pushState || function () { };
    win.history.replaceState = win.history.replaceState || function () { };
}

// ===== Run security JS =====
var errors = [];
vc.on('jsdomError', function (e) { errors.push(e.message); });

try {
    // load via eval
    // seccode loaded
    win.eval(seccode);
} catch (e) {
    process.stderr.write('Script eval error: ' + e.message + '\n');
    process.exit(1);
}

if (errors.length > 0) {
    process.stderr.write('JS errors: ' + errors.slice(0, 5).join(' | ') + '\n');
}

// Check ABC
var ABC = win.ABC || win.window.ABC || win.globalThis.ABC;
if (typeof ABC === 'undefined') {
    // Check all possible locations
    process.stderr.write('ABC not found. Checking scope...\n');
    var found = [];
    for (var k in win) {
        try { if (typeof win[k] === 'function' && k.length <= 3) found.push(k); } catch (e) { }
    }
    process.stderr.write('Short function names: ' + found.join(',') + '\n');
    process.exit(1);
}

// Generate token
try {
    var token = new ABC().z(seed, ts);
    process.stderr.write('Token len: ' + token.length + '\n');
    process.stderr.write('Prefix: ' + token.substring(0, 20) + '\n');
    process.stdout.write(token);
} catch (e) {
    process.stderr.write('Token gen error: ' + e.message + '\n');
    process.exit(1);
}
