---
name: env-sign-separation
description: env.js 补环境 + sign.js 签名 分离架构
metadata:
  type: project
---

# env.js / sign.js 分离架构

## 模式

```
main.py
  │  subprocess.run(["node", "sign.js"], input=JSON)
  ▼
sign.js                          ← 签名入口（Python 唯一调用的 JS 文件）
  │  require("./env")            ← 一行引入补环境
  │  sign(url, d_c0)             ← 纯签名逻辑
  │  stdout → JSON               ← 输出给 Python
  │
  ▼
env.js                           ← 补环境模块（独立文件，可替换）
  ├── sandbox 定义 (window/document/navigator/location/...)
  ├── vm.createContext
  ├── 加载站点 webpack chunk (runtime/vendor/主chunk)
  └── module.exports = { ctx, wp, s }
```

## 规则

- **补环境代码全部放 `env.js`**，不混在 `sign.js` 里
- **`sign.js` 只管签名/加密逻辑**，`require("./env")` 一行引入环境
- **Python 只调 `sign.js`**，不直接调 `env.js`
- **VSCode `80001` hint（CommonJS→ESM 提示）可以忽略**，`sign.js` / `env.js` 是 Node CLI 入口，保持 CommonJS

## 为什么

- 补环境出问题时只改 `env.js`，签名逻辑出问题时只改 `sign.js`，互不干扰
- 同一站点的不同签名函数（如 zse + 其他）可以共用同一个 `env.js`
- 方便以后替换补环境方案（如手写 stub → XBS 框架），只需换 `env.js`，`sign.js` 和 `main.py` 不动

**How to apply:** 每个新站点按此模式建目录：`env.js` + `sign.js` + `main.py`，不要把所有代码写在一个 `sign.js` 里。
