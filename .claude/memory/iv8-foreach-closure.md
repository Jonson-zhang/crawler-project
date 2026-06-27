---
name: iv8-foreach-closure
description: VMP setter 拦截必须用 .forEach() 而非 for 循环 —— var 声明在迭代间共享闭包，导致所有拦截器共享一组 _ra/_oa
metadata:
  type: project
---

# VMP setter 拦截：必须用 .forEach() 而非 for + var

## 问题

小红书 ds_v2.js 加载时会覆盖 `_AUuXfEG27Xa3x`，触发 setter 拦截。拦截需要为每个 VMP 候选函数创建独立的 `_ra` / `_oa` 备份。

### 错误写法（for + var）

```javascript
var names = Object.getOwnPropertyNames(window);
for (var i = 0; i < names.length; i++) {
    var val = window[names[i]];
    if (typeof val !== 'function' || val.toString().length <= 100000) continue;
    var _ra, _oa = val;  // ⚠️ 所有迭代共享同一个 _ra/_oa！
    Object.defineProperty(window, names[i], {
        get: function() { return _ra || _oa; },      // 最后一个覆盖的值
        set: function(fn) {
            if (typeof fn === 'function' && fn.toString().length > 100000) {
                _ra = function(bc, env) { ... };      // 覆盖所有拦截器
            } else { _oa = fn; }
        }
    });
}
```

JavaScript `var` 没有块级作用域 → 所有迭代的 `_ra` / `_oa` 是**同一个变量** → 最后一个 defineProperty 操作覆盖所有前面的。

### 正确写法（forEach + var）

```javascript
Object.getOwnPropertyNames(window).forEach(function(name) {
    var val = window[name];
    if (typeof val !== 'function' || val.toString().length <= 100000) return;
    var _ra, _oa = val;  // ✅ 每次回调有独立的闭包
    Object.defineProperty(window, name, {
        get: function() { return _ra || _oa; },
        set: function(fn) {
            if (typeof fn === 'function' && fn.toString().length > 100000) {
                _ra = function(bc, env) {
                    for (var j = 0; j < 200; j++) {
                        if (env[j] === undefined) {
                            var s = function() {};
                            s.prototype = {};
                            env[j] = s;
                        }
                    }
                    return fn.call(window, bc, env);
                };
            } else { _oa = fn; }
        },
        configurable: true, enumerable: true,
    });
});
```

`.forEach()` 的每次回调函数是一个独立的作用域 → 每个 `var _ra, _oa` 是回调函数的局部变量 → setter/getter 闭包引用对应的局部变量 → 互不干扰。

## 为什么 Node.js 中 `for` 循环没问题

Node.js 的 `sign.js` 中同样用了 `for` 循环 + `var`，但因为**只有一个 VMP 候选函数**（`_AUuXfEG27Xa3x`），共享闭包不影响结果。当 IV8 中扫出多个超过 100K 的函数时才会暴露。

iv8 中如果有多个 VMP 候选（`ds_script.js` + `ds_v2.js` 各定义一个 100K+ 函数），`for` 循环的闭包共享问题就会显现。

## 踩坑记录

2026-06-27 小红书 iv8 迁移：VMP interception 日志显示 `_AUuXfEG27Xa3x:plain:51642`，ds_v2 赋值 51KB 函数时**未触发包装**（应该走 `> 100000` 分支 → `wrapped`）。根因是 `for` 循环中最后一个 defineProperty 覆盖了 `_ra/_oa`，ds_v2 对 `_AUuXfEG27Xa3x` 的 setter 操作在错误的闭包中，条件判断失效。

**Why:** `var` 没有块级作用域，for 循环中所有迭代共享同一个 `_ra/_oa`。`let` 或 `.forEach()` 回调可解决。
**How to apply:** VMP setter 拦截代码统一用 `Object.getOwnPropertyNames(window).forEach(function(name) {...})` 模式。
