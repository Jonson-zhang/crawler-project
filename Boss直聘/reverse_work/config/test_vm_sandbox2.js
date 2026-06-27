// test_vm_sandbox2.js - vm sandbox with auto-generating Proxy for missing globals
var vm = require('vm');
var fs = require('fs');
var code = fs.readFileSync(__dirname + '/security-7c91433f.js', 'utf8');

var accessed = {};

// Auto-generating handler for unknown properties
function makeBaseObj(name) {
    return new Proxy({}, {
        get: function(t, p) {
            var key = String(p);
            if (!(key in accessed)) accessed[key] = {count:0};
            accessed[key].count++;
            if (!(key in t)) {
                // Auto-create: if key starts with uppercase, make a function(class)
                if (/^[A-Z]/.test(key)) t[key] = function(){};
                else if (key === 'length') t[key] = 0;
                else if (key === 'prototype') t[key] = {};
                else t[key] = undefined;
            }
            return t[key];
        }
    });
}

var sandbox = new Proxy({}, {
    get: function(t, p) {
        var key = String(p);
        if (!(key in accessed)) accessed[key] = {count:0};
        accessed[key].count++;
        if (key in t) return t[key];
        // Auto-create classes
        if (/^[A-Z]/.test(key)) {
            var fn = function(){};
            t[key] = fn;
        }
        return t[key];
    },
    set: function(t, p, v) { t[p] = v; return true; }
});

// Core JS
var stdLibs = {Object,Array,Function,String,Number,Boolean,Date,Math,RegExp,Error,TypeError,SyntaxError,ReferenceError,RangeError,URIError,EvalError,parseInt,parseFloat,isNaN,isFinite,encodeURIComponent,decodeURIComponent,encodeURI,decodeURI,JSON,Promise,Symbol,Map,Set,WeakMap,WeakSet,Proxy,Reflect,ArrayBuffer,DataView,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,Uint8ClampedArray,BigInt,NaN,Infinity,undefined,setTimeout,setInterval,clearTimeout,clearInterval};
Object.assign(sandbox, stdLibs);

// Browser env
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.top = sandbox;
sandbox.parent = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = {log:function(){},error:function(){},warn:function(){}};
sandbox.navigator = {userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',platform:'Win32',language:'zh-CN',languages:['zh-CN','zh'],cookieEnabled:true,webdriver:false,hardwareConcurrency:2,maxTouchPoints:1,vendor:'',vendorSub:'',productSub:'20100101',doNotTrack:'1',onLine:true,plugins:{length:5,item:function(){return null},namedItem:function(){return null},refresh:function(){}}};
sandbox.document = {cookie:'ab_guid=test; __a=26709070.1782456825..1782456825.2.1.2.2; __c=1782456825; __g=-',createElement:function(t){return t==='iframe'?{style:{},contentWindow:sandbox}:{style:{}}},body:{appendChild:function(){}},documentElement:{appendChild:function(){}},getElementsByTagName:function(){return{item:function(){return null},length:0}},hidden:false,readyState:'complete',referrer:'',title:'BOSS直聘',visibilityState:'visible',characterSet:'UTF-8'};
sandbox.location = {href:'https://www.zhipin.com/web/geek/jobs?city=101010100&query=python',hostname:'www.zhipin.com',host:'www.zhipin.com',pathname:'/web/geek/jobs',protocol:'https:',origin:'https://www.zhipin.com',port:'',search:'?city=101010100&query=python',hash:''};
sandbox.screen = {width:1920,height:1080,availWidth:1920,availHeight:1040,colorDepth:24,pixelDepth:24};
sandbox.history = {length:1};
sandbox.localStorage = {getItem:function(){return null},setItem:function(){},removeItem:function(){},clear:function(){},length:0,key:function(){return null}};
sandbox.sessionStorage = {getItem:function(){return null},setItem:function(){},removeItem:function(){},clear:function(){},length:0,key:function(){return null}};
sandbox.performance = {now:function(){return Date.now()},timing:{navigationStart:Date.now()}};
sandbox.crypto = (function(){var c=require('crypto');return{getRandomValues:function(arr){var b=c.randomBytes(arr.length);for(var i=0;i<arr.length;i++)arr[i]=b[i];return arr},subtle:null}})();
sandbox.btoa = function(s){return Buffer.from(s).toString('base64')};
sandbox.atob = function(s){return Buffer.from(s,'base64').toString()};
sandbox.eval = function(s){return vm.runInContext(s, vm.createContext(sandbox))};

var context = vm.createContext(sandbox);
var script = new vm.Script(code);

try {
    script.runInContext(context);
    console.log('ABC type:', typeof sandbox.ABC);
    if (typeof sandbox.ABC !== 'undefined') {
        var token = new sandbox.ABC().z('test_seed_12345', 1782456800000);
        console.log('Token len:', token.length);
        console.log('Token preview:', token.substring(0, 60));
    }
} catch(e) {
    console.log('Error:', e.message);
}
