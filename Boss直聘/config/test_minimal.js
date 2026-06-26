// Test minimal VMP env - check token length baseline
var vm=require('vm'), fs=require('fs'), _crypto=require('crypto');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js','utf8');

var mm=new Map,rt=Function.prototype.toString;
Function.prototype.toString=function(){return typeof this==='function'&&mm.get(this)||rt.call(this)};
function sn(o,n){mm.set(o,'function '+n+'() { [native code] }')}
function mf(n){var f=function(){};sn(f,n);return f}
function mc(n){var f=function(){};f.prototype={constructor:f};sn(f,n);return f}
var ST=Symbol.toStringTag;

function Nav_(){}
Nav_.prototype[ST]='Navigator';sn(Nav_,'Navigator');
var NP=Nav_.prototype;
function dNav(p,v){Object.defineProperty(NP,p,{get:function(){return v},enumerable:true,configurable:true})}
dNav('userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
dNav('platform','Win32');dNav('language','zh-CN');dNav('languages',['zh-CN','zh']);
dNav('cookieEnabled',true);dNav('webdriver',false);dNav('onLine',true);
dNav('hardwareConcurrency',32);dNav('maxTouchPoints',0);
dNav('vendor','Google Inc.');dNav('vendorSub','');dNav('productSub','20030107');
dNav('doNotTrack',null);dNav('deviceMemory',32);dNav('pdfViewerEnabled',true);
dNav('webkitTemporaryStorage',{});dNav('appCodeName','Mozilla');dNav('appName','Netscape');dNav('product','Gecko');

// plugins
function getPls(){
    function PlArr(){this.length=5}PlArr.prototype[ST]='PluginArray';
    PlArr.prototype.item=mf('item');PlArr.prototype.namedItem=mf('namedItem');PlArr.prototype.refresh=mf('refresh');
    function Plg(){this._name='PDF Viewer';this._filename='internal-pdf-viewer';this._description='Portable Document Format';this._length=2}
    Plg.prototype[ST]='Plugin';
    Object.defineProperty(Plg.prototype,'name',{get:function(){return this._name},enumerable:true,configurable:true});
    Object.defineProperty(Plg.prototype,'filename',{get:function(){return this._filename},enumerable:true,configurable:true});
    Object.defineProperty(Plg.prototype,'description',{get:function(){return this._description},enumerable:true,configurable:true});
    Object.defineProperty(Plg.prototype,'length',{get:function(){return this._length},enumerable:true,configurable:true});
    function Mt(){this._type='application/pdf';this._suffixes='pdf'}
    Mt.prototype[ST]='MimeType';
    Object.defineProperty(Mt.prototype,'type',{get:function(){return this._type},enumerable:true,configurable:true});
    Object.defineProperty(Mt.prototype,'suffixes',{get:function(){return this._suffixes},enumerable:true,configurable:true});
    var ns=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
    var pa=new PlArr();
    for(var i=0;i<5;i++){var p=new Plg();p._name=ns[i];var m0=new Mt();var m1=new Mt();m1._type='text/pdf';m0._enabledPlugin=p;m1._enabledPlugin=p;p[0]=m0;p[1]=m1;pa[i]=p}
    return pa;
}
Object.defineProperty(NP,'plugins',{get:getPls,enumerable:true,configurable:true});
Object.defineProperty(NP,'mimeTypes',{get:function(){var p=getPls();var m={length:2};m[ST]='MimeTypeArray';m.item=mf('item');m.namedItem=mf('namedItem');m[0]=p[0][0];m[1]=p[0][1];return m},enumerable:true,configurable:true});
var nav=new Nav_();

// Screen
function Scr_(){}Scr_.prototype[ST]='Screen';
var SP=Scr_.prototype;
Object.defineProperty(SP,'width',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'height',{get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP,'availWidth',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'availHeight',{get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP,'colorDepth',{get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP,'pixelDepth',{get:function(){return 32},enumerable:true,configurable:true});
var scr=new Scr_();

// doc
var doc={createElement:function(tag){if(tag==='canvas'){var c={getContext:function(t){if(t==='webgl'){var gl={};gl[ST]='WebGLRenderingContext';gl.getParameter=function(p){var pp={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32};return pp[p]||0};sn(gl.getParameter,'getParameter');gl.getExtension=function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{}};gl.getSupportedExtensions=function(){return['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_float_blend','EXT_frag_depth','EXT_texture_compression_rgtc','EXT_texture_filter_anisotropic','EXT_sRGB','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw']};return gl}if(t==='2d'){var c2d={};c2d[ST]='CanvasRenderingContext2D';return c2d}return null};sn(c.getContext,'getContext');c[ST]='HTMLCanvasElement';return c}if(tag==='iframe'){return{contentWindow:null}}return{}};sn(doc.createElement,'createElement');doc.body={};doc.cookie='__a=0;__c=0;__g=-';doc.all=undefined;doc[ST]='HTMLDocument'};

// perf
function MemInfo_(){}
MemInfo_.prototype[ST]='MemoryInfo';
Object.defineProperty(MemInfo_.prototype,'jsHeapSizeLimit',{get:function(){return 4294967296},enumerable:true,configurable:true});
Object.defineProperty(MemInfo_.prototype,'totalJSHeapSize',{get:function(){return 41938737},enumerable:true,configurable:true});
Object.defineProperty(MemInfo_.prototype,'usedJSHeapSize',{get:function(){return 34705941},enumerable:true,configurable:true});
var mi=new MemInfo_();
var perf={now:function(){return Date.now()},memory:mi};sn(perf.now,'now');perf[ST]='Performance';

// crypto
function SubtleCrypto_(){}
SubtleCrypto_.prototype[ST]='SubtleCrypto';
['decrypt','deriveBits','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey'].forEach(function(m){SubtleCrypto_.prototype[m]=mf(m)});
var subtle=new SubtleCrypto_();
function Crypto_(){}
Crypto_.prototype[ST]='Crypto';
Object.defineProperty(Crypto_.prototype,'subtle',{get:function(){return subtle},enumerable:true,configurable:true});
Crypto_.prototype.getRandomValues=function(a){var b=_crypto.randomBytes(a.length);for(var i=0;i<a.length;i++)a[i]=b[i];return a};sn(Crypto_.prototype.getRandomValues,'getRandomValues');
Crypto_.prototype.randomUUID=function(){return 'xxx-xxx'};sn(Crypto_.prototype.randomUUID,'randomUUID');
var cryptoObj=new Crypto_();

var btoaFn=function(s){return Buffer.from(s).toString('base64')};sn(btoaFn,'btoa');
var atobFn=function(s){return Buffer.from(s,'base64').toString()};sn(atobFn,'atob');

function mkLS(){
    var keys=['ka-uid','c5jbelwo','ab_guid','__a','__c','__g','__l','zp_token','last_login','guide_version','refresh_token','welcome_shown'];
    var e={};for(var i=0;i<keys.length;i++)e[keys[i]]='val_'+i;
    var s={};s[ST]='Storage';s.length=12;
    s.getItem=function(k){return e[k]||null};sn(s.getItem,'getItem');
    s.setItem=mf('setItem');s.key=function(n){return n>=0&&n<keys.length?keys[n]:null};sn(s.key,'key');
    return s;
}

var sbox={Object,Array,Function,String,Number,Boolean,Date,Math,RegExp,Error,TypeError,SyntaxError,ReferenceError,RangeError,parseInt,parseFloat,isNaN,isFinite,JSON,Promise,Symbol,Map,Set,WeakMap,WeakSet,ArrayBuffer,DataView,Uint8Array,Int32Array,Float64Array,Uint8ClampedArray,BigInt,NaN,Infinity,undefined,Proxy,Reflect,console:{log:function(){},error:function(){},warn:function(){}}};
sbox.window=sbox;sbox.self=sbox;sbox.navigator=nav;sbox.document=doc;
sbox.location={hostname:'www.zhipin.com',href:'https://www.zhipin.com/web/geek/jobs'};
sbox.screen=scr;sbox.history={length:1};
sbox.localStorage=mkLS();sbox.sessionStorage=mkLS();sbox.performance=perf;
sbox.crypto=cryptoObj;sbox.btoa=btoaFn;sbox.atob=atobFn;
sbox.innerWidth=2195;sbox.innerHeight=1100;sbox.outerWidth=2195;sbox.outerHeight=1187;
sbox.devicePixelRatio=1.75;sbox.screenX=2195;sbox.screenY=0;
sbox.CSSRuleList=mc('CSSRuleList');sbox.fetch=mf('fetch');sbox.matchMedia=function(){return{matches:false}};
sbox.Intl={};
['Navigator','Document','HTMLElement','Location','Screen','History','Storage','Performance','PluginArray','MimeTypeArray','Plugin','MimeType','MemoryInfo','Crypto','SubtleCrypto','Intl','AbortController','AbortSignal'].forEach(function(n){if(!(n in sbox))sbox[n]=mc(n)});

var ctx=vm.createContext(sbox);
new vm.Script(code).runInContext(ctx);
var t=new sbox.ABC().z('test',1700000000000);
console.log('Minimal: chars='+t.length+' bytes='+Buffer.from(t,'base64').length+' prefix='+t.substring(0,10));

// Now compare with full v10
var v10T=require('child_process').execSync('node '+__dirname+'/../sign_boss_v10.js a a test 1',{encoding:'utf8'}).trim();
console.log('v10: chars='+v10T.length+' bytes='+Buffer.from(v10T,'base64').length+' prefix='+v10T.substring(0,10));
