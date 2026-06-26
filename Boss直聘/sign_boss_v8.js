/**
 * Boss直聘 补环境 v8 — WebGL指纹 + MemoryInfo + Plugin迭代器
 *
 * v8 修复:
 *  1. WebGL: VENDOR=WebKit, RENDERER=WebKit WebGL, UNMASKED values via debug extension
 *  2. performance.memory: [object MemoryInfo] with actual heap values
 *  3. PluginArray/MimeTypeArray: Symbol.iterator support
 *  4. Plugin/MimeType: [object Plugin] / [object MimeType]
 *  5. MAX_TEXTURE_SIZE=16384, MAX_VERTEX_ATTRIBS=16
 *  6. 2D Canvas getContext support
 *
 * 用法: node sign_boss_v8.js <__a> <__c> <seed> <ts>
 */
var vm = require('vm');
var fs = require('fs');
var _crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

// ===== Constructor hierarchy =====
function EvtTgt(){} sn(EvtTgt,'EventTarget'); EvtTgt.prototype[ST]='EventTarget';

function Navigator_(){}
Navigator_.prototype = Object.create(EvtTgt.prototype);
Navigator_.prototype.constructor = Navigator_;
Navigator_.prototype[ST] = 'Navigator';
sn(Navigator_, 'Navigator');

function Document_(){}
Document_.prototype = Object.create(EvtTgt.prototype);
Document_.prototype.constructor = Document_;
Document_.prototype[ST] = 'HTMLDocument';
sn(Document_, 'Document');

function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype);
HTMLEl.prototype.constructor = HTMLEl;
HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1920;
HTMLEl.prototype.offsetHeight = 1080;
HTMLEl.prototype.clientWidth = 1920;
HTMLEl.prototype.clientHeight = 1080;
HTMLEl.prototype.style = {};
HTMLEl.prototype.className = '';
HTMLEl.prototype.id = '';
HTMLEl.prototype.innerHTML = '';
HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function() { return null; }; sn(HTMLEl.prototype.getAttribute, 'getAttribute');
HTMLEl.prototype.getBoundingClientRect = function() { return {top:0,left:0,right:1920,bottom:1080,width:1920,height:1080}; };
sn(HTMLEl.prototype.getBoundingClientRect, 'getBoundingClientRect');
sn(HTMLEl, 'HTMLElement');

function HTMLHtmlEl(){}
HTMLHtmlEl.prototype = Object.create(HTMLEl.prototype);
HTMLHtmlEl.prototype.constructor = HTMLHtmlEl;
HTMLHtmlEl.prototype.tagName = 'HTML';
HTMLHtmlEl.prototype[ST] = 'HTMLHtmlElement';
sn(HTMLHtmlEl, 'HTMLHtmlElement');

function HTMLBodyEl(){}
HTMLBodyEl.prototype = Object.create(HTMLEl.prototype);
HTMLBodyEl.prototype.constructor = HTMLBodyEl;
HTMLBodyEl.prototype[ST] = 'HTMLBodyElement';
sn(HTMLBodyEl, 'HTMLBodyElement');

function HTMLHeadEl(){}
HTMLHeadEl.prototype = Object.create(HTMLEl.prototype);
HTMLHeadEl.prototype.constructor = HTMLHeadEl;
HTMLHeadEl.prototype[ST] = 'HTMLHeadElement';
sn(HTMLHeadEl, 'HTMLHeadElement');

function HTMLCanvasEl(){}
HTMLCanvasEl.prototype = Object.create(HTMLEl.prototype);
HTMLCanvasEl.prototype.constructor = HTMLCanvasEl;
HTMLCanvasEl.prototype.width = 300;
HTMLCanvasEl.prototype.height = 150;
HTMLCanvasEl.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
        return makeWebGLContext();
    }
    if (type === '2d') {
        return make2DContext();
    }
    return null;
}; sn(HTMLCanvasEl.prototype.getContext, 'getContext');
HTMLCanvasEl.prototype.toDataURL = function() { return 'data:image/png;base64,test'; }; sn(HTMLCanvasEl.prototype.toDataURL, 'toDataURL');
HTMLCanvasEl.prototype[ST] = 'HTMLCanvasElement';
sn(HTMLCanvasEl, 'HTMLCanvasElement');

