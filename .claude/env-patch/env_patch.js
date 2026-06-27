/**
 * env_patch.js — 通用浏览器环境补丁（Object.create 原型链方案）
 * ================================================================
 *
 * 核心理念：在 Node.js 中构建"看起来和真浏览器一样"的原型链。
 * 不使用 JSDOM → 完全手工 Object.create 原型链 + Symbol.toStringTag +
 * Object.defineProperty getter + native toString 保护。
 *
 * 用法:
 *   const { setupEnv } = require('./env_patch.js');
 *   setupEnv({
 *     url: 'https://example.com/',
 *     userAgent: 'Mozilla/5.0 ...',
 *     platform: 'Win32',
 *     screenWidth: 1920, screenHeight: 1080,
 *     cookie: '',
 *   });
 *   // 现在 global.window / document / navigator 等全部就绪
 *   // 直接 eval / require 目标 JS 即可
 *
 * 配置项（全部可选，有默认值）:
 *   url              - 页面 URL（影响 location.href / origin / referrer）
 *   userAgent        - navigator.userAgent
 *   platform         - navigator.platform，默认 "Win32"
 *   languages        - navigator.languages，默认 ["zh-CN", "zh"]
 *   screenWidth      - screen.width，默认 1920
 *   screenHeight     - screen.height，默认 1080
 *   availWidth       - screen.availWidth，默认 = screenWidth
 *   availHeight      - screen.availHeight，默认 = screenHeight - 40
 *   colorDepth       - screen.colorDepth，默认 24
 *   devicePixelRatio - window.devicePixelRatio，默认 1
 *   cookie           - document.cookie 初始值，默认 ""
 *   title            - document.title，默认 ""
 *   hardwareConcurrency - navigator.hardwareConcurrency，默认 8
 *   maxTouchPoints   - navigator.maxTouchPoints，默认 0
 *   vendor           - navigator.vendor，默认 "Google Inc."
 *
 *   canvas           - 是否包含 Canvas 2D stub，默认 true
 *   webgl            - 是否包含 WebGL stub，默认 false
 *   plugins          - 是否包含 navigator.plugins/mimeTypes，默认 true
 *   storage          - 是否包含 localStorage/sessionStorage，默认 true
 *   extraConstructors- 是否注入 200+ 浏览器构造函数，默认 true
 *   crypto           - 是否使用 Node.js crypto 填充 Web Crypto，默认 true
 *
 *   windowToGlobal   - 是否让 window === global，默认 true
 *                     设为 false 时 window 是独立对象（用于 vm 沙箱）
 *
 * 返回值:
 *   { nav, doc, loc, scr, hist, perf, cryptoObj } — 各浏览器对象引用
 */

const nodeCrypto = (() => { try { return require('crypto'); } catch (_) { return null; } })();

// ═══════════════════════════════════════════════════════════════
// 1. Native toString 保护工具
// ═══════════════════════════════════════════════════════════════
const _nativeMap = new Map();
const _realToString = Function.prototype.toString;

function sn(obj, name) {
  _nativeMap.set(obj, `function ${name}() { [native code] }`);
  if (obj.prototype) obj.prototype.constructor = obj;
}

function mf(name) {
  const f = function () {};
  sn(f, name);
  Object.defineProperty(f, 'name', { value: name, writable: false, configurable: true });
  return f;
}

function mc(name) {
  const f = function () {};
  f.prototype = { constructor: f };
  sn(f, name);
  Object.defineProperty(f, 'name', { value: name, writable: false, configurable: true });
  return f;
}

// ═══════════════════════════════════════════════════════════════
// 2. 构造函数层级（Object.create 原型链）
// ═══════════════════════════════════════════════════════════════
const ST = Symbol.toStringTag;

function _defineProto(Ctor, ParentCtor, tag) {
  Ctor.prototype = Object.create(ParentCtor.prototype);
  Ctor.prototype[ST] = tag;
  sn(Ctor, tag);
  Object.defineProperty(Ctor, 'name', { value: tag, writable: false, configurable: true });
}

// ── 根：EventTarget ──
function EventTarget() { }
sn(EventTarget, 'EventTarget');
Object.defineProperty(EventTarget, 'name', { value: 'EventTarget', writable: false, configurable: true });

// ── Window ──
function Window() { }
_defineProto(Window, EventTarget, 'Window');

// ── Navigator ──
function Navigator() { }
_defineProto(Navigator, EventTarget, 'Navigator');

// ── Document (HTMLDocument) ──
function HTMLDocument() { }
_defineProto(HTMLDocument, EventTarget, 'HTMLDocument');

// ── HTMLElement 家族 ──
function HTMLElement() { }
_defineProto(HTMLElement, EventTarget, 'HTMLElement');
['offsetWidth', 'clientWidth'].forEach(k => { HTMLElement.prototype[k] = 1920; });
['offsetHeight', 'clientHeight'].forEach(k => { HTMLElement.prototype[k] = 1080; });
HTMLElement.prototype.style = {};
HTMLElement.prototype.className = '';
HTMLElement.prototype.id = '';
HTMLElement.prototype.innerHTML = '';
HTMLElement.prototype.textContent = '';
HTMLElement.prototype.appendChild = mf('appendChild');
HTMLElement.prototype.removeChild = mf('removeChild');
HTMLElement.prototype.setAttribute = mf('setAttribute');
HTMLElement.prototype.getAttribute = function () { return null; };
sn(HTMLElement.prototype.getAttribute, 'getAttribute');
HTMLElement.prototype.getBoundingClientRect = function () {
  return { top: 0, left: 0, width: 1920, height: 1080, right: 1920, bottom: 1080, x: 0, y: 0 };
};
sn(HTMLElement.prototype.getBoundingClientRect, 'getBoundingClientRect');

