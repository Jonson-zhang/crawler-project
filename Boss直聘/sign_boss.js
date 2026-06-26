/**
 * Boss直聘 __zp_stoken__ 离线签名 (v2.0)
 * 用法: node sign_boss.js <__a> <__c> <seed> <ts>
 *
 * 注意: JS 文件 (7c91433f.js) 每天凌晨可能更换，需配合主流程动态下载。
 * 文件名由 API code=37 响应中的 zpData.name 字段指定。
 */
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// ===== Native toString protection =====
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = {}; f.prototype.constructor = f; sn(f, n); return f; }

// ===== Browser class constructors =====
var brCls = [
'Blob','CDATASection','CSSRule','CSSRuleList','CSSStyleDeclaration','CSSStyleSheet',
'CanvasGradient','CanvasPattern','CanvasRenderingContext2D','CloseEvent','Comment',
'CompositionEvent','Crypto','CustomEvent','DOMException','DOMImplementation','DOMParser',
'DOMRect','DOMRectList','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent',
'Element','ErrorEvent','Event','EventSource','EventTarget','File','FileList','FileReader',
'FocusEvent','FormData','HashChangeEvent','Headers','HTMLAllCollection','HTMLAnchorElement',
'HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement',
'HTMLCollection','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement',
'HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement',
'HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement',
'HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLIFrameElement','HTMLImageElement',
'HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement',
'HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement',
'HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement',
'HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement',
'HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement',
'HTMLScriptElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement',
'HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement',
'HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement',
'HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement',
'HTMLUnknownElement','HTMLVideoElement','Image','ImageData','InputEvent',
'IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MessagePort',
'MimeType','MimeTypeArray','MouseEvent','MutationObserver','MutationRecord','NamedNodeMap',
'Navigator','Node','NodeFilter','NodeIterator','NodeList','Notification','PageTransitionEvent',
'Path2D','Performance','PerformanceEntry','PerformanceNavigation','PerformanceObserver',
'PerformanceResourceTiming','PerformanceTiming','Plugin','PluginArray','PointerEvent',
'PopStateEvent','ProcessingInstruction','ProgressEvent','PromiseRejectionEvent',
'RTCPeerConnection','RadioNodeList','Range','ReadableStream','Request','ResizeObserver',
'Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement',
'SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement',
'SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGNumber','SVGPathElement',
'SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement',
'SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement',
'SVGTextElement','SVGTitleElement','SVGUseElement','Screen','Selection','ShadowRoot',
'StorageEvent','SubmitEvent','SubtleCrypto','Text','TextDecoder','TextEncoder','Touch',
'TouchEvent','TouchList','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams',
'ValidityState','VisualViewport','WebSocket','WheelEvent','Window','Worker','WritableStream',
'XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer',
'XPathEvaluator','XPathResult','XSLTProcessor'
];

// ===== Built sandbox with proper prototype chain =====
var sandbox = {
    Object, Array, Function, String, Number, Boolean, Date, Math,
    RegExp, Error, TypeError, SyntaxError, ReferenceError, RangeError,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    JSON, Promise, Symbol, Map, Set, WeakMap, WeakSet,
    ArrayBuffer, DataView, Uint8Array, Uint16Array, Uint32Array,
    Int8Array, Int16Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray,
    BigInt, NaN, Infinity, undefined, Proxy, Reflect,
    setTimeout, setInterval, clearTimeout, clearInterval,
    eval: function(s) { return vm.runInContext(s, vm.createContext(sandbox)); },
};

// All browser classes
brCls.forEach(function(n) { if (!(n in sandbox)) sandbox[n] = mc(n); });

// ===== Object.prototype.toString fix =====
// Set Symbol.toStringTag on all browser constructors so that
// Object.prototype.toString.call(new Foo()) returns "[object Foo]"
var toStringTag = Symbol.toStringTag;
Object.keys(sandbox).forEach(function(k) {
    var v = sandbox[k];
    if (typeof v === 'function' && /^[A-Z]/.test(k) && v.prototype) {
        try { v.prototype[toStringTag] = k; } catch(e) {}
    }
});

// ===== Proper prototype hierarchy =====
function EvtTgt(){} sn(EvtTgt,'EventTarget'); EvtTgt.prototype[toStringTag] = 'EventTarget';