function HTMLIFrameEl(){}
HTMLIFrameEl.prototype = Object.create(HTMLEl.prototype);
HTMLIFrameEl.prototype.constructor = HTMLIFrameEl;
HTMLIFrameEl.prototype.src = '';
HTMLIFrameEl.prototype.contentWindow = null;
HTMLIFrameEl.prototype[ST] = 'HTMLIFrameElement';
sn(HTMLIFrameEl, 'HTMLIFrameElement');

function HTMLScriptEl(){}
HTMLScriptEl.prototype = Object.create(HTMLEl.prototype);
HTMLScriptEl.prototype.constructor = HTMLScriptEl;
HTMLScriptEl.prototype.src = '';
HTMLScriptEl.prototype.type = 'text/javascript';
HTMLScriptEl.prototype[ST] = 'HTMLScriptElement';
sn(HTMLScriptEl, 'HTMLScriptElement');

function Location_(){}
Location_.prototype[ST] = 'Location';
sn(Location_, 'Location');

function Screen_(){}
Screen_.prototype[ST] = 'Screen';
sn(Screen_, 'Screen');

function History_(){}
History_.prototype[ST] = 'History';
sn(History_, 'History');

function Storage_(){}
Storage_.prototype[ST] = 'Storage';
sn(Storage_, 'Storage');

function Performance_(){}
Performance_.prototype[ST] = 'Performance';
sn(Performance_, 'Performance');

// ===== Plugin/MimeType with proper Symbol.toStringTag =====
function PluginArray_(){}
PluginArray_.prototype[ST] = 'PluginArray';
PluginArray_.prototype.item = mf('item');
PluginArray_.prototype.namedItem = mf('namedItem');
PluginArray_.prototype.refresh = mf('refresh');
// Symbol.iterator for for...of
PluginArray_.prototype[Symbol.iterator] = function() {
    var arr = this;
    var i = 0;
    return { next: function() { return i < arr.length ? {value: arr[i++], done: false} : {done: true}; } };
};
sn(PluginArray_, 'PluginArray');

function MimeTypeArray_(){}
MimeTypeArray_.prototype[ST] = 'MimeTypeArray';
MimeTypeArray_.prototype.item = mf('item');
MimeTypeArray_.prototype.namedItem = mf('namedItem');
MimeTypeArray_.prototype[Symbol.iterator] = function() {
    var arr = this;
    var i = 0;
    return { next: function() { return i < arr.length ? {value: arr[i++], done: false} : {done: true}; } };
};
sn(MimeTypeArray_, 'MimeTypeArray');

function Plugin_(){}
Plugin_.prototype.item = mf('item');
Plugin_.prototype.namedItem = mf('namedItem');
Plugin_.prototype[ST] = 'Plugin';
sn(Plugin_, 'Plugin');

function MimeType_(){}
MimeType_.prototype[ST] = 'MimeType';
sn(MimeType_, 'MimeType');

// ===== MemoryInfo class =====
function MemoryInfo_(){}
MemoryInfo_.prototype[ST] = 'MemoryInfo';
MemoryInfo_.prototype.jsHeapSizeLimit = 4294967296;
MemoryInfo_.prototype.totalJSHeapSize = 41938737;
MemoryInfo_.prototype.usedJSHeapSize = 34705941;
sn(MemoryInfo_, 'MemoryInfo');