function HTMLHtmlElement() { }
_defineProto(HTMLHtmlElement, HTMLElement, 'HTMLHtmlElement');

function HTMLHeadElement() { }
_defineProto(HTMLHeadElement, HTMLElement, 'HTMLHeadElement');

function HTMLBodyElement() { }
_defineProto(HTMLBodyElement, HTMLElement, 'HTMLBodyElement');

function HTMLCanvasElement() { }
_defineProto(HTMLCanvasElement, HTMLElement, 'HTMLCanvasElement');

function HTMLIFrameElement() { }
_defineProto(HTMLIFrameElement, HTMLElement, 'HTMLIFrameElement');

function HTMLScriptElement() { }
_defineProto(HTMLScriptElement, HTMLElement, 'HTMLScriptElement');

// ── 其他浏览器类 ──
function Location() { }
Location.prototype[ST] = 'Location';
sn(Location, 'Location');
Object.defineProperty(Location, 'name', { value: 'Location', writable: false, configurable: true });

function Screen() { }
Screen.prototype[ST] = 'Screen';
sn(Screen, 'Screen');
Object.defineProperty(Screen, 'name', { value: 'Screen', writable: false, configurable: true });

function History() { }
History.prototype[ST] = 'History';
sn(History, 'History');
Object.defineProperty(History, 'name', { value: 'History', writable: false, configurable: true });

function Storage() { }
Storage.prototype[ST] = 'Storage';
sn(Storage, 'Storage');
Object.defineProperty(Storage, 'name', { value: 'Storage', writable: false, configurable: true });

function Performance() { }
Performance.prototype[ST] = 'Performance';
sn(Performance, 'Performance');
Object.defineProperty(Performance, 'name', { value: 'Performance', writable: false, configurable: true });

function PluginArray() { }
PluginArray.prototype[ST] = 'PluginArray';
sn(PluginArray, 'PluginArray');
Object.defineProperty(PluginArray, 'name', { value: 'PluginArray', writable: false, configurable: true });

function MimeTypeArray() { }
MimeTypeArray.prototype[ST] = 'MimeTypeArray';
sn(MimeTypeArray, 'MimeTypeArray');
Object.defineProperty(MimeTypeArray, 'name', { value: 'MimeTypeArray', writable: false, configurable: true });

function Plugin() { }
Plugin.prototype[ST] = 'Plugin';
sn(Plugin, 'Plugin');
Object.defineProperty(Plugin, 'name', { value: 'Plugin', writable: false, configurable: true });

function MimeType() { }
MimeType.prototype[ST] = 'MimeType';
sn(MimeType, 'MimeType');
Object.defineProperty(MimeType, 'name', { value: 'MimeType', writable: false, configurable: true });

function SubtleCrypto() { }
SubtleCrypto.prototype[ST] = 'SubtleCrypto';
sn(SubtleCrypto, 'SubtleCrypto');
Object.defineProperty(SubtleCrypto, 'name', { value: 'SubtleCrypto', writable: false, configurable: true });

function Crypto() { }
Crypto.prototype[ST] = 'Crypto';
sn(Crypto, 'Crypto');
Object.defineProperty(Crypto, 'name', { value: 'Crypto', writable: false, configurable: true });

function MemoryInfo() { }
MemoryInfo.prototype[ST] = 'MemoryInfo';
sn(MemoryInfo, 'MemoryInfo');
Object.defineProperty(MemoryInfo, 'name', { value: 'MemoryInfo', writable: false, configurable: true });

// ═══════════════════════════════════════════════════════════════
// 3. Navigator 构建
// ═══════════════════════════════════════════════════════════════
function _defineGetter(proto, prop, getter) {
  Object.defineProperty(proto, prop, {
    get: getter,
    enumerable: true,
    configurable: true,
  });
}

function buildNavigator(opts) {
  const NP = Navigator.prototype;

  _defineGetter(NP, 'userAgent', () => opts.userAgent);
  _defineGetter(NP, 'appVersion', () => opts.userAgent);
  _defineGetter(NP, 'appCodeName', () => 'Mozilla');
  _defineGetter(NP, 'appName', () => 'Netscape');
  _defineGetter(NP, 'platform', () => opts.platform);
  _defineGetter(NP, 'product', () => 'Gecko');
  _defineGetter(NP, 'vendor', () => opts.vendor);
  _defineGetter(NP, 'vendorSub', () => '');
  _defineGetter(NP, 'productSub', () => '20030107');
  _defineGetter(NP, 'language', () => opts.languages[0]);
  _defineGetter(NP, 'languages', () => opts.languages.slice());
  _defineGetter(NP, 'cookieEnabled', () => true);
  _defineGetter(NP, 'webdriver', () => false);
  _defineGetter(NP, 'onLine', () => true);
  _defineGetter(NP, 'hardwareConcurrency', () => opts.hardwareConcurrency);
  _defineGetter(NP, 'maxTouchPoints', () => opts.maxTouchPoints);
  _defineGetter(NP, 'deviceMemory', () => undefined);
  _defineGetter(NP, 'pdfViewerEnabled', () => true);
  _defineGetter(NP, 'doNotTrack', () => null);
  _defineGetter(NP, 'webkitTemporaryStorage', () => undefined);

  const nav = new Navigator();

  if (opts.plugins) {
    _defineGetter(NP, 'plugins', () => _buildPlugins());
    _defineGetter(NP, 'mimeTypes', () => {
      const pls = _buildPlugins();
      const mt = new MimeTypeArray();
      mt.length = 2;
      mt.item = mf('item');
      mt.namedItem = mf('namedItem');
      mt[0] = pls[0][0];
      mt[1] = pls[0][1];
      return mt;
    });
  } else {
    NP.plugins = { length: 0, item: mf('item'), namedItem: mf('namedItem'), refresh: mf('refresh') };
    NP.mimeTypes = { length: 0, item: mf('item'), namedItem: mf('namedItem') };
  }

  return nav;
}

