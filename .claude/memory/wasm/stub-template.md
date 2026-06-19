---
name: stub-template
description: 逆向 WASM 签名时，先用 gen_stub_template.js 生成参数签名正确的 stub 模板
metadata:
  type: feedback
---

逆向 WASM（wasm-bindgen 生成的模块）时，**必须**先跑模板生成器，再实现 stub 函数。顺序不对会导致参数签名错误（特别是单参数 vs 零参数），产生静默的正确性 bug 而非崩溃。

**Why:** 米画师逆向中，5 个 wbg 函数因参数数量搞错导致签名被服务器拒绝——`__wbg_crypto`、`__wbg_navigator`、`__wbg_document` 实际接收 1 个 i32 参数（self 引用），被误写为零参数；`__wbg_new_a12002a7f91c75be` 实际接收 1 个参数（bufferRef），被误写为双参数（ptr, len）。3 小时黑盒试错，模板生成器 10 秒即可避免。

**How to apply:**
1. 拿到 .wasm 文件后，第一步跑：
   ```bash
   wasm-objdump -x target.wasm | node tools/gen_stub_template.js
   ```
2. 输出是完整 wbg 对象骨架，每个函数有精确参数个数（来自 Type section）
3. 直接复制进 sign.js，按注释填实现
4. 参数语义从浏览器 trace（MCP evaluate_js）获取，不要猜
5. 只在逆向 WASM 时触发——纯 JS 混淆不需要此步骤
