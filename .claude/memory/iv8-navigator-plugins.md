---
name: iv8-navigator-plugins
description: navigator.plugins 在 iv8 C++ 中默认有真实值，VMP 检测 plugins.length 会走不同分支，必须显式设为空数组匹配 env.js
metadata:
  type: project
---

# iv8 的 navigator.plugins 必须显式覆盖为空数组

## 问题

小红书 VMP 会检测 `navigator.plugins.length` 来判断运行环境。在真实 Chrome 浏览器中：

```javascript
navigator.plugins.length  // → 5 (Chrome PDF Viewer, Chrome PDF Plugin 等)
```

Node.js `env.js` 中设置为空数组：
```javascript
Navigator.prototype.plugins = [];  // → length = 0
```

iv8 C++ 层的 `navigator` 默认**包含真实的浏览器插件列表**（与 Chrome 一致，~5 个插件）。VMP 检测到 `plugins.length > 0` 会走与 `env.js` 不同的代码分支 → VMP 操作与预期不符 → 静默失败。

## 解决

在 iv8 `environment` 配置中显式覆盖：

```python
environment = {
    "navigator": {
        "userAgent": UA,
        "platform": "Win32",
        "webdriver": False,
        "plugins": [],       # ⚠️ 必须显式设为空数组
        "mimeTypes": [],     # ⚠️ 同上
    },
}
```

不设的话 iv8 默认值是 Chrome 的真实插件集合 → `navigator.plugins.length` ≠ 0 → VMP 不同分支。

## 为什么 env.js 没问题

env.js 中 `navigator` 对象是**完全手写**的，原型链上的 `plugins` 由开发者主动设为 `[]`：

```javascript
Navigator.prototype.plugins = [];
```

iv8 的 navigator 由 C++ 构造，原型链上 `plugins` 来自真实 Chrome 实现。**iv8 的 `environment` dict 只覆盖用户显式指定的属性**，未指定的仍保持 C++ 默认值。

## 踩坑记录

2026-06-27 小红书 iv8 迁移：`navigator.plugins` 非根因。最终修复了三个 bug 才让 iv8 自举成功：
1. Python `if body`（空 dict falsy）vs JS truthy → `if body is not None`
2. `_json_to_bytes(json.dumps(...))` 双重 JSON 编码 → 直接传 dict
3. `document` 不可全局替换 → `Object.defineProperty` 覆盖 getter

**Why:** iv8 C++ 层 navigator 默认包含真实 Chrome 插件。VMP 环境检测读 `navigator.plugins.length` 来判断是否在目标环境。
**How to apply:** 任何依赖 `navigator.plugins` / `navigator.mimeTypes` 做环境判断的站点，iv8 environment 中必须显式覆盖这些属性，否则与 env.js 行为不一致。
