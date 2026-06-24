/**
 * VMP 兼容浏览器环境 — 直接在 global 上赋值
 * 在 vm.createContext 的沙箱中运行, 所有 global.X 赋值生效
 */

// ═══ v_saf: 保护 native toString ═══
var v_saf;
(function() {
  var n = Function.prototype.toString;
  var t = [], i = [];
  var o = [].indexOf.bind(t), e = [].push.bind(t), r = [].push.bind(i);
  function u(n, t) {
    return -1 === o(n) && (e(n), r("function " + (t || n.name || "") + "() { [native code] }")), n;
  }
  Object.defineProperty(Function.prototype, "toString", {
    enumerable: false, configurable: true, writable: true,
    value: function() { return "function" == typeof this && i[o(this)] || n.call(this); }
  });
  u(Function.prototype.toString, "toString");
  v_saf = u;
})();

function _inherits(t, e) {
  t.prototype = Object.create(e.prototype, { constructor: { value: t, writable: true, configurable: true } });
  e && Object.setPrototypeOf(t, e);
}
var _v_new_toggle = true;
var _v_new = function(v) { var t = _v_new_toggle; _v_new_toggle = true; var r = new v; _v_new_toggle = t; return r; };

// ═══ 构造函数 (全部赋值到 global) ═══
global.EventTarget = v_saf(function EventTarget() {});
global.EventTarget.prototype.addEventListener = function() {};
global.EventTarget.prototype.removeEventListener = function() {};

