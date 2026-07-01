---
name: js-reverse-priority
description: JS逆向方法论 — 优先使用站点内部JS代码暴露加密函数，禁止使用 jsdom
metadata:
  type: feedback
---

JS 逆向时，**优先使用站点内部的 JS 代码**，暴露其中的加密函数供本地调用。
如有环境依赖，用 iv8（C++ V8 引擎）。

## Webpack 硬约束（最高优先级）

**遇到 webpack 打包的站点，必须走「扣内部模块」路线，禁止尝试运行完整 bundle。**

```
正确路线: 定位加密 webpack 模块 → 按依赖链扣取 → 精简到最小可工作集 → Node.js subprocess 调用
错误路线: jsdom 补环境跑完整 app.js → CDP 连浏览器跑完整 app.js → iv8 嵌 V8 跑完整 app.js
```

**Why:** 
- 站点内部的加密实现可能与标准库不兼容（如 SM2 定制版 vs npm sm-crypto）
- 即使所有密码学参数都已知（密钥、IV、模式），实现差异仍会导致输出不匹配
- 运行完整 webpack bundle 需要补 DOM/BOM/网络层，这是无底洞——加密函数本身是纯算法，不依赖这些
- 国家医保局为证：jsdom 12 个脚本白费、CDP 太重(8s)、iv8 SM2 不完整——最终 4226 行扣取代码一次解决

**How to apply:**
1. 先在页面中搜索 `EncryptedData` / `signData` / `encData` 等函数名，定位 webpack module ID
2. 按依赖链扣取模块，保留 webpack loader 框架（`function o(t) { if (n[t]) ... }`）
3. 逐步精简：注释非必需 `require`，运行报错再打开；保留 `o.e` 防异步 chunk 报错
4. **先搜开源参考仓库**——八成已有前人扣好了（如 victory-volunteer/fuwu_nhsa）
5. 纯算法模块直接用 Node.js subprocess 执行；有 DOM 依赖的模块走 iv8

**案例:** [[nhsa-reverse]] 国家医保局项目：12 个 jsdom 脚本全部白费。npm sm-crypto 产出 96B 签名，内部模块产出 64B；穷举 SHA256 公式 120+ 种全部失败；最终 `gov_nhsa_encrypt.js`（webpack 提取版）直接解决。

**优先级链:** 
内部 JS 代码暴露函数 > webpack 模块扣取 > iv8 补环境 > 外部库重建

**jsdom 永远禁止。** 三个致命缺陷：
1. 易被检测（原型链/构造函数/instanceof）— iv8 真 V8 无法区分
2. 无法 Hook 早期加载代码 — source patch 在 jsdom 中几乎总是语法错误
3. 产出不可部署 — 最终方案必须是纯算或补环境

详见 [[stop-loss-rules#规则0]]。
