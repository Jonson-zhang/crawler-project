/**
 * iv8-stubs.js — iv8 通用浏览器环境补丁 (可复用)
 * =================================================
 *
 * 每个 iv8 站点项目的第一行 JS 就是注入这个文件。
 * 覆盖 iv8 C++ 层缺失的浏览器 API，让 SDK 正常运行。
 *
 * 用法:
 *   ctx = iv8.JSContext(environment={...})
 *   ctx.__enter__()
 *   ctx.eval(Path(".claude/iv8/stubs.js").read_text("utf-8"))
 *   // 然后加载站点特有的 SDK
 */

// ═══════════════════════════════════════════════════════════════
// 1. 全局引用
// ═══════════════════════════════════════════════════════════════
self = window;
globalThis = window;

// ═══════════════════════════════════════════════════════════════
// 2. MessageChannel — core-js Promise polyfill 的微任务调度
//    bdms.js / 任何含 core-js 的 webpack bundle 都需要
// ═══════════════════════════════════════════════════════════════
window.MessageChannel = function() {
    var _cb = null;
    this.port1 = {
        postMessage: function(m) {
            if (_cb) setTimeout(function() { _cb({data: m}); }, 0);
        }
    };
    this.port2 = {};
    Object.defineProperty(this.port2, 'onmessage', {
        get: function() { return _cb; },
        set: function(fn) { _cb = fn; }
    });
};

// ═══════════════════════════════════════════════════════════════
// 3. setImmediate — 旧版 polyfill 回退
// ═══════════════════════════════════════════════════════════════
window.setImmediate = function(fn) { return setTimeout(fn, 0); };
window.clearImmediate = function(id) { clearTimeout(id); };

// ═══════════════════════════════════════════════════════════════
// 4. 事件系统
// ═══════════════════════════════════════════════════════════════
window.addEventListener = function(e, fn) {
    if (e === 'DOMContentLoaded') setTimeout(fn, 100);
};
window.removeEventListener = function() {};
window.ProgressEvent = function() {};

// ═══════════════════════════════════════════════════════════════
// 5. Performance
// ═══════════════════════════════════════════════════════════════
performance.now = function() { return Date.now(); };