function _buildPlugins() {
  const ns = ['PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer', 'WebKit built-in PDF'];
  const pa = new PluginArray();
  pa.length = 5;
  pa.item = mf('item');
  pa.namedItem = mf('namedItem');
  pa.refresh = mf('refresh');

  for (let i = 0; i < 5; i++) {
    const p = new Plugin();
    _defineGetter(p, 'name', function () { return this._n; });
    _defineGetter(p, 'filename', () => 'internal-pdf-viewer');
    _defineGetter(p, 'description', () => 'Portable Document Format');
    _defineGetter(p, 'length', () => 2);
    p._n = ns[i];
    p.item = mf('item');
    p.namedItem = mf('namedItem');

    const m0 = new MimeType();
    _defineGetter(m0, 'type', () => 'application/pdf');
    _defineGetter(m0, 'suffixes', () => 'pdf');
    _defineGetter(m0, 'description', () => 'Portable Document Format');
    m0.enabledPlugin = p;
    const m1 = new MimeType();
    _defineGetter(m1, 'type', () => 'text/pdf');
    _defineGetter(m1, 'suffixes', () => 'pdf');
    _defineGetter(m1, 'description', () => 'Portable Document Format');
    m1.enabledPlugin = p;
    p[0] = m0;
    p[1] = m1;

    Object.defineProperty(p, 'application/pdf', { get: () => m0, enumerable: false, configurable: true });
    Object.defineProperty(p, 'text/pdf', { get: () => m1, enumerable: false, configurable: true });
    pa[i] = p;
  }
  return pa;
}

// ── Anchor helper: 模拟 <a href="..."> 的 URL 解析行为 ──
function _makeAnchor() {
  let _href = '';
  const a = Object.create(HTMLElement.prototype);
  a[ST] = 'HTMLAnchorElement';

  function _parse() {
    try {
      const u = new URL(_href || 'about:blank');
      a.protocol = u.protocol;
      a.host = u.host;
      a.hostname = u.hostname;
      a.port = u.port;
      a.pathname = u.pathname;
      a.search = u.search;
      a.hash = u.hash;
      a.origin = u.origin;
      // 直接写 _href 而非 a.href，避免触发 setter 递归
      _href = u.href;
    } catch (_) {
      a.protocol = '';
      a.host = '';
      a.hostname = '';
      a.port = '';
      a.pathname = '';
      a.search = '';
      a.hash = '';
      a.origin = '';
    }
  }

  a.setAttribute = function (name, value) {
    if (name === 'href') { _href = String(value); _parse(); }
  };
  Object.defineProperty(a, 'href', {
    get() { return _href; },
    set(v) { _href = String(v); _parse(); },
    enumerable: true, configurable: true,
  });
  a.getAttribute = function (name) { return name === 'href' ? _href : null; };
  a.toString = function () { return _href; };

  return a;
}

