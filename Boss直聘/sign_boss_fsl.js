/**
 * sign_boss_fsl.js — FSl强制浏览器路径
 * 使用 security-fsl2.js（VMP内所有(W,j)对FSl被覆盖为浏览器值）
 */
var vm = require('vm'), fs = require('fs'), _crypto = require('crypto');
var code = fs.readFileSync(__dirname + '/config/security-fsl2.js', 'utf8');

var mm = new Map(), rt = Function.prototype.toString;
Function.prototype.toString = function() { return typeof this === 'function' && mm.get(this) || rt.call(this); };
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

function EvtTgt(){} sn(EvtTgt,'EventTarget');
function Nav_(){}
Nav_.prototype = Object.create(EvtTgt.prototype); Nav_.prototype[ST] = 'Navigator'; sn(Nav_,'Navigator');
var NP = Nav_.prototype;
function dNav(p, v) { Object.defineProperty(NP, p, {get:function(){return v},enumerable:true,configurable:true}); }
dNav('userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
dNav('platform','Win32'); dNav('language','zh-CN'); dNav('languages',['zh-CN','zh']);
dNav('cookieEnabled',true); dNav('webdriver',false); dNav('onLine',true);
dNav('hardwareConcurrency',32); dNav('maxTouchPoints',0); dNav('vendor','Google Inc.');
dNav('productSub','20030107'); dNav('doNotTrack',null); dNav('deviceMemory',32);
dNav('webkitTemporaryStorage',{}); dNav('appCodeName','Mozilla'); dNav('appName','Netscape'); dNav('product','Gecko');
dNav('pdfViewerEnabled',true);

Object.defineProperty(NP,'plugins',{get:function(){var p={length:5};p[ST]='PluginArray';p.item=mf('item');p.namedItem=mf('namedItem');p.refresh=mf('refresh');for(var i=0;i<5;i++){var pl={name:['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'][i],filename:'internal-pdf-viewer',description:'Portable Document Format',length:2};pl[ST]='Plugin';pl[0]={type:'application/pdf',suffixes:'pdf'};pl[1]={type:'text/pdf',suffixes:'pdf'};pl[0][ST]='MimeType';pl[1][ST]='MimeType';p[i]=pl};return p},enumerable:true,configurable:true});
Object.defineProperty(NP,'mimeTypes',{get:function(){var m={length:2};m[ST]='MimeTypeArray';m.item=mf('item');m.namedItem=mf('namedItem');m[0]={type:'application/pdf',suffixes:'pdf'};m[1]={type:'text/pdf',suffixes:'pdf'};return m},enumerable:true,configurable:true});
var nav = new Nav_();

var doc = {};
doc[ST]='HTMLDocument';
doc.createElement=function(tag){
    if(tag==='canvas'){return{getContext:function(t){if(t==='webgl'){var gl={};gl[ST]='WebGLRenderingContext';gl.getParameter=function(p){var pp={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32};return pp[p]||0};gl.getExtension=function(n){if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445};return{}};gl.getSupportedExtensions=function(){return['ANGLE_instanced_arrays','EXT_blend_minmax']};return gl}if(t==='2d')return{font:'10px sans-serif',measureText:function(t){return{width:t.length*6}}};return null},width:300,height:150,style:{}}};
    if(tag==='iframe')return{contentWindow:globalThis};
    return{};
};
sn(doc.createElement,'createElement');
doc.body={}; doc.all=undefined; doc.hidden=false; doc.readyState='complete'; doc.characterSet='UTF-8';
doc.cookie='__a='+(process.argv[2]||'0')+';__c='+(process.argv[3]||'0')+';__g=-';

var scr = new (function Scr_(){})();
scr[ST]='Screen';
Object.defineProperty(Object.getPrototypeOf(scr),'width',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(Object.getPrototypeOf(scr),'height',{get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(Object.getPrototypeOf(scr),'availWidth',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(Object.getPrototypeOf(scr),'availHeight',{get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(Object.getPrototypeOf(scr),'colorDepth',{get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(Object.getPrototypeOf(scr),'pixelDepth',{get:function(){return 32},enumerable:true,configurable:true});

function mkLS(){return{getItem:function(){return null},setItem:function(){},key:function(){return null},length:0};}

var perf = {}; perf[ST]='Performance';
perf.now=function(){return Date.now()}; perf.memory={}; perf.navigation={type:0};

var sbox = {Object,Array,Function,String,Number,Boolean,Date,Math,RegExp,Error,TypeError,parseInt,parseFloat,isNaN,isFinite,JSON,Promise,Symbol,Map,Set,ArrayBuffer,Uint8Array,Int32Array,NaN,Infinity,undefined,console:{log:function(){},error:function(){},warn:function(){}}};
sbox.window=sbox; sbox.self=sbox; sbox.navigator=nav; sbox.document=doc;
sbox.location={hostname:'www.zhipin.com',href:'https://www.zhipin.com/web/geek/jobs'};
sbox.screen=scr; sbox.history={length:1};
sbox.localStorage=mkLS(); sbox.sessionStorage=mkLS(); sbox.performance=perf;
sbox.crypto={getRandomValues:function(a){var b=_crypto.randomBytes(a.length);for(var i=0;i<a.length;i++)a[i]=b[i];return a},subtle:{}};
sbox.btoa=function(s){return Buffer.from(s).toString('base64')};
sbox.atob=function(s){return Buffer.from(s,'base64').toString()};
sbox.CSSRuleList=mc('CSSRuleList');
sbox.innerWidth=2195;sbox.innerHeight=1100;sbox.outerWidth=2195;sbox.outerHeight=1187;
sbox.devicePixelRatio=1.75;sbox.screenX=2195;sbox.screenY=0;
sbox.fetch=mf('fetch');sbox.matchMedia=function(){return{matches:false}};
sbox.Intl={};sbox.AbortController=mc('AbortController');sbox.AbortSignal=mc('AbortSignal');
['Navigator','Document','Screen','PluginArray','MimeTypeArray','Plugin','MimeType','HTMLElement'].forEach(function(n){sbox[n]=mc(n)});

var ctx = vm.createContext(sbox);
try {
    new vm.Script(code).runInContext(ctx);
    var seed = process.argv[4] || 'test';
    var ts = parseInt(process.argv[5] || '1700000000000');
    process.stdout.write(new sbox.ABC().z(seed, ts));
} catch(e) {
    process.stderr.write('Error: ' + e.message + '\n');
    process.exit(1);
}
