// test_vm_sandbox.js - vm sandbox that completely hides Node.js globals
var vm = require('vm');
var fs = require('fs');

var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

// Build a browser-like sandbox with ONLY browser globals (NO Node.js)
var sandbox = {
    // Standard JS builtins
    Object: Object, Array: Array, Function: Function, String: String,
    Number: Number, Boolean: Boolean, Date: Date, Math: Math,
    RegExp: RegExp, Error: Error, TypeError: TypeError, SyntaxError: SyntaxError,
    ReferenceError: ReferenceError, RangeError: RangeError, URIError: URIError,
    EvalError: EvalError,
    parseInt: parseInt, parseFloat: parseFloat,
    isNaN: isNaN, isFinite: isFinite,
    encodeURIComponent: encodeURIComponent, decodeURIComponent: decodeURIComponent,
    encodeURI: encodeURI, decodeURI: decodeURI,
    JSON: JSON, Promise: Promise, Symbol: Symbol,
    Map: Map, Set: Set, WeakMap: WeakMap, WeakSet: WeakSet,
    Proxy: Proxy, Reflect: Reflect,
    ArrayBuffer: ArrayBuffer, DataView: DataView,
    Uint8Array: Uint8Array, Uint16Array: Uint16Array, Uint32Array: Uint32Array,
    Int8Array: Int8Array, Int16Array: Int16Array, Int32Array: Int32Array,
    Float32Array: Float32Array, Float64Array: Float64Array,
    Uint8ClampedArray: Uint8ClampedArray,
    BigInt: BigInt, BigInt64Array: BigInt64Array, BigUint64Array: BigUint64Array,
    NaN: NaN, Infinity: Infinity, undefined: undefined,

    // Browser globals
    window: undefined, // will be set below
    self: undefined,
    top: undefined,
    parent: undefined,
    navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
        platform: 'Win32', language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
        cookieEnabled: true, webdriver: false,
        appVersion: '5.0 (Windows)',
        hardwareConcurrency: 2, maxTouchPoints: 1,
        vendor: '', vendorSub: '', productSub: '20100101',
        doNotTrack: '1', onLine: true,
        plugins: { length: 5, item: function(){return null}, namedItem: function(){return null}, refresh: function(){} }
    },
    document: {
        cookie: 'ab_guid=test; __a=26709070.1782456825..1782456825.2.1.2.2; __c=1782456825; __g=-',
        createElement: function(t) { if(t==='iframe') return {style:{}, contentWindow: sandbox}; return {style:{}}; },
        body: {appendChild: function(){}},
        documentElement: {appendChild: function(){}},
        getElementsByTagName: function(){return {item:function(){return null}, length:0};},
        hidden: false,
        readyState: 'complete',
        referrer: '', title: 'BOSS直聘',
        visibilityState: 'visible', characterSet: 'UTF-8'
    },
    location: {
        href: 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',
        hostname: 'www.zhipin.com', host: 'www.zhipin.com',
        pathname: '/web/geek/jobs', protocol: 'https:',
        origin: 'https://www.zhipin.com', port: '', search: '?city=101010100&query=python', hash: ''
    },
    screen: {
        width: 1920, height: 1080, availWidth: 1920, availHeight: 1040,
        colorDepth: 24, pixelDepth: 24
    },
    history: {length: 1},
    localStorage: {getItem: function(){return null}, setItem: function(){}, removeItem: function(){}, clear: function(){}, length: 0, key: function(){return null}},
    sessionStorage: {getItem: function(){return null}, setItem: function(){}, removeItem: function(){}, clear: function(){}, length: 0, key: function(){return null}},
    performance: {now: function(){return Date.now()}, timing: {navigationStart: Date.now()}},
    crypto: (function(){
        var c = require('crypto');
        return {
            getRandomValues: function(arr) { var b = c.randomBytes(arr.length); for(var i=0;i<arr.length;i++) arr[i]=b[i]; return arr; },
            subtle: null
        };
    })(),
    console: { log: function(){}, error: function(){}, warn: function(){} },

    // Stub browser APIs
    CSSRuleList: function(){},
    Image: function(){},
    WebSocket: function(){},
    Worker: function(){},
    MutationObserver: function(){ this.observe=function(){}; this.disconnect=function(){}; },
    XMLHttpRequest: function(){},
    Event: function(){}, CustomEvent: function(){},
    MouseEvent: function(){}, KeyboardEvent: function(){},
    InputEvent: function(){}, MessageEvent: function(){},
    ErrorEvent: function(){}, PopStateEvent: function(){},
    FocusEvent: function(){}, HashChangeEvent: function(){},
    ProgressEvent: function(){}, StorageEvent: function(){},
    PointerEvent: function(){}, WheelEvent: function(){},
    UIEvent: function(){}, CompositionEvent: function(){},
    Blob: function(){}, File: function(){}, FileReader: function(){},
    FormData: function(){},
    Node: function(){}, Element: function(){},
    HTMLCollection: function(){},
    NodeList: function(){},
    addEventListener: function(){},
    removeEventListener: function(){},
    dispatchEvent: function(){},
    setTimeout: setTimeout, setInterval: setInterval,
    clearTimeout: clearTimeout, clearInterval: clearInterval,
    btoa: function(s){return Buffer.from(s).toString('base64')},
    atob: function(s){return Buffer.from(s,'base64').toString()},
    eval: function(s){return vm.runInContext(s, vm.createContext(sandbox))},
};

// Set self-references
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.top = sandbox;
sandbox.parent = sandbox;
sandbox.globalThis = sandbox;

var context = vm.createContext(sandbox);
var script = new vm.Script(code);

try {
    script.runInContext(context);
    console.log('ABC type:', typeof sandbox.ABC);
    if (typeof sandbox.ABC !== 'undefined') {
        var token = new sandbox.ABC().z('test_seed_12345', 1782456800000);
        console.log('Token len:', token.length);
        console.log('Token preview:', token.substring(0, 60));
    }
} catch(e) {
    console.log('Error:', e.message);
    console.log('Stack:', e.stack && e.stack.substring(0, 300));
}