function Navigator(){} Navigator.prototype = Object.create(EvtTgt.prototype); Navigator.prototype.constructor = Navigator; sn(Navigator,'Navigator'); Navigator.prototype[toStringTag] = 'Navigator';

function Document(){} Document.prototype = Object.create(EvtTgt.prototype); Document.prototype.constructor = Document; sn(Document,'Document'); Document.prototype[toStringTag] = 'HTMLDocument';

function HTMLElement(){} HTMLElement.prototype = Object.create(EvtTgt.prototype); HTMLElement.prototype.constructor = HTMLElement; HTMLElement.prototype.offsetWidth=1920; HTMLElement.prototype.offsetHeight=1080; HTMLElement.prototype.clientWidth=1920; HTMLElement.prototype.clientHeight=1080; HTMLElement.prototype.style={}; HTMLElement.prototype.className=''; HTMLElement.prototype.id=''; HTMLElement.prototype.innerHTML=''; HTMLElement.prototype.textContent=''; HTMLElement.prototype.appendChild=mf('appendChild'); HTMLElement.prototype.removeChild=mf('removeChild'); HTMLElement.prototype.setAttribute=mf('setAttribute'); HTMLElement.prototype.getAttribute=function(){return null}; sn(HTMLElement.prototype.getAttribute,'getAttribute'); HTMLElement.prototype.getBoundingClientRect=function(){return{x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0}}; sn(HTMLElement.prototype.getBoundingClientRect,'getBoundingClientRect'); sn(HTMLElement,'HTMLElement'); HTMLElement.prototype[toStringTag] = 'HTMLElement';

function HTMLHtmlElement(){} HTMLHtmlElement.prototype = Object.create(HTMLElement.prototype); HTMLHtmlElement.prototype.constructor = HTMLHtmlElement; HTMLHtmlElement.prototype.tagName='HTML'; sn(HTMLHtmlElement,'HTMLHtmlElement'); HTMLHtmlElement.prototype[toStringTag] = 'HTMLHtmlElement';

function HTMLHeadElement(){} HTMLHeadElement.prototype = Object.create(HTMLElement.prototype); HTMLHeadElement.prototype.constructor = HTMLHeadElement; sn(HTMLHeadElement,'HTMLHeadElement'); HTMLHeadElement.prototype[toStringTag] = 'HTMLHeadElement';

function HTMLBodyElement(){} HTMLBodyElement.prototype = Object.create(HTMLElement.prototype); HTMLBodyElement.prototype.constructor = HTMLBodyElement; sn(HTMLBodyElement,'HTMLBodyElement'); HTMLBodyElement.prototype[toStringTag] = 'HTMLBodyElement';

function HTMLCanvasElement(){} HTMLCanvasElement.prototype = Object.create(HTMLElement.prototype); HTMLCanvasElement.prototype.constructor = HTMLCanvasElement; HTMLCanvasElement.prototype.width=300; HTMLCanvasElement.prototype.height=150; HTMLCanvasElement.prototype.getContext=function(t){if(t==='2d'){var c={};c[toStringTag]='CanvasRenderingContext2D';['fillText','fillRect','clearRect','save','restore','scale','rotate','translate'].forEach(function(m){c[m]=mf(m)});c.measureText=function(t){return{width:t.length*10}};c.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};c.toDataURL=function(){return'data:image/png;base64,test'};return c}return null}; sn(HTMLCanvasElement.prototype.getContext,'getContext'); HTMLCanvasElement.prototype.toDataURL=function(){return'data:image/png;base64,test'}; sn(HTMLCanvasElement.prototype.toDataURL,'toDataURL'); sn(HTMLCanvasElement,'HTMLCanvasElement'); HTMLCanvasElement.prototype[toStringTag] = 'HTMLCanvasElement';

function HTMLIFrameElement(){} HTMLIFrameElement.prototype = Object.create(HTMLElement.prototype); HTMLIFrameElement.prototype.constructor = HTMLIFrameElement; sn(HTMLIFrameElement,'HTMLIFrameElement'); HTMLIFrameElement.prototype[toStringTag] = 'HTMLIFrameElement';