// ═══════════════════════════════════════════════════════════════
// 4. Document 构建
// ═══════════════════════════════════════════════════════════════
function buildDocument(opts) {
  const doc = new HTMLDocument();

  doc.createElement = function (tag) {
    tag = (tag || '').toLowerCase();
    if (tag === 'iframe') {
      const f = new HTMLIFrameElement();
      f.style = {};
      f.contentWindow = opts.windowToGlobal ? global : {};
      f.src = '';
      f.setAttribute = mf('setAttribute');
      f.getAttribute = function () { return null; };
      return f;
    }
    if (tag === 'canvas') {
      const c = new HTMLCanvasElement();
      c.width = 300;
      c.height = 150;
      return c;
    }
    if (tag === 'script') {
      const s = new HTMLScriptElement();
      s.src = '';
      s.type = 'text/javascript';
      s.onload = null;
      s.onerror = null;
      s.onreadystatechange = null;
      s.parentNode = null;
      return s;
    }
    if (tag === 'link') {
      const l = Object.create(HTMLElement.prototype);
      l[ST] = 'HTMLLinkElement';
      l.href = '';
      l.rel = '';
      l.type = '';
      return l;
    }
    if (tag === 'style') {
      const s = Object.create(HTMLElement.prototype);
      s[ST] = 'HTMLStyleElement';
      s.type = 'text/css';
      return s;
    }
    // "a" element — anchor URL parsing trick (很多库用 a.href 解析 URL)
    if (tag === 'a') {
      return _makeAnchor();
    }
    return new HTMLElement();
  };
  sn(doc.createElement, 'createElement');

  doc.createElementNS = function (ns, tag) { return doc.createElement(tag); };
  sn(doc.createElementNS, 'createElementNS');

  doc.body = new HTMLBodyElement();
  doc.documentElement = new HTMLHtmlElement();
  doc.documentElement.tagName = 'HTML';
  doc.head = new HTMLHeadElement();

  function _htmlCollection(items) {
    return new Proxy(items, {
      get(target, prop) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          return target[parseInt(prop)] || null;
        }
        if (prop === 'item') return (i) => target[i] || null;
        if (prop === 'namedItem') return mf('namedItem');
        if (prop === 'length') return target.length;
        if (prop === ST) return 'HTMLCollection';
        return target[prop];
      },
    });
  }

  doc.getElementsByTagName = function (t) {
    if (t === 'head') {
      return _htmlCollection([doc.head]);
    }
    if (t === 'body') {
      return _htmlCollection([doc.body]);
    }
    if (t === 'link' || t === 'style' || t === 'script') {
      return _htmlCollection([]);
    }
    return _htmlCollection([]);
  };
  sn(doc.getElementsByTagName, 'getElementsByTagName');

  doc.getElementById = function (id) { return null; };
  sn(doc.getElementById, 'getElementById');
  doc.getElementsByClassName = function (cn) { return { item: function () { return null; }, length: 0 }; };
  sn(doc.getElementsByClassName, 'getElementsByClassName');
  doc.querySelector = function (sel) { return null; };
  sn(doc.querySelector, 'querySelector');
  doc.querySelectorAll = function (sel) { return []; };
  sn(doc.querySelectorAll, 'querySelectorAll');
  doc.addEventListener = mf('addEventListener');
  doc.removeEventListener = mf('removeEventListener');
  doc.createDocumentFragment = function () { return new HTMLElement(); };
  sn(doc.createDocumentFragment, 'createDocumentFragment');
  doc.createTextNode = function (text) {
    const n = Object.create(HTMLElement.prototype);
    n[ST] = 'Text';
    n.nodeType = 3;
    n.nodeName = '#text';
    n.textContent = String(text || '');
    n.nodeValue = n.textContent;
    n.data = n.textContent;
    n.length = n.textContent.length;
    return n;
  };
  sn(doc.createTextNode, 'createTextNode');

  doc.hidden = false;
  doc.readyState = 'complete';
  doc.characterSet = 'UTF-8';
  doc.charset = 'UTF-8';
  doc.visibilityState = 'visible';
  doc.title = opts.title;
  doc.referrer = '';
  doc.domain = '';
  doc.all = undefined;
  doc.forms = [];
  doc.images = [];
  doc.links = [];
  doc.scripts = [];
  doc.styleSheets = { length: 0, item: mf('item') };
  doc.defaultView = opts.windowToGlobal ? global : null;

  // cookie getter/setter
  let _cookie = opts.cookie || '';
  Object.defineProperty(HTMLDocument.prototype, 'cookie', {
    get() { return _cookie; },
    set(v) { _cookie = v; },
    enumerable: true,
    configurable: true,
  });

  return doc;
}

// ═══════════════════════════════════════════════════════════════
// 5. Location 构建
// ═══════════════════════════════════════════════════════════════
function buildLocation(opts) {
  const url = new URL(opts.url);
  const loc = new Location();
  loc.href = opts.url;
  loc.protocol = url.protocol;
  loc.host = url.host;
  loc.hostname = url.hostname;
  loc.port = url.port;
  loc.pathname = url.pathname;
  loc.search = url.search;
  loc.hash = url.hash;
  loc.origin = url.origin;
  loc.reload = mf('reload');
  loc.replace = mf('replace');
  loc.assign = mf('assign');
  loc.toString = function () { return opts.url; };
  sn(loc.toString, 'toString');
  return loc;
}

// ═══════════════════════════════════════════════════════════════
// 6. Screen 构建
// ═══════════════════════════════════════════════════════════════
function buildScreen(opts) {
  const SP = Screen.prototype;
  _defineGetter(SP, 'width', () => opts.screenWidth);
  _defineGetter(SP, 'height', () => opts.screenHeight);
  _defineGetter(SP, 'availWidth', () => opts.availWidth);
  _defineGetter(SP, 'availHeight', () => opts.availHeight);
  _defineGetter(SP, 'colorDepth', () => opts.colorDepth);
  _defineGetter(SP, 'pixelDepth', () => opts.colorDepth);
  _defineGetter(SP, 'orientation', () => ({ type: 'landscape-primary', angle: 0 }));
  return new Screen();
}

// ═══════════════════════════════════════════════════════════════
// 7. Storage 构建
// ═══════════════════════════════════════════════════════════════
function buildStorage() {
  const store = new Map();
  const s = new Storage();
  s.getItem = function (key) { const v = store.get(String(key)); return v !== undefined ? v : null; };
  sn(s.getItem, 'getItem');
  s.setItem = function (key, value) { store.set(String(key), String(value)); };
  sn(s.setItem, 'setItem');
  s.removeItem = function (key) { store.delete(String(key)); };
  sn(s.removeItem, 'removeItem');
  s.clear = function () { store.clear(); };
  sn(s.clear, 'clear');
  s.key = function (index) { const keys = Array.from(store.keys()); return keys[index] || null; };
  sn(s.key, 'key');
  Object.defineProperty(s, 'length', { get() { return store.size; }, enumerable: true, configurable: true });
  return s;
}

// ═══════════════════════════════════════════════════════════════
// 8. Canvas 2D + WebGL stubs
// ═══════════════════════════════════════════════════════════════
function buildCanvasStubs(opts) {
  // 2D context
  HTMLCanvasElement.prototype.width = 300;
  HTMLCanvasElement.prototype.height = 150;
  HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
  sn(HTMLCanvasElement.prototype.toDataURL, 'toDataURL');
  HTMLCanvasElement.prototype.toBlob = mf('toBlob');
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === '2d') {
      return _makeCanvas2DContext();
    }
    if (opts.webgl && (type === 'webgl' || type === 'experimental-webgl')) {
      return _makeWebGLContext();
    }
    return null;
  };
  sn(HTMLCanvasElement.prototype.getContext, 'getContext');
}

