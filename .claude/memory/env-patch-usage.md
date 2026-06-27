---
name: env-patch-usage
description: 通用补环境框架的使用规范 — env_patch.js 为底座不可改，每个站点写 env_site.js 层叠差异
metadata:
  type: project
---

# env-patch 使用规范

## 核心原则

**`env_patch.js` 是通用框架，不要改。每个站点写自己的 `env_site.js` 做局部覆盖。**

```
.claude/env-patch/env_patch.js     ← 通用底座（不改）
.claude/env-patch/env_site_template.js ← 新站点复制改名
你的站点/env_site.js               ← 站点差异（只写这里）
```

## 三步接入

1. 复制 `.claude/env-patch/env_site_template.js` → 目标目录/`env_site.js`
2. 改 `url`、`userAgent`、`windowToGlobal` 等参数
3. `require("./env_site")` 即可

## 调试流程

站点 JS 报错或签名不匹配时，**在 `env_site.js` 尾部追加覆盖，不改 `env_patch.js`**。

常见追加项：
- `navigator.hardwareConcurrency = 8`
- `document.cookie` getter/setter
- `windowToGlobal: true`（VMP 要求时）
- `额外 require("./env_tweaks")`（复杂覆盖放独立文件）

## 已验证站点

| 站点 | 方式 | 关键参数 |
|------|------|---------|
| QQ音乐 | 纯 env_patch | `windowToGlobal: false` |
| Boss直聘 | 纯 env_patch | `windowToGlobal: true`（vm 沙箱） |
| 小红书 | 纯 env_patch | `windowToGlobal: true` + `watch(window)` |

## 为什么 windowToGlobal 影响 VMP

`windowToGlobal: false` 时 `window !== global`，`window.constructor === Window`，
字节码 VM 的类型检测能正确通过。
`true` 时 `window === global`，`window.constructor === Object`（Node.js global），
VM 内部 `instanceof` 检测失败 → 静默失败。

QQ音乐 vendor.chunk.js 字节码 VM 需要 `false`，Boss直聘 vm 沙箱用 `true` 也能过（因为 Function 构造器隔离了作用域）。

**Why:** env_patch 作为通用框架不能被某个站点的特殊需求污染。所有站点差异通过配置或 env_site.js 覆盖解决。
**How to apply:** 接新站点时先复制模板 → 改配置 → 跑签名。报错就在 env_site.js 追加覆盖，不碰 env_patch.js。