function HTMLScriptElement(){} HTMLScriptElement.prototype = Object.create(HTMLElement.prototype); HTMLScriptElement.prototype.constructor = HTMLScriptElement; sn(HTMLScriptElement,'HTMLScriptElement'); HTMLScriptElement.prototype[toStringTag] = 'HTMLScriptElement';

function Location(){} sn(Location,'Location'); Location.prototype[toStringTag] = 'Location';
function Screen(){} sn(Screen,'Screen'); Screen.prototype[toStringTag] = 'Screen';
function History(){} sn(History,'History'); History.prototype[toStringTag] = 'History';
function Storage(){} sn(Storage,'Storage'); Storage.prototype[toStringTag] = 'Storage';
function Performance(){} sn(Performance,'Performance'); Performance.prototype[toStringTag] = 'Performance';
function PluginArray_f(){} sn(PluginArray_f,'PluginArray'); PluginArray_f.prototype[toStringTag] = 'PluginArray';
function MimeTypeArray_f(){} sn(MimeTypeArray_f,'MimeTypeArray'); MimeTypeArray_f.prototype[toStringTag] = 'MimeTypeArray';

// Override sandbox classes with proper prototyped versions
sandbox.EventTarget = EvtTgt; sandbox.Navigator = Navigator; sandbox.Document = Document;
sandbox.HTMLElement = HTMLElement; sandbox.HTMLHtmlElement = HTMLHtmlElement;
sandbox.HTMLHeadElement = HTMLHeadElement; sandbox.HTMLBodyElement = HTMLBodyElement;
sandbox.HTMLCanvasElement = HTMLCanvasElement; sandbox.HTMLIFrameElement = HTMLIFrameElement;
sandbox.HTMLScriptElement = HTMLScriptElement; sandbox.Location = Location;
sandbox.Screen = Screen; sandbox.History = History; sandbox.Storage = Storage;
sandbox.Performance = Performance;

// ===== Navigator =====
var nav = new Navigator();
nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion='5.0 (Windows)';nav.platform='Win32';nav.language='zh-CN';
nav.languages=['zh-CN','zh'];nav.cookieEnabled=true;nav.webdriver=false;
nav.hardwareConcurrency=8;nav.maxTouchPoints=0;
nav.vendor='';nav.vendorSub='';nav.productSub='20100101';
nav.doNotTrack='1';nav.onLine=true;
nav.deviceMemory=undefined;nav.webkitTemporaryStorage=undefined;

// Plugin / MimeType constructors (needed for instanceof checks in VMP)
function PluginCtor(){} sn(PluginCtor,'Plugin');
PluginCtor.prototype[toStringTag]='Plugin';
PluginCtor.prototype.item=mf('item');PluginCtor.prototype.namedItem=mf('namedItem');
function MimeTypeCtor(){} sn(MimeTypeCtor,'MimeType');
MimeTypeCtor.prototype[toStringTag]='MimeType';

// Plugins (5 PDF viewers — FireFox on Windows)
var plgnames=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
var pls=Object.create(PluginArray_f.prototype);pls.length=5;pls.refresh=mf('refresh');pls.item=mf('item');pls.namedItem=mf('namedItem');
for(var i=0;i<5;i++){
    var p=Object.create(PluginCtor.prototype);
    p.name=plgnames[i];p.filename='internal-pdf-viewer';p.description='Portable Document Format';p.length=2;
    p.item=mf('item');p.namedItem=mf('namedItem');
    var mt0=Object.create(MimeTypeCtor.prototype);mt0.type='application/pdf';mt0.suffixes='pdf';mt0.description='Portable Document Format';mt0.enabledPlugin=p;
    var mt1=Object.create(MimeTypeCtor.prototype);mt1.type='text/pdf';mt1.suffixes='pdf';mt1.description='Portable Document Format';mt1.enabledPlugin=p;
    p[0]=mt0;p[1]=mt1;
    pls[i]=p;
}
nav.plugins=pls;

