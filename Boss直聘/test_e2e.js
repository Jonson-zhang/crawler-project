/**
 * Boss直聘 E2E 测试：生成 token → 发 API 请求
 * 用法: node test_e2e.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// Build browser sandbox
var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math,
    RegExp, Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, setTimeout, setInterval, clearTimeout, clearInterval,
    Proxy, Reflect, // needed for some JS constructs
};

// Browser globals
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = { log: function(){}, error: function(){}, warn: function(){} };
sandbox.navigator = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    platform: 'Win32', language: 'zh-CN', languages: ['zh-CN', 'zh'],
    cookieEnabled: true, webdriver: false, hardwareConcurrency: 2, maxTouchPoints: 1,
    vendor: '', vendorSub: '', productSub: '20100101', doNotTrack: '1', onLine: true,
    plugins: { length: 5, item: function(){return null}, namedItem: function(){return null}, refresh: function(){} },
    appVersion: '5.0 (Windows)', mimeTypes: { length: 4, item: function(){return null}, namedItem: function(){return null} }
};
sandbox.document = {
    cookie: 'ab_guid=test; __a=' + (process.argv[2] || '0') + '; __c=' + (process.argv[3] || '0') + '; __g=-',
    createElement: function(t) { return t === 'iframe' ? { style: {}, contentWindow: sandbox } : { style: {} }; },
    body: { appendChild: function(){} }, documentElement: { appendChild: function(){} },
    getElementsByTagName: function(){ return { item: function(){return null}, length: 0 }; },
    hidden: false, readyState: 'complete', referrer: '', title: 'BOSS直聘',
    visibilityState: 'visible', characterSet: 'UTF-8'
};
sandbox.location = {
    href: 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',
    hostname: 'www.zhipin.com', host: 'www.zhipin.com', pathname: '/web/geek/jobs',
    protocol: 'https:', origin: 'https://www.zhipin.com', port: '', search: '', hash: ''
};
sandbox.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 };
sandbox.history = { length: 1, pushState: function(){}, replaceState: function(){} };
sandbox.localStorage = { getItem: function(){return null}, setItem: function(){}, removeItem: function(){}, clear: function(){}, length: 0, key: function(){return null} };
sandbox.sessionStorage = { getItem: function(){return null}, setItem: function(){}, removeItem: function(){}, clear: function(){}, length: 0, key: function(){return null} };
sandbox.performance = { now: function(){return Date.now()}, timing: {navigationStart: Date.now()} };
sandbox.crypto = (function(){ var c = require('crypto'); return { getRandomValues: function(arr) { var b = c.randomBytes(arr.length); for(var i=0;i<arr.length;i++) arr[i]=b[i]; return arr; }, subtle: null }; })();
sandbox.eval = function(s) { return vm.runInContext(s, vm.createContext(sandbox)); };
sandbox.btoa = function(s) { return Buffer.from(s).toString('base64'); };
sandbox.atob = function(s) { return Buffer.from(s, 'base64').toString(); };
sandbox.XMLHttpRequest = function(){};
sandbox.addEventListener = function(){};
sandbox.Image = function(){};
sandbox.MutationObserver = function(){ this.observe=function(){}; this.disconnect=function(){}; };

var context = vm.createContext(sandbox);
var script = new vm.Script(code);

try {
    script.runInContext(context);
    if (typeof sandbox.ABC !== 'undefined') {
        var seed = process.argv[4];
        var ts = parseInt(process.argv[5]);
        var token = new sandbox.ABC().z(seed, ts);
        console.log(token);
    } else {
        console.error('ABC not defined');
        process.exit(1);
    }
} catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
}
