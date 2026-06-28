/**
 * sign.js — 今日头条 _signature 签名 (纯 Node.js 补环境方案)
 * ================================================================
 *
 * 基于 acrawler.js (71KB, _$jsvmprt JSVMP 保护) 在 Node.js vm 沙箱中
 * 通过补环境 + JSONP 网络请求生成 _signature 参数。
 *
 * 核心路径:
 *   1. vm.createContext 创建隔离沙箱
 *   2. 构建浏览器环境 (Window/Document/Navigator/Canvas/WebGL/...)
 *   3. Hook Object.prototype.toString 绕过 domDetect
 *   4. nativeFn 包装绕过 hookDetect
 *   5. 拦截 document.createElement('script') → 捕获 JSONP URL
 *   6. instanceof 安全化 patch → 避免 VM 字节码崩溃
 *   7. 加载 acrawler.js → byted_acrawler 可用
 *   8. init() + JSONP 真实 HTTP 请求 → 内部状态完整
 *   9. sign({url, body?}) → 47 字符 _signature (可通过 API 验证)
 *
 * 用法:
 *   const { ToutiaoSigner } = require('./sign');
 *   const signer = new ToutiaoSigner({ cookie: 'tt_webid=...' });
 *   await signer.init();
 *   const sig = signer.sign('/article/v4/tab_comments/?aid=24&...');
 *   // => "_02B4Z6wo00f01..."
 */

const vm = require("vm");
const https = require("https");
const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

// ═══════════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════════

/** 将函数伪装为 native code */
function nativeFn(name, fn) {
  const wrapper = function (...args) {
    return fn.apply(this, args);
  };
  Object.defineProperty(wrapper, "name", { value: name, configurable: true });
  wrapper.toString = () => `function ${name}() { [native code] }`;
  return wrapper;
}

