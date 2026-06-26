# 原型链补环境方法论

## 为什么需要原型链补环境

VMP（虚拟机保护）字节码解释器会检测环境质量：

1. **`typeof` 检测** — 必须返回与浏览器完全一致的结果
2. **原型链检测** — `navigator instanceof Object` 必须是 `true`
3. **`toString` 检测** — 内置函数的 `toString()` 必须返回 `function xxx() { [native code] }`
4. **构造函数检测** — `new MutationObserver()` 必须产生正确的实例

简单 `Object.assign` 或 Proxy 无法通过 VMP 的深度环境校验。

## 核心原则

### 1. window = globalThis

**不要创建隔离对象。** 直接把 Node.js 全局当 window：

```javascript
window = globalThis;
global.window = window;
global.self = window;
```

这确保 VMP 能正确访问 `parseInt`、`encodeURIComponent` 等内置函数。

### 2. Native toString 保护

```javascript
const memoryMap = new Map();
const rawToString = Function.prototype.toString;
Function.prototype.toString = function () {
  return typeof this === "function" && memoryMap.get(this) || rawToString.call(this);
};

function setNative(func, name) {
  Object.defineProperty(func, "name", { value: name, writable: false, enumerable: false, configurable: true });
  memoryMap.set(func, `function ${name}() { [native code] }`);
}
```

### 3. 原型链通过 `new Constructor()` 建立

```javascript
function HTMLElement() {}
HTMLElement.prototype.offsetWidth = 1920;
HTMLElement.prototype.getBoundingClientRect = function () { /* ... */ };

function HTMLHtmlElement() {}
// 🔑 关键：通过 new 建立完整原型链
HTMLHtmlElement.prototype = new HTMLElement();
```

### 4. 构造函数使用空函数 + setNative

```javascript
function Navigator() {}
setNative(Navigator, "Navigator");

navigator = new Navigator();
Navigator.prototype.userAgent = "Mozilla/5.0 ...";
```

## 必需的浏览器对象清单

### JS 内置（从 Node.js 直接取）

```
Object, Array, Function, String, Number, Boolean, Date, RegExp, Math, JSON,
Error, TypeError, SyntaxError, ReferenceError, RangeError, URIError,
parseInt, parseFloat, isNaN, isFinite,
encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
Uint8Array, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array,
Float32Array, Float64Array, Uint8ClampedArray, ArrayBuffer, DataView,
Promise, Symbol, Map, Set, WeakMap, WeakSet, Proxy, Reflect
```

### 浏览器 DOM/BOM（必须原型链 + setNative）

```javascript
navigator: { userAgent, platform, language, languages, webdriver,
             cookieEnabled, plugins, mimeTypes }
screen:   { width, height, colorDepth, availWidth, availHeight }
location: { href, origin, host, hostname, protocol, pathname, port, search, hash }
document: { cookie, createElement, addEventListener, head, body, documentElement,
            getElementById, getElementsByTagName, querySelector, hidden, readyState }
history:  { length, state, pushState, replaceState, back, forward, go }
localStorage / sessionStorage: { getItem, setItem, removeItem, clear, key, length }
performance: { now, timing }
```

### 构造函数

```javascript
MutationObserver, Image, WebSocket, Worker, Event, CustomEvent,
XMLHttpRequest, HTMLElement, HTMLCanvasElement, CanvasRenderingContext2D
```

## 🔑 关键技巧：`_AUuXfEG27Xa3x` setter 拦截

**这是 VMP 字节码升级成功的关键。** ds_v2.js 使用 `_AUuXfEG27Xa3x` 函数
执行 VMP 字节码，将 mns0201 升级为 mns0301。VMP 解释器在执行过程中会
`new env[i]()` 构造 env 数组中的对象——如果数组中有空 slot (undefined)，就会报 `undefined is not a constructor`。

**解决**：在加载 ds_v2.js **之前**，用 `Object.defineProperty` 拦截 `_AUuXfEG27Xa3x` 的 setter：

```javascript
var _ra, _oa = global._AUuXfEG27Xa3x;
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _oa; },
  set: function (fn) {
    // 通过 toString 长度识别 VMP 升级函数（>100K 的混淆函数）
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        // 🔑 预填充 200 个 env slot 为空构造器
        for (var i = 0; i < 200; i++) {
          if (env[i] === undefined) {
            var s = function () {};
            s.prototype = {};
            env[i] = s;
          }
        }
        return fn.call(window, bc, env);
      };
    }
  },
  configurable: true, enumerable: true,
});
eval(fs.readFileSync("data/ds_v2.js", "utf8"));
// 此时 window.mnsv2 已被升级为 mns0301
```

**原理**：
1. ds_v2.js 加载时，内部代码设置 `global._AUuXfEG27Xa3x = some_vmp_function`
2. 我们的 setter 拦截这个赋值，用 `fn.toString().length > 100000` 识别 VMP 升级函数
3. 包装一层：在 VMP 字节码执行前，遍历 env 数组填充所有空 slot
4. VMP 升级完成后，`window.mnsv2` 变成了 mns0301 版本

## 加载顺序

```
env.js → ds_script.js (430KB) → ds_api.js (60KB) → ds_v2.js (62KB)
```

**不是** `ds_loader.js (148KB)`。必须从浏览器 eval 抠出 `ds_script.js` (430KB 合并版)。

## 常见 env 报错及修复

| 报错 | 原因 | 修复 |
|------|------|------|
| `Cannot read properties of undefined (reading 'apply')` | while(!![]) 循环未收敛或环境对象缺失 | 确认 env 对象完整，必要时给 while 循环设上限 |
| `undefined is not a constructor` | VMP env 数组中某 slot 为 undefined | **实施 `_AUuXfEG27Xa3x` setter 拦截 + env 预填充** |
| `Maximum call stack size exceeded` | VMP 字节码递归过深 | `--stack-size=65536` |
| mns0201 而非 mns0301 | ds_v2 覆盖失败 | 检查 setter 拦截是否正确触发 |
| `eval is not a function` | window.eval 被设为 undefined | 保持 `window.eval = eval` |
