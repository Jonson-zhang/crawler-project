---
name: no-wasmtime
description: 禁止使用 wasmtime 做 WASM 逆向——耗时且多次失败
metadata:
  type: feedback
---

WASM 逆向不要使用 wasmtime-py 或 wasmtime 作为运行时。昨天在米画师逆向中 try wasmtime 方案花费大量时间仍失败，最终通过 Node.js 直接加载 WASM（new WebAssembly.Instance）成功。

**Why:** wasmtime 是独立 WASM 运行时，不兼容 wasm-bindgen 的 wbg 导入体系——wbg 函数深度依赖 JS 对象引用链（self → crypto → getRandomValues）、DOM API（querySelector/getAttribute）、以及 JS 弱类型语义。wasmtime stub 需要从头模拟所有 Web API，工作量和出错概率远高于 Node.js 原生 WASM 支持。

**How to apply:**
- WASM 签名逆向：直接用 Node.js `new WebAssembly.Instance(module, { wbg })` 加载
- wbg 导入函数的参数签名：用 `wasm-objdump -x | node gen_stub_template.js` 生成，不再猜
- 仅在 WASM 完全不依赖 Web API（纯计算型）时才考虑 wasmtime
- 相关：[[stub-template]]
