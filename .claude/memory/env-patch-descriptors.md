---
name: env-patch-descriptors
description: env_patch 属性描述符对齐 — Navigator/Screen getter 和 Window 状态属性已对齐浏览器不可枚举行为
metadata:
  type: project
---

# env_patch 属性描述符对齐

## 已修复

### #1 Navigator/Screen getter 可枚举性

`_defineGetter` 现使用 `enumerable: false`（对齐浏览器行为）。

```js
// 修复前
Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').enumerable // true

// 修复后
Object.getOwnPropertyDescriptor(navigatorActualProto, 'userAgent').enumerable  // false
```

### #3 Window 状态属性不可枚举

以下属性现设为不可枚举（`_setGlobal(key, value, false)`）：

- 尺寸：`innerWidth`、`innerHeight`、`outerWidth`、`outerHeight`、`devicePixelRatio`
- 坐标：`screenX`、`screenY`、`scrollX`、`scrollY`
- 状态：`name`、`closed`、`length`、`opener`、`origin`、`isSecureContext`
- 函数：`fetch`、`postMessage`、`addEventListener`、`removeEventListener`、`requestAnimationFrame`、`cancelAnimationFrame`、`matchMedia`、`getComputedStyle`、`getSelection`
- 编码：`btoa`、`atob`
- 调试：`console`
- 身份：`window`、`self`、`top`、`parent`（windowToGlobal 下）

## 注意事项

**Node.js 24 有内置 Navigator 类**。`console.log(Navigator)` 会显示 Node.js 内置类（其 prototype 上的 getter 是原生的），但 env_patch 创建的 navigator 实例使用的是文件闭包中的自定义 Navigator，描述符已正确对齐。测试时不要直接检查 `Navigator.prototype`，而应检查 `Object.getPrototypeOf(navigator)`。

## 回归状态

QQ音乐 / 小红书 / 知乎 三个站点签名均正常。
