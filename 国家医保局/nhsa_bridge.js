/**
 * 国家医保局 — iv8 桥接脚本
 * ==============================
 *
 * 在 iv8 (C++ V8) 中为 app.js 提供最小浏览器环境，
 * 并拦截加密模块导出。
 *
 * iv8 已提供: window, self, navigator({userAgent, platform})
 * 需要补丁: document, location, XMLHttpRequest, crypto, WebSocket, fetch
 */

(function() {
    'use strict';

    // ═══════════════════════════════════════════════════════════
    // 环境补丁 (iv8 中 window === globalThis)
    // ═══════════════════════════════════════════════════════════

    // document
    if (typeof document === 'undefined' || !document.createElement) {
        window.document = {
            cookie: '',
            createElement: function(tag) {
                var el = { style: {}, children: [], tagName: tag.toUpperCase() };
                el.setAttribute = function() { return el; };
                el.appendChild = function(c) { el.children.push(c); return c; };
                el.removeChild = function() {};
                el.addEventListener = function() {};
                el.removeEventListener = function() {};
                el.querySelector = function() { return null; };
                el.querySelectorAll = function() { return []; };
                el.getAttribute = function() { return null; };
                el.getBoundingClientRect = function() { return {left:0,top:0,width:0,height:0}; };
                return el;
            },
            createElementNS: function(ns, tag) { return document.createElement(tag); },
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; },
            getElementById: function() { return null; },
            getElementsByTagName: function() { return []; },
            getElementsByClassName: function() { return []; },
            addEventListener: function() {},
            removeEventListener: function() {},
            documentElement: { style: {} },
            body: {
                appendChild: function() {}, removeChild: function() {},
                style: {},
            },
            head: { appendChild: function() {} },
        };
    }

    // location
    if (typeof location === 'undefined' || !location.href) {
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
            assign: function() {}, replace: function() {}, reload: function() {},
        };
    }

    // XMLHttpRequest
    if (typeof XMLHttpRequest === 'undefined') {
        window.XMLHttpRequest = function() {
            this.readyState = 0;
            this.status = 0;
            this.responseText = '';
            this.responseURL = '';
            this.onreadystatechange = null;
        };
        XMLHttpRequest.prototype.open = function(method, url) {
            this._method = method; this._url = url;
        };
        XMLHttpRequest.prototype.setRequestHeader = function() {};
        XMLHttpRequest.prototype.send = function() {};
        XMLHttpRequest.prototype.addEventListener = function() {};
        XMLHttpRequest.prototype.getAllResponseHeaders = function() { return ''; };
        XMLHttpRequest.UNSENT = 0;
        XMLHttpRequest.OPENED = 1;
        XMLHttpRequest.DONE = 4;
    }

    // WebSocket
    if (typeof WebSocket === 'undefined') {
        window.WebSocket = function() {
            this.readyState = 0;
        };
        WebSocket.prototype.send = function() {};
        WebSocket.prototype.close = function() {};
        WebSocket.CONNECTING = 0;
        WebSocket.OPEN = 1;
        WebSocket.CLOSED = 3;
    }

    // fetch
    if (typeof fetch === 'undefined') {
        window.fetch = function() {
            return Promise.resolve({
                json: function() { return Promise.resolve({}); },
                text: function() { return Promise.resolve(''); },
                status: 200, ok: true,
                headers: { get: function() { return null; } },
            });
        };
    }

    // crypto (subtle not needed for sm-crypto)
    if (typeof crypto === 'undefined') {
        window.crypto = {
            getRandomValues: function(arr) {
                for (var i = 0; i < arr.length; i++) {
                    arr[i] = Math.floor(Math.random() * 256);
                }
                return arr;
            },
            subtle: {},
        };
    }

    // console
    if (!console || !console.log) {
        window.console = {
            log: function() {}, warn: function() {}, error: function() {},
            info: function() {}, debug: function() {}, trace: function() {},
        };
    }

    // setTimeout / setInterval (同步执行)
    if (typeof setTimeout === 'undefined') {
        window.setTimeout = function(fn) { if (typeof fn === 'function') fn(); return 0; };
        window.setInterval = function() { return 0; };
        window.clearTimeout = function() {};
        window.clearInterval = function() {};
    }

    // 其他常用 API
    if (typeof atob === 'undefined') {
        window.atob = function(s) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
            var out = '', i = 0;
            while (i < s.length) {
                var e = chars.indexOf(s[i++]), n = chars.indexOf(s[i++]);
                var h = chars.indexOf(s[i++]), r = chars.indexOf(s[i++]);
                out += String.fromCharCode(e << 2 | n >> 4);
                if (h !== 64) out += String.fromCharCode((15 & n) << 4 | h >> 2);
                if (r !== 64) out += String.fromCharCode((3 & h) << 6 | r);
            }
            return out;
        };
        window.btoa = function(s) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            var out = '', i = 0;
            while (i < s.length) {
                var a = s.charCodeAt(i++), b = s.charCodeAt(i++), c = s.charCodeAt(i++);
                out += chars[a >> 2] + chars[(3 & a) << 4 | b >> 4];
                out += isNaN(b) ? '=' : chars[(15 & b) << 2 | c >> 6];
                out += isNaN(c) ? '=' : chars[63 & c];
            }
            return out;
        };
    }

    // Event / CustomEvent
    if (typeof Event === 'undefined') {
        window.Event = function(type) { this.type = type; };
        window.CustomEvent = function(type, opts) { this.type = type; this.detail = (opts||{}).detail; };
    }

    // innerWidth/innerHeight
    if (typeof innerWidth === 'undefined') {
        window.innerWidth = 1920;
        window.innerHeight = 1080;
        window.outerWidth = 1920;
        window.outerHeight = 1080;
        window.screenX = 0;
        window.screenY = 0;
        window.pageXOffset = 0;
        window.pageYOffset = 0;
    }

    if (typeof screen === 'undefined') {
        window.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 };
    }

    // Worker 代理 (app.js 可能尝试创建 Worker)
    if (typeof Worker === 'undefined') {
        window.Worker = function() {
            this.postMessage = function() {};
            this.terminate = function() {};
            this.onmessage = null;
            this.onerror = null;
        };
    }

    // MessageChannel/MessagePort
    if (typeof MessageChannel === 'undefined') {
        window.MessageChannel = function() {
            var ch = this;
            this.port1 = {
                postMessage: function() {},
                onmessage: null,
                close: function() {},
            };
            this.port2 = {
                postMessage: function() {},
                onmessage: null,
                close: function() {},
            };
        };
    }

    // ServiceWorker
    if (typeof navigator !== 'undefined' && !navigator.serviceWorker) {
        navigator.serviceWorker = {
            register: function() { return Promise.resolve({}); },
            ready: Promise.resolve({}),
            getRegistration: function() { return Promise.resolve(null); },
        };
    }

    // 防止 null.onmessage 错误
    window.onmessage = null;
    window.onerror = null;
    window.onpopstate = null;
    window.onhashchange = null;
    window.onload = null;
    window.onunload = null;
    window.onbeforeunload = null;

    // 额外的 DOM 安全垫
    if (!document.documentElement) {
        document.documentElement = document.createElement('html');
    }
    if (!document.body) {
        document.body = document.createElement('body');
    }

    // ===========================================================
    // 模块拦截
    // ===========================================================

    window.__nhsa_sm_crypto = null;
    window.__nhsa_exports = {};

    var _origDP = Object.defineProperty;
    Object.defineProperty = function(obj, prop, desc) {
        if (desc && desc.value && typeof desc.value === 'object' && desc.value !== null) {
            var v = desc.value;
            if (v.sm2 && v.sm3 && v.sm4) {
                window.__nhsa_sm_crypto = v;
                window.__nhsa_exports.sm_crypto = Object.keys(v);
            }
            if (v.generateKeyPairHex || v.doSignature) {
                window.__nhsa_exports.sm2_like = prop;
            }
        }
        return _origDP.call(Object, obj, prop, desc);
    };

    window.nhsa_bridge_loaded = true;
})();
