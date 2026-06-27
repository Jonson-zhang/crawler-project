/**
 * Boss直聘 v11 — Function构造器(无vm沙箱) + Chrome精确指纹
 * 融合v4的纯净V8执行 + v10的31项自检全部对齐
 */
var fs = require('fs'), crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var __a = process.argv[2], __c = process.argv[3];
var seed = process.argv[4], ts = parseInt(process.argv[5]);

// Build Function body with all browser env inline
var fn = new Function('__a','__c','seed','ts','code','crb','btoaFn','atobFn', `
var mm=new Map,rt=Function.prototype.toString;
Function.prototype.toString=function(){return typeof this==='function'&&mm.get(this)||rt.call(this)};
function sn(o,n){mm.set(o,'function '+n+'() { [native code] }')}
function mf(n){var f=function(){};sn(f,n);return f}
function mc(n){var f=function(){};f.prototype={constructor:f};sn(f,n);return f}
var ST=Symbol.toStringTag;
function EvtTgt(){}sn(EvtTgt,'EventTarget');
function Nav_(){}
Nav_.prototype=Object.create(EvtTgt.prototype);Nav_.prototype[ST]='Navigator';sn(Nav_,'Navigator');
function Doc_(){}
Doc_.prototype=Object.create(EvtTgt.prototype);Doc_.prototype[ST]='HTMLDocument';sn(Doc_,'Document');
function HTMLEl(){}
HTMLEl.prototype=Object.create(EvtTgt.prototype);HTMLEl.prototype[ST]='HTMLElement';
HTMLEl.prototype.offsetWidth=1920;HTMLEl.prototype.appendChild=mf('appendChild');
HTMLEl.prototype.setAttribute=mf('setAttribute');
HTMLEl.prototype.getAttribute=function(){return null};sn(HTMLEl.prototype.getAttribute,'getAttribute');
sn(HTMLEl,'HTMLElement');
function HTMLCanvasEl(){}
HTMLCanvasEl.prototype=Object.create(HTMLEl.prototype);HTMLCanvasEl.prototype[ST]='HTMLCanvasElement';
HTMLCanvasEl.prototype.getContext=function(t){
    if(t==='webgl'||t==='experimental-webgl'){var gl={};gl[ST]='WebGLRenderingContext';
        var p={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32};
        gl.getParameter=function(x){return p[x]||0};sn(gl.getParameter,'getParameter');
        gl.getExtension=function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{}};sn(gl.getExtension,'getExtension');
        gl.getSupportedExtensions=function(){return['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth','EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']};sn(gl.getSupportedExtensions,'getSupportedExtensions');
        gl.getShaderPrecisionFormat=function(){return{rangeMin:127,rangeMax:127,precision:23}};sn(gl.getShaderPrecisionFormat,'getShaderPrecisionFormat');
        return gl}
    if(t==='2d'){var c={};c[ST]='CanvasRenderingContext2D';c.measureText=function(t){return{width:t.length*6}};sn(c.measureText,'measureText');c.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4),width:w,height:h}};sn(c.getImageData,'getImageData');['fillText','fillRect'].forEach(function(m){c[m]=mf(m)});c.font='10px sans-serif';return c}
    return null};sn(HTMLCanvasEl.prototype.getContext,'getContext');
HTMLCanvasEl.prototype.width=300;HTMLCanvasEl.prototype.height=150;sn(HTMLCanvasEl,'HTMLCanvasEl');
function HTMLIFrameEl(){}
HTMLIFrameEl.prototype=Object.create(HTMLEl.prototype);HTMLIFrameEl.prototype[ST]='HTMLIFrameElement';sn(HTMLIFrameEl,'HTMLIFrameEl');
function HTMLScriptEl(){}
HTMLScriptEl.prototype=Object.create(HTMLEl.prototype);HTMLScriptEl.prototype[ST]='HTMLScriptElement';sn(HTMLScriptEl,'HTMLScriptEl');
function HTMLBodyEl(){}
HTMLBodyEl.prototype=Object.create(HTMLEl.prototype);HTMLBodyEl.prototype[ST]='HTMLBodyElement';sn(HTMLBodyEl,'HTMLBodyEl');
function HTMLHeadEl(){}
HTMLHeadEl.prototype=Object.create(HTMLEl.prototype);HTMLHeadEl.prototype[ST]='HTMLHeadElement';sn(HTMLHeadEl,'HTMLHeadEl');
function HTMLHtmlEl(){}
HTMLHtmlEl.prototype=Object.create(HTMLEl.prototype);HTMLHtmlEl.prototype[ST]='HTMLHtmlElement';sn(HTMLHtmlEl,'HTMLHtmlElement');
function Loc_(){}
Loc_.prototype[ST]='Location';sn(Loc_,'Location');
function Scr_(){}
Scr_.prototype[ST]='Screen';sn(Scr_,'Screen');
function Hist_(){}
Hist_.prototype[ST]='History';sn(Hist_,'History');
function Stor_(){}
Stor_.prototype[ST]='Storage';sn(Stor_,'Storage');
function Perf_(){}
Perf_.prototype[ST]='Performance';sn(Perf_,'Performance');
function PlArr_(){}
PlArr_.prototype[ST]='PluginArray';PlArr_.prototype.item=mf('item');PlArr_.prototype.namedItem=mf('namedItem');PlArr_.prototype.refresh=mf('refresh');sn(PlArr_,'PluginArray');
function MtArr_(){}
MtArr_.prototype[ST]='MimeTypeArray';MtArr_.prototype.item=mf('item');MtArr_.prototype.namedItem=mf('namedItem');sn(MtArr_,'MimeTypeArray');
function Plg_(){}
Object.defineProperty(Plg_.prototype,'name',{get:function(){return this._name||''},enumerable:true,configurable:true});
Object.defineProperty(Plg_.prototype,'filename',{get:function(){return this._filename||''},enumerable:true,configurable:true});
Object.defineProperty(Plg_.prototype,'description',{get:function(){return this._description||''},enumerable:true,configurable:true});
Object.defineProperty(Plg_.prototype,'length',{get:function(){return this._length||0},enumerable:true,configurable:true});
Plg_.prototype.item=mf('item');Plg_.prototype.namedItem=mf('namedItem');Plg_.prototype[ST]='Plugin';sn(Plg_,'Plugin');
function Mt_(){}
Object.defineProperty(Mt_.prototype,'type',{get:function(){return this._type||''},enumerable:true,configurable:true});
Object.defineProperty(Mt_.prototype,'suffixes',{get:function(){return this._suffixes||''},enumerable:true,configurable:true});
Object.defineProperty(Mt_.prototype,'description',{get:function(){return this._description||''},enumerable:true,configurable:true});
Object.defineProperty(Mt_.prototype,'enabledPlugin',{get:function(){return this._enabledPlugin||null},enumerable:true,configurable:true});
Mt_.prototype[ST]='MimeType';sn(Mt_,'MimeType');
function MemInfo_(){}
MemInfo_.prototype[ST]='MemoryInfo';
Object.defineProperty(MemInfo_.prototype,'jsHeapSizeLimit',{get:function(){return 4294967296},enumerable:true,configurable:true});
Object.defineProperty(MemInfo_.prototype,'totalJSHeapSize',{get:function(){return 41938737},enumerable:true,configurable:true});
Object.defineProperty(MemInfo_.prototype,'usedJSHeapSize',{get:function(){return 34705941},enumerable:true,configurable:true});
sn(MemInfo_,'MemoryInfo');

// Navigator (prototype getters)
var NP=Nav_.prototype;
function def(p,v){Object.defineProperty(NP,p,{get:function(){return v},enumerable:true,configurable:true})}
def('userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
def('appVersion','5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
def('appCodeName','Mozilla');def('appName','Netscape');def('platform','Win32');
def('product','Gecko');def('vendor','Google Inc.');def('vendorSub','');
def('productSub','20030107');def('language','zh-CN');def('languages',['zh-CN','zh']);
def('cookieEnabled',true);def('webdriver',false);def('onLine',true);
def('hardwareConcurrency',32);def('maxTouchPoints',0);def('deviceMemory',32);
def('pdfViewerEnabled',true);def('doNotTrack',null);def('webkitTemporaryStorage',{});

// Plugins
function getPls(){
    var ns=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
    var pa=Object.create(PlArr_.prototype);pa.length=5;
    for(var i=0;i<5;i++){
        var p=Object.create(Plg_.prototype);p._name=ns[i];p._filename='internal-pdf-viewer';p._description='Portable Document Format';p._length=2;
        var m0=Object.create(Mt_.prototype);m0._type='application/pdf';m0._suffixes='pdf';m0._description='Portable Document Format';m0._enabledPlugin=p;
        var m1=Object.create(Mt_.prototype);m1._type='text/pdf';m1._suffixes='pdf';m1._description='Portable Document Format';m1._enabledPlugin=p;
        p[0]=m0;p[1]=m1;Object.defineProperty(p,'application/pdf',{get:function(){return m0},enumerable:false,configurable:true});
        Object.defineProperty(p,'text/pdf',{get:function(){return m1},enumerable:false,configurable:true});
        pa[i]=p;
    }
    return pa;
}
Object.defineProperty(NP,'plugins',{get:getPls,enumerable:true,configurable:true});
Object.defineProperty(NP,'mimeTypes',{get:function(){var p=getPls();var mt=Object.create(MtArr_.prototype);mt.length=2;mt[0]=p[0][0];mt[1]=p[0][1];return mt},enumerable:true,configurable:true});
var nav=new Nav_();

// Document
var doc=new Doc_();
doc.createElement=function(t){if(t==='iframe'){var f=new HTMLIFrameEl();f.contentWindow=win;return f}if(t==='canvas')return new HTMLCanvasEl();if(t==='script')return new HTMLScriptEl();return new HTMLEl()};sn(doc.createElement,'createElement');
doc.body=new HTMLBodyEl();doc.documentElement=new HTMLHtmlEl();doc.head=new HTMLHeadEl();
Object.defineProperty(Doc_.prototype,'cookie',{get:function(){return'__a='+__a+';__c='+__c+';__g=-'},set:function(){},configurable:true,enumerable:true});
doc.all=undefined;doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';

// Screen
var SP=Scr_.prototype;
Object.defineProperty(SP,'width',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'height',{get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP,'availWidth',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'availHeight',{get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP,'colorDepth',{get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP,'pixelDepth',{get:function(){return 32},enumerable:true,configurable:true});
var scr=new Scr_();
var loc=new Loc_();
loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100&query=python';loc.hostname='www.zhipin.com';
var hist=new Hist_();hist.length=1;

// Performance
var mi=new MemInfo_();
var pf=new Perf_();pf.now=function(){return Date.now()};sn(pf.now,'now');pf.memory=mi;
pf.navigation={type:0};pf.timing={navigationStart:Date.now()};

// Storage
function mkLS(){
    var keys=['ka-uid','c5jbelwo','ab_guid','__a','__c','__g','__l','zp_token','last_login','guide_version','refresh_token','welcome_shown'];
    var e={};for(var i=0;i<keys.length;i++)e[keys[i]]='val_'+i;
    var s=Object.create(Stor_.prototype);s.length=12;
    s.getItem=function(k){return e[k]||null};sn(s.getItem,'getItem');
    s.setItem=function(k,v){e[k]=v};sn(s.setItem,'setItem');
    s.key=function(n){return n>=0&&n<keys.length?keys[n]:null};sn(s.key,'key');
    s.removeItem=mf('removeItem');s.clear=mf('clear');return s;
}

// Crypto
var cryptoFn=function(a){var b=crb(a.length);for(var i=0;i<a.length;i++)a[i]=b[i];return a};sn(cryptoFn,'getRandomValues');

// Window object
var win=this;
win.window=win;win.self=win;win.top=win;win.parent=win;win.globalThis=win;
win.navigator=nav;win.document=doc;win.location=loc;win.screen=scr;win.history=hist;
win.localStorage=mkLS();win.sessionStorage=mkLS();win.performance=pf;
win.crypto={getRandomValues:cryptoFn,subtle:{}};
win.btoa=function(s){return btoaFn(s)};sn(win.btoa,'btoa');
win.atob=function(s){return atobFn(s)};sn(win.atob,'atob');
win.innerWidth=2195;win.innerHeight=1100;win.outerWidth=2195;win.outerHeight=1187;
win.devicePixelRatio=1.75;win.screenX=2195;win.screenY=0;
win.CSSRuleList=mc('CSSRuleList');win.XMLHttpRequest=mc('XMLHttpRequest');
win.MutationObserver=mc('MutationObserver');win.Image=mc('Image');win.Event=mc('Event');
win.console={log:function(){},error:function(){},warn:function(){}};
win.fetch=mf('fetch');win.postMessage=mf('postMessage');
win.addEventListener=mf('addEventListener');win.matchMedia=function(){return{matches:false}};
win.getComputedStyle=function(){return{}};sn(win.getComputedStyle,'getComputedStyle');
win.getSelection=function(){return null};
['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'].forEach(function(n){if(typeof win[n]==='undefined')win[n]=mc(n)});

eval(code);
if(typeof ABC==='undefined')throw new Error('ABC not defined');
return new ABC().z(seed, ts);
`);

var result = fn(__a, __c, seed, ts, code,
    function(n) { return Array.from(crypto.randomBytes(n)); },
    function(s) { return Buffer.from(s).toString('base64'); },
    function(s) { return Buffer.from(s, 'base64').toString(); }
);

if (typeof result === 'string') {
    process.stdout.write(result);
} else {
    process.stderr.write('Error: ' + JSON.stringify(result) + '\n');
    process.exit(1);
}