// ===== WebGL Context (EXACT browser values) =====
function makeWebGLContext() {
    var ctx = {};
    ctx[ST] = 'WebGLRenderingContext';

    // Rendering stubs
    ['clear','clearColor','enable','disable','depthFunc','depthMask','blendFunc','blendFuncSeparate',
     'viewport','scissor','cullFace','frontFace','lineWidth','activeTexture','bindTexture','generateMipmap',
     'bindBuffer','bufferData','bufferSubData','useProgram','drawArrays','drawElements','readPixels',
     'pixelStorei','texParameteri','texImage2D','texSubImage2D','flush','finish','hint',
     'vertexAttribPointer','enableVertexAttribArray','disableVertexAttribArray',
     'uniform1i','uniform1f','uniform2f','uniform3f','uniform4f',
     'uniformMatrix2fv','uniformMatrix3fv','uniformMatrix4fv',
     'bindAttribLocation','linkProgram','validateProgram','attachShader','compileShader','shaderSource',
     'bindFramebuffer','framebufferTexture2D','checkFramebufferStatus',
     'createShader','createProgram','createTexture','createBuffer','createFramebuffer',
     'createRenderbuffer','bindRenderbuffer','renderbufferStorage',
     'stencilFunc','stencilOp','colorMask','sampleCoverage',
     'getUniformLocation','getAttribLocation','getBufferParameter','getProgramParameter','getShaderParameter',
     'getProgramInfoLog','getShaderInfoLog','getError','getActiveUniform','getActiveAttrib','getShaderSource',
     'deleteShader','deleteProgram','deleteTexture','deleteBuffer','deleteFramebuffer','deleteRenderbuffer',
     'isProgram','isShader','isTexture','isBuffer','isFramebuffer','isRenderbuffer'].forEach(function(m){
        ctx[m] = mf(m);
    });

    // === getParameter — browser-exact values ===
    var params = {
        // Constants from WebGL spec
        3410: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',              // VERSION
        3411: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)', // SHADING_LANGUAGE_VERSION
        7938: 'WebKit',                                            // VENDOR (standard)
        7937: 'WebKit WebGL',                                      // RENDERER (standard)
        // UNMASKED via WEBGL_debug_renderer_info
        37445: 'Google Inc. (NVIDIA)',                            // UNMASKED_VENDOR_WEBGL
        37446: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)',
        3379: 16384,                                               // MAX_TEXTURE_SIZE
        3386: [16384, 16384],                                      // MAX_VIEWPORT_DIMS
        34921: 16,                                                 // MAX_VERTEX_ATTRIBS
        35661: 32,                                                 // MAX_COMBINED_TEXTURE_IMAGE_UNITS
        34076: 32,                                                 // MAX_TEXTURE_IMAGE_UNITS
        36347: 32,                                                 // MAX_VARYING_VECTORS (16 for Firefox, 32 for Chrome)
        36348: 4096,                                               // MAX_VERTEX_UNIFORM_VECTORS
        36349: 1024,                                               // MAX_FRAGMENT_UNIFORM_VECTORS
        3415: 16,                                                  // MAX_SAMPLES
        33901: 16384,                                              // MAX_CUBE_MAP_TEXTURE_SIZE
        33902: [1, 1024],                                          // ALIASED_LINE_WIDTH_RANGE
        3387: [1, 1024],                                           // ALIASED_POINT_SIZE_RANGE
        34024: 256,                                                // MAX_RENDERBUFFER_SIZE
        35724: 'WebGL 1.0 (OpenGL ES 2.0 Chromium)',              // UNMASKED_VERSION
        33902: [1, 1024],                                          // ALIASED_LINE_WIDTH_RANGE
        7939: 16,                                                  // RED_BITS
        3412: 0,                                                   // BLUE_BITS
        3413: 0,                                                   // GREEN_BITS
        3414: 0,                                                   // ALPHA_BITS
        3415: 0,                                                   // DEPTH_BITS
        3416: 0,                                                   // STENCIL_BITS
        35660: 0,                                                  // MAX_ELEMENT_INDEX (or large number)
        34922: 8,                                                  // MAX_DRAW_BUFFERS
        35657: 0,                                                  // SUBPIXEL_BITS
    };

    ctx.getParameter = function(p) {
        if (p in params) return params[p];
        return 0;
    };
    sn(ctx.getParameter, 'getParameter');

    // === getExtension — browser-exact ===
    ctx.getExtension = function(name) {
        if (name === 'WEBGL_debug_renderer_info') {
            return { UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 };
        }
        if (name === 'WEBGL_compressed_texture_s3tc_srgb') return {};
        if (name === 'WEBGL_draw_buffers') return {};
        if (name === 'WEBGL_multi_draw') return {};
        if (name === 'OES_standard_derivatives') return {};
        if (name === 'OES_texture_float') return {};
        if (name === 'OES_texture_float_linear') return {};
        if (name === 'OES_texture_half_float') return {};
        if (name === 'OES_texture_half_float_linear') return {};
        if (name === 'OES_vertex_array_object') return {};
        if (name === 'OES_element_index_uint') return {};
        if (name === 'OES_fbo_render_mipmap') return {};
        if (name === 'ANGLE_instanced_arrays') return {};
        if (name === 'EXT_blend_minmax') return {};
        if (name === 'EXT_color_buffer_half_float') return {};
        if (name === 'EXT_color_buffer_float') return {};
        if (name === 'EXT_disjoint_timer_query') return {};
        if (name === 'EXT_float_blend') return {};
        if (name === 'EXT_frag_depth') return {};
        if (name === 'EXT_shader_texture_lod') return {};
        if (name === 'EXT_sRGB') return {};
        if (name === 'EXT_texture_compression_bptc') return {};
        if (name === 'EXT_texture_compression_rgtc') return {};
        if (name === 'EXT_texture_filter_anisotropic') return { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047, TEXTURE_MAX_ANISOTROPY_EXT: 16 };
        if (name === 'KHR_parallel_shader_compile') return {};
        if (name === 'WEBGL_compressed_texture_s3tc') return {};
        if (name === 'WEBGL_color_buffer_float') return {};
        if (name === 'WEBGL_debug_shaders') return {};
        if (name === 'WEBGL_depth_texture') return {};
        if (name === 'WEBGL_lose_context') return {};
        return null;
    };
    sn(ctx.getExtension, 'getExtension');

    // === getSupportedExtensions — browser-exact ===
    ctx.getSupportedExtensions = function() {
        return [
            'ANGLE_instanced_arrays',
            'EXT_blend_minmax',
            'EXT_color_buffer_half_float',
            'EXT_color_buffer_float',
            'EXT_disjoint_timer_query',
            'EXT_float_blend',
            'EXT_frag_depth',
            'EXT_shader_texture_lod',
            'EXT_sRGB',
            'EXT_texture_compression_bptc',
            'EXT_texture_compression_rgtc',
            'EXT_texture_filter_anisotropic',
            'KHR_parallel_shader_compile',
            'OES_element_index_uint',
            'OES_fbo_render_mipmap',
            'OES_standard_derivatives',
            'OES_texture_float',
            'OES_texture_float_linear',
            'OES_texture_half_float',
            'OES_texture_half_float_linear',
            'OES_vertex_array_object',
            'WEBGL_color_buffer_float',
            'WEBGL_compressed_texture_s3tc',
            'WEBGL_compressed_texture_s3tc_srgb',
            'WEBGL_debug_renderer_info',
            'WEBGL_debug_shaders',
            'WEBGL_depth_texture',
            'WEBGL_draw_buffers',
            'WEBGL_lose_context',
            'WEBGL_multi_draw'
        ];
    };
    sn(ctx.getSupportedExtensions, 'getSupportedExtensions');

    ctx.getShaderPrecisionFormat = function(shaderType, precisionType) {
        return { rangeMin: 127, rangeMax: 127, precision: 23 };
    };
    sn(ctx.getShaderPrecisionFormat, 'getShaderPrecisionFormat');

    // Canvas reference
    ctx.canvas = { width: 300, height: 150 };
    ctx.drawingBufferWidth = 300;
    ctx.drawingBufferHeight = 150;

    return ctx;
}

