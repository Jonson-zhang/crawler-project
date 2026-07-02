# QQ音乐 sdenv 方案技术文档

## 架构

```
sign → env_patch 环境 + 模块顶层激活 → 同步执行 ✅
encrypt → subprocess → node env-patch/qqmusic_api.js (200ms) ⚠️
decrypt → subprocess → node env-patch/qqmusic_api.js (200ms) ⚠️
combined → sign(直接) + encrypt(回退) → 一次 subprocess 完成 ✅
```

## 关于 VMP

sdenv 使用 env_patch.js 的 safeFunction 机制（`Function.prototype.toString` 覆写），并尝试在 async 函数中 `await` 排空微任务来让 VMP 解码。但最终发现 VMP 检测的是 **V8 的执行上下文**（Module vs Script），而非环境属性或微任务队列。

## 关键发现

`sdenv` 的 jsdom 环境比 `env_patch` 更完整（真实 Canvas、EventTarget 原型链），但对 VMP 解码没有帮助——VMP 不关心 DOM API 的完整度，它检测的是 V8 底层的脚本编译模式。

## 文件清单

| 文件 | 来源 | 作用 |
|------|------|------|
| `runner.js` | 手写 | Node.js 入口 |
| `qqmusic_sdenv.py` | 手写 | Python 爬虫 |
| `env_site.js` | 手写 | env_patch 配置 |
| `runtime.js` | QQ音乐 CDN | webpack 运行时 |
| `vendor.chunk.js` | QQ音乐 CDN | 业务模块 |