function _makeCanvas2DContext() {
  const ctx = {};
  ctx[ST] = 'CanvasRenderingContext2D';
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  const voidMethods = ['fillText', 'strokeText', 'fillRect', 'clearRect', 'strokeRect',
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'bezierCurveTo',
    'fill', 'stroke', 'clip', 'save', 'restore',
    'scale', 'rotate', 'translate', 'transform', 'setTransform',
    'putImageData', 'drawImage', 'createPattern', 'quadraticCurveTo',
    'rect', 'arcTo', 'ellipse', 'isPointInPath', 'isPointInStroke'];
  voidMethods.forEach(m => { ctx[m] = mf(m); });

  ctx.measureText = function (t) { return { width: (t || '').length * 6, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }; };
  sn(ctx.measureText, 'measureText');

  ctx.getImageData = function (x, y, w, h) {
    return { data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1, colorSpace: 'srgb' };
  };
  sn(ctx.getImageData, 'getImageData');

  ctx.createLinearGradient = function () {
    const g = { addColorStop: mf('addColorStop') };
    g[ST] = 'CanvasGradient';
    return g;
  };
  sn(ctx.createLinearGradient, 'createLinearGradient');

  ctx.createRadialGradient = function () {
    const g = { addColorStop: mf('addColorStop') };
    g[ST] = 'CanvasGradient';
    return g;
  };
  sn(ctx.createRadialGradient, 'createRadialGradient');

  ctx.toDataURL = function () { return 'data:image/png;base64,'; };
  sn(ctx.toDataURL, 'toDataURL');

  ctx.createImageData = function (w, h) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  };
  sn(ctx.createImageData, 'createImageData');

  return ctx;
}

function _makeWebGLContext() {
  const gl = {};
  gl[ST] = 'WebGLRenderingContext';

  const params = {
    7936: 'WebKit',        // VENDOR
    7937: 'WebKit WebGL',  // RENDERER
    3379: 16384,           // MAX_TEXTURE_SIZE
    34921: 16,             // MAX_VIEWPORT_DIMS (array)
    35661: 32,             // MAX_COMBINED_TEXTURE_IMAGE_UNITS
  };
  gl.getParameter = function (p) {
    if (p === 34921) return new Int32Array([16384, 16384]);
    return params[p] || 0;
  };
  sn(gl.getParameter, 'getParameter');

  gl.getExtension = function (n) {
    if (n === 'WEBGL_debug_renderer_info') {
      const ext = {};
      ext.UNMASKED_VENDOR_WEBGL = 37446;
      ext.UNMASKED_RENDERER_WEBGL = 37445;
      return ext;
    }
    return {};
  };
  sn(gl.getExtension, 'getExtension');

  gl.getSupportedExtensions = function () {
    return [
      'ANGLE_instanced_arrays', 'EXT_blend_minmax', 'EXT_float_blend', 'EXT_frag_depth',
      'EXT_texture_compression_rgtc', 'EXT_texture_filter_anisotropic', 'EXT_sRGB',
      'OES_standard_derivatives', 'OES_texture_float', 'OES_texture_float_linear',
      'OES_texture_half_float', 'OES_texture_half_float_linear', 'OES_vertex_array_object',
      'WEBGL_color_buffer_float', 'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_s3tc_srgb', 'WEBGL_debug_renderer_info',
      'WEBGL_debug_shaders', 'WEBGL_depth_texture', 'WEBGL_draw_buffers',
      'WEBGL_lose_context', 'WEBGL_multi_draw',
    ];
  };
  sn(gl.getExtendedExtensions, 'getSupportedExtensions');

  gl.getShaderPrecisionFormat = function () {
    return { rangeMin: 127, rangeMax: 127, precision: 23 };
  };
  sn(gl.getShaderPrecisionFormat, 'getShaderPrecisionFormat');

  // Stub common WebGL methods
  ['activeTexture', 'attachShader', 'bindBuffer', 'bindTexture', 'blendFunc',
    'bufferData', 'clear', 'clearColor', 'compileShader', 'createBuffer',
    'createProgram', 'createShader', 'createTexture', 'deleteBuffer',
    'deleteProgram', 'deleteShader', 'deleteTexture', 'depthFunc',
    'disable', 'drawArrays', 'drawElements', 'enable', 'enableVertexAttribArray',
    'framebufferTexture2D', 'generateMipmap', 'getAttribLocation',
    'getProgramInfoLog', 'getProgramParameter', 'getShaderInfoLog',
    'getShaderParameter', 'getUniformLocation', 'linkProgram',
    'pixelStorei', 'readPixels', 'scissor', 'shaderSource',
    'texImage2D', 'texParameteri', 'uniform1f', 'uniform1i',
    'uniform2f', 'uniform3f', 'uniform4f', 'uniformMatrix4fv',
    'useProgram', 'vertexAttribPointer', 'viewport',
  ].forEach(m => { gl[m] = mf(m); });

  gl.canvas = null;
  gl.drawingBufferWidth = 300;
  gl.drawingBufferHeight = 150;

  return gl;
}