// ===== 2D Canvas Context =====
function make2DContext() {
    var ctx = {};
    ctx[ST] = 'CanvasRenderingContext2D';

    ['fillText','fillRect','clearRect','save','restore','scale','rotate','translate',
     'beginPath','moveTo','lineTo','stroke','arc','fill','clip','closePath','rect',
     'strokeRect','quadraticCurveTo','bezierCurveTo','arcTo','createLinearGradient',
     'createRadialGradient','createPattern','drawImage','putImageData','createImageData',
     'getImageData','measureText','isPointInPath','isPointInStroke','setTransform',
     'transform','resetTransform','globalCompositeOperation','globalAlpha',
     'setLineDash','getLineDash','lineDashOffset','createConicGradient','filter',
     'reset','roundRect','getContextAttributes'].forEach(function(m) {
        ctx[m] = mf(m);
    });

    ctx.measureText = function(t) { return { width: t.length * 6, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }; };
    sn(ctx.measureText, 'measureText');

    ctx.getImageData = function(x, y, w, h) {
        return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    };
    sn(ctx.getImageData, 'getImageData');

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0, 0, 0, 0)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
    ctx.miterLimit = 10;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.lineDashOffset = 0;

    return ctx;
}

// ===== Navigator (prototype getters, browser-exact) =====
var NP = Navigator_.prototype;
function defNav(prop, val) {
    Object.defineProperty(NP, prop, {
        get: function() { return val; },
        enumerable: true, configurable: true
    });
}

