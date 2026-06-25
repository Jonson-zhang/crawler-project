/**
 * env.js — 小红书 mnsv2 VMP 浏览器环境模拟
 *
 * 按 Web IDL 规范构建 DOM 原型链，供 Node.js VM 沙箱使用。
 * VMP 初始化需 env 数组: [,, Function, document, performance, MutationObserver, Object]
 * 但字节码执行中还会访问 navigator, screen, crypto, localStorage 等。
 */

"use strict";

const noop = () => {};

// ==============================
// Proxy 辅助 — 缺属性自动补空对象
// ==============================
function watch(obj, name) {
  return new Proxy(obj, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol") return undefined;
      // 返回空函数/空对象，防止 VMP 访问未定义属性崩溃
      const fallback = function () { return ""; };
      fallback.prototype = null;
      return fallback;
    },
  });
}

function setNative(fn, name) {
  fn.toString = function () { return "function " + name + "() { [native code] }"; };
}

// ==============================
// 原型链层级
// ==============================

// Level 0: EventTarget
function EventTarget() {}
EventTarget.prototype.addEventListener = noop;
EventTarget.prototype.removeEventListener = noop;
EventTarget.prototype.dispatchEvent = function () { return true; };

// Level 1: Node
function Node() {}
Node.prototype = Object.create(EventTarget.prototype);
Node.prototype.constructor = Node;
Node.prototype.ELEMENT_NODE = 1;
Node.prototype.TEXT_NODE = 3;
Node.prototype.nodeType = 1;
Node.prototype.nodeName = "";
Node.prototype.appendChild = noop;
Node.prototype.removeChild = noop;
Node.prototype.insertBefore = noop;
Node.prototype.replaceChild = noop;
Node.prototype.cloneNode = function () { return this; };
Node.prototype.contains = () => false;
Node.prototype.hasChildNodes = () => false;

// Level 2: Element
function Element() {}
Element.prototype = Object.create(Node.prototype);
Element.prototype.constructor = Element;
Element.prototype.tagName = "DIV";
Element.prototype.getAttribute = () => null;
Element.prototype.setAttribute = noop;
Element.prototype.removeAttribute = noop;
Element.prototype.querySelector = () => null;
Element.prototype.querySelectorAll = () => [];
Element.prototype.getElementsByTagName = () => [];
Element.prototype.classList = { add: noop, remove: noop, contains: () => false, toggle: noop };
Element.prototype.style = {};
Element.prototype.innerHTML = "";
Element.prototype.outerHTML = "";
Element.prototype.clientWidth = 1920;
Element.prototype.clientHeight = 1080;
Element.prototype.getBoundingClientRect = () => ({
  x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0,
});

// Level 3: HTMLElement
function HTMLElement() {}
HTMLElement.prototype = Object.create(Element.prototype);
HTMLElement.prototype.constructor = HTMLElement;
HTMLElement.prototype.click = noop;
HTMLElement.prototype.focus = noop;
HTMLElement.prototype.blur = noop;
HTMLElement.prototype.title = "";
HTMLElement.prototype.hidden = false;

// Level 4: 具体 HTML 元素
function HTMLHeadElement() {}
HTMLHeadElement.prototype = Object.create(HTMLElement.prototype);
HTMLHeadElement.prototype.constructor = HTMLHeadElement;

function HTMLBodyElement() {}
HTMLBodyElement.prototype = Object.create(HTMLElement.prototype);
HTMLBodyElement.prototype.constructor = HTMLBodyElement;

function HTMLHtmlElement() {}
HTMLHtmlElement.prototype = Object.create(HTMLElement.prototype);
HTMLHtmlElement.prototype.constructor = HTMLHtmlElement;

// Canvas
function HTMLCanvasElement(w, h) { this.width = w || 300; this.height = h || 150; }
HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype);
HTMLCanvasElement.prototype.constructor = HTMLCanvasElement;
HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === "2d") return new CanvasRenderingContext2D(this);
  if (type === "webgl" || type === "experimental-webgl") return new WebGLRenderingContext(this);
  return null;
};
HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
HTMLCanvasElement.prototype.toBlob = function (cb) { cb && cb(new Blob([])); };