// MimeTypes
var mts=Object.create(MimeTypeArray_f.prototype);mts.length=2;mts.item=mf('item');mts.namedItem=mf('namedItem');
var mmt0=Object.create(MimeTypeCtor.prototype);mmt0.type='application/pdf';mmt0.suffixes='pdf';mmt0.description='Portable Document Format';mmt0.enabledPlugin=pls[0];
var mmt1=Object.create(MimeTypeCtor.prototype);mmt1.type='text/pdf';mmt1.suffixes='pdf';mmt1.description='Portable Document Format';mmt1.enabledPlugin=pls[0];
mts[0]=mmt0;mts[1]=mmt1;
nav.mimeTypes=mts;

// ===== Document =====
var doc = new Document();
doc.createElement=function(tag){
    if(tag==='iframe'){var f=new HTMLIFrameElement();f.style={};f.setAttribute=mf('setAttribute');f.src='about:blank';f.contentWindow=null;return f}
    if(tag==='canvas')return new HTMLCanvasElement();
    if(tag==='script'){var s=new HTMLScriptElement();s.src='';s.type='text/javascript';s.setAttribute=mf('setAttribute');return s}
    return new HTMLElement();
};sn(doc.createElement,'createElement');
doc.createElementNS=function(ns,tag){return doc.createElement(tag)};sn(doc.createElementNS,'createElementNS');
doc.body=new HTMLBodyElement();
doc.documentElement=new HTMLHtmlElement();
doc.head=new HTMLHeadElement();
doc.getElementsByTagName=function(t){if(t==='head')return{item:function(i){return doc.head},length:1};return{item:function(){return null},length:0}};
sn(doc.getElementsByTagName,'getElementsByTagName');
doc.getElementById=function(){return new HTMLElement()};sn(doc.getElementById,'getElementById');
doc.getElementsByClassName=function(){return[]};sn(doc.getElementsByClassName,'getElementsByClassName');
doc.querySelector=function(){return new HTMLElement()};sn(doc.querySelector,'querySelector');
doc.querySelectorAll=function(){return[]};sn(doc.querySelectorAll,'querySelectorAll');
doc.addEventListener=mf('addEventListener');
doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';
doc.visibilityState='visible';doc.title='BOSS直聘';doc.referrer='';
doc.domain='www.zhipin.com';doc.URL='https://www.zhipin.com/web/geek/jobs';
Object.defineProperty(doc,'cookie',{
    get: function(){ return '__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-'; },
    set: function(v){},
    configurable:true, enumerable:true
});

// ===== Location / Screen / History / Storage =====
var loc = new Location();
loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';
loc.hostname='www.zhipin.com';loc.host='www.zhipin.com';loc.pathname='/web/geek/jobs';
loc.protocol='https:';loc.origin='https://www.zhipin.com';loc.port='';
loc.search='?city=101010100&query=python';loc.hash='';

var scr = new Screen();
scr.width=2560;scr.height=1440;scr.availWidth=2560;scr.availHeight=1440;
scr.colorDepth=24;scr.pixelDepth=24;

var hist = new History();
hist.length=1;hist.pushState=mf('pushState');hist.replaceState=mf('replaceState');
hist.back=mf('back');hist.forward=mf('forward');hist.go=mf('go');

function makeStorage(){
    var s = new Storage();
    s.getItem=mf('getItem');s.setItem=mf('setItem');s.removeItem=mf('removeItem');
    s.clear=mf('clear');s.key=mf('key');s.length=0;
    return s;
}

var perf = new Performance();
perf.now=function(){return Date.now()};sn(perf.now,'now');
var nowTs=Date.now();
perf.timing={navigationStart:nowTs,fetchStart:nowTs,domainLookupStart:nowTs,domainLookupEnd:nowTs,connectStart:nowTs,connectEnd:nowTs,requestStart:nowTs,responseStart:nowTs,responseEnd:nowTs,domLoading:nowTs,domInteractive:nowTs,domContentLoadedEventStart:nowTs,domContentLoadedEventEnd:nowTs,domComplete:nowTs,loadEventStart:nowTs,loadEventEnd:nowTs};

var cryptoFn = function(arr){
    var b = require('crypto').randomBytes(arr.length);
    for(var i=0;i<arr.length;i++)arr[i]=b[i];
    return arr;
};
sn(cryptoFn,'getRandomValues');

