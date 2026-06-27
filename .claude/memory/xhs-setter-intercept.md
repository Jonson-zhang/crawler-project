---
name: xhs-setter-intercept
description: VMP env slot 预填充 — setter 拦截解决 undefined is not a constructor
metadata:
  type: project
---

# VMP env slot 预填充

## 问题

VMP 字节码升级时，解释器 `new env[i]()` 构造对象。
env 数组中有空 slot (undefined) → `undefined is not a constructor`。

## 解决

```javascript
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  set: function (fn) {
    // fn.toString().length > 100000 识别 VMP 升级函数
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        for (var i = 0; i < 200; i++)
          if (env[i] === undefined) { var s = function(){}; s.prototype={}; env[i]=s; }
        return fn.call(window, bc, env);
      };
    }
  }
});
```

## 关键点

- `toString().length > 100000` — VMP 混淆函数远超普通函数长度
- `env[i] = function(){}` — 必须是可构造的函数，不是普通对象
- 200 个 slot — 保守覆盖，不够再加
- 在加载 ds_v2.js **之前** 实施

## 适用范围

任何通过 `Object.defineProperty` + setter 拦截来修补 VMP 解释器 env 数组缺口的场景。

> **iv8 迁移注意**：在 iv8 中此技巧需配合 `.forEach()` 闭包隔离使用，见 [[iv8-foreach-closure]]。iv8 中还需额外处理 DOM stub（[[iv8-dom-stubs]]）和作用域隔离（[[iv8-iife-scope]]）。

**Why:** 直接加载 ds_v2.js 会因 VMP `new env[i]()` 报 undefined is not a constructor。
**How to apply:** 找到 VMP 升级函数对应的全局属性名 → Object.defineProperty setter 拦截 → 预填充 env slot。
