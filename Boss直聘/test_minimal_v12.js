// Test: minimal env matching exactly what VMP accesses
var vm=require('vm'),fs=require('fs'),_crypto=require('crypto');
var code=fs.readFileSync(__dirname+'/config/security-7c91433f.js','utf8');

function mf(n){var f=function(){};return f}
function mc(n){var f=function(){};f.prototype={constructor:f};return f}
var ST=Symbol.toStringTag;

function Nav_(){}
Nav_.prototype[ST]='Navigator';
var NP=Nav_.prototype;
function df(p,v){Object.defineProperty(NP,p,{get:function(){return v},enumerable:true,configurable:true})}
df('userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
df('platform','Win32');df('language','zh-CN');df('languages',['zh-CN','zh']);
df('cookieEnabled',true);df('webdriver',false);df('hardwareConcurrency',32);
df('onLine',true);df('maxTouchPoints',0);df('deviceMemory',32);
df('vendor','Google Inc.');df('productSub','20030107');df('doNotTrack',null);
df('webkitTemporaryStorage',{});df('appCodeName','Mozilla');df('appName','Netscape');df('product','Gecko');
Object.defineProperty(NP,'plugins',{get:function(){return{length:5}},enumerable:true,configurable:true});
Object.defineProperty(NP,'mimeTypes',{get:function(){return{length:2}},enumerable:true,configurable:true});
var nav=new Nav_();

function Scr_(){}
Scr_.prototype[ST]='Screen';
var SP=Scr_.prototype;
Object.defineProperty(SP,'width',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'height',{get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP,'availWidth',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'availHeight',{get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP,'colorDepth',{get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP,'pixelDepth',{get:function(){return 32},enumerable:true,configurable:true});
var scr=new Scr_();

var doc={createElement:function(tag){
  if(tag==='canvas'){
    var c={};
    c.getContext=function(t){
      if(t==='webgl'){var gl={};gl[ST]='WebGLRenderingContext';gl.getParameter=function(p){var v={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32};return v[p]||0};gl.getExtension=function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{}};gl.getSupportedExtensions=function(){return['ANGLE_instanced_arrays','EXT_blend_minmax']};return gl}
      if(t==='2d')return{font:'10px sans-serif'};
      return null;
    };
    c.width=300;c.height=150;c.style={};
    return c;
  }
  if(tag==='iframe')return{contentWindow:globalThis};
  return{};
}};
doc.body={};doc.cookie='';doc.all=undefined;doc[ST]='HTMLDocument';

var perf={now:function(){return Date.now()},memory:{},navigation:{type:0}};
var ls={getItem:function(){return null},setItem:function(){},key:function(){return null},length:0,[ST]:'Storage'};

var subtle={};['digest','encrypt','decrypt','sign','verify','generateKey'].forEach(function(m){subtle[m]=mf(m)});
var cryptoObj={getRandomValues:function(a){var b=_crypto.randomBytes(a.length);for(var i=0;i<a.length;i++)a[i]=b[i];return a},subtle:subtle};

var sbox={Object,Array,Function,String,Number,Boolean,Date,Math,RegExp,Error,TypeError,SyntaxError,ReferenceError,RangeError,parseInt,parseFloat,isNaN,isFinite,JSON,Promise,Symbol,Map,Set,WeakMap,WeakSet,ArrayBuffer,DataView,Uint8Array,Int32Array,Float64Array,Uint8ClampedArray,BigInt,NaN,Infinity,undefined,Proxy,Reflect,setTimeout,setInterval,clearTimeout,clearInterval,console:{log:function(){},error:function(){},warn:function(){}}};
sbox.window=sbox;sbox.self=sbox;sbox.top=sbox;sbox.globalThis=sbox;
sbox.navigator=nav;sbox.document=doc;sbox.screen=scr;sbox.performance=perf;
sbox.location={hostname:'www.zhipin.com',href:'https://www.zhipin.com/'};
sbox.localStorage=ls;sbox.sessionStorage=ls;
sbox.crypto=cryptoObj;
sbox.btoa=function(s){return Buffer.from(s).toString('base64')};
sbox.atob=function(s){return Buffer.from(s,'base64').toString()};
sbox.innerWidth=2195;sbox.innerHeight=1100;sbox.outerWidth=2195;sbox.outerHeight=1187;
sbox.devicePixelRatio=1.75;sbox.screenX=2195;sbox.screenY=0;
sbox.CSSRuleList=mc('CSSRuleList');
sbox.fetch=mf('fetch');sbox.matchMedia=function(){return{matches:false}};
sbox.getComputedStyle=function(){return{}};
sbox.Intl={};sbox.AbortController=mc('AbortController');

['Navigator','Screen','HTMLElement','Location','History','Storage','Performance','PluginArray','MimeTypeArray','Plugin','MimeType','MemoryInfo','Crypto','SubtleCrypto','Blob','CSSStyleDeclaration','CloseEvent','Comment','CompositionEvent','CustomEvent','DOMException','DOMParser','DOMRect','DataTransfer','DeviceMotionEvent','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLSerializer','XSLTProcessor'].forEach(function(n){if(!(n in sbox))sbox[n]=mc(n)});

var ctx=vm.createContext(sbox);
new vm.Script(code).runInContext(ctx);
var t=new sbox.ABC().z('test',1700000000000);
console.log('MINIMAL: chars='+t.length+' bytes='+Buffer.from(t,'base64').length+' prefix='+t.substring(0,10));

var v12=require('child_process').execSync('node '+__dirname+'/sign_boss_v12.js a a test 1',{encoding:'utf8'}).trim();
console.log('v12: chars='+v12.length+' bytes='+Buffer.from(v12,'base64').length+' prefix='+v12.substring(0,10));