// CanvasRenderingContext2D
function CanvasRenderingContext2D(canvas) { this.canvas = canvas; }
CanvasRenderingContext2D.prototype.fillStyle = "#000000";
CanvasRenderingContext2D.prototype.strokeStyle = "#000000";
CanvasRenderingContext2D.prototype.lineWidth = 1;
CanvasRenderingContext2D.prototype.globalAlpha = 1;
CanvasRenderingContext2D.prototype.font = "10px sans-serif";
CanvasRenderingContext2D.prototype.textAlign = "start";
CanvasRenderingContext2D.prototype.save = noop;
CanvasRenderingContext2D.prototype.restore = noop;
CanvasRenderingContext2D.prototype.scale = noop;
CanvasRenderingContext2D.prototype.rotate = noop;
CanvasRenderingContext2D.prototype.translate = noop;
CanvasRenderingContext2D.prototype.transform = noop;
CanvasRenderingContext2D.prototype.beginPath = noop;
CanvasRenderingContext2D.prototype.closePath = noop;
CanvasRenderingContext2D.prototype.moveTo = noop;
CanvasRenderingContext2D.prototype.lineTo = noop;
CanvasRenderingContext2D.prototype.arc = noop;
CanvasRenderingContext2D.prototype.rect = noop;
CanvasRenderingContext2D.prototype.fill = noop;
CanvasRenderingContext2D.prototype.stroke = noop;
CanvasRenderingContext2D.prototype.clip = noop;
CanvasRenderingContext2D.prototype.clearRect = noop;
CanvasRenderingContext2D.prototype.fillRect = noop;
CanvasRenderingContext2D.prototype.strokeRect = noop;
CanvasRenderingContext2D.prototype.fillText = noop;
CanvasRenderingContext2D.prototype.strokeText = noop;
CanvasRenderingContext2D.prototype.drawImage = noop;
CanvasRenderingContext2D.prototype.putImageData = noop;
CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
  const size = w * h * 4;
  const data = new Uint8Array(size);
  // 填充随机像素数据（VMP 可能检查画布指纹）
  for (let i = 0; i < size; i += 4) {
    data[i] = Math.floor(Math.random() * 256);
    data[i + 1] = Math.floor(Math.random() * 256);
    data[i + 2] = Math.floor(Math.random() * 256);
    data[i + 3] = 255;
  }
  return { data: data, width: w, height: h };
};
CanvasRenderingContext2D.prototype.createImageData = function (w, h) {
  return { data: new Uint8Array(w * h * 4), width: w, height: h };
};
CanvasRenderingContext2D.prototype.measureText = function (text) {
  return { width: (text || "").length * 8 };
};
CanvasRenderingContext2D.prototype.createLinearGradient = function () { return new CanvasGradient(); };
CanvasRenderingContext2D.prototype.createRadialGradient = function () { return new CanvasGradient(); };
CanvasRenderingContext2D.prototype.createPattern = () => null;

function CanvasGradient() {}
CanvasGradient.prototype.addColorStop = noop;

// WebGL
function WebGLRenderingContext(canvas) { this.canvas = canvas; this.drawingBufferWidth = 300; this.drawingBufferHeight = 150; }
WebGLRenderingContext.prototype.getParameter = function (p) {
  // 返回常见 GPU 参数伪造值
  const params = { 37445: "WebKit WebGL", 37446: "WebKit", 7937: "WebGL 1.0", 7938: "Mozilla/5.0" };
  return params[p] || "";
};
WebGLRenderingContext.prototype.getExtension = () => null;

