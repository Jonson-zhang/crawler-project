# 原型链补环境方法论

## 为什么需要原型链补环境

VMP（虚拟机保护）字节码解释器会检测环境质量：

1. **`typeof` 检测** — 必须返回与浏览器完全一致的结果
2. **原型链检测** — `navigator instanceof Object` 必须是 `true`
3. **`toString` 检测** — 内置函数的 `toString()` 必须返回 `function xxx() { [native code] }`
4. **构造函数检测** — `new MutationObserver()` 必须产生正确的实例

简单 `Object.assign` 或 Proxy 无法通过 VMP 的深度环境校验。

## 核心原则

### 1. 每个浏览器对象都有正确的原型链

```javascript
// ❌ 错误：纯对象，没有原型
const navigator = { userAgent: "Mozilla/5.0" };

// ✅ 正确：基于 Navigator 原型创建
const NavigatorProto = Object.create(Object.prototype);
Object.defineProperty(NavigatorProto, Symbol.toStringTag, { value: "Navigator" });
Object.defineProperty(NavigatorProto, "userAgent", {
    value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    writable: true, configurable: true, enumerable: true,
});
const navigator = Object.create(NavigatorProto);
```

### 2. 所有函数标记 native toString

```javascript
function markNative(fn, name) {
    Object.defineProperty(fn, "toString", {
        value: function() { return "function " + (name || fn.name) + "() { [native code] }"; },
        writable: true, configurable: true, enumerable: false,
    });
    return fn;
}

const noop = markNative(function noop() {}, "noop");
```

### 3. 构造函数使用 fakeCtor 模式

```javascript
function fakeCtor(name, bodyFn) {
    const fn = function() {
        if (!(this instanceof fn))
            throw new TypeError("calling a builtin " + name + " constructor without new is forbidden");
        if (bodyFn) bodyFn.apply(this, arguments);
    };
    Object.defineProperty(fn, "name", { value: name });
    fn.prototype = Object.create(Object.prototype);
    fn.prototype.constructor = fn;
    markNative(fn, name);
    return fn;
}

const MutationObserver = fakeCtor("MutationObserver", function(cb) {
    this._cb = cb;
});
MutationObserver.prototype.observe = markNative(noop, "observe");
```

## 必需的浏览器对象清单

VMP 字节码执行需要的完整 window 属性：

### 第一层：JS 内置（从 Node.js 直接取）

```
Object, Array, Function, String, Number, Boolean, Date, RegExp, Math, JSON,
Error, TypeError, SyntaxError, ReferenceError, RangeError, URIError,
parseInt, parseFloat, isNaN, isFinite,
encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
Float32Array, Float64Array, Uint8ClampedArray, ArrayBuffer, DataView,
Promise, Symbol, Map, Set, WeakMap, WeakSet, Proxy, Reflect
```

### 第二层：浏览器 DOM/BOM

```javascript
navigator: { userAgent, platform, language, languages, webdriver,
             cookieEnabled, plugins(MimeTypeArray), mimeTypes }
screen:   { width, height, colorDepth, availWidth, availHeight }
location: { href, origin, host, hostname, protocol, pathname, port, search, hash }
document: { cookie, createElement, addEventListener, head, body, documentElement,
            createEvent, getElementsByTagName, querySelector, hidden, readyState, visibilityState }
history:  { length, state, pushState, replaceState, back, forward, go }
```

### 第三层：Storage

```javascript
localStorage:  { getItem, setItem, removeItem, clear, key, length }
sessionStorage: 同上
```

### 第四层：构造函数（必须 fakeCtor）

```javascript
MutationObserver:  { observe, disconnect, takeRecords }
Image:             { src, width, height, complete, naturalWidth, onload, onerror }
WebSocket:         { CONNECTING, OPEN, CLOSING, CLOSED, send, close, readyState }
Worker:            { postMessage, terminate, addEventListener }
XMLHttpRequest:    { UNSENT, OPENED, HEADERS_RECEIVED, LOADING, DONE,
                     open, send, setRequestHeader, readyState, status }
Event:             { type, preventDefault, stopPropagation }
CustomEvent:       { detail }
Blob:              { size, text, arrayBuffer }
FileReader:        { readAsDataURL, readAsText, readAsArrayBuffer }
FormData:          { append, delete, get, has }
Headers:           { get, set, has, forEach }
Request:           { url, method, headers }
Response:          { ok, status, json, text }
```

### 第五层：HTML 元素类（VMP 会构造这些）

```javascript
HTMLElement, HTMLCanvasElement, HTMLImageElement, HTMLDivElement,
HTMLSpanElement, HTMLHeadElement, HTMLBodyElement, HTMLInputElement,
HTMLScriptElement
```

### 第六层：其他全局

```javascript
console: { log, error, warn, info, debug, table, trace }
atob, btoa
crypto: require("crypto").webcrypto || require("crypto")
performance: { now, timing, getEntriesByType, mark, measure }
setTimeout, clearTimeout, setInterval, clearInterval
requestAnimationFrame, cancelAnimationFrame
fetch: 返回 { json, text, ok, status }
addEventListener, removeEventListener, dispatchEvent
eval
external: {}, chrome: {}
devicePixelRatio, innerWidth, innerHeight, outerWidth, outerHeight
scrollX, scrollY, pageXOffset, pageYOffset
name, closed, opener
```

### 循环引用

```javascript
win.self = win;
win.window = win;
win.globalThis = win;
win.parent = win;
win.top = win;
document.defaultView = win;

// 脚本检查 typeof window === 'undefined' ? global : window
Object.defineProperty(global, "window", { value: win, writable: true, configurable: true });
```

## 加载顺序

脚本必须严格按顺序加载，每个都传入 `window, global, self` 作为参数：

```
1. ds_loader.js (151KB) — VMP 解释器基础
2. ds_api.js (60KB) — 调用 _BHjFmfUMEtxhI → 创建 __bc 字节码
3. ds_v2.js (62KB) — 调用 _AUuXfEG27Xa3x → mns0201→mns0301 升级
```

无需加载 `sdt_source_init.js`（245KB，它是另一个 VMP 解释器变体，会栈溢出）。

## 常见 env 报错及修复

| 报错 | 原因 | 修复 |
|------|------|------|
| `Cannot read properties of undefined (reading 'apply')` | 环境对象缺少方法 | 补充对应的浏览器对象 |
| `undefined is not a constructor` | VMP 尝试 `new` 一个不存在的构造函数 | 补充对应的 HTMLxxxElement |
| `Bind must be called on a function` | Function.prototype.bind 被覆盖 | 保持原生 bind/call/apply |
| `Maximum call stack size exceeded` | VMP 字节码递归过深 | `--stack-size=65536` 增大 Node 栈 |
| 输出 mns0201 非 mns0301 | ds_v2 覆盖失败 | 检查 `_AUuXfEG27Xa3x` 的 setter 是否被正确触发 |