// XHR / MO
var XHR = function(){this.open=mf('open');this.send=mf('send');this.setRequestHeader=mf('setRequestHeader');this.readyState=0;this.status=0;this.responseText='';this.DONE=4};sn(XHR,'XMLHttpRequest');
var MO = function(cb){this.observe=mf('observe');this.disconnect=mf('disconnect')};sn(MO,'MutationObserver');

// ===== Window =====
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.top = sandbox; sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = { log: function(){}, error: function(){}, warn: function(){}, info: function(){} };
sandbox.navigator = nav; sandbox.document = doc; sandbox.location = loc;
sandbox.screen = scr; sandbox.history = hist;
sandbox.localStorage = makeStorage(); sandbox.sessionStorage = makeStorage();
sandbox.performance = perf;
sandbox.crypto = {getRandomValues:cryptoFn,subtle:null};
sandbox.btoa = function(s){return Buffer.from(s).toString('base64')};sn(sandbox.btoa,'btoa');
sandbox.atob = function(s){return Buffer.from(s,'base64').toString()};sn(sandbox.atob,'atob');
sandbox.XMLHttpRequest = XHR; sandbox.MutationObserver = MO;
sandbox.Image = function(){return new sandbox.HTMLImageElement()};
sandbox.innerWidth=2560;sandbox.innerHeight=1440;sandbox.outerWidth=2560;sandbox.outerHeight=1440;
sandbox.devicePixelRatio=1;sandbox.screenX=0;sandbox.screenY=0;sandbox.scrollX=0;sandbox.scrollY=0;
sandbox.name='';sandbox.closed=false;sandbox.length=0;sandbox.opener=null;
sandbox.origin='https://www.zhipin.com';sandbox.isSecureContext=true;
sandbox.postMessage=mf('postMessage');sandbox.addEventListener=mf('addEventListener');
sandbox.removeEventListener=mf('removeEventListener');sandbox.dispatchEvent=mf('dispatchEvent');
sandbox.fetch=mf('fetch');sandbox.requestAnimationFrame=mf('requestAnimationFrame');
sandbox.matchMedia=function(){return{matches:false}};sn(sandbox.matchMedia,'matchMedia');
sandbox.getComputedStyle=function(){return{}};sn(sandbox.getComputedStyle,'getComputedStyle');
sandbox.getSelection=function(){return null};sn(sandbox.getSelection,'getSelection');
sandbox.print=mf('print');sandbox.open=mf('open');sandbox.close=mf('close');
sandbox.focus=mf('focus');sandbox.blur=mf('blur');sandbox.stop=mf('stop');
sandbox.scroll=mf('scroll');sandbox.scrollTo=mf('scrollTo');sandbox.scrollBy=mf('scrollBy');
sandbox.alert=mf('alert');sandbox.confirm=mf('confirm');sandbox.prompt=mf('prompt');

