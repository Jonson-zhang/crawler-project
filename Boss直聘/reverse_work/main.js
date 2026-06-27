/**
 * Boss直聘 __zp_stoken__ 离线签名工具
 * 用法: node main.js
 *
 * 完整流程: 获取 seed → 生成 token → API 请求
 * 安全 JS 文件名由 API 返回的 name 字段动态指定，支持每天自动更换
 */
var https = require('https');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

// ===== 参数 =====
var API = '/wapi/zpgeek/search/joblist.json';
var HOST = 'www.zhipin.com';
var CITY = '101010100';
var QUERY = 'python';
var SECURITY_JS_DIR = __dirname + '/config';

// ===== 步骤 1: 获取基础 Cookie =====
function generateBaseCookies() {
    var ts_sec = Math.floor(Date.now() / 1000);
    var sid = String(ts_sec).slice(-8) + String(Date.now() % 100000000).padStart(8, '0');
    var __a = sid + '.' + ts_sec + '..' + ts_sec + '.2.1.2.2';
    return { __a: __a, __c: String(ts_sec) };
}

// ===== 步骤 2: 请求 API 获取 seed =====
function getSeed(cookies, callback) {
    var ts = Date.now();
    var options = {
        hostname: HOST, path: API + '?city=' + CITY + '&query=' + QUERY + '&page=1&_=' + ts,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://' + HOST + '/web/geek/jobs?city=' + CITY + '&query=' + QUERY,
            'Cookie': '__a=' + cookies.__a + '; __c=' + cookies.__c + '; __g=-',
        },
    };
    https.get(options, function(res) {
        var body = '';
        res.on('data', function(d) { body += d; });
        res.on('end', function() {
            try {
                var data = JSON.parse(body);
                var zp = data.zpData || {};
                callback(null, { seed: zp.seed, ts: zp.ts, name: zp.name });
            } catch(e) { callback(e); }
        });
    }).on('error', callback);
}

// ===== 下载/缓存安全 JS =====
function loadSecurityJS(name, callback) {
    var filePath = SECURITY_JS_DIR + '/security-' + name + '.js';
    if (fs.existsSync(filePath)) {
        fs.readFile(filePath, 'utf8', callback);
        return;
    }
    // 下载
    var req = https.get('https://' + HOST + '/web/common/security-js/' + name + '.js', function(res) {
        var body = '';
        res.on('data', function(d) { body += d; });
        res.on('end', function() {
            fs.writeFileSync(filePath, body);
            callback(null, body);
        });
    });
    req.on('error', callback);
}