/** HTTP/HTTPS GET 请求 */
function fetchUrl(targetUrl, cookie) {
  return new Promise((resolve, reject) => {
    const u = new url.URL(targetUrl);
    const mod = u.protocol === "https:" ? https : http;
    const opts = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Referer: "https://www.toutiao.com/",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      timeout: 10000,
    };
    const req = mod.request(opts, (res) => {
      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(data);
        } else {
          reject(
            new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`)
          );
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════
// 浏览器环境构建 (注入到 vm 沙箱的 JS 代码)
// ═══════════════════════════════════════════════════════════════════

function buildEnvScript(cookieStr) {
  return `
// ═══════════════════════════════════════════════════════════
// 0. 顶层引用 — 必须在所有代码之前
// ═══════════════════════════════════════════════════════════
var _win = this;
var window = _win;
var self = _win;
var top = _win;
var parent = _win;
var globalThis = _win;
var document = { cookie: ${JSON.stringify(cookieStr)} };
var navigator = {};
var screen = {};
var location = { href: 'https://www.toutiao.com/' };
var history = {};

// ========== 1. Storage ==========
function Storage() { this._data = {}; }
Storage.prototype.getItem = function(k) {
  return Object.prototype.hasOwnProperty.call(this._data, String(k))
    ? this._data[String(k)] : null;
};
Storage.prototype.setItem = function(k, v) {
  this._data[String(k)] = String(v);
};
Storage.prototype.removeItem = function(k) {
  delete this._data[String(k)];
};
Storage.prototype.clear = function() { this._data = {}; };
Object.defineProperty(Storage.prototype, 'length', {
  get: function() { return Object.keys(this._data).length; }
});
Storage.prototype.key = function(n) {
  return Object.keys(this._data)[n] || null;
};

// ========== 2. Location ==========
function Location() {
  this._url = new URL('https://www.toutiao.com/');
}
['href','protocol','host','hostname','pathname','search','hash'].forEach(function(p) {
  Object.defineProperty(Location.prototype, p, {
    get: function() { return this._url[p]; },
    set: function(v) { try { this._url[p] = String(v); } catch(e) {} },
    configurable: true, enumerable: true
  });
});
Object.defineProperty(Location.prototype, 'origin', {
  get: function() { return this._url.origin; },
  configurable: true, enumerable: true
});
Location.prototype.toString = function() { return this.href; };
Location.prototype.assign = function() {};
Location.prototype.replace = function() {};
Location.prototype.reload = function() {};

// ========== 3. Navigator ==========
function Navigator() {}
Object.defineProperty(Navigator.prototype, Symbol.toStringTag, {
  value: 'Navigator', configurable: true
});
Object.defineProperties(Navigator.prototype, {
  userAgent: { get: function() { return ${JSON.stringify(UA)}; },
    configurable: true, enumerable: true },
  platform: { value: 'Win32', configurable: true, enumerable: true },
  vendor: { value: 'Google Inc.', configurable: true, enumerable: true },
  language: { value: 'zh-CN', configurable: true, enumerable: true },
  languages: { value: ['zh-CN', 'zh'], configurable: true, enumerable: true },
  hardwareConcurrency: { value: 8, configurable: true, enumerable: true },
  deviceMemory: { value: 8, configurable: true, enumerable: true },
  maxTouchPoints: { value: 0, configurable: true, enumerable: true },
  webdriver: { value: false, configurable: true, enumerable: true },
  cookieEnabled: { value: true, configurable: true, enumerable: true },
  onLine: { value: true, configurable: true, enumerable: true },
  doNotTrack: { value: null, configurable: true, enumerable: true },
  productSub: { value: '20030107', configurable: true, enumerable: true },
  vendorSub: { value: '', configurable: true, enumerable: true },
  appVersion: { get: function() { return this.userAgent; },
    configurable: true, enumerable: true },
  appCodeName: { value: 'Mozilla', configurable: true, enumerable: true },
  plugins: { value: [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer',
      description: 'Portable Document Format', length: 1 },
    { name: 'Chrome PDF Viewer',
      filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
      description: 'Portable Document Format', length: 1 },
    { name: 'Native Client', filename: 'internal-nacl-plugin',
      description: '', length: 1 },
  ], configurable: true, enumerable: true },
  mimeTypes: { value: [
    { type: 'application/pdf', suffixes: 'pdf',
      description: 'Portable Document Format' },
  ], configurable: true, enumerable: true },
  connection: { value: {
    effectiveType: '4g', rtt: 50, downlink: 10, saveData: false
  }, configurable: true, enumerable: true },
  userAgentData: { value: {
    platform: 'Windows',
    brands: [{ brand: 'Chromium', version: '143' }, { brand: 'Google Chrome', version: '143' }],
    mobile: false
  }, configurable: true, enumerable: true },
});
Navigator.prototype.sendBeacon = function() { return true; };
Navigator.prototype.javaEnabled = function() { return false; };

// ========== 4. Screen ==========
function Screen() {}
Object.defineProperty(Screen.prototype, Symbol.toStringTag, {
  value: 'Screen', configurable: true
});
Object.defineProperties(Screen.prototype, {
  width: { value: 1920, configurable: true, enumerable: true },
  height: { value: 1080, configurable: true, enumerable: true },
  availWidth: { value: 1920, configurable: true, enumerable: true },
  availHeight: { value: 1040, configurable: true, enumerable: true },
  colorDepth: { value: 24, configurable: true, enumerable: true },
  pixelDepth: { value: 24, configurable: true, enumerable: true },
  orientation: { value: {
    type: 'landscape-primary', angle: 0, onchange: null
  }, configurable: true, enumerable: true },
});

// ========== 5. History ==========
function History() {}
Object.defineProperty(History.prototype, Symbol.toStringTag, {
  value: 'History', configurable: true
});
History.prototype.back = function() {};
History.prototype.forward = function() {};
History.prototype.go = function() {};
History.prototype.pushState = function() {};
History.prototype.replaceState = function() {};

// ========== 6. Window ==========
function Window() {}
Object.defineProperties(Window.prototype, {
  innerWidth: { value: 1920, writable: true },
  innerHeight: { value: 1080, writable: true },
  outerWidth: { value: 1936, writable: true },
  outerHeight: { value: 1112, writable: true },
  screenX: { value: 0, writable: true },
  screenY: { value: 0, writable: true },
  pageXOffset: { value: 0, writable: true },
  pageYOffset: { value: 0, writable: true },
  devicePixelRatio: { value: 1.25, writable: true },
  clientWidth: { get: function() { return 1920; }, configurable: true },
  clientHeight: { get: function() { return 1080; }, configurable: true },
  sizeWidth: { get: function() { return 1920; }, configurable: true },
  sizeHeight: { get: function() { return 1080; }, configurable: true },
});
// _rafId — 由外层 Node 代码传入 (vm 内无 setTimeout)
var _rafId = 0;
Window.prototype.requestAnimationFrame = function(cb) {
  return ++_rafId;
};
Window.prototype.cancelAnimationFrame = function(id) {};
Window.prototype.addEventListener = function() {};
Window.prototype.removeEventListener = function() {};
Window.prototype.dispatchEvent = function() { return true; };
Window.prototype.open = function() { return null; };
Window.prototype.close = function() {};
Window.prototype.focus = function() {};
Window.prototype.blur = function() {};
Window.prototype.postMessage = function() {};
Window.prototype.matchMedia = function() {
  return { matches: false, media: '', addListener: function() {} };
};
Window.prototype.getComputedStyle = function() {
  return { getPropertyValue: function() { return ''; } };
};
Window.prototype.atob = function(s) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var str = String(s).replace(/=+$/, '');
  var result = '';
  for (var i = 0, bs; i < str.length; i += 4) {
    bs = (chars.indexOf(str[i]) << 18) | (chars.indexOf(str[i+1]) << 12) |
         (chars.indexOf(str[i+2]) << 6) | chars.indexOf(str[i+3]);
    result += String.fromCharCode((bs >> 16) & 255, (bs >> 8) & 255, bs & 255);
  }
  return result.slice(0, result.length - (str.length % 4 ? 4 - str.length % 4 : 0));
};
Window.prototype.btoa = function(s) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var str = String(s);
  var result = '';
  for (var i = 0; i < str.length; i += 3) {
    var a = str.charCodeAt(i), b = str.charCodeAt(i+1), c = str.charCodeAt(i+2);
    result += chars[a >> 2] + chars[((a & 3) << 4) | (b >> 4)] +
              (i+1 < str.length ? chars[((b & 15) << 2) | (c >> 6)] : '=') +
              (i+2 < str.length ? chars[c & 63] : '=');
  }
  return result;
};

// ========== 7. Document ==========
function Document() {}
Object.defineProperty(Document.prototype, Symbol.toStringTag, {
  value: 'HTMLDocument', configurable: true
});

// document.cookie
var _cookieStore = ${JSON.stringify(cookieStr)};
Object.defineProperty(Document.prototype, 'cookie', {
  get: function() { return _cookieStore; },
  set: function(v) {
    v = String(v).trim();
    if (!v) return;
    if (_cookieStore) _cookieStore += '; ' + v;
    else _cookieStore = v;
  },
  configurable: true, enumerable: true
});

// document.createElement — 核心: 拦截 script 创建以捕获 JSONP URL
// _jsonpQueue 由外层 Node.js 代码读取
_jsonpQueue = [];
var _scriptCounter = 0;

Document.prototype.createElement = function(tagName) {
  var tag = String(tagName || '').toLowerCase();
  var el = {
    tagName: tag.toUpperCase(),
    style: {},
    attributes: {},
    children: [],
    childNodes: [],
    innerHTML: '',
    setAttribute: function(k, v) { this.attributes[k] = v; },
    getAttribute: function(k) { return this.attributes[k] || null; },
    appendChild: function(child) {
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    },
    removeChild: function(child) {
      var i = this.children.indexOf(child);
      if (i >= 0) { this.children.splice(i, 1); this.childNodes.splice(i, 1); }
      return child;
    },
    addEventListener: function() {},
    removeEventListener: function() {},
    getElementsByTagName: function() { return []; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    insertBefore: function() {},
    replaceChild: function() {},
    cloneNode: function() { return document.createElement(tag); },
    hasChildNodes: function() { return this.children.length > 0; },
  };

  // ---- script 标签: JSONP 拦截 ----
  if (tag === 'script') {
    var scriptEl = Object.create(el);
    scriptEl.type = 'text/javascript';
    scriptEl.async = true;
    scriptEl.defer = false;
    scriptEl.onload = null;
    scriptEl.onerror = null;
    scriptEl.onreadystatechange = null;
    scriptEl._id = ++_scriptCounter;

    var _src = '';
    Object.defineProperty(scriptEl, 'src', {
      get: function() { return _src; },
      set: function(v) {
        _src = String(v || '');
        if (_src && (_src.startsWith('http://') || _src.startsWith('https://'))) {
          // 捕获 JSONP URL，稍后由 Node.js 发起真实请求
          _jsonpQueue.push({
            url: _src,
            id: scriptEl._id,
            el: scriptEl
          });
        }
      },
      configurable: true, enumerable: true
    });
    return scriptEl;
  }

  // ---- canvas 标签: 提供 getContext ----
  if (tag === 'canvas') {
    el.width = 300;
    el.height = 150;
    el.getContext = function(type) {
      if (type === '2d') {
        return _createCanvas2D(el);
      }
      if (type === 'webgl' || type === 'experimental-webgl') {
        return _createWebGL(el);
      }
      return null;
    };
    el.toDataURL = function() { return 'data:image/png;base64,'; };
    el.toDataURL.toString = function() {
      return 'function toDataURL() { [native code] }';
    };
    el.toBlob = function() {};
  }

  return el;
};

// ---- Canvas 2D Context ----
function _createCanvas2D(canvas) {
  return {
    canvas: canvas,
    font: '10px sans-serif',
    fillStyle: '#000000', strokeStyle: '#000000',
    lineWidth: 1, globalAlpha: 1,
    textAlign: 'start', textBaseline: 'alphabetic',
    fillRect: function(){}, strokeRect: function(){},
    clearRect: function(){},
    fillText: function(){}, strokeText: function(){},
    beginPath: function(){}, closePath: function(){},
    moveTo: function(){}, lineTo: function(){},
    arc: function(){}, rect: function(){},
    fill: function(){}, stroke: function(){},
    clip: function(){},
    save: function(){}, restore: function(){},
    scale: function(){}, rotate: function(){},
    translate: function(){}, transform: function(){},
    setTransform: function(){},
    measureText: function(t) {
      return { width: (t||'').length * 6, actualBoundingBoxAscent: 10,
               actualBoundingBoxDescent: 2 };
    },
    getImageData: function(x, y, w, h) {
      var d = new Uint8ClampedArray(w*h*4);
      for (var i = 0; i < d.length; i++) d[i] = Math.floor(Math.random()*256);
      return { data: d, width: w, height: h, colorSpace: 'srgb' };
    },
    createLinearGradient: function() {
      return { addColorStop: function(){} };
    },
    createRadialGradient: function() {
      return { addColorStop: function(){} };
    },
    createPattern: function() { return {}; },
    drawImage: function(){}, putImageData: function(){},
    isPointInPath: function(){ return false; },
    isPointInStroke: function(){ return false; },
    createImageData: function(w,h) {
      return { data: new Uint8ClampedArray(w*h*4), width: w, height: h };
    },
    setLineDash: function(){}, getLineDash: function(){ return []; },
  };
}

// ---- WebGL Context ----
function _createWebGL(canvas) {
  var _params = {
    3415: 0, 7936: 'WebKit', 7937: 'WebKit WebGL',
    3379: 16384, 37445: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11-30.0.100.9864)',
    37446: 'Google Inc. (Intel)',
  };
  return {
    canvas: canvas,
    drawingBufferWidth: 300, drawingBufferHeight: 150,
    getParameter: function(p) { return _params[p] !== undefined ? _params[p] : 0; },
    getExtension: function(n) {
      if (n === 'WEBGL_debug_renderer_info')
        return { UNMASKED_VENDOR_WEBGL: 37446, UNMASKED_RENDERER_WEBGL: 37445 };
      if (n === 'EXT_texture_filter_anisotropic')
        return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 16 };
      return null;
    },
    getSupportedExtensions: function() {
      return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_color_buffer_half_float',
              'EXT_texture_filter_anisotropic','OES_texture_float','OES_texture_half_float',
              'WEBGL_color_buffer_float','WEBGL_debug_renderer_info','WEBGL_lose_context'];
    },
    getShaderPrecisionFormat: function() {
      return { rangeMin: 127, rangeMax: 127, precision: 23 };
    },
    getContextAttributes: function() {
      return { alpha: true, antialias: true, depth: true, stencil: false,
               premultipliedAlpha: true, preserveDrawingBuffer: false,
               powerPreference: 'default', failIfMajorPerformanceCaveat: false };
    },
    activeTexture: function(){}, attachShader: function(){}, bindBuffer: function(){},
    bindTexture: function(){}, blendFunc: function(){}, bufferData: function(){},
    clear: function(){}, clearColor: function(){}, compileShader: function(){},
    createBuffer: function(){ return {}; }, createProgram: function(){ return {}; },
    createShader: function(t) { return { shaderType: t }; },
    createTexture: function(){ return {}; },
    deleteBuffer: function(){}, deleteProgram: function(){},
    deleteShader: function(){}, deleteTexture: function(){},
    depthFunc: function(){}, disable: function(){},
    drawArrays: function(){}, drawElements: function(){},
    enable: function(){}, enableVertexAttribArray: function(){},
    framebufferTexture2D: function(){}, generateMipmap: function(){},
    getAttribLocation: function(){ return 0; },
    getProgramInfoLog: function(){ return ''; },
    getProgramParameter: function(){ return true; },
    getShaderInfoLog: function(){ return ''; },
    getShaderParameter: function(){ return true; },
    getUniformLocation: function(){ return {}; },
    linkProgram: function(){}, pixelStorei: function(){},
    readPixels: function(){}, scissor: function(){},
    shaderSource: function(){}, texImage2D: function(){},
    texParameteri: function(){},
    uniform1f: function(){}, uniform1i: function(){},
    uniform2f: function(){}, uniform3f: function(){}, uniform4f: function(){},
    uniformMatrix4fv: function(){}, useProgram: function(){},
    vertexAttribPointer: function(){}, viewport: function(){},
  };
}

