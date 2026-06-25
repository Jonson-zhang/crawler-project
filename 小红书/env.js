!function () {
    // 拿原始toString()函数暂存起来
    const $toString = Function.prototype.toString;
    // 函数$callTostring的意思是 - 当调用它的时候就相当于调用原始toString()函数
    const $callTostring = Function.prototype.call.bind($toString);
    // 一个存东西的地方 - memoryMap，是整个所有代码的全局变量
    const memoryMap = new Map();
    // 新的toString()函数 - myToString，目的是调用它的时候返回合适的toString()方法，防止toString()值检测
    const myToString = function toString() {
        return typeof this === 'function' && memoryMap.get(this) || $callTostring(this);
    };
    // 改造原始的Function.prototype.toString()方法
    Object.defineProperty(Function.prototype, "toString", {
        enumerable: false,
        configurable: true,
        writable: true,
        value: myToString
    });
 
    function set_native(obj, value) {
        memoryMap.set(obj, value);
    }
 
    // 保护Function.prototype.toString方法，或者叫native化
    set_native(Function.prototype.toString, "function toString() { [native code] }");
 
    // 保护func的toString方法，或者叫native化
    setNative = function setNative(func, funcname) {
        Object.defineProperty(func, "name", {
            value: funcname || func.name || '',
            writable: false,
            enumerable: false,
            configurable: true
        });
        set_native(func, `function ${funcname || func.name || ''}() { [native code] }`);
    };
}();
// === 修复版 watch 函数 ===
function watch(func, name) {
  // &#128295; 确保 name 是有效的字符串（避免 undefined 或 null）
  const objName = name || 'unknown';
 
  // &#128295; 修复：定义 console_log 函数（或使用 console.log）
  const console_log = (...args) => console.log(...args);
 
  return new Proxy(func, {
    get(target, p, receiver) {
      try {
        // &#128295; 修复：正确处理 Symbol 类型的属性名
        const propKey = typeof p === 'symbol' ? p.toString() : p;
 
        // &#128295; 修复：检查 p 是否为 Math 或 isNaN（字符串比较）
        if (propKey === 'Math' || propKey === 'isNaN') {
          return Reflect.get(target, p, receiver);
        } else {
          if (propKey === 'hasOwnProperty') {
            // debugger; // &#128295; 可选：保留调试断点（注释掉以避免中断）
          }
           
          // &#128295; 特殊处理 crypto，直接返回原生对象，不经过 Proxy
          if (propKey === 'crypto') {
            return globalThis.crypto;
          }
 
          const val = Reflect.get(target, p, receiver);
 
          // &#128295; 修复：记录取值操作，格式化输出
          console_log('取值:', `${objName}.${propKey}`, '=>', val);
 
          return val;
        }
      } catch (e) {
        // &#128295; 修复：异常处理（原代码空 catch）
        console.error(`[watch/get] 错误访问 ${objName}.${String(p)}:`, e);
        // &#128295; 修复：异常时仍需返回值，而不是 undefined
        return Reflect.get(target, p, receiver); // 尝试返回原始值
      }
    },
 
    set(target, p, value, receiver) {
      try {
        // &#128295; 修复：原代码在 set 中又调用了 Reflect.get，逻辑错误
        // 正确做法：先记录设置操作，再执行 Reflect.set
 
        const propKey = typeof p === 'symbol' ? p.toString() : p;
        const currentValue = Reflect.get(target, p, receiver); // 获取当前值
 
        console_log('设置值:', `${objName}.${propKey}`, currentValue, '=>', value);
 
        // &#128295; 修复：正确执行设置操作
        return Reflect.set(target, p, value, receiver);
      } catch (e) {
        // &#128295; 修复：异常处理
        console.error(`[watch/set] 错误设置 ${objName}.${String(p)} = ${value}:`, e);
        // &#128295; 修复：设置失败时返回 false
        return false;
      }
    },
 
    // &#128295; 可选：添加 apply 拦截器（如果 func 是函数）
    apply(target, thisArg, argumentsList) {
      console_log('函数调用:', `${objName}(...)`, 'with args:', argumentsList);
      return Reflect.apply(target, thisArg, argumentsList);
    },
 
    // &#128295; 可选：添加 construct 拦截器（如果 func 是构造函数）
    construct(target, argumentsList, newTarget) {
      console_log('构造函数调用:', `new ${objName}(...)`, 'with args:', argumentsList);
      return Reflect.construct(target, argumentsList, newTarget);
    }
  });
}
 