global.Node = v_saf(function Node() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
_inherits(global.Node, global.EventTarget);

global.Element = v_saf(function Element() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
_inherits(global.Element, global.Node);

global.HTMLElement = v_saf(function HTMLElement() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
_inherits(global.HTMLElement, global.Element);

global.HTMLCanvasElement = v_saf(function HTMLCanvasElement() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
_inherits(global.HTMLCanvasElement, global.HTMLElement);
global.HTMLCanvasElement.prototype.getContext = function(t) {
  if (t === '2d') return new CanvasRenderingContext2D();
  if (t === 'webgl' || t === 'experimental-webgl') return new WebGLRenderingContext();
  return null;
};
global.HTMLCanvasElement.prototype.toDataURL = function() { return 'data:image/png;base64,iVBORw0KGgo'; };

global.CanvasRenderingContext2D = v_saf(function CanvasRenderingContext2D() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });

global.WebGLRenderingContext = v_saf(function WebGLRenderingContext() { if (!_v_new_toggle) throw TypeError("Illegal constructor");
  this.getSupportedExtensions = function() { return ["ANGLE_instanced_arrays","EXT_blend_minmax","EXT_color_buffer_half_float","EXT_disjoint_timer_query","EXT_float_blend","EXT_frag_depth","EXT_shader_texture_lod","EXT_texture_compression_bptc","EXT_texture_compression_rgtc","EXT_texture_filter_anisotropic","WEBKIT_EXT_texture_filter_anisotropic","EXT_sRGB","KHR_parallel_shader_compile","OES_element_index_uint","OES_fbo_render_mipmap","OES_standard_derivatives","OES_texture_float","OES_texture_float_linear","OES_texture_half_float","OES_texture_half_float_linear","OES_vertex_array_object","WEBGL_color_buffer_float","WEBGL_compressed_texture_s3tc","WEBKIT_WEBGL_compressed_texture_s3tc","WEBGL_compressed_texture_s3tc_srgb","WEBGL_debug_renderer_info","WEBGL_debug_shaders","WEBGL_depth_texture","WEBKIT_WEBGL_depth_texture","WEBGL_draw_buffers","WEBGL_lose_context","WEBKIT_WEBGL_lose_context","WEBGL_multi_draw"]; };
  this.getExtension = function(k) { return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 }; };
  this.getParameter = function(k) {
    if (k === 37445) return "Google Inc. (NVIDIA)";
    if (k === 37446) return "ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.5671)";
    if (k === 7937) return "WebKit WebGL"; if (k === 7938) return "WebGL 1.0 (OpenGL ES 2.0 Chromium)";
    if (k === 7936) return "WebKit"; if (k === 35724) return "WebGL GLSL ES 1.0";
    return null;
  };
  this.getContextAttributes = function() { return { alpha: true, antialias: true, depth: true, desynchronized: false, failIfMajorPerformanceCaveat: false, powerPreference: "default", premultipliedAlpha: true, preserveDrawingBuffer: false, stencil: false, xrCompatible: false }; };
  this.getShaderPrecisionFormat = function() { return { rangeMin: 127, rangeMax: 127, precision: 23 }; };
});

global.Event = v_saf(function Event() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });

global.MutationObserver = v_saf(function MutationObserver() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
global.MutationObserver.prototype.observe = function() {};
global.MutationObserver.prototype.disconnect = function() {};

global.IntersectionObserver = v_saf(function IntersectionObserver() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
global.ResizeObserver = v_saf(function ResizeObserver() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
global.PerformanceObserver = v_saf(function PerformanceObserver() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });

global.MessageChannel = v_saf(function MessageChannel() { this.port1 = {}; this.port2 = {}; });
global.Worker = v_saf(function Worker() {});
global.WebSocket = v_saf(function WebSocket() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
global.XMLHttpRequest = v_saf(function XMLHttpRequest() {});
global.Image = v_saf(function Image() { return new HTMLImageElement(); });
global.HTMLImageElement = v_saf(function HTMLImageElement() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
_inherits(global.HTMLImageElement, global.HTMLElement);

global.AudioContext = v_saf(function AudioContext() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });

// Plugin / MimeType
global.PluginArray = v_saf(function PluginArray() { if (!_v_new_toggle) throw TypeError("Illegal constructor");
  var names = ["PDF Viewer","Chrome PDF Viewer","Chromium PDF Viewer","Microsoft Edge PDF Viewer","WebKit built-in PDF"];
  for (var i = 0; i < 5; i++) { this[i] = { description: "PDF", filename: "internal-pdf-viewer", length: 2, name: names[i] }; }
  this.length = 5;
});
global.Plugin = v_saf(function Plugin() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
global.MimeTypeArray = v_saf(function MimeTypeArray() { if (!_v_new_toggle) throw TypeError("Illegal constructor");
  this[0] = { description: "PDF", enabledPlugin: {}, suffixes: "pdf", type: "application/pdf" };
  this[1] = { description: "PDF", enabledPlugin: {}, suffixes: "pdf", type: "text/pdf" };
  this.length = 2;
});
global.MimeType = v_saf(function MimeType() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });

global.Navigator = v_saf(function Navigator() { if (!_v_new_toggle) throw TypeError("Illegal constructor");
  this._plugins = new PluginArray(); this._mimeTypes = new MimeTypeArray();
});

// Performance
global.Performance = v_saf(function Performance() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });
_inherits(global.Performance, global.EventTarget);
global.Performance.prototype.now = function() { return Date.now() - this._t0; };
global.PerformanceTiming = v_saf(function PerformanceTiming() { if (!_v_new_toggle) throw TypeError("Illegal constructor"); });

// Document
global.Document = v_saf(function Document() {});
_inherits(global.Document, global.Node);
global.Document.prototype.createElement = function(tag) {
  tag = (tag || '').toLowerCase();
  if (tag === 'canvas') return new HTMLCanvasElement();
  return { style: {} };
};

// ═══ 环境单例 ═══
global.navigator = new Navigator();
global.document = new Document();
global.document.location = { href: 'https://www.xiaohongshu.com/explore', protocol: 'https:', host: 'www.xiaohongshu.com', hostname: 'www.xiaohongshu.com', pathname: '/explore', origin: 'https://www.xiaohongshu.com', toString: function() { return this.href; } };
global.document.cookie = '';
global.document.title = '小红书';
global.document.head = { appendChild: function() {} };
global.document.body = { appendChild: function() {} };
global.document.documentElement = { style: {} };
global.document.all = [];
global.document.hidden = false;

global.location = global.document.location;
global.screen = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24, orientation: { type: 'landscape-primary', angle: 0 } };
global.history = { length: 1, state: null, pushState: function() {}, replaceState: function() {}, back: function() {}, forward: function() {}, go: function() {} };
global.performance = new Performance();
global.performance._t0 = Date.now();

global.localStorage = { _d: {}, getItem: function(k) { return this._d[k] || null; }, setItem: function(k, v) { this._d[k] = String(v); }, removeItem: function(k) { delete this._d[k]; }, clear: function() { this._d = {}; }, get length() { return Object.keys(this._d).length; }, key: function(i) { return Object.keys(this._d)[i] || null; } };
global.sessionStorage = { _d: {}, getItem: function(k) { return this._d[k] || null; }, setItem: function(k, v) { this._d[k] = String(v); }, removeItem: function(k) { delete this._d[k]; }, clear: function() { this._d = {}; }, get length() { return Object.keys(this._d).length; }, key: function(i) { return Object.keys(this._d)[i] || null; } };
global.console = { log: function() {}, error: function() {}, warn: function() {}, info: function() {}, debug: function() {} };

// VMP 需要的其他浏览器全局变量
global.top = global.self = global;
global.InstallTrigger = undefined;
global.chrome = {};
global.Blob = function(p) { this.parts = p || []; };
global.File = function() {};
global.FileReader = function() {};
global.FormData = function() {};
global.Headers = function() {};
global.URL = URL;
global.URLSearchParams = URLSearchParams;
