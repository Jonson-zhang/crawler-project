---
name: iv8-tongdun-ceiling
description: iv8 社区版在指纹 SDK 场景的天花板 — Tongdun/TrustDecision 服务器端 AI 拒绝合成指纹
metadata:
  type: project
---

# iv8 社区版 vs Tongdun 指纹 SDK

## 核心发现（东航 2026-06-29）

iv8 Community Edition v0.1.3 可以完整加载并运行 Tongdun SDK（monitor.js + fm.js + Worker），
但在 **服务器端指纹 AI** 被拒绝（`code:074 "数据伪造"`）。

## Tongdun SDK 执行链

```
monitor.js (5KB, 错误监控)
  ├─ 加载后设置全局错误处理
  └─ 无副作用

fm.js (510KB, TrustDeviceJs Pro v4.2.4)
  ├─ window[411 次] 读取浏览器 API
  ├─ new Blob([workerCode]) + URL.createObjectURL + new Worker(blobUrl)
  ├─ Worker 内: 指纹收集 (Canvas/WebGL/Audio/Font/CPU 等)
  ├─ postMessage 回主线程: 指纹数据
  └─ XHR POST 到 fp.tongdun.net/web/v2?partner=ceair
       body: data=CAQSkAzL... (Protocol Buffers)
       服务器响应: {"code":"074","desc":"数据伪造"}
```

## iv8 CE 已攻克的点

| 问题 | 解决方案 |
|------|---------|
| `URL.createObjectURL` 缺失 | polyfill: Blob 构造器拦截保存 text parts，URL.createObjectURL 返回 `blob:nk-N` |
| Worker 不支持 blob URL | polyfill: `new Function(workerCode)` 在隔离 scope 中执行，postMessage/onmessage 通过事件循环桥接 |
| `_fmOpt` 未初始化 | 从 ceair HTML inline script 提取配置: `{partner:'ceair', appName:'ceair_web', fmb:true, fpHost:'https://fp.tongdun.net'}` |

## iv8 CE 无法攻克的问题

Tongdun **不在 JS 层检测环境**。它不在 JS 中做 `navigator.webdriver` 检查、原型链完整性检查、`toString` 检查等。
它只是**采集指纹数据**，上报到服务器（`fp.tongdun.net`），服务器端 AI 做判断。

iv8 CE 的 Canvas/WebGL stub 返回的是随机/空值，与真实 Chrome 设备的物理特征不匹配：

```
客户端指纹向量                         服务器期望
─────────────────────────────────      ─────────
Canvas toDataURL: 随机 png           → 与设备 GPU 一致的 png hash
WebGL UNMASKED_RENDERER: 'WebKit'   → 'ANGLE (NVIDIA GeForce...)'
AudioContext: 空 Float32Array        → 设备时钟偏移 Trace
CPU core count: NaN                  → navigator.hardwareConcurrency 值
Font list: []                        → 系统已安装字体集
```

这些值组成的高维向量被服务器分类器判定为 `class: synthetic`。

## 三条路径

### A. iv8 Pro Edition
- Pro 版文档声称有真实 Canvas/WebGL/CSS Layout Engine/Worker 并行
- **风险**: 未验证。需购买（价格未知）。可能仍不够（Tongdun 检测粒度未知）

### B. 逆向 Tongdun blackbox 格式
- blackbox: `tddf<urlsafe-base64>.<protobuf-binary>` → Base64 → JSON `{"v":"4.2.4","os":3,"p":"ceair","e":200,"l":"8a2"}`
- protobuf 主体内容未知（可能含 ECC 签名或 HMAC）
- **工作量**: 需抓取真实设备的 blackbox 做对照分析，逆推签名算法
- **风险**: 如签名涉及手机端 TEE（Trusted Execution Environment），则不可逆

### C. 混合方案（当前推荐）
- iv8 做 WASM 加解密（去 Node.js）+ DrissionPage/CloakBrowser 做 HTTP
- **状态**: 已验证可用，39 flights / 9.4s
- **文件**: `东航/iv8/test_hybrid.py`

## 止损规则

**看到 `trustdecision.com` / `tongdun.net` / `static.tongdun.net` / `fp.tongdun.net` 在 JS 加载列表**

→ **30 分钟内判路径 C（混合方案），不在纯 iv8 端到端上死磕。**

不要：
- 尝试补全 Canvas/WebGL 到"真实"水平（工作量 = 写一个 GPU 模拟器）
- 尝试补全 AudioContext 到 bit-perfect（工作量 = 写一个音频 DSP 模拟器）
- 尝试补全 200+ 个 DOM API 到 C++ 语义（iv8 Pro 已做）

## 适用场景

| 站点类型 | iv8 CE 可行性 |
|---------|-------------|
| 签名算法（VM 保护/混淆） | ✅ VMP 检测不到 iv8（真实 V8） |
| 简单 Cookie（Set-Cookie 下发） | ✅ |
| JS 生成的动态 Cookie（无指纹 SDK） | ✅ `document.cookie = calcToken()` |
| Tongdun/TrustDecision 指纹 SDK | ❌ 需路径 B 或 C |
| 极验/网易易盾 滑块 | ❌ 需真实浏览器交互 |

## 参考

- [[env-patch-iv8-ceiling]] — iv8 切换决策（VMP 场景）
- [[waf-tls-fingerprint]] — WAF TLS 指纹诊断
- [[stop-loss-rules]] — 止损规则
- `东航/NOTES.md#八iv8-方案研究2026-06-29`
- `东航/iv8/iv8_polyfills.js` — Blob Worker polyfill
- `东航/iv8/test_tongdun.py` — 完整的 Tongdun SDK 加载测试
