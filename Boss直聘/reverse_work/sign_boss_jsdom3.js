/**
 * v3: 最小 jsdom + canvas stub + runScripts
 * 不触发 navigation
 */
var { JSDOM } = require('jsdom');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/config/security-7c91433f.js', 'utf8');

var seed = process.argv[2] || 'test';
var ts = parseInt(process.argv[3] || '1700000000000');

var dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://www.zhipin.com/web/common/security-check.html',
    runScripts: 'dangerously',
    resources: 'usable'
});

var win = dom.window;

// === Canvas stub ===
var origCE = win.document.createElement.bind(win.document);
win.document.createElement = function(tag) {
    if (tag === 'canvas') {
        return {
            getContext: function(type) {
                if (type === 'webgl' || type === 'experimental-webgl') {
                    var gl = {};
                    gl._params = {7936:'WebKit',7937:'WebKit WebGL',3379:16384,34921:16,35661:32};
                    gl.getParameter = function(p) { return gl._params[p]||0; };
                    gl.getExtension = function(n) { if(n==='WEBGL_debug_renderer_info')return{UNMASKED_VENDOR_WEBGL:37446,UNMASKED_RENDERER_WEBGL:37445}; return {}; };
                    gl.getSupportedExtensions = function() { return ['ANGLE_instanced_arrays']; };
                    gl.getShaderPrecisionFormat = function() { return {rangeMin:127,rangeMax:127,precision:23}; };
                    return gl;
                }
                if (type === '2d') return { font:'10px sans-serif', measureText:function(t){return{width:t.length*6}} };
                return null;
            },
            width: 300,
            height: 150,
            style: {}
        };
    }
    return origCE(tag);
};

// === Navigator patches ===
var nav = win.navigator;
nav.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
nav.platform = 'Win32';
nav.language = 'zh-CN';
nav.languages = ['zh-CN', 'zh'];
nav.cookieEnabled = true;
nav.webdriver = false;
nav.hardwareConcurrency = 32;
nav.maxTouchPoints = 0;
nav.vendor = 'Google Inc.';
nav.productSub = '20030107';
nav.doNotTrack = null;
nav.onLine = true;
nav.deviceMemory = 32;
nav.webkitTemporaryStorage = {};
nav.appCodeName = 'Mozilla';
nav.appName = 'Netscape';
nav.product = 'Gecko';

// === Crypto ===
var subtle = {};
['digest','encrypt','decrypt','sign','verify','generateKey','importKey','exportKey','deriveKey','deriveBits','unwrapKey','wrapKey'].forEach(function(m){subtle[m]=function(){}});
win.crypto = win.crypto || {};
win.crypto.getRandomValues = function(a) { for (var i=0;i<a.length;i++) a[i]=Math.floor(Math.random()*256); return a; };
Object.defineProperty(win.crypto, 'subtle', {get:function(){return subtle}, configurable:true});

// === Performance ===
win.performance = win.performance || {};
win.performance.now = function() { return Date.now(); };
win.performance.memory = {};
win.performance.navigation = { type: 0 };

// === Screen ===
var scr = win.screen;
scr.width=2195; scr.height=1235; scr.availWidth=2195; scr.availHeight=1187; scr.colorDepth=32; scr.pixelDepth=32;

// === Storage ===
var ls = { getItem:function(){return null}, setItem:function(){}, key:function(){return null}, length:0 };
win.localStorage = ls;
win.sessionStorage = ls;

// === Window ===
win.btoa = function(s) { return Buffer.from(s).toString('base64'); };
win.atob = function(s) { return Buffer.from(s, 'base64').toString(); };
win.innerWidth=2195; win.innerHeight=1100; win.outerWidth=2195; win.outerHeight=1187;
win.devicePixelRatio=1.75; win.screenX=2195; win.screenY=0;
win.CSSRuleList = function(){};
win.console.log = function(){};
win.console.error = function(){};
win.console.warn = function(){};

// === Execute ===
try { win.eval(code); } catch(e) { process.stderr.write('ERR:'+e.message+'\n'); process.exit(1); }

if (typeof win.ABC === 'undefined') { process.stderr.write('ABC not defined\n'); process.exit(1); }

var tz = 60 * (480 + new Date().getTimezoneOffset()) * 1000;
var token = new win.ABC().z(seed, parseInt(ts) + tz);
process.stdout.write(encodeURIComponent(token));