// document 属性 — 先创建基础对象，实例化后再 replace
var _htmlEl = { tagName: 'HTML', style: {}, children: [], childNodes: [],
  appendChild: function(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
  setAttribute: function(){}, getAttribute: function(){ return null; },
  addEventListener: function(){}, removeEventListener: function(){},
  getElementsByTagName: function() { return []; },
  querySelector: function() { return null; }, querySelectorAll: function() { return []; },
};
var _headEl = { tagName: 'HEAD', style: {}, children: [], childNodes: [],
  appendChild: function(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
  setAttribute: function(){}, getAttribute: function(){ return null; },
  addEventListener: function(){}, removeEventListener: function(){},
  getElementsByTagName: function() { return []; },
  querySelector: function() { return null; }, querySelectorAll: function() { return []; },
};
var _bodyEl = { tagName: 'BODY', style: {}, children: [], childNodes: [],
  appendChild: function(c) { this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
  setAttribute: function(){}, getAttribute: function(){ return null; },
  addEventListener: function(){}, removeEventListener: function(){},
  getElementsByTagName: function() { return []; },
  querySelector: function() { return null; }, querySelectorAll: function() { return []; },
  clientWidth: 1920, clientHeight: 1080,
};

_htmlEl.appendChild(_headEl);
_htmlEl.appendChild(_bodyEl);

Document.prototype.documentElement = _htmlEl;
Document.prototype.head = _headEl;
Document.prototype.body = _bodyEl;

Document.prototype.referrer = '';
Document.prototype.title = '';
Document.prototype.readyState = 'complete';
Document.prototype.hidden = false;
Document.prototype.visibilityState = 'visible';
Document.prototype.characterSet = 'UTF-8';
Document.prototype.charset = 'UTF-8';
Document.prototype.inputEncoding = 'UTF-8';
Document.prototype.contentType = 'text/html';
Document.prototype.documentURI = 'https://www.toutiao.com/';
Document.prototype.baseURI = 'https://www.toutiao.com/';
Document.prototype.URL = 'https://www.toutiao.com/';
Document.prototype.domain = 'toutiao.com';

Document.prototype.all = undefined;
Document.prototype.forms = [];
Document.prototype.links = [];
Document.prototype.images = [];
Document.prototype.scripts = [];
Document.prototype.embeds = [];
Document.prototype.plugins = [];
Document.prototype.styleSheets = [];

Document.prototype.createElementNS = function(ns, tag) {
  return document.createElement(tag);
};
Document.prototype.createEvent = function(type) {
  return { type: type, initEvent: function() {} };
};
Document.prototype.createTextNode = function(t) {
  return { nodeType: 3, textContent: String(t||''), nodeValue: String(t||'') };
};
Document.prototype.createComment = function(t) {
  return { nodeType: 8, textContent: String(t||'') };
};
Document.prototype.createDocumentFragment = function() {
  return document.createElement('div');
};
Document.prototype.getElementById = function() { return null; };
Document.prototype.getElementsByClassName = function() { return []; };
Document.prototype.getElementsByName = function() { return []; };
Document.prototype.getElementsByTagName = function(t) {
  t = (t||'').toLowerCase();
  if (t === 'head') return [document.head];
  if (t === 'body') return [document.body];
  if (t === 'html') return [document.documentElement];
  return [];
};
Document.prototype.querySelector = function() { return null; };
Document.prototype.querySelectorAll = function() { return []; };
Document.prototype.addEventListener = function() {};
Document.prototype.removeEventListener = function() {};
Document.prototype.hasFocus = function() { return false; };
Document.prototype.execCommand = function() { return false; };

// ========== 8. XMLHttpRequest ==========
function XMLHttpRequest() {
  this.readyState = 0; this.status = 0; this.statusText = '';
  this.responseText = ''; this.responseXML = null;
  this.response = ''; this.responseType = '';
  this.timeout = 0; this.withCredentials = false;
  this.onreadystatechange = null; this.onload = null;
  this.onerror = null; this.ontimeout = null;
  this._requestHeaders = {};
}
XMLHttpRequest.UNSENT = 0;
XMLHttpRequest.OPENED = 1;
XMLHttpRequest.HEADERS_RECEIVED = 2;
XMLHttpRequest.LOADING = 3;
XMLHttpRequest.DONE = 4;
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
  this._method = method; this._url = url;
  this.readyState = 1;
  if (this.onreadystatechange) this.onreadystatechange();
};
XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
  this._requestHeaders[k] = v;
};
XMLHttpRequest.prototype.send = function(body) {
  var self = this;
  this.readyState = 4;
  this.status = 200;
  this.statusText = 'OK';
  this.responseText = '';
  this.response = '';
  if (self.onreadystatechange) self.onreadystatechange();
  if (self.onload) self.onload();
};
XMLHttpRequest.prototype.abort = function() {};
XMLHttpRequest.prototype.getResponseHeader = function() { return null; };
XMLHttpRequest.prototype.getAllResponseHeaders = function() { return ''; };

// ========== 9. 全局构造函数 ==========
function Image(w, h) {
  this.width = w || 0; this.height = h || 0;
  this.src = ''; this.onload = null; this.onerror = null;
  this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0;
}
function EventSource(url) {
  this.url = url; this.readyState = 0;
  this.onopen = null; this.onmessage = null; this.onerror = null;
}
function MessageChannel() {
  var _cb = null;
  this.port1 = { postMessage: function(m) { if (_cb) _cb({data:m}); } };
  this.port2 = {};
  Object.defineProperty(this.port2, 'onmessage', {
    get: function() { return _cb; }, set: function(fn) { _cb = fn; }
  });
}
function Worker() {
  this.onmessage = null; this.onerror = null;
  this.postMessage = function() {}; this.terminate = function() {};
}
function Blob(parts, opts) {
  this._parts = parts; this.type = (opts||{}).type || '';
  this.size = parts ? parts.join('').length : 0;
}
var _blobUrls = {};
if (typeof URL !== 'undefined') {
  URL.createObjectURL = function(blob) {
    var id = 'blob:' + Math.random().toString(36).slice(2);
    _blobUrls[id] = blob; return id;
  };
  URL.revokeObjectURL = function(id) { delete _blobUrls[id]; };
}

// ========== 10. 其他全局 ==========
window.chrome = {
  runtime: {}, app: { isInstalled: false }, webstore: {},
  csi: function() { return { startE: Date.now(), onloadT: Date.now(), pageT: 100 }; },
  loadTimes: function() {
    return { requestTime: Date.now()/1000, startLoadTime: Date.now()/1000,
             commitLoadTime: Date.now()/1000, finishDocumentLoadTime: Date.now()/1000,
             finishLoadTime: Date.now()/1000, firstPaintTime: Date.now()/1000,
             navigationType: 'Other', wasFetchedViaSpdy: false, wasNpnNegotiated: false,
             npnNegotiatedProtocol: 'unknown', connectionInfo: 'http/1.1' };
  }
};
window.Intl = {
  DateTimeFormat: function() {
    return { resolvedOptions: function() {
      return { locale:'zh-CN', calendar:'gregory', numberingSystem:'latn',
               timeZone:'Asia/Shanghai', year:'numeric', month:'numeric', day:'numeric' };
    }};
  }
};
window.MutationObserver = function() {
  this.observe = function() {}; this.disconnect = function() {};
};
window.PerformanceObserver = function() {
  this.observe = function() {}; this.disconnect = function() {};
};
window.setImmediate = function(fn) { return fn(); };
window.clearImmediate = function(id) {};

window.crypto = window.crypto || {};
window.crypto.getRandomValues = function(buf) {
  for (var i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random()*256);
  return buf;
};
if (!window.crypto.subtle) {
  window.crypto.subtle = {
    digest: function(algo, data) { return Promise.resolve(new ArrayBuffer(32)); },
    encrypt: function(algo, key, data) { return Promise.resolve(new ArrayBuffer(32)); },
    decrypt: function(algo, key, data) { return Promise.resolve(new ArrayBuffer(32)); },
    generateKey: function() { return Promise.resolve({}); },
    importKey: function() { return Promise.resolve({}); },
    exportKey: function() { return Promise.resolve(new ArrayBuffer(32)); },
    sign: function() { return Promise.resolve(new ArrayBuffer(32)); },
    verify: function() { return Promise.resolve(true); },
  };
}

// ========== 11. 实例化 & 挂载 ==========
var _win = this;
Object.setPrototypeOf(_win, Window.prototype);

var _navigator = new Navigator();
var _screen = new Screen();
var _history = new History();
var _location = new Location();
var _document = new Document();
var _localStorage = new Storage();
var _sessionStorage = new Storage();

_win.window = _win;
_win.self = _win;
_win.top = _win;
_win.parent = _win;
_win.frames = _win;
_win.globalThis = _win;
_win.navigator = _navigator;
_win.screen = _screen;
_win.history = _history;
_win.location = _location;
_win.document = _document;
_win.localStorage = _localStorage;
_win.sessionStorage = _sessionStorage;

_win.XMLHttpRequest = XMLHttpRequest;
_win.Image = Image;
_win.EventSource = EventSource;
_win.MessageChannel = MessageChannel;
_win.Worker = Worker;
_win.Blob = Blob;

_document.location = _location;
_document.defaultView = _win;

// 今日头条特有全局
_win.onwheelx = { _Ax: '0X21' };
_win._sdkGlueVersionMap = {
  sdkGlueVersion: '1.0.0.55',
  bdmsVersion: '1.0.1.7',
  captchaVersion: '4.0.2'
};

// ========== 12. domDetect bypass: Object.prototype.toString Hook ==========
(function() {
  var _origToString = Object.prototype.toString;
  var _globalObj = _win;
  Object.prototype.toString = function() {
    try {
      if (this === _globalObj) return '[object Window]';
    } catch(e) {}
    return _origToString.call(this);
  };
})();

// ========== 13. hookDetect bypass: native code toString 伪装 ==========
// createElement.toString() 必须含 "native code"
Document.prototype.createElement.toString = function() {
  return 'function createElement() { [native code] }';
};
`;
}

// ═══════════════════════════════════════════════════════════════════
// ToutiaoSigner 类
// ═══════════════════════════════════════════════════════════════════

class ToutiaoSigner {
  /**
   * @param {Object} options
   * @param {string} options.cookie - 浏览器 Cookie 字符串 (用于 JSONP 请求)
   * @param {boolean} options.debug - 启用调试日志
   * @param {boolean} options.skipJsonp - 跳过 JSONP 请求 (调试用, 仅生成短签名)
   */
  constructor(options = {}) {
    this._cookie = options.cookie || "";
    this._debug = options.debug || false;
    this._skipJsonp = options.skipJsonp || false;
    this._ready = false;
    this._context = null;
    this._jsonpQueue = [];
  }

  _log(...args) {
    if (this._debug) console.log("[sign]", ...args);
  }

  /**
   * 异步初始化: 加载 acrawler.js, 执行 init(), 处理 JSONP 请求
   */
  async init() {
    this._log("初始化签名器...");

    // 1. 读取 acrawler.js 源码并做 instanceof 安全化 patch
    const acrawlerPath = path.join(__dirname, "acrawler.js");
    let acrawlerCode = fs.readFileSync(acrawlerPath, "utf-8");

    // instanceof 安全化 patch:
    // S[R]=S[R]instanceof C → S[R]=C!=null?S[R]instanceof C:false
    const before = acrawlerCode.length;
    acrawlerCode = acrawlerCode.replace(
      /S\[R\]=S\[R\]instanceof C/g,
      "S[R]=C!=null?S[R]instanceof C:false"
    );
    this._log(
      `instanceof patch: ${acrawlerCode.length - before} bytes changed`
    );

    // 2. 构建浏览器环境脚本
    const cookieInit = this._cookie || "";
    const envScript = buildEnvScript(cookieInit);

    // 3. 创建 vm 沙箱
    // 提供 URL (Location 需要), setTimeout/clearTimeout (no-op, 防止异步回调崩溃)
    this._context = vm.createContext({
      URL: url.URL,
      setTimeout: function () { return 0; },
      clearTimeout: function () {},
      setInterval: function () { return 0; },
      clearInterval: function () {},
    });

    // 4. 注入环境
    vm.runInContext(envScript, this._context);
    this._log("浏览器环境已注入");

    // 5. 加载 acrawler.js (JSVMP) — toString hook 已包含在 env 中
    try {
      vm.runInContext(acrawlerCode, this._context);
      this._log("acrawler.js 加载完成");
    } catch (e) {
      this._log("acrawler.js 加载失败:", e.message);
      throw e;
    }

    // 7. 检查 byted_acrawler 是否存在
    const btType = vm.runInContext(
      "typeof window.byted_acrawler",
      this._context
    );
    this._log(`byted_acrawler type: ${btType}`);

    if (btType === "undefined") {
      throw new Error(
        "window.byted_acrawler not found — acrawler.js 可能加载失败"
      );
    }

    // 8. 调用 init() → 触发 JSONP 请求
    this._log("调用 byted_acrawler.init({aid:24, dfp:true})...");
    vm.runInContext(
      "window.byted_acrawler.init({aid:24, dfp:true})",
      this._context
    );

    // 9. 获取 JSONP 队列
    this._jsonpQueue = vm.runInContext("_jsonpQueue", this._context) || [];
    this._log(`JSONP 队列: ${this._jsonpQueue.length} 个请求`);

    // 10. 执行 JSONP 请求 (可选 — 失败则走短签名路径)
    if (!this._skipJsonp) {
      this._jsonpDone = false;
      for (let i = 0; i < this._jsonpQueue.length; i++) {
      const { url: jsonpUrl, el } = this._jsonpQueue[i];
      try {
        this._log(
          `JSONP [${i + 1}/${this._jsonpQueue.length}] ${jsonpUrl.slice(0, 80)}...`
        );
        const responseText = await fetchUrl(jsonpUrl, this._cookie);
        this._log(`  响应: ${responseText.slice(0, 100)}`);

        // 在沙箱中执行 JSONP 回调
        vm.runInContext(responseText, this._context);

        // 触发 onload
        if (el && el.onload) {
          vm.runInContext(
            `(_jsonpQueue[${i}].el.onload)()`,
            this._context
          );
        }
      } catch (e) {
        this._log(`  JSONP 失败: ${e.message.slice(0, 150)}`);
        // 即使 JSONP 失败也继续 — 会退化为 47 字符短签名
      }
    }
    this._jsonpDone = true;
    } // end skipJsonp if

    // 11. 验证 sign 函数
    const signType = vm.runInContext(
      "typeof window.byted_acrawler.sign",
      this._context
    );
    this._log(`byted_acrawler.sign type: ${signType}`);

    if (signType !== "function") {
      throw new Error("window.byted_acrawler.sign is not a function");
    }

    this._ready = true;
    this._log("初始化完成 ✓");
  }

  /**
   * 生成 _signature
   * @param {string} apiPath - API 路径 (如 '/article/v4/tab_comments/?aid=24&...')
   * @param {Object|string} [body] - POST 请求体 (可选)
   * @returns {string} _signature 字符串
   */
  sign(apiPath, body) {
    if (!this._ready) {
      throw new Error("Signer not initialized. Call await init() first.");
    }

    // 构造完整 URL
    const fullUrl = apiPath.startsWith("http")
      ? apiPath
      : `https://www.toutiao.com${apiPath.startsWith("/") ? "" : "/"}${apiPath}`;

    const input = { url: fullUrl };
    if (body) {
      input.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const inputJson = JSON.stringify(input);
    const result = vm.runInContext(
      `window.byted_acrawler.sign(${inputJson})`,
      this._context
    );

    return String(result || "");
  }

  /**
   * 获取签名长度模式 (便于调试)
   */
  getMode(signature) {
    if (!signature || signature.length < 10) return "unknown";
    // 格式: _02B4Z6wo + mode(3chars) + ...
    if (signature.length >= 13) {
      return signature.slice(10, 13);
    }
    return "unknown";
  }

  /**
   * 清理资源
   */
  close() {
    this._context = null;
    this._ready = false;
    this._jsonpQueue = [];
  }
}

module.exports = { ToutiaoSigner };
