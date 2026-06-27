
// === Function prototype toString ===
var _mm=new Map;
var _rt=Function.prototype.toString;
Function.prototype.toString=function(){return typeof this==='function' && _mm.get(this) || _rt.call(this);};
function _sn(o,n){_mm.set(o,'function '+n+'() { [native code] }');}
function _mf(n){var f=function(){};_sn(f,n);Object.defineProperty(f,'name',{value:n});return f;}
function _mc(n){var f=function(){};f.prototype={constructor:f};_sn(f,n);Object.defineProperty(f,'name',{value:n});return f;}
var _ST=Symbol.toStringTag;

// === Constructors ===
function EvtTgt(){} _sn(EvtTgt,'EventTarget');
function Navigator(){}
Navigator.prototype=Object.create(EvtTgt.prototype); Navigator.prototype[_ST]='Navigator';
_sn(Navigator,'Navigator');
function HTMLDocument(){}
HTMLDocument.prototype=Object.create(EvtTgt.prototype); HTMLDocument.prototype[_ST]='HTMLDocument';
_sn(HTMLDocument,'HTMLDocument');
function HTMLElement(){}
HTMLElement.prototype=Object.create(EvtTgt.prototype); HTMLElement.prototype[_ST]='HTMLElement';
_sn(HTMLElement,'HTMLElement');
function Performance(){} Performance.prototype[_ST]='Performance'; _sn(Performance,'Performance');
function Screen(){} Screen.prototype[_ST]='Screen'; _sn(Screen,'Screen');
function PluginArray(){}
PluginArray.prototype[_ST]='PluginArray';
PluginArray.prototype.item=_mf('item');
PluginArray.prototype.namedItem=_mf('namedItem');
PluginArray.prototype.refresh=_mf('refresh');
_sn(PluginArray,'PluginArray');
function MimeTypeArray(){}
MimeTypeArray.prototype[_ST]='MimeTypeArray';
MimeTypeArray.prototype.item=_mf('item');
MimeTypeArray.prototype.namedItem=_mf('namedItem');
_sn(MimeTypeArray,'MimeTypeArray');
function Plugin(){}
Plugin.prototype[_ST]='Plugin'; Plugin.prototype.item=_mf('item'); Plugin.prototype.namedItem=_mf('namedItem');
_sn(Plugin,'Plugin');
function MimeType(){}
MimeType.prototype[_ST]='MimeType'; _sn(MimeType,'MimeType');
function Crypto(){}
Crypto.prototype[_ST]='Crypto'; _sn(Crypto,'Crypto');
function SubtleCrypto(){}
SubtleCrypto.prototype[_ST]='SubtleCrypto'; _sn(SubtleCrypto,'SubtleCrypto');
function MemoryInfo(){}
MemoryInfo.prototype[_ST]='MemoryInfo'; _sn(MemoryInfo,'MemoryInfo');
function CSSRuleList(){}
CSSRuleList.prototype[_ST]='CSSRuleList'; _sn(CSSRuleList,'CSSRuleList');

// === Navigator (EXACT Camoufox Firefox values) ===
var NP=Navigator.prototype;
function dp(o,p,f){Object.defineProperty(o,p,{get:f,enumerable:true,configurable:true});}
dp(NP,'userAgent',function(){return'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'});
dp(NP,'appVersion',function(){return'5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'});
dp(NP,'appCodeName',function(){return'Mozilla'});
dp(NP,'appName',function(){return'Netscape'});
dp(NP,'platform',function(){return'Win32'});
dp(NP,'product',function(){return'Gecko'});
dp(NP,'productSub',function(){return'20030107'});
dp(NP,'vendor',function(){return''});
dp(NP,'vendorSub',function(){return''});
dp(NP,'language',function(){return'zh-CN'});
dp(NP,'languages',function(){return['zh-CN','zh']});
dp(NP,'cookieEnabled',function(){return true});
dp(NP,'webdriver',function(){return false});
dp(NP,'onLine',function(){return true});
dp(NP,'doNotTrack',function(){return'1'});
dp(NP,'hardwareConcurrency',function(){return 8});
dp(NP,'maxTouchPoints',function(){return 0});
dp(NP,'pdfViewerEnabled',function(){return true});