// ===== __zp_stoken__ 生成器（Function 构造器创建纯净浏览器环境） =====
function generateStoken(__a, __c, securityCode, seed, ts) {
    // 这个函数体在一个独立的 Function 作用域中执行
    // 没有 Node.js 全局污染
    var fnBody = String(function runInBrowser(__a, __c, seed, ts, code, crb) {
        // ──── 以下代码在纯浏览器环境运行 ────
        var mm = new Map();
        var rt = Function.prototype.toString;
        Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
        function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
        function mf(n) { var f = function() {}; sn(f, n); return f; }
        function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
        var ST = Symbol.toStringTag;

        function EvtTgt() { } sn(EvtTgt, 'EventTarget');
        function Navigator_() { } Navigator_.prototype = Object.create(EvtTgt.prototype); Navigator_.prototype[ST] = 'Navigator'; sn(Navigator_, 'Navigator');
        function Document_() { } Document_.prototype = Object.create(EvtTgt.prototype); Document_.prototype[ST] = 'HTMLDocument'; sn(Document_, 'Document');
        function HTMLEl() { } HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype.offsetWidth = 1280; HTMLEl.prototype.style = {}; HTMLEl.prototype.appendChild = mf('appendChild'); HTMLEl.prototype.setAttribute = mf('setAttribute'); HTMLEl.prototype.getAttribute = function () { return null; }; sn(HTMLEl.prototype.getAttribute, 'getAttribute'); HTMLEl.prototype.getBoundingClientRect = function () { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }; }; sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect'); HTMLEl.prototype[ST] = 'HTMLElement'; sn(HTMLEl, 'HTMLElement');
        function HTMLHtmlEl() { } HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype); HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement'; sn(HTMLHtmlEl, 'HTMLHtmlElement');
        function HTMLBodyEl() { } HTMLBodyEl.prototype = Object.create(HTMLEl.prototype); HTMLBodyEl.prototype[ST] = 'HTMLBodyElement'; sn(HTMLBodyEl, 'HTMLBodyElement');
        function HTMLHeadEl() { } HTMLHeadEl.prototype = Object.create(HTMLEl.prototype); HTMLHeadEl.prototype[ST] = 'HTMLHeadElement'; sn(HTMLHeadEl, 'HTMLHeadElement');
        function HTMLCanvasEl() { } HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype); HTMLCanvasEl.prototype.width = 300; HTMLCanvasEl.prototype.height = 150; HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement'; sn(HTMLCanvasEl, 'HTMLCanvasElement');
        function HTMLIFrameEl() { } HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype); HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement'; sn(HTMLIFrameEl, 'HTMLIFrameElement');
        function HTMLScriptEl() { } HTMLScriptEl.prototype = Object.create(HTMLEl.prototype); HTMLScriptEl.prototype[ST] = 'HTMLScriptElement'; sn(HTMLScriptEl, 'HTMLScriptElement');
        function Location_() { } Location_.prototype[ST] = 'Location'; sn(Location_, 'Location');
        function Screen_() { } Screen_.prototype[ST] = 'Screen'; sn(Screen_, 'Screen');
        function History_() { } History_.prototype[ST] = 'History'; sn(History_, 'History');
        function Storage_() { } Storage_.prototype[ST] = 'Storage'; sn(Storage_, 'Storage');
        function Performance_() { } Performance_.prototype[ST] = 'Performance'; sn(Performance_, 'Performance');
        function PluginArray_() { } PluginArray_.prototype[ST] = 'PluginArray'; sn(PluginArray_, 'PluginArray');
        function MimeTypeArray_() { } MimeTypeArray_.prototype[ST] = 'MimeTypeArray'; sn(MimeTypeArray_, 'MimeTypeArray');
        function Plugin_() { } Plugin_.prototype.item = mf('item'); Plugin_.prototype.namedItem = mf('namedItem'); Plugin_.prototype[ST] = 'Plugin'; sn(Plugin_, 'Plugin');
        function MimeType_() { } MimeType_.prototype[ST] = 'MimeType'; sn(MimeType_, 'MimeType');

        var nav = new Navigator_();
        nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
        nav.appVersion = '5.0 (Windows)'; nav.platform = 'Win32'; nav.language = 'zh-CN'; nav.languages = ['zh-CN', 'zh'];
        nav.cookieEnabled = true; nav.webdriver = false; nav.hardwareConcurrency = 8; nav.maxTouchPoints = 0;
        nav.vendor = ''; nav.productSub = '20100101'; nav.doNotTrack = '1'; nav.onLine = true;
        nav.deviceMemory = undefined; nav.webkitTemporaryStorage = undefined;
        var pls = new PluginArray_(); pls.length = 5; pls.refresh = mf('refresh'); pls.item = mf('item'); pls.namedItem = mf('namedItem');
        var plgnames = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'];
        for (var i = 0; i < 5; i++) { var p = new Plugin_(); p.name = plgnames[i]; p.filename = 'internal-pdf-viewer'; p.description = 'Portable Document Format'; p.length = 2; var m0 = new MimeType_(); m0.type = 'application/pdf'; m0.suffixes = 'pdf'; m0.description = 'Portable Document Format'; m0.enabledPlugin = p; var m1 = new MimeType_(); m1.type = 'text/pdf'; m1.suffixes = 'pdf'; m1.description = 'Portable Document Format'; m1.enabledPlugin = p; p[0] = m0; p[1] = m1; pls[i] = p; }
        nav.plugins = pls;
        var mts = new MimeTypeArray_(); mts.length = 2; mts.item = mf('item'); mts.namedItem = mf('namedItem');
        var mm0 = new MimeType_(); mm0.type = 'application/pdf'; mm0.suffixes = 'pdf'; mm0.description = 'Portable Document Format'; mm0.enabledPlugin = pls[0];
        var mm1 = new MimeType_(); mm1.type = 'text/pdf'; mm1.suffixes = 'pdf'; mm1.description = 'Portable Document Format'; mm1.enabledPlugin = pls[0];
        mts[0] = mm0; mts[1] = mm1; nav.mimeTypes = mts;

        var doc = new Document_();
        doc.createElement = function (tag) { if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.style = {}; f.setAttribute = mf('setAttribute'); f.getAttribute = function () { return null; }; f.contentWindow = null; return f; } if (tag === 'canvas') return new HTMLCanvasEl(); if (tag === 'script') { var s = new HTMLScriptEl(); s.src = ''; s.setAttribute = mf('setAttribute'); return s; } return new HTMLEl(); }; sn(doc.createElement, 'createElement');
        doc.createElementNS = function (ns, tag) { return doc.createElement(tag); }; sn(doc.createElementNS, 'createElementNS');
        doc.body = new HTMLBodyEl(); doc.documentElement = new HTMLHtmlEl(); doc.head = new HTMLHeadEl();
        doc.getElementsByTagName = function (t) { if (t === 'head') return { item: function () { return doc.head; }, length: 1 }; return { item: function () { return null; }, length: 0 }; }; sn(doc.getElementsByTagName, 'getElementsByTagName');
        doc.getElementById = function () { return new HTMLEl(); }; sn(doc.getElementById, 'getElementById');
        doc.getElementsByClassName = function () { return []; }; sn(doc.getElementsByClassName, 'getElementsByClassName');
        doc.querySelector = function () { return new HTMLEl(); }; sn(doc.querySelector, 'querySelector');
        doc.querySelectorAll = function () { return []; }; sn(doc.querySelectorAll, 'querySelectorAll');
        doc.addEventListener = mf('addEventListener');
        doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8'; doc.visibilityState = 'visible'; doc.title = 'BOSS直聘'; doc.referrer = ''; doc.all = undefined;
        var _docCookie = '__a=' + __a + ';__c=' + __c + ';__g=-';
        Object.defineProperty(doc, 'cookie', { get: function () { return _docCookie; }, set: function (v) { }, configurable: true, enumerable: true });

        var loc = new Location_(); loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python'; loc.hostname = 'www.zhipin.com'; loc.host = 'www.zhipin.com'; loc.pathname = '/web/geek/jobs'; loc.protocol = 'https:'; loc.origin = 'https://www.zhipin.com';
        var scr = new Screen_(); scr.width = 2560; scr.height = 1440; scr.availWidth = 2560; scr.availHeight = 1440; scr.colorDepth = 24; scr.pixelDepth = 24;
        var hist = new History_(); hist.length = 1; hist.pushState = mf('pushState'); hist.replaceState = mf('replaceState');
        function mkStor() { var s = new Storage_(); s.getItem = mf('getItem'); s.setItem = mf('setItem'); s.removeItem = mf('removeItem'); s.clear = mf('clear'); s.key = mf('key'); s.length = 0; return s; }
        var perf = new Performance_(); perf.now = function () { return Date.now(); }; sn(perf.now, 'now'); perf.memory = {};

        var win = this;
        win.window = win; win.self = win; win.top = win; win.parent = win; win.globalThis = win;
        win.console = { log: function () { }, error: function () { }, warn: function () { }, info: function () { } };
        win.navigator = nav; win.document = doc; win.location = loc; win.screen = scr; win.history = hist;
        win.localStorage = mkStor(); win.sessionStorage = mkStor(); win.performance = perf;
        win.crypto = { getRandomValues: function (arr) { var b = crb(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; }, subtle: null }; sn(win.crypto.getRandomValues, 'getRandomValues');
        win.btoa = function (s) { return btoa(s); }; sn(win.btoa, 'btoa');
        win.atob = function (s) { return atob(s); }; sn(win.atob, 'atob');
        win.innerWidth = 2560; win.innerHeight = 1440; win.outerWidth = 2560; win.outerHeight = 1440; win.devicePixelRatio = 1;
        win.name = ''; win.closed = false; win.length = 0; win.opener = null; win.origin = 'https://www.zhipin.com'; win.isSecureContext = true;
        win.postMessage = mf('postMessage'); win.addEventListener = mf('addEventListener'); win.removeEventListener = mf('removeEventListener');
        win.fetch = mf('fetch'); win.requestAnimationFrame = mf('requestAnimationFrame');
        win.matchMedia = function () { return { matches: false }; }; sn(win.matchMedia, 'matchMedia');
        win.getComputedStyle = function () { return {}; }; sn(win.getComputedStyle, 'getComputedStyle');
        win.getSelection = function () { return null; }; sn(win.getSelection, 'getSelection');
        win.XMLHttpRequest = mc('XMLHttpRequest'); win.MutationObserver = mc('MutationObserver'); win.Image = mc('Image'); win.Event = mc('Event'); win.CSSRuleList = mc('CSSRuleList');
        win.process = undefined; win.module = undefined; win.require = undefined;
        win._phantom = undefined; win.callphantom = undefined;
        ['Blob', 'CSSRule', 'CSSStyleDeclaration', 'CSSStyleSheet', 'CanvasRenderingContext2D', 'CloseEvent', 'Comment', 'CompositionEvent', 'CustomEvent', 'DOMException', 'DOMImplementation', 'DOMParser', 'DOMRect', 'DataTransfer', 'DeviceMotionEvent', 'DocumentFragment', 'DragEvent', 'Element', 'ErrorEvent', 'File', 'FileList', 'FileReader', 'FocusEvent', 'FormData', 'HashChangeEvent', 'Headers', 'HTMLCollection', 'HTMLAnchorElement', 'HTMLAudioElement', 'HTMLButtonElement', 'HTMLDivElement', 'HTMLImageElement', 'HTMLInputElement', 'HTMLParagraphElement', 'HTMLSelectElement', 'HTMLSpanElement', 'HTMLStyleElement', 'HTMLTableElement', 'HTMLTemplateElement', 'HTMLTextAreaElement', 'HTMLUListElement', 'HTMLVideoElement', 'InputEvent', 'KeyboardEvent', 'MediaList', 'MessageChannel', 'MessageEvent', 'MouseEvent', 'MutationRecord', 'NodeList', 'Notification', 'PageTransitionEvent', 'Path2D', 'PerformanceEntry', 'PerformanceObserver', 'PointerEvent', 'PopStateEvent', 'ProgressEvent', 'Range', 'ReadableStream', 'Request', 'ResizeObserver', 'Response', 'SVGAElement', 'SVGElement', 'SVGSVGElement', 'SVGScriptElement', 'SVGStyleElement', 'Selection', 'ShadowRoot', 'SharedWorker', 'StorageEvent', 'SubmitEvent', 'Text', 'TextDecoder', 'TextEncoder', 'TouchEvent', 'TransitionEvent', 'TreeWalker', 'UIEvent', 'URL', 'URLSearchParams', 'ValidityState', 'VisualViewport', 'WebSocket', 'WheelEvent', 'Worker', 'XMLDocument', 'XMLHttpRequestEventTarget', 'XMLHttpRequestUpload', 'XMLSerializer', 'XSLTProcessor'].forEach(function (n) { if (typeof win[n] === 'undefined') win[n] = mc(n); });

        // 执行安全 JS
        eval(code);

        if (typeof ABC === 'undefined') return { error: 'ABC not defined' };
        var token = new ABC().z(seed, ts);
        return { token: token };
    });

    // 从 fnBody 提取函数体
    var bodyStr = fnBody.toString();
    bodyStr = bodyStr.substring(bodyStr.indexOf('{') + 1, bodyStr.lastIndexOf('}'));

    var fn = new Function('__a', '__c', 'seed', 'ts', 'code', 'crb', 'btoa', 'atob', bodyStr);

    return fn(
        __a, __c, seed, ts, securityCode,
        function(n) { var b = crypto.randomBytes(n); return Array.from(b); },
        function(s) { return Buffer.from(s).toString('base64'); },
        function(s) { return Buffer.from(s, 'base64').toString(); }
    );
}

