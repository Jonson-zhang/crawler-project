#!/usr/bin/env node
/**
 * 调试版：追踪 __cgiEncrypt 出现时机
 */
const fs = require("fs");
const path = require("path");
const _require = require;

console.log("0: __cgiEncrypt =", typeof global.__cgiEncrypt);

_require("./env_site");
console.log("1: after env_site, __cgiEncrypt =", typeof global.__cgiEncrypt);

global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(__dirname, "runtime.js"), "utf-8"));
console.log("2: after runtime, __cgiEncrypt =", typeof global.window.__cgiEncrypt);

global.window.webpackJsonp.push([[999],{380:function(e){e.exports={debuglog:function(){return function(){}},inspect:{colors:false}}},381:function(e){e.exports=function(){this.head=null;this.tail=null;this.length=0};var p=e.exports.prototype;p.push=function(d){var n={data:d,next:null};this.length>0?(this.tail.next=n):(this.head=n);this.tail=n;++this.length};p.shift=function(){if(0!==this.length){var d=this.head.data;return 1===this.length?(this.head=this.tail=null):(this.head=this.head.next),--this.length,d}}},382:function(e){e.exports=e(381)}}]);
console.log("3: after stubs, __cgiEncrypt =", typeof global.window.__cgiEncrypt);

eval(fs.readFileSync(path.join(__dirname, "vendor.chunk.js"), "utf-8"));
console.log("4: after vendor, modules=", Object.keys(global.window.__webpack_require__.m).length);

var wp = global.window.__webpack_require__;
var keys = Object.keys(wp.m).filter(function(k){return wp.m[k]}).sort(function(a,b){return a-b});
console.log("5: activating", keys.length, "modules...");

for (var i = 0; i < keys.length; i++) {
    try { wp(keys[i]); } catch(e) {}
    if (typeof global.window.__cgiEncrypt !== "undefined") {
        console.log("6: __cgiEncrypt appeared after module", keys[i]);
        break;
    }
}

if (typeof global.window.__cgiEncrypt === "undefined") {
    console.log("7: __cgiEncrypt never appeared during activation");
}

console.log("8: after activation, __cgiEncrypt =", typeof global.window.__cgiEncrypt);

// Check after a tick
setTimeout(function() {
    console.log("9: after tick, __cgiEncrypt =", typeof global.window.__cgiEncrypt);
}, 100);
