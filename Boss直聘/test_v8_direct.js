// test_v8_direct.js - Execute security JS directly in V8 (not vm sandbox)
// Run as: node test_v8_direct.js
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// The approach: wrap all code in a function where Node.js globals aren't visible
// DO NOT use vm - run in real V8 like browser does
(function() {
    var mm = new Map();
    var rt = Function.prototype.toString;
    Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
    function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
    function mf(n) { var f = function() {}; sn(f, n); return f; }
    function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }

    // Classes with prototype chain
    function EventTarget(){} sn(EventTarget,'EventTarget');
    function Nav(){} Nav.prototype = new EventTarget(); sn(Nav,'Navigator');
    function Doc(){} Doc.prototype = new EventTarget(); sn(Doc,'Document');
    function HTMLEl(){} HTMLEl.prototype = new EventTarget();
    HTMLEl.prototype.offsetWidth=1920;HTMLEl.prototype.offsetHeight=1080;
    HTMLEl.prototype.style={};HTMLEl.prototype.appendChild=mf('appendChild');
    HTMLEl.prototype.getAttribute=function(){return null};sn(HTMLEl.prototype.getAttribute,'getAttribute');
    HTMLEl.prototype.setAttribute=mf('setAttribute');
    sn(HTMLEl,'HTMLElement');

    function HTMLHtmlEl(){} HTMLHtmlEl.prototype = new HTMLEl(); sn(HTMLHtmlEl,'HTMLHtmlElement');
    function HTMLHeadEl(){} HTMLHeadEl.prototype = new HTMLEl(); sn(HTMLHeadEl,'HTMLHeadElement');
    function HTMLBodyEl(){} HTMLBodyEl.prototype = new HTMLEl(); sn(HTMLBodyEl,'HTMLBodyElement');

    function HTMLCanvasEl(){}
    HTMLCanvasEl.prototype = new HTMLEl();
    HTMLCanvasEl.prototype.width=300; HTMLCanvasEl.prototype.height=150;
    HTMLCanvasEl.prototype.getContext=function(t){
        if(t==='2d'){
            var ctx={};
            ['fillText','fillRect','clearRect','save','restore','scale','rotate','translate','transform'].forEach(function(m){ctx[m]=mf(m)});
            ctx.measureText=function(t){return{width:t.length*10}};
            ctx.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};
            ctx.toDataURL=function(){return'data:image/png;base64,test'};
            return ctx;
        }
        return null;
    };
    sn(HTMLCanvasEl.prototype.getContext,'getContext');
    sn(HTMLCanvasEl,'HTMLCanvasElement');

    function HTMLIFrameEl(){} HTMLIFrameEl.prototype = new HTMLEl(); sn(HTMLIFrameEl,'HTMLIFrameElement');
    function HTMLScriptEl(){} HTMLScriptEl.prototype = new HTMLEl(); sn(HTMLScriptEl,'HTMLScriptElement');
    function Loc(){} sn(Loc,'Location');
    function Scr(){} sn(Scr,'Screen');
    function Hist(){} sn(Hist,'History');
    function Stor(){} sn(Stor,'Storage');
    function Perf(){} sn(Perf,'Performance');

    // Navigator
    var nav = new Nav();
    nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
    nav.appVersion='5.0 (Windows)'; nav.platform='Win32'; nav.language='zh-CN';
    nav.languages=['zh-CN','zh']; nav.cookieEnabled=true; nav.webdriver=false;
    nav.hardwareConcurrency=8; nav.maxTouchPoints=0; nav.vendor='';
    nav.productSub='20100101'; nav.doNotTrack='1'; nav.onLine=true;
    var pls={length:3};pls.refresh=mf('refresh');pls.item=mf('item');pls.namedItem=mf('namedItem');
    for(var i=0;i<3;i++){pls[i]={name:'Plugin'+i,filename:'plugin'+i+'.dll',description:'',length:1};pls[i][0]={type:'application/pdf',suffixes:'pdf',description:''}}
    nav.plugins=pls;
    var mts={length:2};mts.item=mf('item');mts.namedItem=mf('namedItem');
    mts[0]={type:'application/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]};
    mts[1]={type:'text/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]};
    nav.mimeTypes=mts;

    // Document
    var doc = new Doc();
    doc.createElement=function(tag){
        if(tag==='iframe'){var f=new HTMLIFrameEl();f.style={};f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};return f}
        if(tag==='canvas')return new HTMLCanvasEl();
        if(tag==='script'){var s=new HTMLScriptEl();s.src='';s.setAttribute=mf('setAttribute');return s}
        return new HTMLEl();
    };sn(doc.createElement,'createElement');
    doc.createElementNS=function(ns,tag){return doc.createElement(tag)};sn(doc.createElementNS,'createElementNS');
    doc.body=new HTMLBodyEl();doc.documentElement=new HTMLHtmlEl();doc.head=new HTMLHeadEl();
    doc.getElementsByTagName=function(t){if(t==='head')return{item:function(i){return doc.head},length:1};return{item:function(){return null},length:0}};
    sn(doc.getElementsByTagName,'getElementsByTagName');
    doc.hidden=false;doc.readyState='complete';doc.title='BOSS直聘';doc.characterSet='UTF-8';
    Object.defineProperty(doc,'cookie',{get:function(){return'__a=test;__c=123;__g=-'},set:function(v){},configurable:true,enumerable:true});

    // Other env objects
    var loc = new Loc(); loc.href='https://www.zhipin.com/web/geek/jobs'; loc.hostname='www.zhipin.com'; loc.host='www.zhipin.com'; loc.pathname='/web/geek/jobs'; loc.protocol='https:'; loc.origin='https://www.zhipin.com';
    var scr = new Scr(); scr.width=1920; scr.height=1080; scr.availWidth=1920; scr.availHeight=1040; scr.colorDepth=24; scr.pixelDepth=24;
    var hist = new Hist(); hist.length=1; hist.pushState=mf('pushState'); hist.replaceState=mf('replaceState');
    var ls = new Stor(); ls.getItem=mf('getItem'); ls.setItem=mf('setItem'); ls.length=0;
    var perf = new Perf(); perf.now=function(){return Date.now()}; sn(perf.now,'now');
    var cryptoObj = {getRandomValues:function(arr){var b=require('crypto').randomBytes(arr.length);for(var i=0;i<arr.length;i++)arr[i]=b[i];return arr},subtle:null};
    sn(cryptoObj.getRandomValues,'getRandomValues');
    var btoaFn = function(s){return Buffer.from(s).toString('base64')}; sn(btoaFn,'btoa');
    var atobFn = function(s){return Buffer.from(s,'base64').toString()}; sn(atobFn,'atob');

    // Browser-specific classes (abbreviated for brevity)
    var brCls = ['Audio','Blob','CSSRuleList','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','Crypto','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DataTransfer','DocumentFragment','ErrorEvent','Event','EventSource','EventTarget','File','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAreaElement','HTMLAudioElement','HTMLBRElement','HTMLBaseElement','HTMLButtonElement','HTMLDListElement','HTMLDataElement','HTMLDataListElement','HTMLDetailsElement','HTMLDialogElement','HTMLDirectoryElement','HTMLDivElement','HTMLEmbedElement','HTMLFieldSetElement','HTMLFontElement','HTMLFormControlsCollection','HTMLFormElement','HTMLFrameElement','HTMLFrameSetElement','HTMLHRElement','HTMLHeadingElement','HTMLImageElement','HTMLInputElement','HTMLLIElement','HTMLLabelElement','HTMLLegendElement','HTMLLinkElement','HTMLMapElement','HTMLMarqueeElement','HTMLMediaElement','HTMLMenuElement','HTMLMetaElement','HTMLMeterElement','HTMLModElement','HTMLOListElement','HTMLObjectElement','HTMLOptGroupElement','HTMLOptionElement','HTMLOptionsCollection','HTMLOutputElement','HTMLParagraphElement','HTMLParamElement','HTMLPictureElement','HTMLPreElement','HTMLProgressElement','HTMLQuoteElement','HTMLSelectElement','HTMLSlotElement','HTMLSourceElement','HTMLSpanElement','HTMLStyleElement','HTMLTableCaptionElement','HTMLTableCellElement','HTMLTableColElement','HTMLTableElement','HTMLTableRowElement','HTMLTableSectionElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLTimeElement','HTMLTitleElement','HTMLTrackElement','HTMLUListElement','HTMLUnknownElement','HTMLVideoElement','Image','InputEvent','IntersectionObserver','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MimeType','MimeTypeArray','MouseEvent','MutationObserver','MutationRecord','NamedNodeMap','Node','NodeFilter','NodeIterator','NodeList','Notification','PageTransitionEvent','Path2D','Performance','PerformanceEntry','PerformanceNavigation','PerformanceObserver','PerformanceResourceTiming','PerformanceTiming','Plugin','PluginArray','PointerEvent','PopStateEvent','ProcessingInstruction','ProgressEvent','Range','ReadableStream','Request','ResizeObserver','Response','SVGAElement','SVGCircleElement','SVGDefsElement','SVGDescElement','SVGElement','SVGEllipseElement','SVGFilterElement','SVGGElement','SVGGraphicsElement','SVGImageElement','SVGLineElement','SVGLinearGradientElement','SVGMetadataElement','SVGNumber','SVGPathElement','SVGPolygonElement','SVGPolylineElement','SVGRect','SVGSVGElement','SVGScriptElement','SVGStopElement','SVGStyleElement','SVGSwitchElement','SVGSymbolElement','SVGTSpanElement','SVGTextElement','SVGTitleElement','SVGUseElement','Screen','Selection','ShadowRoot','StorageEvent','SubmitEvent','SubtleCrypto','Text','TextDecoder','TextEncoder','TouchEvent','TransitionEvent','TreeWalker','UIEvent','URL','URLSearchParams','ValidityState','VisualViewport','WebSocket','WheelEvent','Window','Worker','WritableStream','XMLDocument','XMLHttpRequest','XMLHttpRequestEventTarget','XMLHttpRequestUpload','XMLSerializer','XPathEvaluator','XPathResult','XSLTProcessor'];
    var sb = {};
    brCls.forEach(function(n){sb[n]=mc(n)});

    // Override with our proper prototype-having instances
    sb.Navigator=Nav;sb.Document=Doc;sb.HTMLElement=HTMLEl;
    sb.HTMLHtmlElement=HTMLHtmlEl;sb.HTMLHeadElement=HTMLHeadEl;sb.HTMLBodyElement=HTMLBodyEl;
    sb.HTMLCanvasElement=HTMLCanvasEl;sb.HTMLIFrameElement=HTMLIFrameEl;
    sb.HTMLScriptElement=HTMLScriptEl;sb.Location=Loc;sb.Screen=Scr;
    sb.History=Hist;sb.Storage=Stor;sb.Performance=Perf;
    sb.EventTarget=EventTarget;

    // Window
    sb.window=sb; sb.self=sb; sb.top=sb; sb.parent=sb; sb.globalThis=sb;
    sb.console={log:function(){},error:function(){},warn:function(){}};
    sb.navigator=nav; sb.document=doc; sb.location=loc; sb.screen=scr; sb.history=hist;
    sb.localStorage=ls; sb.sessionStorage=ls; sb.performance=perf; sb.crypto=cryptoObj;
    sb.btoa=btoaFn; sb.atob=atobFn;
    sb.innerWidth=1920;sb.innerHeight=1080;sb.outerWidth=1920;sb.outerHeight=1080;sb.devicePixelRatio=1;
    sb.addEventListener=mf('addEventListener');sb.removeEventListener=mf('removeEventListener');
    sb.matchMedia=function(){return{matches:false}};sn(sb.matchMedia,'matchMedia');
    sb.getComputedStyle=function(){return{}};sn(sb.getComputedStyle,'getComputedStyle');
    sb.postMessage=mf('postMessage');sb.fetch=mf('fetch');
    sb.origin='https://www.zhipin.com';sb.isSecureContext=true;
    sb.XMLHttpRequest=function(){};sn(sb.XMLHttpRequest,'XMLHttpRequest');
    sb.MutationObserver=function(){};sn(sb.MutationObserver,'MutationObserver');
    sb.requestAnimationFrame=mf('requestAnimationFrame');
    sb.name='';sb.length=0;sb.opener=null;sb.closed=false;
    sb.scrollX=0;sb.scrollY=0;sb.screenX=0;sb.screenY=0;
    sb.origin='https://www.zhipin.com';

    // Execute security JS in this V8 context (not vm)
    var origProcess = global.process;
    var origRequire = global.require;
    var origModule = global.module;
    delete global.process;
    delete global.require;
    delete global.module;

    try {
        // Use Function constructor to evaluate without Node.js globals
        var fn = new Function('sb','mm','sn','mf','mc', code + ';\nreturn typeof sb.ABC');
        var abcExists = fn(sb, mm, sn, mf, mc);
        console.log('ABC exists:', abcExists);
        if (abcExists === 'function') {
            var token = new sb.ABC().z('test_seed', 1782456800000);
            console.log('TOKEN_LEN:', token.length);
            console.log('PREVIEW:', token.substring(0, 60));
            console.log('nav instanceof Nav:', sb.navigator instanceof Nav);
            console.log('doc instanceof Doc:', sb.document instanceof Doc);
        }
    } catch(e) {
        console.log('ERR:', e.message);
    }

    // Restore
    global.process = origProcess;
    global.require = origRequire;
    global.module = origModule;
})();
