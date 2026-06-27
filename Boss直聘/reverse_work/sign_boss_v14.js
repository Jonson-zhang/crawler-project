/**
 * v14: v12 FULL env + INTERNAL Function.prototype.toString patch + timing fix
 * Key fix: run the toString patch INSIDE the sandbox via vm.Script
 */
var vm=require('vm'),fs=require('fs'),_crypto=require('crypto');
var securityCode=fs.readFileSync(__dirname+'/config/security-7c91433f.js','utf8');

// Build v12 environment
var mm=new Map,rt=Function.prototype.toString;
Function.prototype.toString=function(){return typeof this==='function'&&mm.get(this)||rt.call(this)};
function sn(o,n){mm.set(o,'function '+n+'() { [native code] }')}
function mf(n){var f=function(){};sn(f,n);return f}
function mc(n){var f=function(){};f.prototype={constructor:f};sn(f,n);return f}
var ST=Symbol.toStringTag;

// ===== CRITICAL FIX: toString patch code to run INSIDE sandbox =====
// This creates the _mm and sn() inside the sandbox context,
// where the sandbox's own Function.prototype is properly patched
var internalPatch =
  'var _sm=new Map();' +
  'var _srt=Function.prototype.toString;' +
  'Function.prototype.toString=function(){return typeof this===\"function\"&&_sm.get(this)||_srt.call(this)};' +
  'function _sn(o,n){_sm.set(o,\"function \"+n+\"() { [native code] }\")};' +
  'function _mf(n){var f=function(){};_sn(f,n);return f};' +
  'function _mc(n){var f=function(){};f.prototype={constructor:f};_sn(f,n);return f};';

// Override v12 constructors to use _sn/_mf/_mc inside sandbox
// But easier: just rename our host-level helpers so they don't conflict
var code = internalPatch + securityCode;

