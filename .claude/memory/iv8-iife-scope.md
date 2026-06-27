---
name: iv8-iife-scope
description: iv8 全局作用域 vs Node.js require 模块作用域 —— VMP 变量覆盖导致解码失败，必须 IIFE 隔离
metadata:
  type: project
---

# iv8 中 VMP 解释器必须 IIFE 隔离作用域

## 问题

小红书签名依赖三层 JS：

```
ds_script.js  → require()  → 闭包持有 _0xe762c0(_0x5ae8 字符串表)
ds_api.js     → eval()     → 覆盖全局 _0xe762c0
ds_v2.js      → eval()     → 再次覆盖全局 _0xe762c0
```

Node.js 中：
- `ds_script.js` 通过 `require("./ds_script")` 加载 → **CommonJS 模块作用域**
- 内部的 `var _0xe762c0` 是模块局部变量
- `eval(ds_api)` / `eval(ds_v2)` 是全局作用域
- 三者的 `_0xe762c0` 互不干扰

iv8 中：
- 所有代码运行在**同一个全局作用域**
- `eval(ds_script)` → `_0xe762c0` 挂 window
- `eval(ds_api)` → 覆盖 `window._0xe762c0`
- `eval(ds_v2)` → 再覆盖
- VMP 闭包中引用的是**最后一个覆盖的值** → 字符串解码乱码 → 整个 VMP 解释失败 → `mnsv2: undefined`

## 症状

```
_AUuXfEG27Xa3x: function   ✅ VMP 函数存在
_AUuXfEG27Xa3x size: 51642 ✅ ds_v2 覆盖完成
mnsv2: undefined           ❌ VMP 执行失败（无声）
```

无报错、无异常——VMP 内部静默失败，结果不创建 `mnsv2`。

## 解决

将 `ds_script.js` 包裹在 IIFE 中，模拟 `require()` 的模块作用域：

```python
# ✅ IIFE 隔离 — 模拟 Node.js require 模块作用域
ctx.eval("(function(){" + ds_script_content + "})();")
# 内部 var _0xe762c0 等自动成为局部变量
# glb = window; window._AUuXfEG27Xa3x = ... 仍然挂全局
```

ds_script.js 内部的关键行：
```javascript
var glb = typeof window == 'undefined' ? global : window;
glb['_AUuXfEG27Xa3x'] = function(...) { ... };  // 这个赋值不受 IIFE 影响
```

IIFE 只隔离了 `var` 声明的内部变量（字符串表、辅助函数），`glb.xxx = ` 的赋值仍然能到达 `window`。

## 与 Node.js 的差异对比

| | Node.js | iv8 |
|---|---------|-----|
| ds_script 加载方式 | `require("./ds_script")` | `eval(ds_content)` |
| 作用域 | CommonJS 模块（局部） | 全局 window |
| `_0xe762c0` 生命周期 | 模块内持久 | 被后续 eval 覆盖 |
| 修复方式 | 默认 OK | IIFE 包裹 `(function(){...})()` |

## 踩坑记录

2026-06-27 小红书 iv8 迁移：VMP 函数存在但 `mnsv2` 始终 `undefined`。追踪发现在 `ds_v2.js` eval 后 `_0xe762c0` 被覆盖，VMP 闭包持有的引用指向错误字符串表 → 字节码解码乱码 → 静默失败。

**Why:** iv8 没有模块系统，所有 `var` 声明都在全局作用域。ds_v2 的字符串表覆盖了 ds_script 的 → VMP 闭包引用错误。
**How to apply:** 任何在 Node.js 中通过 `require()` 加载的 JS 文件（尤其是 VMP 解释器），在 iv8 中必须用 `(function(){...})()` IIFE 包裹以隔离作用域。