// ═══════════════════════════════════════════════════════════════
// 6. DOM 元素工厂
// ═══════════════════════════════════════════════════════════════
var _elBase = {
    appendChild: function() {}, removeChild: function() {},
    setAttribute: function() {}, getAttribute: function() { return null; },
    children: [], childNodes: [], parentNode: null,
    addEventListener: function() {}, removeEventListener: function() {},
    getElementsByTagName: function() { return []; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
};

document.createElement = function(t) {
    var tag = (t || '').toLowerCase();
    var el = Object.create(_elBase);
    el.tagName = tag.toUpperCase();
    el.style = {};

    // Canvas — 通常需要 getContext
    if (tag === 'canvas') {
        el.width = 300; el.height = 150;
        el.getContext = function(type) {
            if (type === '2d') {
                return {
                    font: '10px sans-serif',
                    fillStyle: '#000000', strokeStyle: '#000000',
                    lineWidth: 1, globalAlpha: 1,
                    fillRect: function(){}, strokeRect: function(){},
                    fillText: function(){}, strokeText: function(){},
                    beginPath: function(){}, closePath: function(){},
                    moveTo: function(){}, lineTo: function(){},
                    arc: function(){}, fill: function(){}, stroke: function(){},
                    save: function(){}, restore: function(){},
                    scale: function(){}, rotate: function(){},
                    translate: function(){}, transform: function(){},
                    measureText: function(t) { return { width: (t||'').length * 6 }; },
                    getImageData: function(x,y,w,h) {
                        var d = new Uint8ClampedArray(w*h*4);
                        for (var i = 0; i < d.length; i++) d[i] = Math.floor(Math.random() * 256);
                        return { data: d, width: w, height: h };
                    },
                    createLinearGradient: function() { return { addColorStop: function(){} }; },
                    createRadialGradient: function() { return { addColorStop: function(){} }; },
                    createPattern: function() { return {}; },
                    drawImage: function(){}, putImageData: function(){},
                    toDataURL: function() { return 'data:image/png;base64,'; },
                };
            }
            if (type === 'webgl' || type === 'experimental-webgl') {
                return {
                    getParameter: function(p) {
                        var map = { 7936: 'WebKit', 7937: 'WebKit WebGL', 3379: 16384 };
                        return map[p] || 0;
                    },
                    getExtension: function(n) {
                        if (n === 'WEBGL_debug_renderer_info')
                            return { UNMASKED_VENDOR_WEBGL: 37446, UNMASKED_RENDERER_WEBGL: 37445 };
                        return {};
                    },
                    getSupportedExtensions: function() {
                        return ['ANGLE_instanced_arrays','WEBGL_debug_renderer_info','EXT_texture_filter_anisotropic'];
                    },
                    getShaderPrecisionFormat: function() {
                        return { rangeMin: 127, rangeMax: 127, precision: 23 };
                    },
                    activeTexture: function(){}, attachShader: function(){}, bindBuffer: function(){},
                    bindTexture: function(){}, blendFunc: function(){}, bufferData: function(){},
                    clear: function(){}, clearColor: function(){}, compileShader: function(){},
                    createBuffer: function(){}, createProgram: function(){}, createShader: function(){},
                    createTexture: function(){}, deleteBuffer: function(){}, deleteProgram: function(){},
                    deleteShader: function(){}, deleteTexture: function(){}, depthFunc: function(){},
                    disable: function(){}, drawArrays: function(){}, drawElements: function(){},
                    enable: function(){}, enableVertexAttribArray: function(){},
                    framebufferTexture2D: function(){}, generateMipmap: function(){},
                    getAttribLocation: function(){}, getProgramInfoLog: function(){},
                    getProgramParameter: function(){}, getShaderInfoLog: function(){},
                    getShaderParameter: function(){}, getUniformLocation: function(){},
                    linkProgram: function(){}, pixelStorei: function(){}, readPixels: function(){},
                    scissor: function(){}, shaderSource: function(){}, texImage2D: function(){},
                    texParameteri: function(){}, uniform1f: function(){}, uniform1i: function(){},
                    uniform2f: function(){}, uniform3f: function(){}, uniform4f: function(){},
                    uniformMatrix4fv: function(){}, useProgram: function(){},
                    vertexAttribPointer: function(){}, viewport: function(){},
                    canvas: el, drawingBufferWidth: 300, drawingBufferHeight: 150,
                };
            }
            return null;
        };
        el.toDataURL = function() { return 'data:image/png;base64,'; };
        el.toBlob = function() {};
    }

    return el;
};

document.createElementNS = function(ns, tag) { return document.createElement(tag); };

// ═══════════════════════════════════════════════════════════════
// 7. DOM 关键节点
// ═══════════════════════════════════════════════════════════════
document._headEl = document.createElement('head');
document._bodyEl = document.createElement('body');
document._htmlEl = document.createElement('html');

document.getElementsByTagName = function(t) {
    t = (t || '').toLowerCase();
    if (t === 'head') return [document._headEl];
    if (t === 'body') return [document._bodyEl];
    if (t === 'html') return [document._htmlEl];
    return [document.createElement(t)];
};

try {
    Object.defineProperty(document, 'body', {
        get: function() { return document._bodyEl; }, configurable: true });
    Object.defineProperty(document, 'documentElement', {
        get: function() { return document._htmlEl; }, configurable: true });
    Object.defineProperty(document, 'head', {
        get: function() { return document._headEl; }, configurable: true });
} catch(e) {}

document.querySelector = function() { return null; };
document.getElementById = function() { return null; };
document.addEventListener = function() {};
document.removeEventListener = function() {};
document.createEvent = function(t) { return { initEvent: function() {} }; };
document.createTextNode = function(t) {
    return { nodeType: 3, textContent: String(t||''), nodeValue: String(t||'') };
};

// ═══════════════════════════════════════════════════════════════
// 8. document 属性
// ═══════════════════════════════════════════════════════════════
document.all = undefined;
document.readyState = 'complete';
document.hidden = false;
document.visibilityState = 'visible';
document.characterSet = 'UTF-8';
document.title = '';
document.referrer = '';

var _docCookie = '';
Object.defineProperty(document, 'cookie', {
    get: function() { return _docCookie; },
    set: function(v) { if (v) _docCookie = _docCookie ? _docCookie + '; ' + v : v; },
    configurable: true
});

// ═══════════════════════════════════════════════════════════════
// 9. document.currentScript — SDK 框架读取 project-id
//    值需要按站点覆盖
// ═══════════════════════════════════════════════════════════════
Object.defineProperty(document, 'currentScript', {
    get: function() {
        return {
            src: '',
            getAttribute: function(n) { return null; }
        };
    },
    configurable: true
});

// ═══════════════════════════════════════════════════════════════
// 10. document.writeln — 注入远程模块
//     站点按需设置 window._remoteModules
// ═══════════════════════════════════════════════════════════════
window._remoteModules = {};
document.writeln = function(html) {
    var m = html.match(/src="([^"]+)"/);
    if (!m) return;
    var src = m[1];
    for (var k in window._remoteModules) {
        if (src.indexOf(k) >= 0 || k.indexOf(src.split('/').pop()) >= 0) {
            eval(window._remoteModules[k]);
            return;
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// 11. Observers
// ═══════════════════════════════════════════════════════════════
window.MutationObserver = function() {
    this.observe = function() {}; this.disconnect = function() {};
};
window.PerformanceObserver = function() {
    this.observe = function() {}; this.disconnect = function() {};
};

// ═══════════════════════════════════════════════════════════════
// 12. Navigator 扩展
// ═══════════════════════════════════════════════════════════════
navigator.sendBeacon = function() { return true; };
navigator.plugins = [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
    { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
    { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: '' },
];
navigator.mimeTypes = [
    { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
    { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
];
if (!navigator.languages) navigator.languages = ['zh-CN', 'zh'];
if (!navigator.language) navigator.language = 'zh-CN';

Object.defineProperty(navigator, 'connection', {
    get: function() {
        return { effectiveType: '4g', rtt: 50, downlink: 10, saveData: false };
    },
    configurable: true
});
Object.defineProperty(navigator, 'userAgentData', {
    get: function() {
        return {
            platform: 'Windows',
            brands: [{ brand: 'Chromium', version: '143' }],
            mobile: false
        };
    },
    configurable: true
});

// ═══════════════════════════════════════════════════════════════
// 13. 网络 API
// ═══════════════════════════════════════════════════════════════
window.Request = function(input) {
    this.url = typeof input === 'string' ? input : (input && input.url);
    this.method = 'GET';
};
window.Response = function(body) { this.body = body; this.status = 200; this.ok = true; };
window.Response.prototype.text = function() { return Promise.resolve(this.body || ''); };
window.Response.prototype.json = function() {
    return Promise.resolve(JSON.parse(this.body || '{}'));
};

window.Headers = function(init) { this._h = {}; if (init) Object.assign(this._h, init); };
window.Headers.prototype.get = function(k) { return this._h[k]; };
window.Headers.prototype.set = function(k, v) { this._h[k] = v; };
window.Headers.prototype.forEach = function(cb) {
    Object.entries(this._h).forEach(function(e) { cb(e[1], e[0]); });
};
window.Headers.prototype.entries = function() {
    return Object.entries(this._h)[Symbol.iterator]();
};

window.XMLHttpRequest = function() { this.readyState = 0; this.status = 0; };
window.XMLHttpRequest.prototype.open = function() { this.readyState = 1; };
window.XMLHttpRequest.prototype.setRequestHeader = function() {};
window.XMLHttpRequest.prototype.send = function() {
    this.readyState = 4; this.status = 200;
};

// ═══════════════════════════════════════════════════════════════
// 14. Storage
// ═══════════════════════════════════════════════════════════════
var _storeData = {};
window.localStorage = {
    getItem: function(k) { return _storeData[String(k)] || null; },
    setItem: function(k, v) { _storeData[String(k)] = String(v); },
    removeItem: function(k) { delete _storeData[String(k)]; },
    clear: function() { _storeData = {}; },
    get length() { return Object.keys(_storeData).length; },
    key: function(n) { return Object.keys(_storeData)[n] || null; }
};
window.sessionStorage = window.localStorage;

// ═══════════════════════════════════════════════════════════════
// 15. 浏览器特有全局
// ═══════════════════════════════════════════════════════════════
window.chrome = {
    runtime: {}, app: { isInstalled: false }, webstore: {},
    csi: function() { return { startE: Date.now() }; },
    loadTimes: function() {
        return { requestTime: Date.now() / 1000, navigationType: 'Other' };
    }
};
window.Intl = {
    DateTimeFormat: function() {
        return {
            resolvedOptions: function() {
                return { locale: 'zh-CN', timeZone: 'Asia/Shanghai' };
            }
        };
    }
};

// ═══════════════════════════════════════════════════════════════
// 16. 多媒体 / Worker
// ═══════════════════════════════════════════════════════════════
window.Image = function(w, h) {
    this.width = w || 0; this.height = h || 0;
    this.src = ''; this.onload = null; this.onerror = null;
    this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0;
};
window.Audio = function() {
    this.play = function() {}; this.pause = function() {}; this.load = function() {};
};
window.OfflineAudioContext = function(channels, length, sampleRate) {
    this.sampleRate = sampleRate || 44100;
    this.length = length || 128;
    this.numberOfChannels = channels || 2;
};
window.OfflineAudioContext.prototype = {
    createOscillator: function() {
        return { type: 'sine', frequency: { value: 440 },
                 connect: function(){}, start: function(){}, stop: function(){} };
    },
    createDynamicsCompressor: function() { return { connect: function(){} }; },
    createGain: function() { return { connect: function(){}, gain: { value: 1 } }; },
    createBiquadFilter: function() {
        return { connect: function(){}, type: 'lowpass', frequency: { value: 350 } };
    },
    createBuffer: function(c, len, sr) {
        return { getChannelData: function() { return new Float32Array(len); },
                 length: len, numberOfChannels: c, sampleRate: sr };
    },
    startRendering: function() { return Promise.resolve({}); },
    destination: {}, sampleRate: 44100,
};
window.AudioContext = window.OfflineAudioContext;
window.webkitAudioContext = window.OfflineAudioContext;

window.Worker = function() {
    this.onmessage = null; this.onerror = null;
    this.postMessage = function() {}; this.terminate = function() {};
};
window.Blob = function(parts, opts) {
    this._parts = parts; this.type = (opts || {}).type || '';
};
var _URL = window.URL || {};
_URL.createObjectURL = function() { return 'blob:mock'; };
_URL.revokeObjectURL = function() {};
window.URL = _URL;

window.EventSource = function(url) {
    this.url = url; this.readyState = 0;
    var s = this;
    setTimeout(function() { s.readyState = 1; }, 0);
};

// ═══════════════════════════════════════════════════════════════
// 17. Crypto
// ═══════════════════════════════════════════════════════════════
if (!window.crypto) window.crypto = {};
if (!window.crypto.subtle) {
    window.crypto.subtle = {
        digest: function() { return Promise.resolve(new ArrayBuffer(32)); },
        encrypt: function() { return Promise.resolve(new ArrayBuffer(32)); },
        decrypt: function() { return Promise.resolve(new ArrayBuffer(32)); },
        generateKey: function() { return Promise.resolve({}); },
        importKey: function() { return Promise.resolve({}); },
        exportKey: function() { return Promise.resolve(new ArrayBuffer(32)); },
        sign: function() { return Promise.resolve(new ArrayBuffer(32)); },
        verify: function() { return Promise.resolve(true); },
    };
}

// ═══════════════════════════════════════════════════════════════
// 18. fetch — 默认 mock (站点按需覆盖为 capture 版本)
// ═══════════════════════════════════════════════════════════════
window.fetch = function() {
    return Promise.resolve({
        status: 200, ok: true,
        text: function() { return Promise.resolve('{}'); },
        json: function() { return Promise.resolve({}); },
    });
};
