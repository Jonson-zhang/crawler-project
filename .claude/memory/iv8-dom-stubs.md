---
name: iv8-dom-stubs
description: iv8 真实 DOM 方法校验参数类型，VMP 调用 removeChild/appendChild 会报 TypeError —— 必须提前 stub
metadata:
  type: project
---

# iv8 的 DOM API 必须在加载 VMP 前 stub

## 问题

小红书 VMP 字节码解释器在初始化时会调用 `removeChild()`、`appendChild()`、`insertAdjacentElement()` 等 DOM 方法。在 Node.js `env.js` 中这些方法被定义为 `noop`（空函数），所有参数都接受。

但在 iv8 中，这些是**真实的 C++ DOM API**，会校验参数类型：

```
TypeError: Failed to execute 'removeChild' on 'Node': Parameter 1 is not of type 'Node'
```

VMP 传的是一般 JS 对象而不是真实 `Node` 实例 → 整个 VMP 初始化失败 → `mnsv2: undefined`。

## 解决

在加载 VMP 解释器（`ds_script.js`）**之前**，覆盖所有 VMP 可能调用的 DOM 方法为 noop：

```python
_DOM_STUBS_JS = """(function() {
    var noop = function() {};
    var stubElement = function(tag) {
        return {
            tagName: (tag || '').toUpperCase(), style: {}, className: '',
            appendChild: noop, removeChild: noop, setAttribute: noop,
            getAttribute: function() { return null; },
            insertAdjacentElement: noop, addEventListener: noop,
            offsetWidth: 1920, offsetHeight: 1080,
            getBoundingClientRect: function() {
                return {top:0,left:0,width:1920,height:1080,right:1920,bottom:1080};
            },
        };
    };
    document.createElement = function(tag) { return stubElement(tag); };
    document.getElementsByTagName = function() { return []; };
    document.querySelector = function() { return null; };
    document.getElementById = function() { return null; };
    document.addEventListener = noop;
    try { Object.defineProperty(document, 'body', {
        get: function() { return stubElement('body'); }, configurable: true
    }); } catch(e) {}
})();"""
```

stub 只覆盖 VMP 会摸到的属性（`tagName`/`style`/`className`/`offsetWidth`），不需要全量补齐——那些 iv8 真实 DOM 仍然可靠。

## 为什么 iv8 的真实 DOM 不能直接用

VMP 的代码不是浏览器写的——它来自逆向提取，`new env[i]()` 构造的"假 DOM 对象"没有原型链继承自 `Node`，`instanceof Node` 为 `false`。iv8 的 C++ `removeChild()` 做了 `IsNode()` 检查，直接抛 TypeError。

Node.js `env.js` 之所以没这个问题，是因为整个 DOM 对象树都是手写 stub 的 POJO，`removeChild = function(){}` 什么都不校验。

## 踩坑记录

2026-06-27 小红书 iv8 迁移：VMP 加载成功（`_AUuXfEG27Xa3x: function`）但 `mnsv2: undefined`，排查发现 `removeChild` 在校验参数类型，文档 `.createElement` 和 `.documentElement` 被 iv8 真实 DOM 接管。

**Why:** iv8 的真实 DOM 方法校验参数类型，VMP 传的不是 Node 实例会抛 TypeError，整个初始化失败。
**How to apply:** 加载 VMP 代码前，先把 `document.createElement`/`document.body`/`document.documentElement` 等覆盖为 POJO stub。