// Document
function Document() {}
Document.prototype = Object.create(Node.prototype);
Document.prototype.constructor = Document;
Document.prototype.createElement = function (tag) {
  tag = (tag || "").toLowerCase();
  if (tag === "canvas") return new HTMLCanvasElement();
  if (tag === "div" || tag === "span") return new HTMLElement();
  return new HTMLElement();
};
Document.prototype.createElementNS = function () { return new HTMLElement(); };
Document.prototype.createTextNode = function () { return new Node(); };
Document.prototype.getElementsByTagName = () => [];
Document.prototype.getElementById = () => null;
Document.prototype.querySelector = () => null;
Document.prototype.querySelectorAll = () => [];
Document.prototype.cookie = "";
Document.prototype.referrer = "";
Document.prototype.title = "";
Document.prototype.readyState = "complete";
Document.prototype.characterSet = "UTF-8";
Document.prototype.documentElement = watch(new HTMLHtmlElement(), "document.documentElement");
Document.prototype.body = watch(new HTMLBodyElement(), "document.body");
Document.prototype.head = watch(new HTMLHeadElement(), "document.head");

// Storage
function Storage() { this._data = {}; }
Storage.prototype.getItem = function (k) { return this._data[k] || null; };
Storage.prototype.setItem = function (k, v) { this._data[k] = String(v); };
Storage.prototype.removeItem = function (k) { delete this._data[k]; };
Storage.prototype.clear = function () { this._data = {}; };
Storage.prototype.key = function (i) { return Object.keys(this._data)[i] || null; };
Object.defineProperty(Storage.prototype, "length", {
  get: function () { return Object.keys(this._data).length; },
});

// XMLHttpRequest
function XMLHttpRequest() {
  this.readyState = 0;
  this.status = 0;
  this.responseText = "";
  this.responseXML = null;
  this.response = "";
  this.responseType = "";
  this.timeout = 0;
  this.withCredentials = false;
  this.onreadystatechange = null;
}
XMLHttpRequest.prototype.open = function () {};
XMLHttpRequest.prototype.send = function () {};
XMLHttpRequest.prototype.setRequestHeader = function () {};
XMLHttpRequest.prototype.getResponseHeader = function () { return null; };
XMLHttpRequest.prototype.getAllResponseHeaders = function () { return ""; };
XMLHttpRequest.prototype.abort = function () {};
XMLHttpRequest.UNSENT = 0;
XMLHttpRequest.OPENED = 1;
XMLHttpRequest.HEADERS_RECEIVED = 2;
XMLHttpRequest.LOADING = 3;
XMLHttpRequest.DONE = 4;

// Navigator
function Navigator() {}
Navigator.prototype.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
Navigator.prototype.appVersion = "5.0";
Navigator.prototype.platform = "Win32";
Navigator.prototype.language = "zh-CN";
Navigator.prototype.languages = ["zh-CN", "zh"];
Navigator.prototype.cookieEnabled = true;
Navigator.prototype.doNotTrack = null;
Navigator.prototype.hardwareConcurrency = 8;
Navigator.prototype.maxTouchPoints = 0;
Navigator.prototype.vendor = "Google Inc.";
Navigator.prototype.vendorSub = "";
Navigator.prototype.productSub = "20030107";
Navigator.prototype.webdriver = false;
Navigator.prototype.plugins = [];
Navigator.prototype.mimeTypes = [];

// Screen
function Screen() {}
Screen.prototype.width = 1920;
Screen.prototype.height = 1080;
Screen.prototype.availWidth = 1920;
Screen.prototype.availHeight = 1040;
Screen.prototype.colorDepth = 24;
Screen.prototype.pixelDepth = 24;

// Location
function Location() { this.href = "https://www.xiaohongshu.com/"; }
Location.prototype.protocol = "https:";
Location.prototype.host = "www.xiaohongshu.com";
Location.prototype.hostname = "www.xiaohongshu.com";
Location.prototype.port = "";
Location.prototype.pathname = "/";
Location.prototype.search = "";
Location.prototype.hash = "";
Location.prototype.origin = "https://www.xiaohongshu.com";
Location.prototype.assign = noop;
Location.prototype.replace = noop;
Location.prototype.reload = noop;
Location.prototype.toString = function () { return this.href; };

