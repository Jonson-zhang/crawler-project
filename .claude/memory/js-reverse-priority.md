---
name: js-reverse-priority
description: JS逆向方法论 — 优先使用站点内部JS代码暴露加密函数，禁止使用 jsdom
metadata:
  type: feedback
---

JS 逆向时，**优先使用站点内部的 JS 代码**，暴露其中的加密函数供本地调用。
如有环境依赖，用 iv8（C++ V8 引擎）。

**Why:** 
- 站点内部的加密实现可能与标准库不兼容（如 SM2 定制版 vs npm sm-crypto）
- 即使所有密码学参数都已知（密钥、IV、模式），实现差异仍会导致输出不匹配
- 外部重建加密逻辑的调试成本远高于直接调用内部代码

**How to apply:**
1. 先在页面中搜索 `EncryptedData` / `signData` / `encData` 等函数名
2. 如果能定位到 webpack 模块，按依赖链扣取，逐步精简（注释非必需模块，运行报错再打开）
3. 如果 webpack 依赖太深，直接搜索是否有开源参考仓库
4. iv8 用于有 DOM 依赖的场景；纯算法的加密模块直接用 Node.js 执行

**案例:** [[nhsa-reverse]] 国家医保局项目：12 个 jsdom 脚本全部白费。npm sm-crypto 产出 96B 签名，内部模块产出 64B；穷举 SHA256 公式 120+ 种全部失败；最终 `gov_nhsa_encrypt.js`（webpack 提取版）直接解决。

**优先级链:** 
内部 JS 代码暴露函数 > webpack 模块扣取 > iv8 补环境 > 外部库重建

**jsdom 永远禁止。** 三个致命缺陷：
1. 易被检测（原型链/构造函数/instanceof）— iv8 真 V8 无法区分
2. 无法 Hook 早期加载代码 — source patch 在 jsdom 中几乎总是语法错误
3. 产出不可部署 — 最终方案必须是纯算或补环境

详见 [[stop-loss-rules#规则0]]。