defNav('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appVersion', '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
defNav('appCodeName', 'Mozilla');
defNav('appName', 'Netscape');
defNav('platform', 'Win32');
defNav('product', 'Gecko');
defNav('vendor', 'Google Inc.');
defNav('vendorSub', '');
defNav('productSub', '20030107');
defNav('language', 'zh-CN');
defNav('languages', ['zh-CN', 'zh']);
defNav('cookieEnabled', true);
defNav('webdriver', false);
defNav('onLine', true);
defNav('hardwareConcurrency', 32);
defNav('maxTouchPoints', 0);
defNav('deviceMemory', 32);
defNav('pdfViewerEnabled', true);
defNav('doNotTrack', null);

// Stub objects on navigator (Chrome)
['webkitTemporaryStorage','webkitPersistentStorage','connection','bluetooth','usb','xr',
 'keyboard','locks','wakeLock','serial','hid','clipboard','credentials','mediaDevices',
 'mediaCapabilities','mediaSession','permissions','serviceWorker','storage','geolocation',
 'virtualKeyboard','userActivation','scheduling','gpu','login','ink','devicePosture',
 'presentation','storageBuckets','managed','windowControlsOverlay',
 'protectedAudience'].forEach(function(k) {
    Object.defineProperty(NP, k, {
        get: function() { return {}; },
        enumerable: true, configurable: true
    });
});

// userAgentData (Client Hints)
Object.defineProperty(NP, 'userAgentData', {
    get: function() {
        return {
            brands: [{brand:'Chromium',version:'148'},{brand:'Google Chrome',version:'148'},{brand:'Not/A)Brand',version:'99'}],
            mobile: false,
            platform: 'Windows',
            getHighEntropyValues: mf('getHighEntropyValues'),
            toJSON: mf('toJSON'),
            [ST]: 'NavigatorUAData'
        };
    },
    enumerable: true, configurable: true
});

// Functions on prototype
['javaEnabled','sendBeacon','getGamepads','vibrate'].forEach(function(k) {
    Object.defineProperty(NP, k, {
        get: function() { return mf(k); },
        enumerable: true, configurable: true
    });
});
Object.defineProperty(NP, 'taintEnabled', {
    get: function() { return undefined; },
    enumerable: true, configurable: true
});

// Plugins/MimeTypes (browser-exact structure)
function buildPlugins() {
    var names = ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
    var pls = Object.create(PluginArray_.prototype);
    pls.length = 5;
    pls.refresh = PluginArray_.prototype.refresh;
    pls.item = PluginArray_.prototype.item;
    pls.namedItem = PluginArray_.prototype.namedItem;

    var allMts = Object.create(MimeTypeArray_.prototype);
    allMts.length = 2;

    for (var i = 0; i < 5; i++) {
        var p = Object.create(Plugin_.prototype);
        p.name = names[i];
        p.filename = 'internal-pdf-viewer';
        p.description = 'Portable Document Format';
        p.length = 2;

        var mt0 = Object.create(MimeType_.prototype);
        mt0.type = 'application/pdf';
        mt0.suffixes = 'pdf';
        mt0.description = 'Portable Document Format';
        mt0.enabledPlugin = p;

        var mt1 = Object.create(MimeType_.prototype);
        mt1.type = 'text/pdf';
        mt1.suffixes = 'pdf';
        mt1.description = 'Portable Document Format';
        mt1.enabledPlugin = p;

        p[0] = mt0;
        p[1] = mt1;
        pls[i] = p;

        if (i === 0) {
            allMts[0] = mt0;
            allMts[1] = mt1;
        }
    }

    return { plugins: pls, mimeTypes: allMts };
}

var _pluginCache = null;
Object.defineProperty(NP, 'plugins', {
    get: function() {
        if (!_pluginCache) _pluginCache = buildPlugins();
        return _pluginCache.plugins;
    },
    enumerable: true, configurable: true
});
Object.defineProperty(NP, 'mimeTypes', {
    get: function() {
        if (!_pluginCache) _pluginCache = buildPlugins();
        return _pluginCache.mimeTypes;
    },
    enumerable: true, configurable: true
});

var nav = new Navigator_();

// ===== Document =====
var doc = new Document_();
doc.createElement = function(tag) {
    if (tag === 'iframe') { var f = new HTMLIFrameEl(); f.contentWindow = sandbox; return f; }
    if (tag === 'canvas') return new HTMLCanvasEl();
    if (tag === 'script') return new HTMLScriptEl();
    return new HTMLEl();
}; sn(doc.createElement, 'createElement');
doc.createElementNS = function(ns, tag) { return doc.createElement(tag); }; sn(doc.createElementNS, 'createElementNS');
doc.body = new HTMLBodyEl();
doc.documentElement = new HTMLHtmlEl();
doc.head = new HTMLHeadEl();
doc.getElementsByTagName = function(t) {
    if (t === 'head') return { item: function() { return doc.head; }, length: 1 };
    return { item: function() { return null; }, length: 0 };
}; sn(doc.getElementsByTagName, 'getElementsByTagName');
doc.getElementById = function() { return new HTMLEl(); }; sn(doc.getElementById, 'getElementById');
doc.getElementsByClassName = function() { return []; }; sn(doc.getElementsByClassName, 'getElementsByClassName');
doc.querySelector = function() { return new HTMLEl(); }; sn(doc.querySelector, 'querySelector');
doc.querySelectorAll = function() { return []; }; sn(doc.querySelectorAll, 'querySelectorAll');
doc.addEventListener = mf('addEventListener');
doc.hidden = false;
doc.readyState = 'complete';
doc.characterSet = 'UTF-8';
doc.visibilityState = 'visible';
doc.title = 'BOSS直聘';
doc.referrer = '';
doc.domain = 'www.zhipin.com';
doc.URL = 'https://www.zhipin.com/web/geek/jobs';
doc.all = undefined;

// document.cookie as PROTOTYPE getter (like real browser)
Object.defineProperty(Document_.prototype, 'cookie', {
    get: function() { return '__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-'; },
    set: function(v) {},
    configurable: true, enumerable: true
});

// ===== Location =====
var loc = new Location_();
loc.href = 'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname = 'www.zhipin.com';
loc.host = 'www.zhipin.com';
loc.pathname = '/web/geek/jobs';
loc.protocol = 'https:';
loc.origin = 'https://www.zhipin.com';
loc.port = '';
loc.search = '?city=101010100&query=python';
loc.hash = '';

// ===== Screen (getters on prototype) =====
var SP = Screen_.prototype;
Object.defineProperty(SP, 'width', {get: function(){return 2195;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'height', {get: function(){return 1235;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'availWidth', {get: function(){return 2195;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'availHeight', {get: function(){return 1187;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'colorDepth', {get: function(){return 32;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'pixelDepth', {get: function(){return 32;}, enumerable:true,configurable:true});
Object.defineProperty(SP, 'orientation', {get: function(){return {type:'landscape-primary',angle:0};}, enumerable:true,configurable:true});
var scr = new Screen_();

// ===== History =====
var hist = new History_();
hist.length = 1;
hist.pushState = mf('pushState');
hist.replaceState = mf('replaceState');

// ===== Storage (prototype getter for Symbol.toStringTag) =====
function mkStor() {
    var s = new Storage_();
    s.getItem = function(key) { return null; }; sn(s.getItem, 'getItem');
    s.setItem = mf('setItem');
    s.removeItem = mf('removeItem');
    s.clear = mf('clear');
    s.key = mf('key');
    s.length = 0;
    return s;
}

// ===== Performance with MemoryInfo =====
function Perf_(){}
Perf_.prototype[ST] = 'Performance';
sn(Perf_, 'Performance');

var memInfo = new MemoryInfo_();
var perf = new Perf_();
perf.now = function() { return Date.now(); }; sn(perf.now, 'now');
perf.memory = memInfo;  // [object MemoryInfo]

// ===== Crypto =====
var cryptoFn = function(arr) { var b = _crypto.randomBytes(arr.length); for (var i = 0; i < arr.length; i++) arr[i] = b[i]; return arr; };
sn(cryptoFn, 'getRandomValues');

// ===== Base64 =====
var btoaFn = function(s) { return Buffer.from(s).toString('base64'); }; sn(btoaFn, 'btoa');
var atobFn = function(s) { return Buffer.from(s, 'base64').toString(); }; sn(atobFn, 'atob');

// ===== Sandbox =====
var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math, RegExp,
    Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Int32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    console: { log: function(){}, error: function(){}, warn: function(){} },
};

sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox; sandbox.globalThis = sandbox;
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = mkStor(); sandbox.sessionStorage = mkStor(); sandbox.performance = perf;
sandbox.crypto = { getRandomValues: cryptoFn, subtle: null };
sandbox.btoa = btoaFn; sandbox.atob = atobFn;
sandbox.innerWidth = 2195; sandbox.innerHeight = 1100;
sandbox.outerWidth = 2195; sandbox.outerHeight = 1187;
sandbox.devicePixelRatio = 1.75; sandbox.screenX = 2195; sandbox.screenY = 0;
sandbox.name = ''; sandbox.closed = false; sandbox.length = 0; sandbox.opener = null;
sandbox.origin = 'https://www.zhipin.com'; sandbox.isSecureContext = true;
sandbox.postMessage = mf('postMessage'); sandbox.addEventListener = mf('addEventListener');
sandbox.removeEventListener = mf('removeEventListener'); sandbox.dispatchEvent = mf('dispatchEvent');
sandbox.fetch = mf('fetch'); sandbox.requestAnimationFrame = mf('requestAnimationFrame');
sandbox.matchMedia = function() { return { matches: false, media: '' }; }; sn(sandbox.matchMedia, 'matchMedia');
sandbox.getComputedStyle = function() { return {}; }; sn(sandbox.getComputedStyle, 'getComputedStyle');
sandbox.getSelection = function() { return null; }; sn(sandbox.getSelection, 'getSelection');
sandbox.print = mf('print'); sandbox.open = mf('open'); sandbox.close = mf('close');
sandbox.focus = mf('focus'); sandbox.blur = mf('blur'); sandbox.stop = mf('stop');
sandbox.scroll = mf('scroll'); sandbox.scrollTo = mf('scrollTo'); sandbox.scrollBy = mf('scrollBy');
sandbox.alert = mf('alert'); sandbox.confirm = mf('confirm'); sandbox.prompt = mf('prompt');
sandbox.XMLHttpRequest = mc('XMLHttpRequest'); sandbox.MutationObserver = mc('MutationObserver');
sandbox.Image = mc('Image'); sandbox.Event = mc('Event'); sandbox.CSSRuleList = mc('CSSRuleList');
sandbox.process = undefined; sandbox.module = undefined; sandbox.require = undefined;
sandbox._phantom = undefined; sandbox.callphantom = undefined;

var extraCls = ['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'];
extraCls.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

// Override sandbox with proper constructors
sandbox.Navigator = Navigator_; sandbox.Document = Document_;
sandbox.HTMLElement = HTMLEl; sandbox.HTMLHtmlElement = HTMLHtmlEl;
sandbox.HTMLBodyElement = HTMLBodyEl; sandbox.HTMLHeadElement = HTMLHeadEl;
sandbox.HTMLCanvasElement = HTMLCanvasEl; sandbox.HTMLIFrameElement = HTMLIFrameEl;
sandbox.HTMLScriptElement = HTMLScriptEl;
sandbox.Location = Location_; sandbox.Screen = Screen_;
sandbox.History = History_; sandbox.Storage = Storage_;
sandbox.Performance = Perf_; sandbox.MemoryInfo = MemoryInfo_;
sandbox.PluginArray = PluginArray_; sandbox.MimeTypeArray = MimeTypeArray_;
sandbox.Plugin = Plugin_; sandbox.MimeType = MimeType_;
sandbox.EventTarget = EvtTgt;

// ===== Execute =====
var ctx = vm.createContext(sandbox);
try {
    new vm.Script(code).runInContext(ctx);
    var seed = process.argv[4] || 'test_seed_44_chars_long_abcde12345678';
    var ts = parseInt(process.argv[5] || '1700000000000');
    var result = new sandbox.ABC().z(seed, ts);
    process.stdout.write(result);
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
