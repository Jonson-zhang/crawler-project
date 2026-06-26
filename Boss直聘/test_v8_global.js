// test_v8_global.js - Execute in V8 with browser globals set DIRECTLY on global
// This is the closest approach to the real browser
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

// Debug: ensure code loads
console.log('Code size:', code.length);

// Step 1: Save Node.js globals we'll overwrite
var saved = {};
['process','require','module','exports','__dirname','__filename','Buffer'].forEach(function(k) {
    saved[k] = global[k];
});

// Step 2: Set up native toString
var mm = new Map();
var rt = Function.prototype.toString;
global.Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }

// Step 3: Set browser global classes
function EvtTgt(){} sn(EvtTgt,'EventTarget');
function Navigator(){} Navigator.prototype = new EvtTgt(); sn(Navigator,'Navigator');
function Document(){} Document.prototype = new EvtTgt(); sn(Document,'Document');
function HTMLElement(){} HTMLElement.prototype = new EvtTgt();
HTMLElement.prototype.offsetWidth=1920;HTMLElement.prototype.offsetHeight=1080;
HTMLElement.prototype.style={};HTMLElement.prototype.appendChild=mf('appendChild');
HTMLElement.prototype.setAttribute=mf('setAttribute');
HTMLElement.prototype.getAttribute=function(){return null};sn(HTMLElement.prototype.getAttribute,'getAttribute');
sn(HTMLElement,'HTMLElement');

function HTMLHtmlElement(){} HTMLHtmlElement.prototype = new HTMLElement(); sn(HTMLHtmlElement,'HTMLHtmlElement');
function HTMLHeadElement(){} HTMLHeadElement.prototype = new HTMLElement(); sn(HTMLHeadElement,'HTMLHeadElement');
function HTMLBodyElement(){} HTMLBodyElement.prototype = new HTMLElement(); sn(HTMLBodyElement,'HTMLBodyElement');
function HTMLCanvasElement(){}
HTMLCanvasElement.prototype = new HTMLElement();
HTMLCanvasElement.prototype.width=300;HTMLCanvasElement.prototype.height=150;
HTMLCanvasElement.prototype.getContext=function(t){if(t==='2d'){var c={};['fillText','fillRect','clearRect','save','restore'].forEach(function(m){c[m]=mf(m)});c.measureText=function(t){return{width:t.length*10}};c.getImageData=function(x,y,w,h){return{data:new Uint8ClampedArray(w*h*4)}};return c}return null};
sn(HTMLCanvasElement.prototype.getContext,'getContext');
sn(HTMLCanvasElement,'HTMLCanvasElement');

function HTMLIFrameElement(){} HTMLIFrameElement.prototype = new HTMLElement(); sn(HTMLIFrameElement,'HTMLIFrameElement');
function HTMLScriptElement(){} HTMLScriptElement.prototype = new HTMLElement(); sn(HTMLScriptElement,'HTMLScriptElement');
function Location(){} sn(Location,'Location');
function Screen(){} sn(Screen,'Screen');
function History(){} sn(History,'History');
function Storage(){} sn(Storage,'Storage');

// Set on global
global.EventTarget = EvtTgt;
global.Navigator = Navigator; global.Document = Document; global.HTMLElement = HTMLElement;
global.HTMLHtmlElement = HTMLHtmlElement; global.HTMLHeadElement = HTMLHeadElement;
global.HTMLBodyElement = HTMLBodyElement; global.HTMLCanvasElement = HTMLCanvasElement;
global.HTMLIFrameElement = HTMLIFrameElement; global.HTMLScriptElement = HTMLScriptElement;
global.Location = Location; global.Screen = Screen; global.History = History; global.Storage = Storage;

// 150+ browser constructors
['Audio','Blob','CSSRuleList','CSSStyleDeclaration','CSSStyleSheet','CanvasRenderingContext2D','CloseEvent','Comment','CompositionEvent','Crypto','CustomEvent','DOMException','DOMImplementation','DOMParser','DOMRect','DocumentFragment','ErrorEvent','Event','EventTarget','File','FileReader','FocusEvent','FormData','HashChangeEvent','Headers','HTMLCollection','HTMLAnchorElement','HTMLAudioElement','HTMLButtonElement','HTMLDivElement','HTMLImageElement','HTMLInputElement','HTMLParagraphElement','HTMLSelectElement','HTMLSpanElement','HTMLStyleElement','HTMLTableElement','HTMLTemplateElement','HTMLTextAreaElement','HTMLUListElement','HTMLVideoElement','Image','InputEvent','KeyboardEvent','MediaList','MessageChannel','MessageEvent','MimeType','MimeTypeArray','MouseEvent','MutationObserver','MutationRecord','Node','NodeList','Notification','PageTransitionEvent','Performance','PerformanceEntry','PerformanceObserver','PointerEvent','PopStateEvent','ProgressEvent','Range','Request','Response','SVGElement','SVGSVGElement','Selection','ShadowRoot','Text','TextDecoder','TextEncoder','UIEvent','URL','URLSearchParams','WebSocket','WheelEvent','Window','Worker','XMLDocument','XMLHttpRequest','XMLSerializer'].forEach(function(n){if(!global[n])global[n]=mc(n)});