// ═══════════════════════════════════════════════════════════════
// 9. Crypto 构建
// ═══════════════════════════════════════════════════════════════
function buildCrypto() {
  const subtle = new SubtleCrypto();
  ['decrypt', 'deriveBits', 'deriveKey', 'digest', 'encrypt',
    'exportKey', 'generateKey', 'importKey', 'sign',
    'unwrapKey', 'verify', 'wrapKey',
  ].forEach(m => { SubtleCrypto.prototype[m] = mf(m); });

  const cryptoObj = new Crypto();

  if (nodeCrypto) {
    Crypto.prototype.getRandomValues = function (arr) {
      const bytes = nodeCrypto.randomBytes(arr.length);
      for (let i = 0; i < arr.length; i++) arr[i] = bytes[i];
      return arr;
    };
  } else {
    Crypto.prototype.getRandomValues = function (arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    };
  }
  sn(Crypto.prototype.getRandomValues, 'getRandomValues');

  Crypto.prototype.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  };
  sn(Crypto.prototype.randomUUID, 'randomUUID');

  Object.defineProperty(Crypto.prototype, 'subtle', {
    get() { return subtle; },
    enumerable: true,
    configurable: true,
  });

  return cryptoObj;
}

// ═══════════════════════════════════════════════════════════════
// 10. 额外浏览器构造函数（批量注入）
// ═══════════════════════════════════════════════════════════════
const EXTRA_CONSTRUCTORS = [
  'Blob', 'CSSRule', 'CSSStyleDeclaration', 'CSSStyleSheet', 'CanvasRenderingContext2D',
  'CloseEvent', 'Comment', 'CompositionEvent', 'CustomEvent',
  'DOMException', 'DOMImplementation', 'DOMParser', 'DOMRect',
  'DataTransfer', 'DeviceMotionEvent', 'DocumentFragment', 'DragEvent',
  'Element', 'ErrorEvent', 'EventSource',
  'File', 'FileList', 'FileReader', 'FocusEvent', 'FormData',
  'HashChangeEvent', 'Headers',
  'HTMLCollection', 'HTMLAnchorElement', 'HTMLAreaElement', 'HTMLAudioElement',
  'HTMLBRElement', 'HTMLBaseElement', 'HTMLButtonElement',
  'HTMLDListElement', 'HTMLDataElement', 'HTMLDataListElement',
  'HTMLDetailsElement', 'HTMLDialogElement', 'HTMLDirectoryElement',
  'HTMLDivElement', 'HTMLEmbedElement',
  'HTMLFieldSetElement', 'HTMLFontElement', 'HTMLFormControlsCollection',
  'HTMLFormElement', 'HTMLFrameElement', 'HTMLFrameSetElement',
  'HTMLHRElement', 'HTMLHeadingElement',
  'HTMLImageElement', 'HTMLInputElement',
  'HTMLLIElement', 'HTMLLabelElement', 'HTMLLegendElement', 'HTMLLinkElement',
  'HTMLMapElement', 'HTMLMarqueeElement', 'HTMLMediaElement',
  'HTMLMenuElement', 'HTMLMetaElement', 'HTMLMeterElement',
  'HTMLModElement',
  'HTMLOListElement', 'HTMLObjectElement', 'HTMLOptGroupElement',
  'HTMLOptionElement', 'HTMLOptionsCollection', 'HTMLOutputElement',
  'HTMLParagraphElement', 'HTMLParamElement', 'HTMLPictureElement',
  'HTMLPreElement', 'HTMLProgressElement',
  'HTMLQuoteElement',
  'HTMLSelectElement', 'HTMLSlotElement', 'HTMLSourceElement',
  'HTMLSpanElement', 'HTMLStyleElement',
  'HTMLTableCaptionElement', 'HTMLTableCellElement', 'HTMLTableColElement',
  'HTMLTableElement', 'HTMLTableRowElement', 'HTMLTableSectionElement',
  'HTMLTemplateElement', 'HTMLTextAreaElement', 'HTMLTimeElement',
  'HTMLTitleElement', 'HTMLTrackElement',
  'HTMLUListElement', 'HTMLUnknownElement', 'HTMLVideoElement',
  'InputEvent', 'IntersectionObserver',
  'KeyboardEvent',
  'MediaList', 'MessageChannel', 'MessageEvent',
  'MouseEvent', 'MutationObserver', 'MutationRecord',
  'NodeList', 'Notification',
  'PageTransitionEvent', 'Path2D',
  'PerformanceEntry', 'PerformanceNavigation', 'PerformanceObserver',
  'PerformanceResourceTiming', 'PointerEvent', 'PopStateEvent',
  'ProcessingInstruction', 'ProgressEvent',
  'Range', 'ReadableStream', 'Request', 'ResizeObserver', 'Response',
  'SVGAElement', 'SVGCircleElement', 'SVGDefsElement', 'SVGDescElement',
  'SVGElement', 'SVGEllipseElement', 'SVGFilterElement',
  'SVGGElement', 'SVGGraphicsElement', 'SVGImageElement',
  'SVGLineElement', 'SVGLinearGradientElement', 'SVGMetadataElement',
  'SVGPathElement', 'SVGPolygonElement', 'SVGPolylineElement',
  'SVGRect', 'SVGSVGElement', 'SVGScriptElement', 'SVGStopElement',
  'SVGStyleElement', 'SVGSwitchElement', 'SVGSymbolElement',
  'SVGTSpanElement', 'SVGTextElement', 'SVGTitleElement', 'SVGUseElement',
  'Selection', 'ShadowRoot', 'SharedWorker',
  'StorageEvent', 'SubmitEvent',
  'Text', 'TextDecoder', 'TextEncoder', 'TouchEvent', 'TransitionEvent',
  'TreeWalker',
  'UIEvent', 'URL', 'URLSearchParams',
  'ValidityState', 'VisualViewport',
  'WebSocket', 'WheelEvent', 'Worker',
  'XMLDocument', 'XMLHttpRequest', 'XMLHttpRequestEventTarget',
  'XMLHttpRequestUpload', 'XMLSerializer',
  'XPathEvaluator', 'XPathResult', 'XSLTProcessor',
];

