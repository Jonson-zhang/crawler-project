---
name: iv8-self-contained
description: iv8/补环境方案的每个站点目录必须自包含，SDK 文件全部复制到本目录，不跨目录引用
metadata:
  type: feedback
---

# iv8/补环境 目录自包含规则

## 核心规则

**每个站点的生产目录必须完全自包含。** 所有 SDK 文件（JS 文件、remote modules、数据文件）都必须复制到本站点目录下，不允许通过相对路径引用其他站点目录的资源。

## 为什么

1. **目录可独立部署**：复制整个文件夹即可运行，无需爬路径链
2. **版本隔离**：CDN SDK 随时更新，旧站点不受影响
3. **避免修改扩散**：改本站点文件不影响其他站点

## 目录结构

```
站点/方案/
├── *.py              # Python 入口和签名逻辑
├── *.js              # SDK 原始文件 (复制品，非引用)
├── data/             # 如果有多版本数据文件
│   ├── v1/
│   └── v2/
└── README.md
```

## 错误示例

```python
# ❌ 从一个项目引用另一个目录的 SDK 文件
SDK_DIR = BASE_DIR.parent / "v1.0"

# ❌ 从上上级目录引用 env_patch
const { setupEnv } = require("../../.claude/env-patch/env_patch.js");
```

## 正确示例

```python
# ✅ SDK 文件在本目录内
SDK_DIR = BASE_DIR

# ✅ 每个站点独立复制一份 SDK 文件
cp ../../cdn/acrawler.js ./ 
```

## 适用场景

- iv8 方案的 SDK 文件（acrawler.js / sdk-glue.js / bdms.js 等）
- env_patch 方案的 SDK 文件（02_code.js 等）
- 远程模块文件（config_24.js / strategy_24.js 等）
- 浏览器导出的 cookies.json / data 目录

**Why:** 今日头条项目中 `iv8/toutiao_iv8.py` 最初通过 `SDK_DIR = BASE_DIR.parent / "v1.0"` 引用了上层目录。用户明确指出：必须复制到自己目录，不跨目录复用。
**How to apply:** 新建站点目录后，先把 SDK 文件 cp 进来，再写代码。
