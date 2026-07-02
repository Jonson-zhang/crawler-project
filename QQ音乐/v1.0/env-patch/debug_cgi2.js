#!/usr/bin/env node
/**
 * 精确复制 qqmusic_api.js 的逻辑，逐行跟踪 __cgiEncrypt
 */
const fs = require("fs");
const path = require("path");
const _require = require;

// 精确匹配 qqmusic_api.js 的环境加载顺序
_require("./env_site");

global.window.webpackJsonp = [];
eval(fs.readFileSync(path.join(__dirname, "runtime.js"), "utf-8"));
global.window.webpackJsonp.push([
  [999],
  {
    380: function (e) { e.exports = { debuglog: function () { return function () {}; }, inspect: { colors: false } }; },
    381: function (e) {
      e.exports = function () { this.head = null; this.tail = null; this.length = 0; };
      var p = e.exports.prototype;
      p.push    = function (d) { var n = { data: d, next: null }; this.length > 0 ? (this.tail.next = n) : (this.head = n); this.tail = n; ++this.length; };
      p.unshift = function (d) { var n = { data: d, next: this.head }; 0 === this.length && (this.tail = n); this.head = n; ++this.length; };
      p.shift   = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length && (this.head = this.tail = null), (this.head = this.head.next), --this.length, d; } };
    },
    382: function (e) {
      function n() { this.head = null; this.tail = null; this.length = 0; }
      var p = n.prototype;
      p.push    = function (d) { var t = { data: d, next: null }; this.length > 0 ? (this.tail.next = t) : (this.head = t); this.tail = t; ++this.length; };
      p.unshift = function (d) { var t = { data: d, next: this.head }; 0 === this.length && (this.tail = t); this.head = t; ++this.length; };
      p.shift   = function () { if (0 !== this.length) { var d = this.head.data; return 1 === this.length && (this.head = this.tail = null), (this.head = this.head.next), --this.length, d; } };
      e.exports = n;
    },
  },
]);
eval(fs.readFileSync(path.join(__dirname, "vendor.chunk.js"), "utf-8"));

// 精确复制 qqmusic_api.js 的激活方式
const wp = global.window.__webpack_require__;
if (wp && wp.m) {
  Object.keys(wp.m).forEach(function (id) { try { wp(id); } catch (_) {} });
}

// 输出结果
console.log("_getSecuritySign:", typeof global.window._getSecuritySign);
console.log("_getSecuritySign2:", typeof global.window._getSecuritySign2);
console.log("__cgiEncrypt:", typeof global.window.__cgiEncrypt);
console.log("__cgiDecrypt:", typeof global.window.__cgiDecrypt);

// 能调 encrypt 吗？
if (global.window.__cgiEncrypt) {
  global.window.__cgiEncrypt('{"test":"hello"}').then(function(r) {
    console.log("encrypt result:", r);
  });
}