// ===== WebGL context for canvas (fingerprinting) =====
function makeWebGLContext() {
    var gl = {};
    gl[toStringTag] = 'WebGLRenderingContext';
    gl.canvas = null;
    // Rendering stubs
    ['clear','clearColor','clearDepth','clearStencil','enable','disable','depthFunc','depthMask','blendFunc','blendFuncSeparate',
     'viewport','scissor','cullFace','frontFace','lineWidth','polygonOffset','activeTexture','bindTexture','generateMipmap',
     'bindBuffer','bufferData','bufferSubData','useProgram','drawArrays','drawElements','readPixels',
     'pixelStorei','texParameteri','texImage2D','texSubImage2D','flush','finish','hint',
     'vertexAttribPointer','enableVertexAttribArray','disableVertexAttribArray','uniform1i','uniform1f','uniform2f','uniform3f','uniform4f',
     'uniformMatrix2fv','uniformMatrix3fv','uniformMatrix4fv','bindAttribLocation','linkProgram','validateProgram',
     'attachShader','compileShader','shaderSource','bindFramebuffer','framebufferTexture2D','checkFramebufferStatus',
     'createShader','createProgram','createTexture','createBuffer','createFramebuffer'].forEach(function(m){gl[m]=mf(m)});
    // Parameter queries - return realistic values
    gl.getParameter = function(p) {
        var defaults = {
            3410: 'WebGL 1.0', // VERSION
            3411: 'WebGL GLSL ES 1.0', // SHADING_LANGUAGE_VERSION
            7938: 'Mozilla', // VENDOR
            7937: 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)', // RENDERER
            35724: 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)',
            33901: 4096, // MAX_TEXTURE_SIZE
            3386: 1024, // MAX_VIEWPORT_DIMS
            7939: 30, // MAX_VERTEX_ATTRIBS
            34076: 16, // MAX_TEXTURE_IMAGE_UNITS
            35661: 8, // MAX_COMBINED_TEXTURE_IMAGE_UNITS
            3415: 0, // MAX_SAMPLES (or 4)
            34921: 8, // MAX_DRAW_BUFFERS
            3387: 1024, // ALIASED_POINT_SIZE_RANGE
            33902: [1024, 1024], // ALIASED_LINE_WIDTH_RANGE
            36347: 32, // MAX_VARYING_VECTORS
            36348: 128, // MAX_VERTEX_UNIFORM_VECTORS
            36349: 64, // MAX_FRAGMENT_UNIFORM_VECTORS
        };
        return p in defaults ? defaults[p] : 0;
    };
    gl.getExtension = function(name) {
        if (name === 'WEBGL_debug_renderer_info') return {UNMASKED_VENDOR_WEBGL: 7938, UNMASKED_RENDERER_WEBGL: 7937};
        if (name === 'EXT_texture_filter_anisotropic') return {MAX_TEXTURE_MAX_ANISOTROPY_EXT: 34047, TEXTURE_MAX_ANISOTROPY_EXT: 16};
        if (name === 'OES_texture_float') return {};
        if (name === 'WEBGL_compressed_texture_s3tc') return {};
        return null;
    };
    gl.getSupportedExtensions = function() {
        return ['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_color_buffer_half_float','EXT_disjoint_timer_query',
                'EXT_float_blend','EXT_frag_depth','EXT_shader_texture_lod','EXT_texture_compression_bptc',
                'EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','KHR_parallel_shader_compile',
                'OES_element_index_uint','OES_fbo_render_mipmap','OES_standard_derivatives','OES_texture_float',
                'OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object',
                'WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb',
                'WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers',
                'WEBGL_lose_context','WEBGL_multi_draw'];
    };
    gl.getShaderPrecisionFormat = function() {
        return {rangeMin: 127, rangeMax: 127, precision: 23};
    };
    sn(gl.getParameter,'getParameter');
    sn(gl.getExtension,'getExtension');
    sn(gl.getSupportedExtensions,'getSupportedExtensions');
    return gl;
}

// Hook canvas getContext to also support 'webgl'/'experimental-webgl'
var origGetCtx = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
        return makeWebGLContext();
    }
    return origGetCtx.call(this, type);
};

// ===== Anti-automation markers (must be undefined!) =====
sandbox._phantom = undefined;
sandbox.callphantom = undefined;
sandbox.__phantomas = undefined;
sandbox.Buffer = undefined;
sandbox.process = undefined;
sandbox.require = undefined;
sandbox.module = undefined;
sandbox.exports = undefined;
sandbox.__dirname = undefined;
sandbox.__filename = undefined;
sandbox.global = sandbox; // global === window in browser

// ===== Patch & Execute =====
// Capture VMP's own catch-block errors
sandbox.__vmp_errors = [];
var patchedCode = code.replace(/catch\(([^)]*)\)\{\}/g, function(m, v) {
    return 'catch(' + v + '){try{sandbox.__vmp_errors.push({msg:' + v + '&&' + v + '.message||String(' + v + ').substring(0,120)})}catch(_){}}';
});

var ctx = vm.createContext(sandbox);
try {
    new vm.Script(patchedCode).runInContext(ctx);
    if (sandbox.__vmp_errors.length > 0) {
        process.stderr.write('[VMP errors during init] ' + sandbox.__vmp_errors.length + ' errors caught:\n');
        sandbox.__vmp_errors.slice(0, 10).forEach(function(e, i) {
            process.stderr.write('  [' + i + '] ' + e.msg + '\n');
        });
    }
    if (typeof sandbox.ABC !== 'undefined') {
        var seed = process.argv[4];
        var ts = parseInt(process.argv[5]);
        process.stdout.write(new sandbox.ABC().z(seed, ts));
    } else {
        process.stderr.write('ABC not defined\n');
        process.exit(1);
    }
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
