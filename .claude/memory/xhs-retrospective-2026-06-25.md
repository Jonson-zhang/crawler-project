---
name: xhs-retrospective
description: 小红书 XYS_ 签名逆向复盘 — 失误、经验、当前状态、下一步（2026-06-25）
metadata:
  type: project
---

# 小红书 XYS_ 签名逆向复盘

## 一、目标

纯离线 Node.js/Python 产出 XYS_ 签名，不需要浏览器自动化。

## 二、已确认的签名链

```
MD5(url+body) + MD5(url) → window.mnsv2(u, m, w) → {x0..x4} payload
→ JSON.stringify → encodeUtf8 → custom base64 → "XYS_" + result
```

- 自定义 Base64: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
- Payload: `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:hash, x4:"object"/""}`
- 编码链来源: vendor.js webpack module — 浏览器 DevTools 提取

## 三、当前状态：待攻克

### 可行路线：补环境 + 线上 DS 脚本

env.js（原型链补环境）+ 3 个线上 DS 脚本（ds_loader + ds_api + ds_v2）

环境已确认的模块：
- `_BHjFmfUMEtxhI` + `_AUuXfEG27Xa3x` 两个 VMP 解释器函数 ✅（由 ds_loader.js 创建）
- `getdss()` 辅助函数 ✅（ds_api.js 顶部定义，返回当前时间戳字符串）
- `__bc` 字节码 ✅（ds_api 执行后生成 2466 chars，ds_v2 执行后升级为 7558 chars）
- `MutationObserver`、`Image`、`XMLHttpRequest` 等构造函数 ✅

未解决的障碍：
- `sdt_source_init.js`（245KB）在 Node.js 中栈溢出，但**不需要加载**
- ds_v2.js 执行时报 `undefined is not a constructor` — 某个 HTML 元素构造函数缺失

## 四、关键失误

1. **被误导去用第三方包** — 安装了 xhshow 后又删除，浪费大量时间
2. **误以为需要 web_session** — 访客 Cookie 就能拿数据，之前多次说"缺 web_session 无法翻页"
3. **没有第一时间用 js-reverse MCP** — 用 camoufox-reverse 反复做无意义的 DOM 操作
4. **补环境没按要求用原型链** — 用 Object.assign 平铺，VMP 检测不通过
5. **硬编码版本号** — webBuild 会随发版变动

## 五、经验

1. **补环境必须用原型链** — VMP 解释器会做深度类型检测
2. **访客 Cookie 就能拿数据** — 不需要 web_session
3. **禁止使用第三方逆向成品库** — 所有签名必须自研
4. **js-reverse MCP 用于断点调试，camoufox-reverse 用于绕过指纹**
5. **编码链可复用** — Base64/UTF-8/MD5 来自 vendor.js
6. **线上资源禁止截断/格式化** — 保存原始脚本时一个字节都不能改

## 六、下一步

1. 修复 ds_v2.js 的 `undefined is not a constructor` — 补全缺失的 HTML 元素构造函数
2. 原型链 env 通过后 → mns0301 ✅ → sign.js 输出有效 x-s
3. Python 配合实现 x-s-common + Cookie 引导 → 全链路翻页

## 七、当前可用资产

- 编码链: encodeUtf8 / customBase64 / MD5 — 已经在 vendor-dynamic.js 中定位
- DS 脚本: ds_loader.js / ds_api.js / ds_v2.js 已从线上提取
- x-s-common: 15 字段结构已确认，解码算法已验证
- 补环境: env_proto.js 原型链框架已完成
- 已知 env 需求: MutationObserver, Image, WebSocket, XMLHttpRequest, Event 等
