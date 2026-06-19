---
name: trace-first
description: WASM 补环境第一步是对 signtool_new/signtool_sign 做完整 wbg 调用追踪，不是直接写 stub
metadata:
  type: feedback
---

补 WASM 环境的**第一步**是对目标函数（如 `signtool_new()`、`signtool_sign()`）做完整调用追踪，记录每个 wbg 函数调用的顺序、参数、返回值。拿到完整调用序列表后，再按图索骥逐条实现 stub。禁止跳过 trace 直接写 stub。

**Why（米画师血泪教训）：** 最初直接写 stub，只补了 `querySelector("link[rel*='icon']")`，遗漏了 `querySelector("meta[name='keywords']")`。缺少一个密钥派生因子导致 WASM 签名与服务端不匹配，API 持续 403 "签名错误"。逐项比对 trace 日志和 stub 实现才定位到缺失项——少了一个 DOM 读取调用。3 小时的猜坑和黑盒排查，trace 5 分钟就能避免。

**How to apply:**
1. 用 MCP `hook_function` + `get_console_logs` 对 `signtool_new()` / 签名函数做完整调用追踪
2. 拿到每一步的参数值、返回值后，整理成调用序列表（CSV 或 Markdown 表格——调用序号、函数名、参数、返回值）
3. 按表逐项实现 stub，写一条勾一条，确保零遗漏
4. 少一个函数、参数顺序不对、返回值类型不匹配 → 静默失败，不会报错

**铁律：trace 先于 code。没 trace 不动手。**

相关：[[stub-template]] [[string-abi]] [[memory-buffer]]