// === 使用示例 ===
/*
// 示例 1: 监控一个对象
const obj = { x: 1, y: 2 };
const watchedObj = watch(obj, 'myObject');
console.log(watchedObj.x); // 输出: 取值: myObject.x => 1
watchedObj.z = 3;          // 输出: 设置值: myObject.z undefined => 3
 
// 示例 2: 监控一个函数
const myFunc = function(a, b) { return a + b; };
const watchedFunc = watch(myFunc, 'addFunction');
watchedFunc(1, 2);         // 输出: 函数调用: addFunction(...) with args: [1, 2]
 
// 示例 3: 监控 Math 对象的特定方法
const watchedMath = watch(Math, 'Math');
console.log(watchedMath.PI); // 输出: 取值: Math.PI => 3.141592653589793
*/
window=globalThis
 
function EventTarget(){}
function Document(){}
function HTMLHtmlElement(){}
function Navigator(){}
function Location(){}
function Screen(){}
function History(){}
function Storage(){}
function Performance(){}
function XMLHttpRequest(){}
function CanvasRenderingContext2D(){}
function HTMLCanvasElement(){}
function HTMLElement(){}
 
setNative(EventTarget,'EventTarget')
setNative(Document,'Document')
setNative(HTMLHtmlElement,'HTMLHtmlElement')
setNative(Navigator,'Navigator')
setNative(Location,'Location')
setNative(Screen,'Screen')
setNative(History,'History')
setNative(Storage,'Storage')
setNative(Performance,'Performance')
setNative(XMLHttpRequest,'XMLHttpRequest')
setNative(CanvasRenderingContext2D,'CanvasRenderingContext2D')
setNative(HTMLCanvasElement,'HTMLCanvasElement')
setNative(HTMLElement,'HTMLElement')
 
document=watch(new Document(),'document')
Document.prototype.addEventListener=function(){}
 
Object.defineProperty(Document.prototype, 'cookie', {
    get: function() {
        return 'abRequestId=bc87e19f-1473-5802-857f-aa14072c42f5; a1=197c660cf2d0j0l1bdwbkv2cyce6csd6n3v6nths750000683082; webId=c09b78e6b3cb4b550c9d51b97c057cd0; gid=yjWSKK8f0jIdyjWSKK8Siq9xJf8V81yDfEDThMWhJSvSdK28KSMfKI888KYq8YJ88SyyYWqJ; xsecappid=xhs-pc-web; ets=1775377444539; webBuild=6.7.0; loadts=1776689467785; unread={%22ub%22:%2269d63940000000001b0206cf%22%2C%22ue%22:%2269db583e000000001f00105f%22%2C%22uc%22:24}; websectiga=7750c37de43b7be9de8ed9ff8ea0e576519e8cd2157322eb972ecb429a7735d4; sec_poison_id=4e4a9eab-d586-4ce8-ab46-4095b5cf9e04';
    },
    set: function(value) {
        console.log('设置cookie:', value);
    },
    enumerable: true,
    configurable: true
});
 
function HTMLElement(){}
setNative(HTMLElement,'HTMLElement')
 
HTMLElement.prototype.offsetWidth=1920
HTMLElement.prototype.offsetHeight=1080
HTMLElement.prototype.clientWidth=1920
HTMLElement.prototype.clientHeight=1080
HTMLElement.prototype.style={}
HTMLElement.prototype.className=''
HTMLElement.prototype.id=''
HTMLElement.prototype.innerHTML=''
HTMLElement.prototype.textContent=''
HTMLElement.prototype.appendChild=function(){}
HTMLElement.prototype.removeChild=function(){}
HTMLElement.prototype.setAttribute=function(){}
HTMLElement.prototype.getAttribute=function(attr){return null}
HTMLElement.prototype.getBoundingClientRect=function(){
    return {
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        right: 1920,
        bottom: 1080
    }
}
setNative(HTMLElement.prototype.appendChild,'appendChild')
setNative(HTMLElement.prototype.removeChild,'removeChild')
setNative(HTMLElement.prototype.setAttribute,'setAttribute')
setNative(HTMLElement.prototype.getAttribute,'getAttribute')
setNative(HTMLElement.prototype.getBoundingClientRect,'getBoundingClientRect')
 