// ===== 步骤 4: API 请求 =====
function requestJobs(cookies, stoken, callback) {
    var ts = Date.now();
    var url = API + '?city=' + CITY + '&query=' + QUERY + '&page=1&_=' + ts;
    var options = {
        hostname: HOST, path: url, method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
            'Accept': 'application/json, text/plain, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://' + HOST + '/web/geek/jobs?city=' + CITY + '&query=' + QUERY,
            'Cookie': '__a=' + cookies.__a + '; __c=' + cookies.__c + '; __g=-; __zp_stoken__=' + encodeURIComponent(stoken),
        },
    };
    https.get(options, function(res) {
        var body = '';
        res.on('data', function(d) { body += d; });
        res.on('end', function() {
            try {
                callback(null, JSON.parse(body));
            } catch(e) { callback(e); }
        });
    }).on('error', callback);
}

// ===== 主流程 =====
console.log('=== Boss直聘 joblist API ===');
var cookies = generateBaseCookies();
console.log('[1] Cookies: __a=' + cookies.__a.substring(0, 20) + '...');

getSeed(cookies, function(err, zpData) {
    if (err) { console.error('getSeed error:', err); return; }
    console.log('[2] Seed: ' + zpData.seed.substring(0, 30) + '... ts=' + zpData.ts + ' name=' + zpData.name);

    loadSecurityJS(zpData.name, function(err, code) {
        if (err) { console.error('loadSecurityJS error:', err); return; }

        var result = generateStoken(cookies.__a, cookies.__c, code, zpData.seed, zpData.ts);
        if (result.error) { console.error('generateStoken error:', result.error); return; }
        console.log('[3] Token: len=' + result.token.length + ' preview=' + result.token.substring(0, 50) + '...');

        requestJobs(cookies, result.token, function(err, data) {
            if (err) { console.error('requestJobs error:', err); return; }
            console.log('[4] API: code=' + data.code + ' msg=' + (data.message || ''));
            if (data.code === 0) {
                var jobs = (data.zpData || {}).jobList || [];
                console.log('SUCCESS! ' + jobs.length + ' jobs:');
                jobs.slice(0, 5).forEach(function(j) {
                    console.log('  [' + j.jobName + '] @ ' + j.brandName + ' - ' + (j.salaryDesc || '?'));
                });
            } else if (data.code === 37) {
                console.log('Seed rejected, got new seed: ' + ((data.zpData || {}).seed || '').substring(0, 30));
            }
        });
    });
});
