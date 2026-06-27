/**
 * Full browser environment matching Camoufox fingerprint
 */
module.exports = function() {
Function.prototype.toString = function(){return""};

// location
global.location = {
    hostname:"www.zhipin.com", host:"www.zhipin.com",
    href:"https://www.zhipin.com/web/common/security-check.html",
    protocol:"https:", origin:"https://www.zhipin.com",
    pathname:"/web/common/security-check.html", search:"", port:"", hash:"",
    ancestorOrigins:{}
};

// document
global.document = {
    location:{}, cookie:"",
    all: undefined, hidden: false, visibilityState: "visible",
    readyState: "complete", characterSet: "UTF-8", title: "",
    domain: "www.zhipin.com", referrer: "",
    createElement: function(tag){
        if(tag==='canvas'){
            return {
                getContext: function(type){
                    if(type==='webgl'||type==='experimental-webgl') return {
                        getParameter: function(p){var v={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32,37445:'ANGLE',37446:'Google Inc.'};return v[p]||0},
                        getExtension: function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{}},
                        getSupportedExtensions: function(){return['ANGLE_instanced_arrays','EXT_blend_minmax','OES_texture_float']},
                        getShaderPrecisionFormat: function(){return{rangeMin:127,rangeMax:127,precision:23}}
                    };
                    if(type==='2d') return {
                        fillRect:function(){}, fillText:function(){},
                        measureText:function(t){return{width:t.length*6}},
                        getImageData:function(){return{data:{},width:10,height:10}}
                    };
                    return null;
                },
                toDataURL: function(){return"data:image/png;base64,"},
                width:300, height:150, style:{}
            };
        }
        if(tag==='iframe') return {contentWindow:global};
        if(tag==='script') return {setAttribute:function(){},getAttribute:function(){return null}};
        return {style:{}, appendChild:function(){}};
    },
    getElementById: function(){return null},
    getElementsByTagName: function(t){return{item:function(){return null},length:0}},
    getElementsByClassName: function(){return[]},
    querySelector: function(){return null},
    querySelectorAll: function(){return[]},
    addEventListener: function(){}, removeEventListener: function(){},
    body:{appendChild:function(){},removeChild:function(){},style:{}},
    head:{appendChild:function(){},getElementsByTagName:function(){return[]}},
    documentElement:{style:{},appendChild:function(){}}
};

// navigator
global.navigator = {
    userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    appVersion:"5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    appCodeName:"Mozilla", appName:"Netscape", platform:"Win32",
    product:"Gecko", productSub:"20030107",
    vendor:"", vendorSub:"",
    language:"zh-CN", languages:["zh-CN","zh"],
    cookieEnabled:true, webdriver:false, doNotTrack:"1", onLine:true,
    hardwareConcurrency:32, maxTouchPoints:0, pdfViewerEnabled:true,
    deviceMemory:undefined,
    plugins:{length:5,item:function(i){return i>=0&&i<5?{name:"PDF Viewer",filename:"internal-pdf-viewer",description:"",length:1,item:function(){return null},namedItem:function(){return null}}:null},namedItem:function(){return null},refresh:function(){}},
    mimeTypes:{length:2,item:function(i){return i>=0&&i<2?{type:"application/pdf",suffixes:"pdf",description:"",enabledPlugin:null}:null},namedItem:function(){return null}},
    javaEnabled:function(){return false},
    taintEnabled:function(){return false}
};

// screen
global.screen = {
    width:1680, height:1050, availWidth:1680, availHeight:1002,
    colorDepth:24, pixelDepth:24,
    orientation:{type:"landscape-primary",angle:0}
};

// window
global.window=global; global.self=global; global.top=global; global.parent=global; global.globalThis=global;
global.innerWidth=1680; global.innerHeight=915; global.outerWidth=1680; global.outerHeight=1050;
global.devicePixelRatio=1; global.screenX=0; global.screenY=0;
global.name=""; global.closed=false; global.length=0; global.opener=null;

// localStorage
var _ls={};
global.localStorage={
    setItem:function(a,b){_ls[a]=b}, getItem:function(a){return _ls[a]||null},
    key:function(n){var k=Object.keys(_ls);return n>=0&&n<k.length?k[n]:null},
    removeItem:function(a){delete _ls[a]}, clear:function(){_ls={}}, length:0
};
global.sessionStorage={
    setItem:function(){}, getItem:function(){return null}, key:function(){return null},
    removeItem:function(){}, clear:function(){}, length:0
};

// history
global.history={length:1,scrollRestoration:"auto",state:null,pushState:function(){},replaceState:function(){},back:function(){},forward:function(){},go:function(){}};

