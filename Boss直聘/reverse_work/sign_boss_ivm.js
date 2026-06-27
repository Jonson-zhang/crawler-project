/**
 * sign_boss_ivm.js — isolated-vm 真隔离 V8 沙箱
 * 零 Node.js 全局污染，最接近浏览器 V8 环境
 */
var ivm = require('isolated-vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var __a = process.argv[2] || '0';
var __c = process.argv[3] || '0';
var seed = process.argv[4] || 'test';
var ts = parseInt(process.argv[5] || '1700000000000');

// 创建隔离 V8 实例
var isolate = new ivm.Isolate({ memoryLimit: 256 });
var context = isolate.createContextSync();
var jail = context.global;

// 设置全局引用到隔离环境
jail.setSync('global', jail);
jail.setSync('_ivm', ivm);

// === 在隔离环境中定义浏览器对象 ===
context.evalClosureSync(`
// Native toString protection
var mm = new $0.Map();
var rt = Function.prototype.toString;
Function.prototype.toString = function() {
    return typeof this === 'function' && mm.get(this) || rt.call(this);
};
function sn(o, n) { mm.set(o, 'function ' + n + '() { [native code] }'); }
function mf(n) { var f = function() {}; sn(f, n); return f; }
function mc(n) { var f = function() {}; f.prototype = { constructor: f }; sn(f, n); return f; }
var ST = Symbol.toStringTag;

// === Constructor hierarchy ===
function EvtTgt(){} sn(EvtTgt,'EventTarget');
function Nav_(){}
Nav_.prototype = Object.create(EvtTgt.prototype); Nav_.prototype[ST] = 'Navigator'; sn(Nav_,'Navigator');
function Doc_(){}
Doc_.prototype = Object.create(EvtTgt.prototype); Doc_.prototype[ST] = 'HTMLDocument'; sn(Doc_,'Document');
function HTMLEl(){}
HTMLEl.prototype = Object.create(EvtTgt.prototype); HTMLEl.prototype[ST] = 'HTMLElement';
HTMLEl.prototype.offsetWidth = 1920; HTMLEl.prototype.appendChild = mf('appendChild');
HTMLEl.prototype.setAttribute = mf('setAttribute');
HTMLEl.prototype.getAttribute = function(){return null}; sn(HTMLEl.prototype.getAttribute,'getAttribute');
sn(HTMLEl,'HTMLElement');
function Scr_(){}
Scr_.prototype[ST] = 'Screen'; sn(Scr_,'Screen');

// === Navigator (prototype getters) ===
var NP = Nav_.prototype;
function def(p,v) { Object.defineProperty(NP, p, {get: function(){ return v; }, enumerable: true, configurable: true}); }
def('userAgent','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36');
def('platform','Win32'); def('language','zh-CN'); def('languages',['zh-CN','zh']);
def('cookieEnabled',true); def('webdriver',false); def('onLine',true);
def('hardwareConcurrency',32); def('maxTouchPoints',0); def('vendor','Google Inc.');
def('vendorSub',''); def('productSub','20030107'); def('doNotTrack',null);
def('deviceMemory',32); def('appCodeName','Mozilla'); def('appName','Netscape');
def('product','Gecko'); def('pdfViewerEnabled',true); def('webkitTemporaryStorage',{});
Object.defineProperty(NP,'plugins',{get: function(){ var p = {length:5}; p[ST]='PluginArray'; p.item=mf('item'); p.namedItem=mf('namedItem'); p.refresh=mf('refresh'); return p; }, enumerable:true, configurable:true});
Object.defineProperty(NP,'mimeTypes',{get: function(){ var m = {length:2}; m[ST]='MimeTypeArray'; m.item=mf('item'); return m; }, enumerable:true, configurable:true});
var nav = new Nav_();

// === Document ===
var doc = new Doc_();
doc.createElement = function(tag) {
    if(tag === 'canvas') {
        var c = {}; c[ST] = 'HTMLCanvasElement'; c.width = 300; c.height = 150;
        c.getContext = function(t) {
            if(t === 'webgl' || t === 'experimental-webgl') {
                var gl = {}; gl[ST] = 'WebGLRenderingContext';
                gl.getParameter = function(p) { var pp={7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32}; return pp[p]||0; };
                gl.getExtension = function(n) { if(n==='WEBGL_debug_renderer_info') return {UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445}; return {}; };
                gl.getSupportedExtensions = function() { return ['ANGLE_instanced_arrays','EXT_blend_minmax']; };
                return gl;
            }
            if(t === '2d') { var c2 = {}; c2[ST]='CanvasRenderingContext2D'; c2.font='10px sans-serif'; return c2; }
            return null;
        };
        return c;
    }
    if(tag === 'iframe') return { contentWindow: globalThis };
    return new HTMLEl();
}; sn(doc.createElement,'createElement');
doc.body = new HTMLEl(); doc.head = new HTMLEl();
Object.defineProperty(Doc_.prototype, 'cookie', {get: function(){ return '__a=${__a};__c=${__c};__g=-'; }, set: function(){}, configurable: true, enumerable: true});
doc.all = undefined; doc.hidden = false; doc.readyState = 'complete'; doc.characterSet = 'UTF-8';

// === Screen ===
var SP = Scr_.prototype;
Object.defineProperty(SP,'width',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'height',{get:function(){return 1235},enumerable:true,configurable:true});
Object.defineProperty(SP,'availWidth',{get:function(){return 2195},enumerable:true,configurable:true});
Object.defineProperty(SP,'availHeight',{get:function(){return 1187},enumerable:true,configurable:true});
Object.defineProperty(SP,'colorDepth',{get:function(){return 32},enumerable:true,configurable:true});
Object.defineProperty(SP,'pixelDepth',{get:function(){return 32},enumerable:true,configurable:true});
var scr = new Scr_();

// === Performance ===
function MemInfo_(){}
MemInfo_.prototype[ST] = 'MemoryInfo';
Object.defineProperty(MemInfo_.prototype,'jsHeapSizeLimit',{get:function(){return 4294967296},enumerable:true,configurable:true});
Object.defineProperty(MemInfo_.prototype,'totalJSHeapSize',{get:function(){return 41938737},enumerable:true,configurable:true});
Object.defineProperty(MemInfo_.prototype,'usedJSHeapSize',{get:function(){return 34705941},enumerable:true,configurable:true});
var mi = new MemInfo_();
function Perf_(){}
Perf_.prototype[ST] = 'Performance';
var perf = new Perf_();
perf.now = function() { return Date.now(); };
perf.memory = mi;

// === Crypto ===
var subtle = {};
['digest','encrypt','decrypt','sign','verify','generateKey','importKey','exportKey'].forEach(function(m){ subtle[m]=mf(m); });
function Crypto_(){}
Crypto_.prototype[ST] = 'Crypto';
Crypto_.prototype.getRandomValues = function(a) { for(var i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); return a; };
Object.defineProperty(Crypto_.prototype,'subtle',{get:function(){return subtle},enumerable:true,configurable:true});
var cryptoObj = new Crypto_();

// === Global挂载 ===
globalThis.window = globalThis; globalThis.self = globalThis; globalThis.top = globalThis;
globalThis.navigator = nav; globalThis.document = doc; globalThis.screen = scr;
globalThis.performance = perf; globalThis.crypto = cryptoObj;
globalThis.location = { hostname: 'www.zhipin.com', href: 'https://www.zhipin.com/web/geek/jobs' };
globalThis.localStorage = { getItem: function(){return null}, setItem: function(){}, key: function(){return null}, length: 0 };
globalThis.btoa = function(s) { var r=''; for(var i=0;i<s.length;i++){ var c=s.charCodeAt(i); r+=String.fromCharCode((c>>>6)&63|128,c&63|128); } return r; };
globalThis.innerWidth = 2195; globalThis.innerHeight = 1100;
globalThis.devicePixelRatio = 1.75;
globalThis.CSSRuleList = mc('CSSRuleList');
globalThis.console = { log: function(){}, error: function(){}, warn: function(){} };
globalThis.Intl = {};
`, [Map], { result: { promise: true } }).then(function() {
    // 第二步：在隔离环境中执行 security JS
    return context.evalClosureSync(`
        try {
            $0.eval(codeStr);
        } catch(e) {
            errMsg = e.message;
        }
    `, [code], { arguments: [{ copy: true }] });
}).then(function() {
    // 第三步：调用 ABC.z()
    return context.evalClosureSync(`
        if (typeof ABC === 'undefined') {
            result = 'ABC_NOT_DEFINED';
        } else {
            var t = new ABC().z(seedStr, tsNum);
            result = 'TOK:' + t.length;
        }
    `, [seed, ts], { arguments: [{ copy: true }, { copy: true }] });
}).then(function(result) {
    console.log('isolated-vm result:', result);
}).catch(function(err) {
    console.error('isolated-vm error:', err.message);
});
