# QQ音乐 sdenv 逆向方案技术文档

## 概述

| 项目 | 内容 |
|------|------|
| **目标** | QQ音乐榜单 API (`u6.y.qq.com/cgi-bin/musics.fcg`) |
| **保护** | `zzc` 签名 + 请求体加密 + 响应体加密 |
| **方案** | sdenv (C++ V8 Addon + jsdom) |
| **调用方式** | Python → subprocess → Node.js runner.js |

## 原理

sdenv 是 C++ V8 原生插件 + 魔改 jsdom。与 iv8 的区别在于 sdenv 是 Node.js 的 C++ Addon，通过 `subprocess` 调用；iv8 是 Python 的 C++ 扩展，同进程调用。

对于 QQ音乐，sdenv 使用 jsdom 创建完整的 DOM 环境（含真实的 Node/Element/HTMLElement 原型链，以及 Canvas、Location、Navigator 等 API），然后加载 webpack chunk 并调用 sign/encrypt/decrypt。

## 与 env-patch 方案对比

| 维度 | env-patch (`qqmusic_api.js`) | sdenv (`runner.js`) |
|------|------------------------------|---------------------|
| **环境** | global 上补属性 | jsdom 完整 DOM |
| **原型链** | 只有 EventTarget→HTMLElement | Node→Element→HTMLElement 完整链 |
| **Canvas** | stub 空实现 | node-canvas 真实渲染 |
| **性能** | ~200ms | ~200ms (同 subprocess) |

## 与 iv8 方案对比

| 维度 | iv8 | sdenv |
|------|-----|-------|
| **语言** | Python (C++ 扩展) | Node.js (C++ Addon) |
| **调用** | 同进程 `ctx.eval()` | subprocess `node runner.js` |
| **启动时间** | ~3ms | ~200ms |
| **DOM 完整度** | C++ 层主要 API | jsdom 全 DOM |
| **安装** | `pip install iv8` | `npm install sdenv` |

## runner.js 工作流程

```
Python (qqmusic_sdenv.py)
  │  subprocess.run(["node", "runner.js", "sign", data])
  ▼
Node.js runner.js
  │
  ├─ require("sdenv")              ← C++ V8 Addon
  ├─ new JSDOM(...)                 ← 创建完整 DOM 环境
  ├─ window/document/navigator     ← jsdom 提供
  ├─ crypto = webcrypto            ← 替换为 Node.js 原生 crypto
  │
  ├─ eval(runtime.js)              ← webpack 运行时
  ├─ eval(stub modules 380-382)    ← 缺失 Node 模块
  ├─ eval(vendor.chunk.js)         ← 业务逻辑
  ├─ 激活模块                       ← Object.keys(wp.m).forEach(wp)
  │
  ├─ getSecuritySign(data)         → sign
  ├─ (await) cgiEncrypt(data)      → encrypt
  └─ cgiDecrypt(uint8)             → decrypt
  │
  stdout: {"success":true, "result":"..."}
  ▼
Python 解析 JSON → 发 HTTP 请求
```

## 关键技术点

### 1. jsdom 环境配置

```javascript
const dom = new JSDOM('<!DOCTYPE html>...', {
    url: "https://y.qq.com/",
    userAgent: "Mozilla/5.0 ...",
    runScripts: "dangerously",    // 允许 eval
    resources: "usable",          // 加载资源
});
```

关键参数：
- `runScripts: "dangerously"` — 允许 `<script>` 标签和 eval 执行
- `resources: "usable"` — 允许加载 CSS/JS 等外部资源
- `url` — 设置 document.location 和 referrer

### 2. webpack webpackJsonp 机制

```javascript
window.webpackJsonp = [];  // webpack 检查此数组，自动 push chunk
window.webpackJsonp.push([[moduleId], {  // 注册模块
    id: function(module, exports, __webpack_require__) { ... }
}]);
```

### 3. stub 模块映射

| 模块 ID | 原始 Node.js 模块 | 作用 | stub 方式 |
|---------|-------------------|------|----------|
| 380 | `util` | debuglog + inspect | 空函数 + `{colors: false}` |
| 381 | `_yallist` (linked list) | Queue | 完整链表实现 |
| 382 | `yallist` | Queue | 复用 381 |

## 测试命令

```bash
# 直接测试 Node.js runner
node runner.js sign '{"test":"hello"}'

# Python 爬虫
python qqmusic_sdenv.py --toplist 62

# 测试所有功能
python -c "
import json, base64
from qqmusic_sdenv import sign, encrypt, decrypt
print('sign:', sign('{\"test\":\"hello\"}'))
print('encrypt:', encrypt({'test': 'hello'})[:60])
print('decrypt:', decrypt(base64.b64encode(b'test').decode()))
"
```

## 局限

1. jsdom 启动耗时约 200ms，每个 subprocess 调用都有此开销
2. 需要安装 sdenv（C++ 编译，依赖 node-gyp）
3. 与 iv8 相比，subprocess 模式在大量调用场景下性能较差