// performance
var _perfNow=Date.now();
global.performance={
    now:function(){return Date.now()-_perfNow},
    memory:{jsHeapSizeLimit:4294967296,totalJSHeapSize:41938737,usedJSHeapSize:34705941},
    navigation:{type:0,redirectCount:0},
    timing:{navigationStart:_perfNow,fetchStart:_perfNow,domainLookupStart:_perfNow,domainLookupEnd:_perfNow,connectStart:_perfNow,connectEnd:_perfNow,requestStart:_perfNow,responseStart:_perfNow,responseEnd:_perfNow,domLoading:_perfNow,domInteractive:_perfNow,domContentLoadedEventStart:_perfNow,domContentLoadedEventEnd:_perfNow,domComplete:_perfNow,loadEventStart:_perfNow,loadEventEnd:_perfNow},
    timeOrigin:_perfNow,
    getEntriesByType:function(){return[]}
};

// crypto
global.crypto={
    getRandomValues:function(a){for(var i=0;i<a.length;i++)a[i]=Math.floor(Math.random()*256);return a},
    subtle:{
        digest:function(){},encrypt:function(){},decrypt:function(){},sign:function(){},
        verify:function(){},generateKey:function(){},importKey:function(){},exportKey:function(){},
        deriveKey:function(){},deriveBits:function(){},unwrapKey:function(){},wrapKey:function(){}
    },
    randomUUID:function(){return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'}
};

// Base64
global.btoa=function(s){return Buffer.from(s,'binary').toString('base64')};
global.atob=function(s){return Buffer.from(s,'base64').toString('binary')};

// Console
global.console={log:function(){},error:function(){},warn:function(){},info:function(){},debug:function(){}};

// Timers
global.setTimeout=setTimeout; global.setInterval=setInterval;
global.clearTimeout=clearTimeout; global.clearInterval=clearInterval;

// Constructors
function _mf(n){var f=function(){};Object.defineProperty(f,'name',{value:n});return f;}
function _mc(n){var f=function(){};f.prototype={constructor:f};return f;}

global.CSSRuleList=_mc('CSSRuleList');
global.MutationObserver=function(){this.observe=function(){};this.disconnect=function(){};};
global.XMLHttpRequest=_mc('XMLHttpRequest');
global.Event=_mc('Event'); global.Image=_mc('Image');
global.matchMedia=function(){return{matches:false,media:''}};
global.fetch=function(){};
global.getComputedStyle=function(){return{}};
global.getSelection=function(){return null};
global.addEventListener=_mf('addEventListener');
global.removeEventListener=_mf('removeEventListener');
global.dispatchEvent=_mf('dispatchEvent');
global.postMessage=_mf('postMessage');
global.requestAnimationFrame=_mf('requestAnimationFrame');

// OfflineAudioContext
global.OfflineAudioContext=function(){
    return {
        createOscillator:function(){return{frequency:{setValueAtTime:function(){}},type:"sine",start:function(){},stop:function(){},connect:function(){}}},
        createDynamicsCompressor:function(){return{connect:function(){}}},
        createGain:function(){return{connect:function(){},gain:{setValueAtTime:function(){},value:0}}},
        destination:{},
        startRendering:function(){return{then:function(f){f("")}}},
        sampleRate:44100
    };
};

// Misc
global.Intl={};
global.AbortController=_mc('AbortController'); global.AbortSignal=_mc('AbortSignal');
global.unescape=decodeURIComponent; global.escape=encodeURIComponent;
global.decodeURIComponent=decodeURIComponent; global.encodeURIComponent=encodeURIComponent;
global.eval=eval;

// Extra constructors that the VMP might check
['Blob','CSSStyleDeclaration','Comment','CustomEvent','DOMException','DOMParser','DOMRect','DataTransfer','DocumentFragment','DragEvent','Element','ErrorEvent','EventSource','File','FileList','FileReader','FocusEvent','FormData','Headers','HTMLCollection','HTMLAnchorElement','HTMLButtonElement','HTMLDivElement','HTMLFormElement','HTMLImageElement','HTMLInputElement','HTMLLabelElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationRecord','NodeList','Notification','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGElement','Selection','ShadowRoot','SharedWorker','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Worker','XMLDocument','XMLHttpRequestEventTarget','XMLSerializer','XSLTProcessor'].forEach(function(n){
    if(typeof global[n]==='undefined') global[n]=_mc(n);
});

// location.search with seed/ts
global.location.search="?seed=testXYZ&ts=1700000000000&name=11f5a2fc";
global.location.href="https://www.zhipin.com/web/common/security-check.html?seed=testXYZ&ts=1700000000000&name=11f5a2fc&callbackUrl=%2Fweb%2Fgeek%2Fjobs&srcReferer=";

require('fs').readFileSync(__dirname+'/security-11f5a2fc.js','utf8');
};