// ═══════════════════════════════════════════════════════════════
// 11. 主入口：setupEnv
// ═══════════════════════════════════════════════════════════════

// Node.js ≥21 的部分全局变量是 getter（navigator/crypto/performance），
// 直接赋值无效，必须用 Object.defineProperty 覆盖。
function _setGlobal(key, value) {
  try {
    Object.defineProperty(global, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } catch (_) {
    global[key] = value;
  }
}
const DEFAULTS = {
  url: 'https://www.example.com/',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  platform: 'Win32',
  languages: ['zh-CN', 'zh'],
  screenWidth: 1920,
  screenHeight: 1080,
  availWidth: undefined,   // computed: screenWidth
  availHeight: undefined,  // computed: screenHeight - 40
  colorDepth: 24,
  devicePixelRatio: 1,
  cookie: '',
  title: '',
  hardwareConcurrency: 8,
  maxTouchPoints: 0,
  vendor: 'Google Inc.',

  canvas: true,
  webgl: false,
  plugins: true,
  storage: true,
  extraConstructors: true,
  crypto: true,

  windowToGlobal: true,
};

function setupEnv(options) {
  const opts = Object.assign({}, DEFAULTS, options || {});
  if (opts.availWidth === undefined) opts.availWidth = opts.screenWidth;
  if (opts.availHeight === undefined) opts.availHeight = Math.max(opts.screenHeight - 40, 0);

  // ── 1. 覆盖 Function.prototype.toString ──
  Function.prototype.toString = function () {
    return typeof this === 'function' && _nativeMap.get(this) || _realToString.call(this);
  };

  // ── 2. 构建各浏览器对象 ──
  const nav = buildNavigator(opts);
  const doc = buildDocument(opts);
  const loc = buildLocation(opts);
  const scr = buildScreen(opts);
  const perf = new Performance();
  perf.now = function () { return Date.now(); };
  sn(perf.now, 'now');
  perf.memory = new MemoryInfo();
  _defineGetter(MemoryInfo.prototype, 'jsHeapSizeLimit', () => 4294967296);
  _defineGetter(MemoryInfo.prototype, 'totalJSHeapSize', () => 41938737);
  _defineGetter(MemoryInfo.prototype, 'usedJSHeapSize', () => 34705941);

  const hist = new History();
  hist.length = 1;
  hist.pushState = mf('pushState');
  hist.replaceState = mf('replaceState');
  hist.back = mf('back');
  hist.forward = mf('forward');
  hist.go = mf('go');

  const localStorage = opts.storage ? buildStorage() : null;
  const sessionStorage = opts.storage ? buildStorage() : null;

  // ── 3. Canvas / WebGL ──
  if (opts.canvas || opts.webgl) {
    buildCanvasStubs(opts);
  }

  // ── 4. Crypto ──
  const cryptoObj = opts.crypto ? buildCrypto() : null;

  // ── 5. 注入 global ──
  // 检查 Node.js 原生 getter（navigator/crypto/performance），
  // 提前用 defineProperty 覆盖，否则直接赋值无效
  const _nativeGetters = {};
  for (const k of ['navigator', 'crypto', 'performance']) {
    const desc = Object.getOwnPropertyDescriptor(global, k);
    if (desc && desc.get && desc.configurable) {
      _nativeGetters[k] = true;
    }
  }

  if (opts.windowToGlobal) {
    _setGlobal('window', global);
    _setGlobal('self', global);
    _setGlobal('top', global);
    _setGlobal('parent', global);
    _setGlobal('globalThis', global);
  } else {
    _setGlobal('window', global.window || {});
  }

  _setGlobal('navigator', nav);
  _setGlobal('document', doc);
  _setGlobal('location', loc);
  _setGlobal('screen', scr);
  _setGlobal('history', hist);
  _setGlobal('performance', perf);

  if (opts.storage) {
    _setGlobal('localStorage', localStorage);
    _setGlobal('sessionStorage', sessionStorage);
  }

  if (opts.crypto && cryptoObj) {
    _setGlobal('crypto', cryptoObj);
    if (!opts.windowToGlobal) global.window.crypto = cryptoObj;
  }

  // btoa / atob
  if (typeof global.btoa !== 'function') {
    const _btoa = function (s) { return Buffer.from(String(s), 'binary').toString('base64'); };
    sn(_btoa, 'btoa');
    _setGlobal('btoa', _btoa);
  }
  if (typeof global.atob !== 'function') {
    const _atob = function (s) { return Buffer.from(String(s), 'base64').toString('binary'); };
    sn(_atob, 'atob');
    _setGlobal('atob', _atob);
  }

  // TextEncoder / TextDecoder
  const { TextEncoder: _TE, TextDecoder: _TD } = require('util');
  if (typeof global.TextEncoder === 'undefined') _setGlobal('TextEncoder', _TE);
  if (typeof global.TextDecoder === 'undefined') _setGlobal('TextDecoder', _TD);

  // console
  if (typeof global.console === 'undefined') {
    _setGlobal('console', { log() { }, error() { }, warn() { }, info() { }, debug() { } });
  }

  // window 尺寸
  _setGlobal('innerWidth', opts.screenWidth);
  _setGlobal('innerHeight', opts.screenHeight);
  _setGlobal('outerWidth', opts.screenWidth);
  _setGlobal('outerHeight', opts.screenHeight);
  _setGlobal('devicePixelRatio', opts.devicePixelRatio);
  _setGlobal('screenX', 0);
  _setGlobal('screenY', 0);
  _setGlobal('scrollX', 0);
  _setGlobal('scrollY', 0);
  _setGlobal('name', '');
  _setGlobal('closed', false);
  _setGlobal('length', 0);
  _setGlobal('opener', null);
  _setGlobal('origin', new URL(opts.url).origin);
  _setGlobal('isSecureContext', true);

  // 通用 window 方法
  _setGlobal('setTimeout', setTimeout);
  _setGlobal('setInterval', setInterval);
  _setGlobal('clearTimeout', clearTimeout);
  _setGlobal('clearInterval', clearInterval);
  _setGlobal('fetch', mf('fetch'));
  _setGlobal('postMessage', mf('postMessage'));
  _setGlobal('addEventListener', mf('addEventListener'));
  _setGlobal('removeEventListener', mf('removeEventListener'));
  _setGlobal('requestAnimationFrame', mf('requestAnimationFrame'));
  _setGlobal('cancelAnimationFrame', mf('cancelAnimationFrame'));
  const _mm = function () { return { matches: false, media: '', onchange: null, addListener() { }, removeListener() { } }; };
  sn(_mm, 'matchMedia');
  _setGlobal('matchMedia', _mm);
  const _gcs = function () { return {}; };
  sn(_gcs, 'getComputedStyle');
  _setGlobal('getComputedStyle', _gcs);
  const _gs = function () { return null; };
  sn(_gs, 'getSelection');
  _setGlobal('getSelection', _gs);

  // 隐藏 Node.js 特征
  if (opts.windowToGlobal) {
    Object.defineProperty(global, 'process', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(global, 'require', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(global, 'module', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(global, '__dirname', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(global, '__filename', { value: undefined, writable: true, configurable: true });
  }

  // ── 6. 额外构造函数 ──
  // 先注册文件级自定义构造函数（有完整原型链）
  [
    EventTarget, Window, Navigator, HTMLDocument, HTMLElement, HTMLHtmlElement,
    HTMLHeadElement, HTMLBodyElement, HTMLCanvasElement, HTMLIFrameElement,
    HTMLScriptElement, Location, Screen, History, Storage, Performance,
    PluginArray, MimeTypeArray, Plugin, MimeType, SubtleCrypto, Crypto, MemoryInfo,
  ].forEach(function (Ctor) {
    var name = Ctor.name;
    if (name && typeof global[name] === 'undefined') {
      _setGlobal(name, Ctor);
    }
  });

  if (opts.extraConstructors) {
    EXTRA_CONSTRUCTORS.forEach(name => {
      if (typeof global[name] === 'undefined') {
        _setGlobal(name, mc(name));
      }
    });

    // 补 Observer 原型方法（EXTRA_CONSTRUCTORS 中的 mc() 只有空壳）
    ['MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'PerformanceObserver'].forEach(function (name) {
      var Ctor = global[name];
      if (Ctor && Ctor.prototype) {
        Ctor.prototype.observe = mf('observe');
        Ctor.prototype.disconnect = mf('disconnect');
        if (name === 'MutationObserver') Ctor.prototype.takeRecords = function () { return []; };
        if (name === 'IntersectionObserver' || name === 'ResizeObserver') {
          Ctor.prototype.unobserve = mf('unobserve');
        }
      }
    });
  }

  // ── 7. 补全 window 上的引用 ──
  if (!opts.windowToGlobal) {
    const w = global.window;
    w.document = doc;
    w.navigator = nav;
    w.location = loc;
    w.screen = scr;
    w.history = hist;
    w.performance = perf;
    if (opts.storage) {
      w.localStorage = localStorage;
      w.sessionStorage = sessionStorage;
    }
    w.innerWidth = opts.screenWidth;
    w.innerHeight = opts.screenHeight;
  }

  return {
    nav, doc, loc, scr, hist, perf,
    localStorage, sessionStorage,
    cryptoObj,
    helpers: { sn, mf, mc, _nativeMap, _realToString },
  };
}

// ═══════════════════════════════════════════════════════════════
// 12. watch() — Proxy 包装器（VMP 兼容）
// ═══════════════════════════════════════════════════════════════
// 某些 VMP（如小红书）在运行时通过 window 上的 Proxy 检测环境。
// 用此函数对任意对象施加透明 Proxy，拦截 get/set/apply/construct。
// 使用方式: window = watch(window, 'window');
function watch(func, name) {
  if (typeof func !== 'object' && typeof func !== 'function') return func;
  return new Proxy(func, {
    get(target, p, receiver) {
      try {
        var pk = typeof p === 'symbol' ? p.toString() : String(p);
        if (pk === 'Math' || pk === 'isNaN') return Reflect.get(target, p, receiver);
        if (pk === 'crypto') return global.crypto;
        return Reflect.get(target, p, receiver);
      } catch (e) {
        return Reflect.get(target, p, receiver);
      }
    },
    set(target, p, value, receiver) {
      try { return Reflect.set(target, p, value, receiver); } catch (e) { return false; }
    },
    apply(target, thisArg, args) {
      try { return Reflect.apply(target, thisArg, args); } catch (e) { throw e; }
    },
    construct(target, args, newTarget) {
      try { return Reflect.construct(target, args, newTarget); } catch (e) { throw e; }
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════════════
module.exports = {
  setupEnv,
  // 工具函数（高级用法）
  sn, mf, mc, watch,
};
