/**
 * 国家医保局 — iv8 纯 V8 桥接脚本
 * =================================
 *
 * 在 iv8 (C++ V8) 中为 app.js 提供浏览器环境，拦截加密模块导出。
 *
 * iv8 已提供: window, self, navigator({userAgent, platform}), console
 * 补丁: document, location, XHR, crypto, atob/btoa, Worker, WebSocket, fetch
 *
 * 策略: 用 Proxy 包装 window 以防 null 访问崩溃
 */

(function() {
    // ═══════════════════════════════════════════════════════════
    // 1. 安全的 null 存根 — 任何属性访问返回自身
    // ═══════════════════════════════════════════════════════════
    var safeStub = function() { return safeStub; };
    safeStub.toString = function() { return 'function() { [native code] }'; };
    safeStub.apply = function() { return safeStub; };
    safeStub.call = function() { return safeStub; };
    safeStub.bind = function() { return safeStub; };

    // ═══════════════════════════════════════════════════════════
    // 2. 基础浏览器 API
    // ═══════════════════════════════════════════════════════════

    // location
    window.location = {
        href: 'https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical',
        host: 'fuwu.nhsa.gov.cn',
        hostname: 'fuwu.nhsa.gov.cn',
        protocol: 'https:',
        origin: 'https://fuwu.nhsa.gov.cn',
        pathname: '/nationalHallSt/',
        search: '',
        hash: '#/search/medical',
        port: '',
        assign: function(){}, replace: function(){}, reload: function(){},
    };

    // document
    var elStub = function(tag) {
        return {
            style: {}, children: [], tagName: (tag||'div').toUpperCase(),
            setAttribute: function(){}, getAttribute: function(){ return null; },
            appendChild: function(c){ return c; }, removeChild: function(){},
            addEventListener: function(){}, removeEventListener: function(){},
            querySelector: function(){ return null; },
            querySelectorAll: function(){ return []; },
            getBoundingClientRect: function(){ return {left:0,top:0,width:100,height:100}; },
        };
    };

    window.document = {
        cookie: '',
        createElement: elStub,
        createElementNS: function(ns, tag) { return elStub(tag); },
        querySelector: function(){ return null; },
        querySelectorAll: function(){ return []; },
        getElementById: function(){ return null; },
        getElementsByTagName: function(){ return []; },
        getElementsByClassName: function(){ return []; },
        addEventListener: function(){},
        removeEventListener: function(){},
        documentElement: { style:{} },
        body: elStub('body'),
        head: elStub('head'),
    };

    // navigator extensions
    if (!navigator.userAgent) navigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    if (!navigator.platform) navigator.platform = 'Win32';
    if (!navigator.language) navigator.language = 'zh-CN';
    navigator.appVersion = '5.0';
    navigator.serviceWorker = {
        register: function(){ return Promise.resolve({}); },
        ready: Promise.resolve({}),
    };

    // screen
    window.screen = { width:1920, height:1080, availWidth:1920, availHeight:1040, colorDepth:24 };

    // inner/outer dimensions
    window.innerWidth = 1920; window.innerHeight = 1080;
    window.outerWidth = 1920; window.outerHeight = 1080;
    window.screenX = 0; window.screenY = 0;
    window.pageXOffset = 0; window.pageYOffset = 0;

    // window relationships
    window.parent = window;
    window.top = window;
    window.self = window;

    // ═══════════════════════════════════════════════════════════
    // 3. Web API
    // ═══════════════════════════════════════════════════════════

    // XMLHttpRequest
    var XHR = function() {
        this.readyState = 0; this.status = 0; this.responseText = '';
        this.onreadystatechange = null;
    };
    XHR.prototype.open = function(m, u) { this._url = u; this.readyState = 1; };
    XHR.prototype.setRequestHeader = function(){};
    XHR.prototype.send = function(body) {
        this.readyState = 4; this.status = 200;
        var self = this;
        setTimeout(function() {
            if (self.onreadystatechange) self.onreadystatechange();
        }, 0);
    };
    XHR.prototype.addEventListener = function(){};
    XHR.prototype.getAllResponseHeaders = function(){ return ''; };
    XHR.UNSENT = 0; XHR.OPENED = 1; XHR.DONE = 4;
    window.XMLHttpRequest = XHR;

    // WebSocket
    window.WebSocket = function() { this.readyState = 0; };
    window.WebSocket.prototype.send = function(){};
    window.WebSocket.prototype.close = function(){};
    window.WebSocket.prototype.addEventListener = function(){};
    window.WebSocket.CONNECTING = 0; window.WebSocket.OPEN = 1; window.WebSocket.CLOSED = 3;

    // Worker
    window.Worker = function() { this.onmessage = null; this.onerror = null; };
    window.Worker.prototype.postMessage = function(){};
    window.Worker.prototype.terminate = function(){};

    // MessageChannel / MessagePort
    window.MessageChannel = function() {
        var stub = { postMessage: function(){}, onmessage: null, close: function(){} };
        this.port1 = stub; this.port2 = JSON.parse(JSON.stringify(stub));
    };
    window.MessagePort = function(){ this.onmessage = null; };
    window.MessagePort.prototype.postMessage = function(){};

    // fetch
    window.fetch = function() {
        return Promise.resolve({
            json: function(){ return Promise.resolve({}); },
            text: function(){ return Promise.resolve(''); },
            blob: function(){ return Promise.resolve({}); },
            status: 200, ok: true,
            headers: { get: function(){ return null; } },
        });
    };

    // crypto
    window.crypto = {
        getRandomValues: function(arr) {
            for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
            return arr;
        },
        subtle: {},
        randomUUID: function() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },
    };

    // atob / btoa
    window.atob = function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var out = '', i = 0;
        while (i < s.length) {
            var e = chars.indexOf(s.charAt(i++));
            var n = chars.indexOf(s.charAt(i++));
            var h = chars.indexOf(s.charAt(i++));
            var r = chars.indexOf(s.charAt(i++));
            out += String.fromCharCode((e << 2) | (n >> 4));
            if (h !== 64) out += String.fromCharCode(((15 & n) << 4) | (h >> 2));
            if (r !== 64) out += String.fromCharCode(((3 & h) << 6) | r);
        }
        return out;
    };
    window.btoa = function(s) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        var out = '', i = 0;
        while (i < s.length) {
            var a = s.charCodeAt(i++), b = s.charCodeAt(i++), c = s.charCodeAt(i++);
            out += chars.charAt(a >> 2);
            out += chars.charAt(((3 & a) << 4) | (b >> 4));
            out += (isNaN(b) ? '=' : chars.charAt(((15 & b) << 2) | (c >> 6)));
            out += (isNaN(c) ? '=' : chars.charAt(63 & c));
        }
        return out;
    };

    // setTimeout / setInterval
    if (typeof setTimeout === 'function') {
        var _origSetTimeout = setTimeout;
        window.setTimeout = function(fn, ms) { _origSetTimeout(fn, ms || 0); return 0; };
    }
    window.setInterval = function(){ return 0; };
    window.clearTimeout = function(){};
    window.clearInterval = function(){};

    // console
    window.console = { log: function(){}, warn: function(){}, error: function(){}, info: function(){}, debug: function(){}, trace: function(){} };

    // Events
    window.Event = function(type){ this.type = type; };
    window.CustomEvent = function(type, opts){ this.type = type; this.detail = (opts||{}).detail; };

    // Performance
    window.performance = {
        now: function(){ return Date.now(); },
        timing: { navigationStart: Date.now() - 1000 },
    };

    // localStorage
    var _store = {};
    window.localStorage = { getItem: function(k){ return _store[k]||null; }, setItem: function(k,v){ _store[k]=v; }, removeItem: function(k){ delete _store[k]; } };
    window.sessionStorage = { getItem: function(k){ return _store[k]||null; }, setItem: function(k,v){ _store[k]=v; }, removeItem: function(k){ delete _store[k]; } };

    // requestAnimationFrame
    window.requestAnimationFrame = function(fn){ setTimeout(fn, 16); return 0; };
    window.cancelAnimationFrame = function(){};

    // ═══════════════════════════════════════════════════════════
    // 4. 全局 null 保护 (用 Proxy)
    // ═══════════════════════════════════════════════════════════
    if (typeof Proxy !== 'undefined') {
        var windowProxy = new Proxy(window, {
            get: function(target, prop) {
                if (prop in target) {
                    var v = target[prop];
                    return v === null || v === undefined ? safeStub : v;
                }
                return safeStub;
            },
            set: function(target, prop, value) {
                target[prop] = value;
                return true;
            }
        });
        // Replace window with proxy
        try { window = windowProxy; } catch(e) {}
    }

    // null-safe for common patterns
    window.onmessage = null;
    window.onerror = null;
    window.onpopstate = null;
    window.onhashchange = null;
    window.onload = null;
    window.onbeforeunload = null;

    // ═══════════════════════════════════════════════════════════
    // 5. 加密模块拦截
    // ═══════════════════════════════════════════════════════════
    window.__nhsa_captured = null;
    window.__nhsa_all_exports = [];

    var _origDP = Object.defineProperty;
    Object.defineProperty = function(obj, prop, desc) {
        if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null && desc.value !== window) {
            var v = desc.value;
            if (v.sm2 && v.sm3 && v.sm4) {
                window.__nhsa_captured = {
                    type: 'sm-crypto',
                    sm2Keys: Object.keys(v.sm2).slice(0, 10),
                    sm3Keys: Object.keys(v.sm3).slice(0, 10),
                    sm4Keys: Object.keys(v.sm4).slice(0, 10),
                    module: prop,
                };
            }
            if (v.generateKeyPairHex && v.doSignature) {
                window.__nhsa_all_exports.push({prop: prop, keys: Object.keys(v).slice(0, 15)});
            }
        }
        return _origDP.call(Object, obj, prop, desc);
    };

    // Also intercept Object.assign for webpack-style exports
    var _origAssign = Object.assign;
    Object.assign = function(target) {
        for (var i = 1; i < arguments.length; i++) {
            var src = arguments[i];
            if (src && src.sm2 && src.sm3 && src.sm4) {
                window.__nhsa_captured = {
                    type: 'Object.assign',
                    sm2Keys: Object.keys(src.sm2).slice(0, 10),
                    sm3Keys: Object.keys(src.sm3).slice(0, 10),
                    sm4Keys: Object.keys(src.sm4).slice(0, 10),
                };
            }
        }
        return _origAssign.apply(Object, arguments);
    };

    window.__nhsa_ready = true;
})();