// History
function History() {}
History.prototype.length = 1;
History.prototype.state = null;
History.prototype.pushState = noop;
History.prototype.replaceState = noop;
History.prototype.back = noop;
History.prototype.forward = noop;
History.prototype.go = noop;

// Performance
function Performance() {}
Performance.prototype.now = function () { return Date.now() - performance._startTime; };
Performance.prototype._startTime = Date.now();
Performance.prototype.timing = {
  navigationStart: Date.now() - 1000,
  loadEventEnd: Date.now() - 500,
  domContentLoadedEventEnd: Date.now() - 800,
};
Performance.prototype.navigation = { type: 0, redirectCount: 0 };
Performance.prototype.getEntries = () => [];
Performance.prototype.getEntriesByType = () => [];
Performance.prototype.getEntriesByName = () => [];

// MutationObserver
function MutationObserver(callback) { this._callback = callback; }
MutationObserver.prototype.observe = noop;
MutationObserver.prototype.disconnect = noop;
MutationObserver.prototype.takeRecords = () => [];

// Blob / File / FormData / Headers
function Blob(parts) { this.size = (parts || []).reduce((s, p) => s + (p || "").length, 0); this.type = ""; }
Blob.prototype.slice = function () { return new Blob(); };

function File() { Blob.call(this, []); this.name = ""; this.lastModified = Date.now(); }
File.prototype = Object.create(Blob.prototype);

function FileReader() {}
FileReader.prototype.readAsDataURL = noop;
FileReader.prototype.readAsText = noop;
FileReader.prototype.readAsArrayBuffer = noop;

function FormData() {}
FormData.prototype.append = noop;
FormData.prototype.delete = noop;
FormData.prototype.get = () => null;
FormData.prototype.set = noop;

function Headers() {}
Headers.prototype.append = noop;
Headers.prototype.get = () => null;
Headers.prototype.set = noop;

// Event / CustomEvent
function Event(type) { this.type = type; }
function CustomEvent(type, opts) { Event.call(this, type); this.detail = (opts || {}).detail; }

// Crypto
const _crypto = require("crypto");
const webcrypto = {
  getRandomValues: function (buf) {
    const bytes = _crypto.randomBytes(buf.length);
    for (let i = 0; i < buf.length; i++) buf[i] = bytes[i];
    return buf;
  },
  randomUUID: function () {
    return _crypto.randomUUID();
  },
};
const crypto = {
  subtle: undefined,
  webcrypto: webcrypto,
};

// Image
function Image() { this.src = ""; this.width = 0; this.height = 0; this.onload = null; this.onerror = null; }

// console
const console = {
  log: noop,
  warn: noop,
  error: noop,
  info: noop,
  debug: noop,
};

// TextEncoder / TextDecoder
const TextEncoder = global.TextEncoder;
const TextDecoder = global.TextDecoder;
const atob = (s) => Buffer.from(s, "base64").toString("binary");
const btoa = (s) => Buffer.from(s, "binary").toString("base64");

// ==============================
// 构建 window 全局对象
// ==============================

const _window = Object.create(null);

// 实例化核心对象
_window.document = watch(new Document(), "document");
_window.navigator = watch(new Navigator(), "navigator");
_window.screen = watch(new Screen(), "screen");
_window.location = watch(new Location(), "location");
_window.history = watch(new History(), "history");
_window.performance = watch(new Performance(), "performance");
_window.localStorage = watch(new Storage(), "localStorage");
_window.sessionStorage = watch(new Storage(), "sessionStorage");
_window.crypto = crypto;
_window.console = console;
_window.TextEncoder = TextEncoder;
_window.TextDecoder = TextDecoder;
_window.atob = atob;
_window.btoa = btoa;