// Step 4: Browser objects
global.window = global; global.self = global; global.top = global; global.parent = global;
global.globalThis = global;
global.console = { log: function(){}, error: function(){}, warn: function(){} };

// Navigator
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
global.navigator = nav;

// Document
var doc = new Document();
doc.createElement=function(tag){
    if(tag==='iframe'){var f=new HTMLIFrameElement();f.style={};f.setAttribute=mf('setAttribute');f.getAttribute=function(){return null};return f}
    if(tag==='canvas')return new HTMLCanvasElement();
    if(tag==='script'){var s=new HTMLScriptElement();s.src='';s.setAttribute=mf('setAttribute');return s}
    return new HTMLElement();
};sn(doc.createElement,'createElement');
doc.body=new HTMLBodyElement();doc.documentElement=new HTMLHtmlElement();doc.head=new HTMLHeadElement();
doc.getElementsByTagName=function(t){if(t==='head')return{item:function(i){return doc.head},length:1};return{item:function(){return null},length:0}};
sn(doc.getElementsByTagName,'getElementsByTagName');
doc.hidden=false;doc.readyState='complete';doc.title='BOSS直聘';doc.characterSet='UTF-8';
Object.defineProperty(doc,'cookie',{get:function(){return'__a=test;__c=123;__g=-'},set:function(v){},configurable:true,enumerable:true});
global.document = doc;

// Other env
global.location = {href:'https://www.zhipin.com/web/geek/jobs',hostname:'www.zhipin.com',host:'www.zhipin.com',pathname:'/web/geek/jobs',protocol:'https:',origin:'https://www.zhipin.com',port:'',search:''};
global.screen = {width:1920,height:1080,availWidth:1920,availHeight:1040,colorDepth:24,pixelDepth:24};
global.history = {length:1,pushState:mf('pushState'),replaceState:mf('replaceState')};
global.localStorage = {getItem:mf('getItem'),setItem:mf('setItem'),length:0};
global.sessionStorage = {getItem:mf('getItem'),setItem:mf('setItem'),length:0};
global.performance = {now:function(){return Date.now()}};sn(global.performance.now,'now');
var _cryptoMod = require('crypto');
global.crypto = {getRandomValues:function(arr){var b=_cryptoMod.randomBytes(arr.length);for(var i=0;i<arr.length;i++)arr[i]=b[i];return arr},subtle:null};
sn(global.crypto.getRandomValues,'getRandomValues');
global.btoa = function(s){return Buffer.from(s).toString('base64')};sn(global.btoa,'btoa');
global.atob = function(s){return Buffer.from(s,'base64').toString()};sn(global.atob,'atob');
global.innerWidth=1920;global.innerHeight=1080;global.outerWidth=1920;global.outerHeight=1080;global.devicePixelRatio=1;
global.addEventListener=mf('addEventListener');
global.matchMedia=function(){return{matches:false}};sn(global.matchMedia,'matchMedia');
global.getComputedStyle=function(){return{}};sn(global.getComputedStyle,'getComputedStyle');
global.postMessage=mf('postMessage');global.fetch=mf('fetch');
global.origin='https://www.zhipin.com';global.isSecureContext=true;
global.XMLHttpRequest=mc('XMLHttpRequest');
global.MutationObserver=mc('MutationObserver');
global.requestAnimationFrame=mf('requestAnimationFrame');
global.name='';global.length=0;global.opener=null;global.closed=false;
global.scrollX=0;global.scrollY=0;global.screenX=0;global.screenY=0;

// ===== Step 5: Stub Node.js globals (keep alive for Node internals) =====
// Set to innocuous values but DON'T delete (crashes Node internals)
global._zp_savedProcess = global.process;
global._zp_savedRequire = global.require;
global.process = { env: {}, argv: [], version: '', platform: '', pid: 0 };
global.require = undefined;
global.module = undefined;
global.exports = undefined;

// ===== Step 6: Execute security JS =====
console.log('[1] Loading security JS...');
try {
    eval(code);
    console.log('[2] Done. ABC type:', typeof global.ABC);
    if (typeof global.ABC === 'function') {
        var token = new global.ABC().z('test_seed', 1782456800000);
        console.log('[3] TOKEN_LEN:', token.length);
        console.log('[4] PREVIEW:', token.substring(0, 60));
        console.log('[5] nav instanceof Nav:', nav instanceof Navigator);
        console.log('[6] doc instanceof Doc:', doc instanceof Document);
    } else {
        console.log('[ERR] ABC not defined');
    }
} catch(e) {
    console.log('[ERR]', e.message);
    console.log('[ERR] Stack:', e.stack && e.stack.substring(0, 400));
}

// ===== Step 7: Restore Node.js globals =====
if (global._zp_savedProcess) global.process = global._zp_savedProcess;
if (global._zp_savedRequire) global.require = global._zp_savedRequire;
global.module = saved.module || undefined;
global.exports = saved.exports || undefined;
