# QQ音乐 iv8 方案技术文档

## 架构

```
sign → iv8 C++ V8 同进程执行 (1ms) ✅
encrypt → subprocess → node env-patch/qqmusic_api.js (200ms) ⚠️
decrypt → subprocess → node env-patch/qqmusic_api.js (200ms) ⚠️
```

## 为什么 encrypt 不能纯 iv8？

`__cgiEncrypt` 位于 vendor.chunk.js 模块 8 的 VMP 中。该 VMP 是一个 while(1) + switch/case 字节码解释器。

VMP 解码时检测了 V8 的代码执行上下文：
- **iv8 `ctx.eval()`** → Script 上下文 → VMP 拒绝解码 ❌
- **`node file.js`（CommonJS）** → Module 上下文 → 解码成功 ✅

iv8 的 `ctx.eval()` 是同步调用，无法模拟 Node.js 的 CommonJS 模块加载上下文，也无法排空微任务队列。这是 V8 引擎层的行为差异，iv8 无法绕过。

## 文件清单

| 文件 | 来源 | 作用 |
|------|------|------|
| `qqmusic_iv8.py` | 手写 | Python 入口 |
| `qqmusic_api.js` | 复制自 env-patch | encrypt/decrypt 回退 |
| `env_site.js` | 手写 | env_patch 配置 |
| `runtime.js` | QQ音乐 CDN | webpack 运行时 |
| `vendor.chunk.js` | QQ音乐 CDN | 业务模块 |
| `common.chunk.js` | QQ音乐 CDN | 辅助模块 |