function EvtTgt(){}sn(EvtTgt,'EventTarget');
function Navigator_(){}
Navigator_.prototype=Object.create(EvtTgt.prototype);Navigator_.prototype[ST]='Navigator';sn(Navigator_,'Navigator');
function Document_(){}
Document_.prototype=Object.create(EvtTgt.prototype);Document_.prototype[ST]='HTMLDocument';sn(Document_,'Document');
function HTMLEl(){}
HTMLEl.prototype=Object.create(EvtTgt.prototype);HTMLEl.prototype[ST]='HTMLElement';
HTMLEl.prototype.offsetWidth=1920;HTMLEl.prototype.offsetHeight=1080;
HTMLEl.prototype.appendChild=mf('appendChild');HTMLEl.prototype.setAttribute=mf('setAttribute');
HTMLEl.prototype.getAttribute=function(){return null};sn(HTMLEl.prototype.getAttribute,'getAttribute');
sn(HTMLEl,'HTMLElement');
function HTMLCanvasEl(){}
HTMLCanvasEl.prototype=Object.create(HTMLEl.prototype);HTMLCanvasEl.prototype[ST]='HTMLCanvasElement';sn(HTMLCanvasEl,'HTMLCanvasEl');
HTMLCanvasEl.prototype.getContext=function(t){
    if(t==='webgl'||t==='experimental-webgl'){
        var gl={};gl[ST]='WebGLRenderingContext';
        var pp={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32,37445:'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)',37446:'Google Inc. (NVIDIA)'};
        gl.getParameter=function(p){return pp[p]||0};sn(gl.getParameter,'getParameter');
        gl.getExtension=function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{}};sn(gl.getExtension,'getExtension');
        gl.getSupportedExtensions=function(){return['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth','EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']};sn(gl.getSupportedExtensions,'getSupportedExtensions');
        gl.getShaderPrecisionFormat=function(){return{rangeMin:127,rangeMax:127,precision:23}};sn(gl.getShaderPrecisionFormat,'getShaderPrecisionFormat');
        return gl;
    }
    if(t==='2d'){var c2={};c2[ST]='CanvasRenderingContext2D';c2.measureText=function(t){return{width:t.length*6}};sn(c2.measureText,'measureText');c2.getImageData=function(){return{data:new Uint8ClampedArray(400)}};sn(c2.getImageData,'getImageData');['fillText','fillRect','clearRect','save','restore'].forEach(function(m){c2[m]=mf(m)});c2.font='10px sans-serif';return c2;}
    return null;
};sn(HTMLCanvasEl.prototype.getContext,'getContext');
HTMLCanvasEl.prototype.width=300;HTMLCanvasEl.prototype.height=150;
function HTMLIFrameEl(){}
HTMLIFrameEl.prototype=Object.create(HTMLEl.prototype);HTMLIFrameEl.prototype[ST]='HTMLIFrameElement';sn(HTMLIFrameEl,'HTMLIFrameEl');
function HTMLScriptEl(){}
HTMLScriptEl.prototype=Object.create(HTMLEl.prototype);HTMLScriptEl.prototype[ST]='HTMLScriptElement';sn(HTMLScriptEl,'HTMLScriptEl');
function Location_(){}
Location_.prototype[ST]='Location';sn(Location_,'Location');
function Screen_(){}
Screen_.prototype[ST]='Screen';sn(Screen_,'Screen');
function History_(){}
History_.prototype[ST]='History';sn(History_,'History');
function Storage_(){}
Storage_.prototype[ST]='Storage';sn(Storage_,'Storage');
function Performance_(){}
Performance_.prototype[ST]='Performance';sn(Performance_,'Performance');
function MemoryInfo_(){}
MemoryInfo_.prototype[ST]='MemoryInfo';sn(MemoryInfo_,'MemoryInfo');
function SubtleCrypto_(){}
SubtleCrypto_.prototype[ST]='SubtleCrypto';
['decrypt','deriveBits','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey'].forEach(function(m){SubtleCrypto_.prototype[m]=mf(m)});
sn(SubtleCrypto_,'SubtleCrypto');
function Crypto_(){}
Crypto_.prototype[ST]='Crypto';
Crypto_.prototype.getRandomValues=function(a){var b=_crypto.randomBytes(a.length);for(var i=0;i<a.length;i++)a[i]=b[i];return a};
sn(Crypto_.prototype.getRandomValues,'getRandomValues');
Object.defineProperty(Crypto_.prototype,'subtle',{get:function(){return new SubtleCrypto_()},enumerable:true,configurable:true});
Crypto_.prototype.randomUUID=function(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'};
sn(Crypto_.prototype.randomUUID,'randomUUID');
sn(Crypto_,'Crypto');
function PluginArray_(){}
PluginArray_.prototype[ST]='PluginArray';PluginArray_.prototype.item=mf('item');PluginArray_.prototype.namedItem=mf('namedItem');PluginArray_.prototype.refresh=mf('refresh');sn(PluginArray_,'PluginArray');
function MimeTypeArray_(){}
MimeTypeArray_.prototype[ST]='MimeTypeArray';MimeTypeArray_.prototype.item=mf('item');MimeTypeArray_.prototype.namedItem=mf('namedItem');sn(MimeTypeArray_,'MimeTypeArray');
function Plugin_(){}
Object.defineProperty(Plugin_.prototype,'name',{get:function(){return this._name||''},enumerable:true,configurable:true});
Object.defineProperty(Plugin_.prototype,'filename',{get:function(){return this._filename||''},enumerable:true,configurable:true});
Object.defineProperty(Plugin_.prototype,'description',{get:function(){return this._description||''},enumerable:true,configurable:true});
Object.defineProperty(Plugin_.prototype,'length',{get:function(){return this._length||0},enumerable:true,configurable:true});
Plugin_.prototype.item=mf('item');Plugin_.prototype.namedItem=mf('namedItem');Plugin_.prototype[ST]='Plugin';sn(Plugin_,'Plugin');
function MimeType_(){}
Object.defineProperty(MimeType_.prototype,'type',{get:function(){return this._type||''},enumerable:true,configurable:true});
Object.defineProperty(MimeType_.prototype,'suffixes',{get:function(){return this._suffixes||''},enumerable:true,configurable:true});
Object.defineProperty(MimeType_.prototype,'description',{get:function(){return this._description||''},enumerable:true,configurable:true});
Object.defineProperty(MimeType_.prototype,'enabledPlugin',{get:function(){return this._enabledPlugin||null},enumerable:true,configurable:true});
MimeType_.prototype[ST]='MimeType';sn(MimeType_,'MimeType');

// Navigator (prototype getters)
var NP=Navigator_.prototype;
function def(p,v){Object.defineProperty(NP,p,{get:function(){return v},enumerable:true,configurable:true})}
def('userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
def('appVersion','5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
def('appCodeName','Mozilla');def('appName','Netscape');def('platform','Win32');
def('product','Gecko');def('vendor','Google Inc.');def('vendorSub','');
def('productSub','20030107');def('language','zh-CN');def('languages',['zh-CN','zh']);
def('cookieEnabled',true);def('webdriver',false);def('onLine',true);
def('hardwareConcurrency',32);def('maxTouchPoints',0);def('deviceMemory',32);
def('pdfViewerEnabled',true);def('doNotTrack',null);def('webkitTemporaryStorage',{});
function getPls(){
    var ns=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
    var pa=Object.create(PluginArray_.prototype);pa.length=5;
    for(var i=0;i<5;i++){
        var p=Object.create(Plugin_.prototype);p._name=ns[i];p._filename='internal-pdf-viewer';p._description='Portable Document Format';p._length=2;
        var m0=Object.create(MimeType_.prototype);m0._type='application/pdf';m0._suffixes='pdf';m0._description='Portable Document Format';m0._enabledPlugin=p;
        var m1=Object.create(MimeType_.prototype);m1._type='text/pdf';m1._suffixes='pdf';m1._description='Portable Document Format';m1._enabledPlugin=p;
        p[0]=m0;p[1]=m1;pa[i]=p;
    }
    return pa;
}
Object.defineProperty(NP,'plugins',{get:getPls,enumerable:true,configurable:true});
Object.defineProperty(NP,'mimeTypes',{get:function(){var p=getPls();var mt=Object.create(MimeTypeArray_.prototype);mt.length=2;mt.item=mf('item');mt.namedItem=mf('namedItem');mt[0]=p[0][0];mt[1]=p[0][1];return mt},enumerable:true,configurable:true});
var nav=new Navigator_();

// Document
var doc=new Document_();
doc.createElement=function(t){
    if(t==='iframe'){var f=new HTMLIFrameEl();f.contentWindow=sandbox;return f}
    if(t==='canvas')return new HTMLCanvasEl();
    if(t==='script')return new HTMLScriptEl();
    return new HTMLEl();
};sn(doc.createElement,'createElement');
doc.body=new HTMLEl();doc.head=new HTMLEl();doc.documentElement=new HTMLEl();
Object.defineProperty(Document_.prototype,'cookie',{get:function(){return'__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-'},set:function(){},configurable:true,enumerable:true});
doc.all=undefined;doc.hidden=false;doc.readyState='complete';doc.characterSet='UTF-8';

// Screen
var SP=Screen_.prototype;
Object.defineProperty(SP,'width',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'height',{get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP,'availWidth',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'availHeight',{get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP,'colorDepth',{get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP,'pixelDepth',{get:function(){return 32},enumerable:true,configurable:true});
var scr=new Screen_();
var loc=new Location_();loc.hostname='www.zhipin.com';loc.host='www.zhipin.com';loc.href='https://www.zhipin.com/web/geek/jobs?city=101010100';

// Performance
var mi=new MemoryInfo_();
Object.defineProperty(MemoryInfo_.prototype,'jsHeapSizeLimit',{get:function(){return 4294967296},enumerable:true,configurable:true});
Object.defineProperty(MemoryInfo_.prototype,'totalJSHeapSize',{get:function(){return 41938737},enumerable:true,configurable:true});
Object.defineProperty(MemoryInfo_.prototype,'usedJSHeapSize',{get:function(){return 34705941},enumerable:true,configurable:true});
var perf=new Performance_();
perf.now=function(){return Date.now()};sn(perf.now,'now');perf.memory=mi;perf.navigation={type:0};
var cryptoObj=new Crypto_();
function mkLS(){return{getItem:function(){return null},setItem:function(){},key:function(){return null},length:0,[ST]:'Storage'};}

// Sandbox
var sandbox={Object,Array,Function,String,Number,Boolean,Date,Math,RegExp,Error,TypeError,SyntaxError,ReferenceError,RangeError,parseInt,parseFloat,isNaN,isFinite,JSON,Promise,Symbol,Map,Set,WeakMap,WeakSet,ArrayBuffer,DataView,Uint8Array,Int32Array,Float64Array,Uint8ClampedArray,BigInt,NaN,Infinity,undefined,Proxy,Reflect,setTimeout,setInterval,clearTimeout,clearInterval,console:{log:function(){},error:function(){},warn:function(){}}};
sandbox.window=sandbox;sandbox.self=sandbox;sandbox.top=sandbox;sandbox.parent=sandbox;sandbox.globalThis=sandbox;
sandbox.navigator=nav;sandbox.document=doc;sandbox.location=loc;sandbox.screen=scr;
sandbox.history={length:1};sandbox.localStorage=mkLS();sandbox.sessionStorage=mkLS();
sandbox.performance=perf;sandbox.crypto=cryptoObj;
sandbox.btoa=function(s){return Buffer.from(s).toString('base64')};
sandbox.atob=function(s){return Buffer.from(s,'base64').toString()};
sandbox.innerWidth=2195;sandbox.innerHeight=1100;sandbox.outerWidth=2195;sandbox.outerHeight=1187;
sandbox.devicePixelRatio=1.75;sandbox.screenX=2195;sandbox.screenY=0;
sandbox.CSSRuleList=mc('CSSRuleList');sandbox.fetch=mf('fetch');sandbox.matchMedia=function(){return{matches:false}};
sandbox.getComputedStyle=function(){return{}};sandbox.Intl={};
sandbox.AbortController=mc('AbortController');sandbox.AbortSignal=mc('AbortSignal');
['Blob','CSSRule','CSSStyleDeclaration','CSSStyleSheet','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XSLTProcessor'].forEach(function(n){if(!(n in sandbox))sandbox[n]=mc(n)});

// Override sandbox constructors
sandbox.Navigator=Navigator_;sandbox.Document=Document_;sandbox.HTMLElement=HTMLEl;
sandbox.HTMLCanvasElement=HTMLCanvasEl;sandbox.HTMLIFrameElement=HTMLIFrameEl;sandbox.HTMLScriptElement=HTMLScriptEl;
sandbox.Location=Location_;sandbox.Screen=Screen_;sandbox.History=History_;sandbox.Storage=Storage_;
sandbox.Performance=Performance_;sandbox.MemoryInfo=MemoryInfo_;sandbox.PluginArray=PluginArray_;
sandbox.MimeTypeArray=MimeTypeArray_;sandbox.Plugin=Plugin_;sandbox.MimeType=MimeType_;
sandbox.Crypto=Crypto_;sandbox.SubtleCrypto=SubtleCrypto_;sandbox.EventTarget=EvtTgt;

// Execute with internal patch
var ctx=vm.createContext(sandbox);
try{
    new vm.Script(code).runInContext(ctx);
    var seed=process.argv[4]||'test',ts=parseInt(process.argv[5]||'1700000000000');
    var t=new sandbox.ABC().z(seed,ts);
    process.stdout.write(t);
}catch(e){process.stderr.write('Error: '+e.message+'\\n');process.exit(1)}