HTMLHtmlElement.prototype=new HTMLElement()
setNative(HTMLHtmlElement,'HTMLHtmlElement')
 
document.documentElement=watch(new HTMLHtmlElement(),'document.documentElement')
 
navigator=watch(new Navigator(),'navigator')
Navigator.prototype.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
Navigator.prototype.appVersion='5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
Navigator.prototype.platform='Win32'
Navigator.prototype.language='zh-CN'
Navigator.prototype.languages=['zh-CN','zh','en']
Navigator.prototype.cookieEnabled=true
Navigator.prototype.webdriver=false
 
location=watch(new Location(),'location')
Location.prototype.href='https://www.xiaohongshu.com/'
Location.prototype.protocol='https:'
Location.prototype.host='www.xiaohongshu.com'
Location.prototype.hostname='www.xiaohongshu.com'
Location.prototype.port=''
Location.prototype.pathname='/'
Location.prototype.search=''
Location.prototype.hash=''
Location.prototype.origin='https://www.xiaohongshu.com'
 
screen=watch(new Screen(),'screen')
Screen.prototype.width=1920
Screen.prototype.height=1080
Screen.prototype.availWidth=1920
Screen.prototype.availHeight=1040
Screen.prototype.colorDepth=24
Screen.prototype.pixelDepth=24
 
history=watch(new History(),'history')
History.prototype.length=1
History.prototype.pushState=function(){}
History.prototype.replaceState=function(){}
History.prototype.back=function(){}
History.prototype.forward=function(){}
History.prototype.go=function(){}
setNative(History.prototype.pushState,'pushState')
setNative(History.prototype.replaceState,'replaceState')
 
localStorage=watch(new Storage(),'localStorage')
sessionStorage=watch(new Storage(),'sessionStorage')
Storage.prototype.getItem=function(key){return null}
Storage.prototype.setItem=function(key,value){}
Storage.prototype.removeItem=function(key){}
Storage.prototype.clear=function(){}
Storage.prototype.length=0
Storage.prototype.key=function(index){return null}
setNative(Storage.prototype.getItem,'getItem')
setNative(Storage.prototype.setItem,'setItem')
setNative(Storage.prototype.removeItem,'removeItem')
setNative(Storage.prototype.clear,'clear')
setNative(Storage.prototype.key,'key')
 
performance=watch(new Performance(),'performance')
Performance.prototype.now=function(){return Date.now()}
Performance.prototype.timing={
    navigationStart: Date.now(),
    fetchStart: Date.now(),
    domainLookupStart: Date.now(),
    domainLookupEnd: Date.now(),
    connectStart: Date.now(),
    connectEnd: Date.now(),
    requestStart: Date.now(),
    responseStart: Date.now(),
    responseEnd: Date.now(),
    domLoading: Date.now(),
    domInteractive: Date.now(),
    domContentLoadedEventStart: Date.now(),
    domContentLoadedEventEnd: Date.now(),
    domComplete: Date.now(),
    loadEventStart: Date.now(),
    loadEventEnd: Date.now()
}
setNative(Performance.prototype.now,'now')
 
XMLHttpRequest.prototype.open=function(){}
XMLHttpRequest.prototype.send=function(){}
XMLHttpRequest.prototype.setRequestHeader=function(){}
XMLHttpRequest.prototype.getResponseHeader=function(){return null}
XMLHttpRequest.prototype.getAllResponseHeaders=function(){return ''}
XMLHttpRequest.prototype.abort=function(){}
XMLHttpRequest.prototype.readyState=0
XMLHttpRequest.prototype.status=0
XMLHttpRequest.prototype.responseText=''
XMLHttpRequest.prototype.responseXML=null
XMLHttpRequest.DONE=4
setNative(XMLHttpRequest.prototype.open,'open')
setNative(XMLHttpRequest.prototype.send,'send')
setNative(XMLHttpRequest.prototype.setRequestHeader,'setRequestHeader')
 