// CAMOUFOX: deviceMemory is UNDEFINED (Firefox)
// dp(NP,'deviceMemory',...) NOT set → typeof navigator.deviceMemory === 'undefined'

// Plugins (Firefox: Plugin is iterable, item(4294967296) returns OBJECT)
var _names=['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
var _pls=[];
for(var i=0;i<5;i++) (function(i){
    var p=new Plugin();
    dp(p,'name',function(){return _names[i]});
    dp(p,'filename',function(){return'internal-pdf-viewer'});
    dp(p,'description',function(){return'Portable Document Format'});
    dp(p,'length',function(){return 2});
    var mt=new MimeType();
    dp(mt,'type',function(){return'application/pdf'});
    dp(mt,'suffixes',function(){return'pdf'});
    dp(mt,'description',function(){return'Portable Document Format'});
    dp(mt,'enabledPlugin',function(){return p});
    p[0]=mt; p[1]=mt;
    dp(p,'application/pdf',function(){return mt});
    dp(p,'text/pdf',function(){return mt});
    _pls[i]=p;
})(i);

// PluginArray — Firefox: item(4294967296) returns a Plugin-like object (NOT null!)
var pa=Object.create(PluginArray.prototype);
for(var i=0;i<5;i++) pa[i]=_pls[i];
dp(pa,'length',function(){return 5});
pa.item=function(i){return i>=0&&i<5?_pls[i]:new Plugin();};
pa.namedItem=function(n){return null;};
pa.refresh=function(){};
// Symbol.iterator support (for...of)
pa[Symbol.iterator]=function(){var idx=0,self=this;return{next:function(){return idx<5?{value:self[idx++],done:false}:{done:true}}};};

var mt=Object.create(MimeTypeArray.prototype);
mt[0]=_pls[0][0]; mt[1]=_pls[0][1];
dp(mt,'length',function(){return 2});
mt.item=function(i){return i<2?_pls[0][i]:null;};
mt.namedItem=function(n){return null;};
mt[Symbol.iterator]=function(){var idx=0,self=this;return{next:function(){return idx<2?{value:self[idx++],done:false}:{done:true}}};};

dp(NP,'plugins',function(){return pa});
dp(NP,'mimeTypes',function(){return mt});

// === Screen (Camoufox values) ===
var SP=Screen.prototype;
dp(SP,'width',function(){return 2560});
dp(SP,'height',function(){return 1440});
dp(SP,'availWidth',function(){return 2560});
dp(SP,'availHeight',function(){return 1440});
dp(SP,'colorDepth',function(){return 24});
dp(SP,'pixelDepth',function(){return 24});
dp(SP,'orientation',function(){return{type:'landscape-primary',angle:0}});

// === Document ===
var doc=new HTMLDocument();
doc.createElement=function(tag){
    if(tag==='canvas'){
        return{
            getContext:function(type){
                if(type==='webgl'||type==='experimental-webgl'){
                    return{
                        // Camoufox Intel GPU values
                        getParameter:function(p){var m={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32,37445:'ANGLE (Intel, Intel(R) HD Graphics Direct3D11 vs_5_0 ps_5_0), or similar',37446:'Google Inc. (Intel)'};return m[p]||0;},
                        getExtension:function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{};},
                        getSupportedExtensions:function(){return['ANGLE_instanced_arrays','EXT_blend_minmax','EXT_color_buffer_half_float','EXT_float_blend','EXT_frag_depth','EXT_texture_filter_anisotropic','EXT_sRGB','OES_element_index_uint','OES_fbo_render_mipmap','OES_standard_derivatives','OES_texture_float','OES_texture_float_linear','OES_texture_half_float','OES_texture_half_float_linear','OES_vertex_array_object','WEBGL_color_buffer_float','WEBGL_compressed_texture_s3tc','WEBGL_compressed_texture_s3tc_srgb','WEBGL_debug_renderer_info','WEBGL_debug_shaders','WEBGL_depth_texture','WEBGL_draw_buffers','WEBGL_lose_context','WEBGL_multi_draw'];},
                        getShaderPrecisionFormat:function(){return{rangeMin:127,rangeMax:127,precision:23};}
                    };
                }
                if(type==='2d'){
                    return{
                        fillRect:function(){}, fillText:function(){},
                        measureText:function(t){return{width:23.549999237060547}}, // Camoufox exact value
                        getImageData:function(){return{data:new Uint8ClampedArray(400),width:10,height:10};}
                    };
                }
                return null;
            },
            toDataURL:function(){return'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';},
            width:300,height:150,style:{}
        };
    }
    if(tag==='iframe')return{contentWindow:globalThis};
    return{style:{},appendChild:function(){},setAttribute:function(){},getAttribute:function(){return null}};
};
_sn(doc.createElement,'createElement');
doc.getElementById=function(){return null};
doc.getElementsByTagName=function(){return{length:0,item:function(){return null}}};
doc.getElementsByClassName=function(){return[]};
doc.querySelector=function(){return null};
doc.querySelectorAll=function(){return[]};
doc.addEventListener=_mf('addEventListener');
doc.body=new HTMLElement(); doc.head=new HTMLElement(); doc.documentElement=new HTMLElement();
dp(HTMLDocument.prototype,'cookie',function(){return'__a=0;__c=0;__g=-';});
doc.all=undefined; doc.hidden=false; doc.visibilityState='visible';
doc.readyState='complete'; doc.characterSet='UTF-8'; doc.title='BOSS直聘';

