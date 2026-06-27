/**
 * sign_boss_v16.js — 社区参考方案（chencchen/webcrawler 4reverse.js）
 *
 * 关键修复：
 *   1. Function.prototype.toString = function(){ return ""; } （空字符串！）
 *   2. 环境直接挂在 global（非 vm.createContext）
 *   3. global = undefined, process.argv = undefined
 *   4. OfflineAudioContext 音频指纹
 *   5. window.eval = eval（调用宿主 eval）
 */
var fs = require('fs');
var seed = process.argv[2] || 'test';
var ts = parseInt(process.argv[3] || '1700000000000');
var __a = process.argv[4] || '0', __c = process.argv[5] || '0';

var seccode = fs.readFileSync(__dirname + '/config/security-11f5a2fc.js', 'utf8');

// ===== 1. Function.prototype.toString 返回空 =====
Function.prototype.toString = function () { return ""; };

// ===== 2. 构建浏览器环境（直接挂在 global） =====
global.location = {
    hostname: "www.zhipin.com",
    href: "https://www.zhipin.com/web/common/security-check.html?seed=" + encodeURIComponent(seed) + "&ts=" + ts + "&name=11f5a2fc&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer="
};

global.document = {
    location: {},
    cookie: "__a=" + __a + ";__c=" + __c + ";__g=-",
    createElement: function (tag) {
        if (tag === 'canvas') {
            return {
                getContext: function (type) {
                    if (type === "2d") {
                        return { fillRect: function(){}, fillText: function(){} };
                    }
                    if (type === 'webgl' || type === 'experimental-webgl') {
                        return {
                            getParameter: function(p) { return 0; },
                            getExtension: function() { return {}; },
                            getSupportedExtensions: function() { return []; }
                        };
                    }
                    return null;
                },
                toDataURL: function () { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; }
            };
        }
        return {};
    },
    getElementById: function () { return null; },
    getElementsByTagName: function () { return { item: function(){return null}, length: 0 }; },
    addEventListener: function(){},
    body: { appendChild: function(){}, style: {} },
    documentElement: { style: {} },
    head: { appendChild: function(){} }
};

global.navigator = {
    cookieEnabled: true,
    language: "zh-CN",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    webdriver: false,
    appVersion: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    platform: "Win32",
    plugins: { length: 5, item: function(){return null}, namedItem: function(){return null}, refresh: function(){} },
    mimeTypes: { length: 2, item: function(){return null}, namedItem: function(){return null} },
    hardwareConcurrency: 32,
    deviceMemory: 32,
    vendor: "Google Inc.",
    maxTouchPoints: 0,
    doNotTrack: null,
    onLine: true,
    webkitTemporaryStorage: {},
};

var localStorageObj = {};
global.localStorage = {
    setItem: function (a, b) { localStorageObj[a] = b; },
    getItem: function (a) { return localStorageObj[a] || null; },
    key: function() { return null; },
    length: 0
};
global.sessionStorage = {
    setItem: function(){}, getItem: function(){return null}, key: function(){return null}, length: 0
};

global.window = global;
global.self = global;
global.top = global;
global.parent = global;

global.innerWidth = 2195; global.innerHeight = 1100;
global.outerWidth = 2195; global.outerHeight = 1187;
global.devicePixelRatio = 1.75;
global.screenX = 2195; global.screenY = 0;
global.screen = {
    width: 2195, height: 1235, availWidth: 2195, availHeight: 1187,
    colorDepth: 32, pixelDepth: 32
};
global.history = { length: 1, scrollRestoration: "auto", state: null };
global.performance = {
    now: function() { return Date.now(); },
    memory: {},
    navigation: { type: 0 },
    timing: { navigationStart: Date.now() }
};
global.crypto = {
    getRandomValues: function(a) { for (var i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); return a; },
    subtle: {}
};
global.btoa = function(s) { return Buffer.from(s).toString('base64'); };
global.atob = function(s) { return Buffer.from(s, 'base64').toString(); };

// OfflineAudioContext fingerprint
global.OfflineAudioContext = function () {
    return {
        createOscillator: function () {
            return { frequency: { setValueAtTime: function(){} } };
        },
        createDynamicsCompressor: function(){}
    };
};

global.CSSRuleList = function(){};
global.console = { log: function(){}, error: function(){}, warn: function(){}, info: function(){} };
global.MutationObserver = function(){ this.observe = function(){}; this.disconnect = function(){}; };
global.XMLHttpRequest = function(){};
global.matchMedia = function(){ return { matches: false }; };
global.fetch = function(){};
global.Intl = {};
global.AbortController = function(){};
global.AbortSignal = function(){};

// ===== 3. 隐藏 Node.js =====
// Node.js 24+ 没有 global.process 等，跳过

// ===== 4. Copy window to global =====
global.window = global;

// ===== 5. Execute security JS =====
try {
    eval(seccode);
} catch(e) {
    process.stderr.write('Eval error: ' + e.message + '\n');
    process.exit(1);
}

if (typeof global.ABC === 'undefined') {
    process.stderr.write('ABC not defined\n');
    process.exit(1);
}

// ===== 6. Generate token =====
var tz = 60 * (480 + new Date().getTimezoneOffset()) * 1000;
var token = new global.ABC().z(seed, parseInt(ts) + tz);
process.stdout.write(token);