// 暴露构造函数
_window.Function = Function;
_window.Object = Object;
_window.Array = Array;
_window.String = String;
_window.Number = Number;
_window.Boolean = Boolean;
_window.Date = Date;
_window.RegExp = RegExp;
_window.Error = Error;
_window.Math = Math;
_window.JSON = JSON;
_window.Promise = Promise;
_window.Uint8Array = Uint8Array;
_window.Int8Array = Int8Array;
_window.Uint16Array = Uint16Array;
_window.Uint32Array = Uint32Array;
_window.Int32Array = Int32Array;
_window.Float32Array = Float32Array;
_window.Float64Array = Float64Array;
_window.ArrayBuffer = ArrayBuffer;
_window.DataView = DataView;
_window.Map = Map;
_window.Set = Set;
_window.WeakMap = WeakMap;
_window.WeakSet = WeakSet;
_window.Symbol = Symbol;
_window.Proxy = Proxy;
_window.Reflect = Reflect;

_window.EventTarget = EventTarget;
_window.Node = Node;
_window.Element = Element;
_window.HTMLElement = HTMLElement;
_window.HTMLHtmlElement = HTMLHtmlElement;
_window.HTMLHeadElement = HTMLHeadElement;
_window.HTMLBodyElement = HTMLBodyElement;
_window.HTMLCanvasElement = HTMLCanvasElement;
_window.HTMLImageElement = Image;
_window.Document = Document;
_window.HTMLDocument = Document;
_window.CanvasRenderingContext2D = CanvasRenderingContext2D;
_window.WebGLRenderingContext = WebGLRenderingContext;
_window.AudioContext = undefined;
_window.XMLHttpRequest = XMLHttpRequest;
_window.Blob = Blob;
_window.File = File;
_window.FileReader = FileReader;
_window.FormData = FormData;
_window.Headers = Headers;
_window.MutationObserver = MutationObserver;
_window.IntersectionObserver = undefined;
_window.ResizeObserver = undefined;
_window.PerformanceObserver = undefined;
_window.Event = Event;
_window.CustomEvent = CustomEvent;
_window.Image = Image;
_window.Navigator = Navigator;
_window.Screen = Screen;
_window.Location = Location;
_window.History = History;
_window.Performance = Performance;
_window.Storage = Storage;
_window.Worker = undefined;
_window.WebSocket = undefined;
_window.MessageChannel = undefined;
_window.fetch = undefined;
_window.XMLSerializer = undefined;
_window.DOMParser = undefined;
_window.eval = global.eval;
_window.parseInt = parseInt;
_window.parseFloat = parseFloat;
_window.isNaN = isNaN;
_window.isFinite = isFinite;
_window.decodeURI = decodeURI;
_window.decodeURIComponent = decodeURIComponent;
_window.encodeURI = encodeURI;
_window.encodeURIComponent = encodeURIComponent;
_window.escape = (s) => encodeURIComponent(String(s));
_window.unescape = (s) => decodeURIComponent(String(s));
_window.setTimeout = setTimeout;
_window.setInterval = setInterval;
_window.clearTimeout = clearTimeout;
_window.clearInterval = clearInterval;
_window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
_window.cancelAnimationFrame = clearTimeout;

// 顶层全局 (Node.js 中 global)
// Node 24 的 navigator/crypto/fetch 是 getter-only，需用 defineProperty 覆盖
for (const key of Object.keys(_window)) {
  const desc = Object.getOwnPropertyDescriptor(global, key);
  if (desc && !desc.configurable) continue; // 不可配置的跳过
  if (desc && desc.set === undefined && desc.get) {
    // getter-only → 用 defineProperty 覆盖
    Object.defineProperty(global, key, {
      value: _window[key],
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } else {
    try { global[key] = _window[key]; } catch (e) { /* skip */ }
  }
}
global.window = global;
global.self = global;
global.top = global;
global.parent = global;
try { global.globalThis = global; } catch (e) {}

module.exports = { noop, watch, setNative };