HTMLCanvasElement.prototype.getContext=function(type){
    if(type==='2d'){
        return new CanvasRenderingContext2D()
    }
    return null
}
setNative(HTMLCanvasElement.prototype.getContext,'getContext')
 
CanvasRenderingContext2D.prototype.fillText=function(){}
CanvasRenderingContext2D.prototype.measureText=function(text){
    return {width: text.length * 10}
}
CanvasRenderingContext2D.prototype.createLinearGradient=function(){
    return {
        addColorStop: function(){}
    }
}
CanvasRenderingContext2D.prototype.fillRect=function(){}
CanvasRenderingContext2D.prototype.clearRect=function(){}
CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h){
    return {
        data: new Uint8ClampedArray(w * h * 4)
    }
}
CanvasRenderingContext2D.prototype.toDataURL=function(){return 'data:image/png;base64,test'}
setNative(CanvasRenderingContext2D.prototype.fillText,'fillText')
setNative(CanvasRenderingContext2D.prototype.measureText,'measureText')
setNative(CanvasRenderingContext2D.prototype.createLinearGradient,'createLinearGradient')
setNative(CanvasRenderingContext2D.prototype.fillRect,'fillRect')
setNative(CanvasRenderingContext2D.prototype.clearRect,'clearRect')
setNative(CanvasRenderingContext2D.prototype.getImageData,'getImageData')
 
document.body=watch(new HTMLElement(),'document.body')
document.head=watch(new HTMLElement(),'document.head')
 
document.createElement=function(tagName){
    return new HTMLElement()
}
document.getElementById=function(id){
    return new HTMLElement()
}
document.getElementsByClassName=function(className){
    return []
}
document.getElementsByTagName=function(tagName){
    return []
}
document.querySelector=function(selector){
    return new HTMLElement()
}
document.querySelectorAll=function(selector){
    return []
}
setNative(document.createElement,'createElement')
setNative(document.getElementById,'getElementById')
setNative(document.getElementsByClassName,'getElementsByClassName')
setNative(document.getElementsByTagName,'getElementsByTagName')
setNative(document.querySelector,'querySelector')
setNative(document.querySelectorAll,'querySelectorAll')
 
window.document=document
window.navigator=navigator
window.location=location
window.screen=screen
window.history=history
window.localStorage=localStorage
window.sessionStorage=sessionStorage
 
// 使用 Node.js 原生 crypto，不覆盖
if (typeof globalThis.crypto === 'undefined') {
    const crypto_module = require('crypto');
    window.crypto = {
        getRandomValues: function(arr) {
            const bytes = crypto_module.randomBytes(arr.length);
            for (let i = 0; i < arr.length; i++) {
                arr[i] = bytes[i];
            }
            return arr;
        },
        subtle: globalThis.crypto?.subtle || null
    };
} else {
    window.crypto = globalThis.crypto;
}
 
window.performance=performance
window.XMLHttpRequest=XMLHttpRequest
window.EventTarget=EventTarget
window.Document=Document
window.HTMLElement=HTMLElement
window.HTMLCanvasElement=HTMLCanvasElement
window.CanvasRenderingContext2D=CanvasRenderingContext2D
 
window.setTimeout=setTimeout
window.setInterval=setInterval
window.clearTimeout=clearTimeout
window.clearInterval=clearInterval
window.Date=Date
window.Math=Math
window.JSON=JSON
window.parseInt=parseInt
window.parseFloat=parseFloat
window.isNaN=isNaN
window.encodeURIComponent=encodeURIComponent
window.decodeURIComponent=decodeURIComponent
window.btoa=function(str){return Buffer.from(str).toString('base64')}
window.atob=function(str){return Buffer.from(str,'base64').toString()}
window.addEventListener = function() {}
window.MouseEvent = function() {}
 
// 最后再 watch window，避免代理内置对象时报错
window = watch(window, 'window')
 
console.log("&#9989; 基础环境补充完成")