// === localStorage — getItem('c5jbelwo') THROWS (Firefox third-party cookie blocking) ===
var _lsObj={};
var _ls={
    setItem:function(k,v){_lsObj[k]=v;},
    getItem:function(k){
        if(k==='c5jbelwo') throw new DOMException('The operation is insecure.','SecurityError');
        return _lsObj[k]||null;
    },
    removeItem:function(k){delete _lsObj[k];},
    clear:function(){_lsObj={};},
    key:function(n){var ks=Object.keys(_lsObj);return n>=0&&n<ks.length?ks[n]:null;},
    get length(){return Object.keys(_lsObj).length;}
};
var _ss={setItem:function(){},getItem:function(){return null},removeItem:function(){},clear:function(){},key:function(){return null},length:0};

// === Performance ===
var mi=new MemoryInfo();
dp(MemoryInfo.prototype,'jsHeapSizeLimit',function(){return 4294967296});
dp(MemoryInfo.prototype,'totalJSHeapSize',function(){return 41938737});
dp(MemoryInfo.prototype,'usedJSHeapSize',function(){return 34705941});
var perf=new Performance();
perf.now=function(){return Date.now()-__tsBase}; _sn(perf.now,'now');
perf.memory=mi; perf.navigation={type:0,redirectCount:0};
perf.timeOrigin=__tsBase;
perf.getEntriesByType=_mf('getEntriesByType');
perf.timing={navigationStart:__tsBase,fetchStart:__tsBase,domLoading:__tsBase,domComplete:__tsBase};

