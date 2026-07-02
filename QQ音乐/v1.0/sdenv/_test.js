const path = require('path');
const fs = require('fs');
const HERE = __dirname;
require(path.join(HERE, 'env_site.js'));
console.log('env loaded');
global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf-8'));
global.window.webpackJsonp.push([[999],{380:function(e){e.exports={debuglog:function(){return function(){}},inspect:{colors:false}}},381:function(e){e.exports=function(){this.head=null;this.tail=null;this.length=0};var p=e.exports.prototype;p.push=function(d){var n={data:d,next:null};this.length>0?(this.tail.next=n):(this.head=n);this.tail=n;++this.length};p.shift=function(){if(0!==this.length){var d=this.head.data;return 1===this.length?(this.head=this.tail=null):(this.head=this.head.next),--this.length,d}}},382:function(e){e.exports=e(381)}}]);
eval(fs.readFileSync(path.join(HERE, 'vendor.chunk.js'), 'utf-8'));
var wp=global.window.__webpack_require__;
if(wp&&wp.m){Object.keys(wp.m).forEach(function(id){if(wp.m[id]){try{wp(id)}catch(e){}}});}
console.log('__cgiEncrypt:', typeof global.window.__cgiEncrypt);
