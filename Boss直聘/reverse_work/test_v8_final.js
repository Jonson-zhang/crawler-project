// test_v8_final.js - Execute security JS in V8 context WITHOUT Node.js globals
// Use Function constructor to create a closure where Node.js globals are hidden
var _fs = require('fs');
var _crypto = require('crypto');
var code = _fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');
console.log('Code size:', code.length);

// Build the execution script that wraps security JS
// We construct a single large string containing all our environment setup + the security JS
// This runs in a single Function() invocation where Node.js globals don't exist

var execScript = `
// === Native toString protection ===
var mm = new Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }

// === Browser classes ===
function EvtTgt(){}
function Navigator(){ this.constructor = Navigator; }
Navigator.prototype = new EvtTgt();
function Document(){}
Document.prototype = new EvtTgt();
function HTMLElement(){}
HTMLElement.prototype = new EvtTgt(); HTMLElement.prototype.offsetWidth=1920; HTMLElement.prototype.offsetHeight=1080; HTMLElement.prototype.style={}; HTMLElement.prototype.appendChild=mf('appendChild');
function HTMLHtmlElement(){}
HTMLHtmlElement.prototype = new HTMLElement();
function HTMLBodyElement(){}
HTMLBodyElement.prototype = new HTMLElement();
function HTMLHeadElement(){}
HTMLHeadElement.prototype = new HTMLElement();
function HTMLCanvasElement(){}
HTMLCanvasElement.prototype = new HTMLElement(); HTMLCanvasElement.prototype.width=300; HTMLCanvasElement.prototype.height=150;
HTMLCanvasElement.prototype.getContext=function(t){if(t==='2d'){var c={};['fillText','fillRect','clearRect','save','restore'].forEach(function(m){c[m]=mf(m)});c.measureText=function(t){return{width:t.length*10}};c.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};return c}return null};
function HTMLIFrameElement(){}
HTMLIFrameElement.prototype = new HTMLElement();
function HTMLScriptElement(){}
HTMLScriptElement.prototype = new HTMLElement();
function Location(){}
function Screen(){}
function History(){}
function Storage(){}

// Mark constructors with native toString
var clsList = ['EventTarget','Navigator','Document','HTMLElement','HTMLHtmlElement','HTMLHeadElement','HTMLBodyElement','HTMLCanvasElement','HTMLIFrameElement','HTMLScriptElement','Location','Screen','History','Storage'];
clsList.forEach(function(n){ sn(eval(n), n); });

// More browser constructors
var moreCls = 'Audio,Blob,CSSRuleList,CSSStyleDeclaration,CSSStyleSheet,CanvasRenderingContext2D,CloseEvent,Comment,CompositionEvent,Crypto,CustomEvent,DOMException,DOMImplementation,DOMParser,DOMRect,DocumentFragment,ErrorEvent,Event,EventSource,EventTarget,File,FileReader,FocusEvent,FormData,HashChangeEvent,Headers,HTMLCollection,HTMLAnchorElement,HTMLAudioElement,HTMLButtonElement,HTMLDivElement,HTMLImageElement,HTMLInputElement,HTMLParagraphElement,HTMLSelectElement,HTMLSpanElement,HTMLStyleElement,HTMLTableElement,HTMLTemplateElement,HTMLTextAreaElement,HTMLUListElement,HTMLVideoElement,Image,InputEvent,KeyboardEvent,MediaList,MessageChannel,MessageEvent,MimeType,MimeTypeArray,MouseEvent,MutationObserver,MutationRecord,Node,NodeList,Notification,PageTransitionEvent,Performance,PerformanceObserver,PointerEvent,PopStateEvent,ProgressEvent,Range,Request,Response,SVGElement,SVGSVGElement,Selection,ShadowRoot,Text,TextDecoder,TextEncoder,UIEvent,URL,URLSearchParams,WebSocket,WheelEvent,Window,Worker,XMLDocument,XMLHttpRequest,XMLSerializer'.split(',');
moreCls.forEach(function(n){ if(typeof globalThis.constructor.prototype[n] === 'undefined') { var tmp = mc(n); /* already set by mc */ } });

// Allow access to new Uint8ClampedArray
var _Uint8ClampedArray = Uint8ClampedArray;

// === Browser objects ===
var nav = new Navigator();
nav.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0';
nav.appVersion='5.0 (Windows)';nav.platform='Win32';nav.language='zh-CN';
nav.languages=['zh-CN','zh'];nav.cookieEnabled=true;nav.webdriver=false;
nav.hardwareConcurrency=8;nav.maxTouchPoints=0;nav.vendor='';nav.productSub='20100101';
nav.doNotTrack='1';nav.onLine=true;
var pls={length:3,refresh:mf('refresh')};pls.item=mf('item');pls.namedItem=mf('namedItem');
for(var i=0;i<3;i++){pls[i]={name:'Plugin'+i,filename:'p'+i+'.dll',description:'',length:1};pls[i][0]={type:'application/pdf',suffixes:'pdf',description:''}}
nav.plugins=pls;
var mts={length:2};mts.item=mf('item');mts.namedItem=mf('namedItem');
mts[0]={type:'application/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]};
mts[1]={type:'text/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]};
nav.mimeTypes=mts;

var doc = new Document();
doc.createElement=function(tag){
    if(tag==='iframe'){var f=new HTMLIFrameElement();f.style={};f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};return f}
    if(tag==='canvas')return new HTMLCanvasElement();
    if(tag==='script'){var s=new HTMLScriptElement();s.src='';return s}
    return new HTMLElement();
};sn(doc.createElement,'createElement');
doc.body=new HTMLBodyElement();doc.documentElement=new HTMLHtmlElement();doc.head=new HTMLHeadElement();
doc.getElementsByTagName=function(t){if(t==='head')return{item:function(i){return doc.head},length:1};return{item:function(){return null},length:0}};
sn(doc.getElementsByTagName,'getElementsByTagName');
doc.hidden=false;doc.readyState='complete';doc.title='BOSS直聘';doc.characterSet='UTF-8';
Object.defineProperty(doc,'cookie',{get:function(){return'__a=test;__c=123;__g=-'},set:function(v){},configurable:true,enumerable:true});

// Window
var win = this;
win.window = win; win.self = win; win.top = win; win.parent = win; win.globalThis = win;
win.console = { log: function(){}, error: function(){}, warn: function(){} };
win.navigator = nav; win.document = doc;
win.location = {href:'https://www.zhipin.com/web/geek/jobs',hostname:'www.zhipin.com',host:'www.zhipin.com',pathname:'/web/geek/jobs',protocol:'https:',origin:'https://www.zhipin.com'};
win.screen = {width:1920,height:1080,availWidth:1920,availHeight:1040,colorDepth:24,pixelDepth:24};
win.history = {length:1,pushState:mf('pushState'),replaceState:mf('replaceState')};
win.localStorage = {getItem:mf('getItem'),setItem:mf('setItem'),length:0};
win.sessionStorage = {getItem:mf('getItem'),setItem:mf('setItem'),length:0};
win.performance = {now:function(){return Date.now()}};sn(win.performance.now,'now');
win.crypto = {getRandomValues:cryptoGetRandomValues,subtle:null};
win.addEventListener=mf('addEventListener');
win.matchMedia=function(){return{matches:false}};sn(win.matchMedia,'matchMedia');
win.getComputedStyle=function(){return{}};sn(win.getComputedStyle,'getComputedStyle');
win.postMessage=mf('postMessage');win.fetch=mf('fetch');
win.origin='https://www.zhipin.com';win.isSecureContext=true;
win.XMLHttpRequest=mc('XMLHttpRequest');
win.MutationObserver=mc('MutationObserver');
win.requestAnimationFrame=mf('requestAnimationFrame');
win.innerWidth=1920;win.innerHeight=1080;win.outerWidth=1920;win.outerHeight=1080;win.devicePixelRatio=1;
win.name='';win.length=0;win.opener=null;win.closed=false;
win.scrollX=0;win.scrollY=0;win.screenX=0;win.screenY=0;

${code}
`;

// Create the function with access to crypto
var fn = new Function('cryptoGetRandomValues', execScript);
var cryptoGetRandomValues = function(arr) {
    var b = _crypto.randomBytes(arr.length);
    for (var i = 0; i < arr.length; i++) arr[i] = b[i];
    return arr;
};
var result = fn(cryptoGetRandomValues);
console.log('Result:', result);