// === Crypto ===
var _subtle=new SubtleCrypto();
['decrypt','deriveBits','deriveKey','digest','encrypt','exportKey','generateKey','importKey','sign','unwrapKey','verify','wrapKey'].forEach(function(m){_subtle[m]=_mf(m);});
var crypt=new Crypto();
crypt.getRandomValues=function(a){for(var i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);return a;};
_sn(crypt.getRandomValues,'getRandomValues');
dp(Crypto.prototype,'subtle',function(){return _subtle});
crypt.randomUUID=function(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'};
_sn(crypt.randomUUID,'randomUUID');

// === History ===
var _hist={length:1,scrollRestoration:'auto',state:null,
    pushState:_mf('pushState'),replaceState:_mf('replaceState'),
    back:_mf('back'),forward:_mf('forward'),go:_mf('go')};

// === Misc ===
globalThis.DOMException=function(m,n){this.message=m;this.name=n||'Error';};
globalThis.CSSRuleList=_mc('CSSRuleList');
globalThis.MutationObserver=function(){this.observe=function(){}};
globalThis.fetch=_mf('fetch');
globalThis.addEventListener=_mf('addEventListener');
globalThis.removeEventListener=_mf('removeEventListener');
globalThis.dispatchEvent=_mf('dispatchEvent');
globalThis.postMessage=_mf('postMessage');
globalThis.getComputedStyle=function(){return{}};
globalThis.getSelection=function(){return null};
globalThis.matchMedia=function(){return{matches:false,media:''}};
globalThis.XMLHttpRequest=_mc('XMLHttpRequest');
globalThis.Event=_mc('Event'); globalThis.Image=_mc('Image');
globalThis.Intl={};
globalThis.AbortController=_mc('AbortController'); globalThis.AbortSignal=_mc('AbortSignal');

// OfflineAudioContext stub
globalThis.OfflineAudioContext=function(){return{
    createOscillator:function(){return{frequency:{setValueAtTime:function(){}},type:'sine',start:function(){},stop:function(){},connect:function(){}};},
    createDynamicsCompressor:function(){return{connect:function(){}};},
    createGain:function(){return{connect:function(){},gain:{setValueAtTime:function(){},value:0}};},
    destination:{},
    startRendering:function(){return{then:function(f){f('');}};},
    sampleRate:44100
};};

// Extra constructors
['Blob','Comment','CustomEvent','DOMParser','DOMRect','DataTransfer','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLFormElement','HTMLImageElement','HTMLInputElement','HTMLLabelElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTextAreaElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','InputEvent','KeyboardEvent','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PageTransitionEvent','Path2D','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGEllipseElement','SVGElement','SVGFilterElement','SVGGElement','SVGImageElement','SVGLineElement','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRectElement','SVGSVGElement','SVGStopElement','SVGTextElement','SVGUseElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLSerializer','XSLTProcessor'].forEach(function(n){
    if(typeof globalThis[n]==='undefined')globalThis[n]=_mc(n);
});

// === Mount all globals ===
var __tsBase=${ts};
globalThis.window=globalThis; globalThis.self=globalThis;
globalThis.top=globalThis; globalThis.parent=globalThis;
globalThis.navigator=new Navigator();
globalThis.document=doc; globalThis.screen=new Screen();
globalThis.performance=perf; globalThis.crypto=crypt;
globalThis.localStorage=_ls; globalThis.sessionStorage=_ss;
globalThis.history=_hist;
globalThis.location={hostname:'www.zhipin.com',host:'www.zhipin.com',href:'https://www.zhipin.com/web/common/security-check.html?seed=${seed}&ts=${ts}&name=11f5a2fc',protocol:'https:',origin:'https://www.zhipin.com',pathname:'/web/common/security-check.html',search:'?seed=${seed}&ts=${ts}&name=11f5a2fc',port:'',hash:''};
globalThis.innerWidth=1920;globalThis.innerHeight=994;
globalThis.outerWidth=1920;globalThis.outerHeight=1440;
globalThis.devicePixelRatio=1;globalThis.screenX=0;globalThis.screenY=0;
globalThis.name='';globalThis.closed=false;globalThis.length=0;
globalThis.btoa=function(s){return Buffer.from(s,'binary').toString('base64');};
globalThis.atob=function(s){return Buffer.from(s,'base64').toString('binary');};

// === Run security JS ===
var __code=${JSON.stringify(seccode)};
eval(__code);
if(typeof ABC==='undefined')throw new Error('ABC not defined');
var __token=new ABC().z('${seed}',parseInt('${ts}'));
__token;
