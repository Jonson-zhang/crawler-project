var vm=require('vm');var fs=require('fs');
var code=fs.readFileSync(__dirname+'/config/security-7c91433f.js','utf8');
var sandbox={Object,Array,Function,String,Number,Boolean,Date,Math,RegExp,Error,TypeError,SyntaxError,ReferenceError,RangeError,parseInt,parseFloat,isNaN,isFinite,encodeURIComponent,decodeURIComponent,JSON,Promise,Symbol,Map,Set,WeakMap,WeakSet,ArrayBuffer,DataView,Uint8Array,Int32Array,Float64Array,Uint8ClampedArray,NaN,Infinity,undefined,Proxy,Reflect,setTimeout,setInterval,clearTimeout,clearInterval};
var mm=new Map();var rt=Function.prototype.toString;
Function.prototype.toString=function(){return typeof this==='function'&&mm.get(this)||rt.call(this)};
function sn(o,n){mm.set(o,'function '+n+'() { [native code] }')}
function mf(n){var f=function(){};sn(f,n);return f}
function mc(n){var f=function(){};sn(f,n);return f}

// Deep trace: capture ALL get/set operations on ALL objects recursively
var trace=[];
function makeTraced(name,obj){
    return new Proxy(obj,{
        get:function(t,p){
            var pn=String(p);
            if(pn!=='constructor'&&pn!=='prototype'&&pn!=='toString'&&pn!=='Symbol(Symbol.toPrimitive)'&&pn!=='Symbol(Symbol.iterator)'){
                trace.push({path:name,branch:pn,type:'get',t:typeof t[pn]});
            }
            var v=t[pn];
            if(v!==null&&(typeof v==='object'||typeof v==='function')&&!pn.startsWith('_')){
                // Recursively trace if not already traced
            }
            return v;
        },
        set:function(t,p,v){trace.push({path:name,branch:String(p),type:'set',vt:typeof v});t[p]=v;return true}
    });
}

sandbox.window=sandbox;sandbox.self=sandbox;sandbox.top=sandbox;sandbox.parent=sandbox;sandbox.globalThis=sandbox;
sandbox.console={log:mf('log'),error:mf('error'),warn:mf('warn')};

// Create navigator with full tracing
sandbox._nav={
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    appVersion:'5.0 (Windows)',platform:'Win32',language:'zh-CN',
    languages:['zh-CN','zh'],cookieEnabled:true,webdriver:false,
    hardwareConcurrency:8,maxTouchPoints:0,vendor:'',vendorSub:'',
    productSub:'20100101',doNotTrack:'1',onLine:true,
    plugins:{length:5},mimeTypes:{length:2}
};
sandbox.navigator=makeTraced('navigator',sandbox._nav);

sandbox._doc={
    cookie:'ab_guid=test;__a=16364972.1782458175..1782458175.2.1.2.2;__c=1782458175;__g=-',
    createElement:function(tag){
        trace.push({path:'document',branch:'createElement('+tag+')',type:'call',t:'call'});
        if(tag==='iframe')return{style:{},contentWindow:sandbox};
        return{style:{}};
    },
    body:{appendChild:mf('appendChild')},
    documentElement:{appendChild:mf('appendChild')},
    getElementsByTagName:function(){return{item:mf('item'),length:0}},
    hidden:false,readyState:'complete'
};
sandbox.document=makeTraced('document',sandbox._doc);

sandbox._loc={href:'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',hostname:'www.zhipin.com',host:'www.zhipin.com',pathname:'/web/geek/jobs',protocol:'https:',origin:'https://www.zhipin.com',port:'',search:'',hash:''};
sandbox.location=makeTraced('location',sandbox._loc);

sandbox._scr={width:1920,height:1080,availWidth:1920,availHeight:1040,colorDepth:24,pixelDepth:24};
sandbox.screen=makeTraced('screen',sandbox._scr);

sandbox.history={length:1};sandbox.localStorage={getItem:mf('getItem'),length:0};sandbox.performance={now:mf('now')};
sandbox.crypto={getRandomValues:mf('getRandomValues')};
sandbox.btoa=function(s){return Buffer.from(s).toString('base64')};sn(sandbox.btoa,'btoa');
sandbox.atob=function(s){return Buffer.from(s,'base64').toString()};sn(sandbox.atob,'atob');

// 150+ classes
['Blob','CDATASection','CSSRule','CSSRuleList','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','Crypto','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DOMTokenList','DataTransfer','DeviceMotionEvent','Document','DocumentFragment','ErrorEvent','Event','EventSource','EventTarget','File','FileList','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','History','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLBodyElement','HTMLButtonElement','HTMLCanvasElement','HTMLCollection','HTMLDListElement','HTMLDataElement','HTMLDetailsElement','HTMLDialogElement','HTMLDivElement','HTMLElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormElement','HTMLFrameElement','HTMLHRElement','HTMLHeadElement','HTMLHeadingElement','HTMLHtmlElement','HTMLIFrameElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptionElement','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPreElement','HTMLProgressElement','HTMLScriptElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTableRowElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','Image','InputEvent','KeyboardEvent','Location','MediaList','MessageChannel','MessageEvent','MouseEvent','MutationObserver','NamedNodeMap','Navigator','Node','NodeFilter','NodeIterator','NodeList','Notification','PageTransitionEvent','Performance','PerformanceEntry','PerformanceObserver','PerformanceTiming','Plugin','PluginArray','PointerEvent','PopStateEvent','ProgressEvent','Range','ReadableStream','Request','Response','SVGAElement','SVGElement','SVGSVGElement','SVGScriptElement','SVGStyleElement','Screen','Selection','ShadowRoot','Storage','StorageEvent','SubmitEvent','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','WebSocket','WheelEvent','Window','Worker','XMLDocument','XMLHttpRequest','XMLSerializer','XSLTProcessor'].forEach(function(n){if(!(n in sandbox))sandbox[n]=mc(n)});

sandbox.innerWidth=1920;sandbox.innerHeight=1080;sandbox.outerWidth=1920;sandbox.outerHeight=1080;sandbox.devicePixelRatio=1;
sandbox.addEventListener=mf('addEventListener');sandbox.origin='https://www.zhipin.com';sandbox.isSecureContext=true;

var ctx=vm.createContext(sandbox);
try{new vm.Script(code).runInContext(ctx);
if(typeof sandbox.ABC!=='undefined'){
var t=new sandbox.ABC().z('test_seed',1782456800000);
console.log('token_len:',t.length);
// Group trace by path
var groups={};
trace.forEach(function(e){
    var key=e.path+'.'+e.branch;
    if(!groups[key])groups[key]={gets:0,sets:0,types:new Set()};
    if(e.type==='get'){groups[key].gets++;groups[key].types.add(e.t)}
    else groups[key].sets++;
});
var sorted=Object.entries(groups).sort(function(a,b){return b[1].gets-b[1].gets});
console.log('\nAccessed (grouped):');
sorted.slice(0,30).forEach(function(e){console.log(e[0].padEnd(45),'gets:'+e[1].gets,'sets:'+e[1].sets,'types:'+JSON.stringify([...e[1].types]))});
}}catch(e){console.log('ERR:',e.message)}
