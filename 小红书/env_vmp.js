/**
 * VMP-compatible environment
 * 来源: v_jstools / qxVm / catvm 模式
 * 核心: v_saf 保护 native toString, 构造函数检测, 完整原型链, WebGL存根
 */
module.exports = (function() {
  var v_saf;!function(){var n=Function.toString,t=[],i=[],o=[].indexOf.bind(t),e=[].push.bind(t),r=[].push.bind(i);function u(n,t){return-1==o(n)&&(e(n),r(`function ${t||n.name||""}() { [native code] }`)),n}Object.defineProperty(Function.prototype,"toString",{enumerable:!1,configurable:!0,writable:!0,value:function(){return"function"==typeof this&&i[o(this)]||n.call(this)}}),u(Function.prototype.toString,"toString"),v_saf=u}();

  function _inherits(t, e) {
    t.prototype = Object.create(e.prototype, {constructor: { value: t, writable: !0, configurable: !0 }});
    e && Object.setPrototypeOf(t, e);
  }
  var v_new_toggle = true;
  var v_console_log = function(){};
  var v_console_logger = function(){};

  // ═══ Constructor stubs ═══
  EventTarget = v_saf(function EventTarget(){;});
  MutationObserver = v_saf(function MutationObserver(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  PerformanceObserver = v_saf(function PerformanceObserver(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  NodeList = v_saf(function NodeList(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  Storage = v_saf(function Storage(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  Image = v_saf(function Image(){;return v_new(HTMLImageElement)});
  Event = v_saf(function Event(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  MessageChannel = v_saf(function MessageChannel(){;});
  URLSearchParams = v_saf(function URLSearchParams(){;});

  Navigator = v_saf(function Navigator(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };
    this._plugins = typeof PluginArray=='undefined'?[]:new PluginArray();
    this._mimeTypes = typeof MimeTypeArray=='undefined'?[]:new MimeTypeArray();
  });

  // ═══ WebGLRenderingContext ═══
  WebGLRenderingContext = v_saf(function WebGLRenderingContext(){
    if (!v_new_toggle){ throw TypeError("Illegal constructor") };
    var self = this;
    this._toggle = {};
    this.createBuffer = function(){ return {} };
    this.createProgram = function(){ return {} };
    this.createShader = function(){ return {} };
    this.getSupportedExtensions = function(){
      return ["ANGLE_instanced_arrays","EXT_blend_minmax","EXT_color_buffer_half_float","EXT_disjoint_timer_query","EXT_float_blend","EXT_frag_depth","EXT_shader_texture_lod","EXT_texture_compression_bptc","EXT_texture_compression_rgtc","EXT_texture_filter_anisotropic","WEBKIT_EXT_texture_filter_anisotropic","EXT_sRGB","KHR_parallel_shader_compile","OES_element_index_uint","OES_fbo_render_mipmap","OES_standard_derivatives","OES_texture_float","OES_texture_float_linear","OES_texture_half_float","OES_texture_half_float_linear","OES_vertex_array_object","WEBGL_color_buffer_float","WEBGL_compressed_texture_s3tc","WEBKIT_WEBGL_compressed_texture_s3tc","WEBGL_compressed_texture_s3tc_srgb","WEBGL_debug_renderer_info","WEBGL_debug_shaders","WEBGL_depth_texture","WEBKIT_WEBGL_depth_texture","WEBGL_draw_buffers","WEBGL_lose_context","WEBKIT_WEBGL_lose_context","WEBGL_multi_draw"];
    };
    this.getExtension = function(key){
      if (key == 'WEBGL_debug_renderer_info'){ return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 }; }
      return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
    };
    this.getParameter = function(key){
      if (key == 37445){ return "Google Inc. (NVIDIA)" }
      if (key == 37446){ return "ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Ti Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.5671)" }
      if (key == 7937){ return "WebKit WebGL" }
      if (key == 7938){ return "WebGL 1.0 (OpenGL ES 2.0 Chromium)" }
      if (key == 7936){ return "WebKit" }
      if (key == 35724){ return "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)" }
      return null;
    };
    this.getContextAttributes = function(){ return { alpha: true, antialias: true, depth: true, desynchronized: false, failIfMajorPerformanceCaveat: false, powerPreference: "default", premultipliedAlpha: true, preserveDrawingBuffer: false, stencil: false, xrCompatible: false }; };
    this.getShaderPrecisionFormat = function(a,b){
      return { rangeMin: 127, rangeMax: 127, precision: 23 };
    };
    v_saf(this.createBuffer,'createBuffer');v_saf(this.createProgram,'createProgram');
    v_saf(this.createShader,'createShader');v_saf(this.getSupportedExtensions,'getSupportedExtensions');
    v_saf(this.getExtension,'getExtension');v_saf(this.getParameter,'getParameter');
    v_saf(this.getContextAttributes,'getContextAttributes');v_saf(this.getShaderPrecisionFormat,'getShaderPrecisionFormat');
  });

  // ═══ PerformanceTiming ═══
  PerformanceTiming = v_saf(function PerformanceTiming(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ Plugin / MimeType ═══
  PluginArray = v_saf(function PluginArray(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };
    this[0]={description:"Portable Document Format",filename:"internal-pdf-viewer",length:2,name:"PDF Viewer"};
    this[1]={description:"Portable Document Format",filename:"internal-pdf-viewer",length:2,name:"Chrome PDF Viewer"};
    this[2]={description:"Portable Document Format",filename:"internal-pdf-viewer",length:2,name:"Chromium PDF Viewer"};
    this[3]={description:"Portable Document Format",filename:"internal-pdf-viewer",length:2,name:"Microsoft Edge PDF Viewer"};
    this[4]={description:"Portable Document Format",filename:"internal-pdf-viewer",length:2,name:"WebKit built-in PDF"};
    this.length=5;
  });
  PluginArray.prototype.item = v_saf(function(i){return this[i]||null;},"item");
  PluginArray.prototype.namedItem = v_saf(function(n){for(var i=0;i<this.length;i++){if(this[i].name===n)return this[i];}return null;},"namedItem");
  PluginArray.prototype.refresh = v_saf(function(){},"refresh");

  Plugin = v_saf(function Plugin(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  MimeTypeArray = v_saf(function MimeTypeArray(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };
    this[0]={description:"Portable Document Format",enabledPlugin:{},suffixes:"pdf",type:"application/pdf"};
    this[1]={description:"Portable Document Format",enabledPlugin:{},suffixes:"pdf",type:"text/pdf"};
    this.length=2;
  });
  MimeTypeArray.prototype.item = v_saf(function(i){return this[i]||null;},"item");
  MimeTypeArray.prototype.namedItem = v_saf(function(n){for(var i=0;i<this.length;i++){if(this[i].type===n)return this[i];}return null;},"namedItem");

  MimeType = v_saf(function MimeType(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ TextEncoder/Decoder ═══
  TextEncoder = v_saf(function TextEncoder(){;});
  TextDecoder = v_saf(function TextDecoder(){;});

  // ═══ ResizeObserver ═══
  ResizeObserver = v_saf(function ResizeObserver(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ DOMTokenList ═══
  DOMTokenList = v_saf(function DOMTokenList(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ History ═══
  History = v_saf(function History(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ CanvasRenderingContext2D ═══
  CanvasRenderingContext2D = v_saf(function CanvasRenderingContext2D(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ IntersectionObserver ═══
  IntersectionObserver = v_saf(function IntersectionObserver(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ Audio ═══
  AudioContext = v_saf(function AudioContext(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ HTMLCanvasElement ═══
  HTMLCanvasElement = v_saf(function HTMLCanvasElement(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === '2d') return new CanvasRenderingContext2D();
    if (type === 'webgl' || type === 'experimental-webgl') return new WebGLRenderingContext();
    return null;
  };
  HTMLCanvasElement.prototype.toDataURL = function(){ return 'data:image/png;base64,iVBORw0KGgo'; };
  HTMLCanvasElement.prototype.toBlob = function(cb){ if(cb) cb(new Blob([])); };

  // ═══ XMLHttpRequest ═══
  XMLHttpRequest = v_saf(function XMLHttpRequest(){;});

  // ═══ Document ═══
  Document = v_saf(function Document(){;});
  Document.prototype.createElement = function(tag) {
    tag = (tag||'').toLowerCase();
    if (tag === 'canvas') return new HTMLCanvasElement();
    if (tag === 'script') return {};
    if (tag === 'div') return { style: {} };
    if (tag === 'style') return {};
    if (tag === 'a') return { href: '' };
    return { style: {}, setAttribute: function(){}, getAttribute: function(){ return null; } };
  };
  Document.prototype.querySelector = function(){ return null; };
  Document.prototype.querySelectorAll = function(){ return []; };
  Document.prototype.getElementsByTagName = function(tag) {
    if (tag === 'script') return [];
    if (tag === 'head') return [{}];
    if (tag === 'body') return [{}];
    return [];
  };
  Document.prototype.getElementById = function(){ return null; };
  Document.prototype.addEventListener = function(){};
  Document.prototype.removeEventListener = function(){};

  // ═══ Element ═══
  Element = v_saf(function Element(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  Element.prototype.setAttribute = function(){};
  Element.prototype.removeAttribute = function(){};
  Element.prototype.getAttribute = function(){ return null; };
  Element.prototype.addEventListener = function(){};
  Element.prototype.removeEventListener = function(){};

  // ═══ HTMLElement ═══
  HTMLElement = v_saf(function HTMLElement(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ Node ═══
  Node = v_saf(function Node(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ Performance ═══
  Performance = v_saf(function Performance(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});
  Performance.prototype.now = function(){ return Date.now() - performance.timeOrigin; };
  Performance.prototype.toJSON = function(){ return { timeOrigin: performance.timeOrigin }; };

  // ═══ Screen ═══
  Screen = v_saf(function Screen(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ Location ═══
  Location = v_saf(function Location(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ HTMLImageElement ═══
  HTMLImageElement = v_saf(function HTMLImageElement(){if (!v_new_toggle){ throw TypeError("Illegal constructor") };});

  // ═══ Prototype chains ═══
  _inherits(Node, EventTarget);
  _inherits(Element, Node);
  _inherits(HTMLElement, Element);
  _inherits(HTMLCanvasElement, HTMLElement);
  _inherits(HTMLImageElement, HTMLElement);
  _inherits(Document, Node);
  _inherits(Performance, EventTarget);
  _inherits(Screen, EventTarget);

  // ═══ Navigator 实例 ═══
  var navigator = new Navigator();

  // ═══ Singleton instances ═══
  var document = new Document();
  document.location = new Location();
  document.head = { appendChild: function(){} };
  document.body = { appendChild: function(){} };
  document.documentElement = { style: {}, getAttribute: function(){return null;} };
  document.createElement = Document.prototype.createElement;
  document.cookie = '';
  document.title = '小红书';
  document.readyState = 'complete';
  document.hidden = false;
  document.visibilityState = 'visible';
  document.domain = 'www.xiaohongshu.com';
  document.URL = 'https://www.xiaohongshu.com/explore';
  document.referrer = 'https://www.xiaohongshu.com/';
  document.characterSet = 'UTF-8';
  document.charset = 'UTF-8';
  document.all = [];

  var location = {
    href: 'https://www.xiaohongshu.com/explore',
    protocol: 'https:',
    host: 'www.xiaohongshu.com',
    hostname: 'www.xiaohongshu.com',
    port: '',
    pathname: '/explore',
    search: '',
    hash: '',
    origin: 'https://www.xiaohongshu.com',
    ancestorOrigins: {},
    toString: function() { return this.href; }
  };

  var screen = {
    width: 1920, height: 1080,
    availWidth: 1920, availHeight: 1040,
    colorDepth: 24, pixelDepth: 24,
    orientation: { type: 'landscape-primary', angle: 0 },
  };

  var performance = new Performance();
  performance.timeOrigin = Date.now() - 1000;
  performance.timing = new PerformanceTiming();
  performance.memory = {};

  var history = { length: 1, state: null, scrollRestoration: 'auto',
    pushState: function(){}, replaceState: function(){}, back: function(){}, forward: function(){}, go: function(){}
  };

  var localStorage = {
    _data: {},
    getItem: function(k){ return this._data[k] || null; },
    setItem: function(k,v){ this._data[k] = String(v); },
    removeItem: function(k){ delete this._data[k]; },
    clear: function(){ this._data = {}; },
    get length(){ return Object.keys(this._data).length; },
    key: function(i){ return Object.keys(this._data)[i] || null; }
  };
  var sessionStorage = Object.create(localStorage);
  sessionStorage._data = {};

  var console_obj = { log: function(){}, error: function(){}, warn: function(){}, info: function(){}, debug: function(){} };

  return {
    EventTarget, MutationObserver, PerformanceObserver,
    Node, Element, HTMLElement, HTMLCanvasElement, HTMLImageElement,
    CanvasRenderingContext2D, WebGLRenderingContext,
    Document, HTMLDocument: Document,
    Performance, PerformanceTiming,
    Navigator, Screen, Location, History,
    Event, CustomEvent: Event,
    MessageChannel, Worker: function(){},
    WebSocket: function(){},
    Plugin, PluginArray, MimeType, MimeTypeArray,
    AudioContext, IntersectionObserver, ResizeObserver, PerformanceObserver,
    XMLHttpRequest, Headers: function(){}, Blob: function(){ p:[] }, File: function(){},
    FileReader: function(){}, FormData: function(){},
    Image, TextEncoder, TextDecoder,
    URL, URLSearchParams,
    navigator, document, screen, location, performance, history,
    localStorage, sessionStorage, console: console_obj,
    noop: function(){},
  };
})();
