---
name: xhs-offline-vm
description: 小红书离线 VM 签名 — 线上 DS 脚本 + 原型链补环境方案
metadata:
  type: project
---

# 小红书离线 VM 签名 — 线上 DS 脚本 + 原型链补环境

> 核心目标：纯离线 Node.js/Python 产出 XYS_ 签名。

## 当前方案：env.js + 3 个线上 DS 脚本

| 文件 | 大小 | 来源 | 用途 |
|------|------|------|------|
| env.js | 自研 | 原型链补环境 | 模拟浏览器全局对象 |
| ds_loader.js | ~151KB | 线上提取 | VMP 解释器基础 |
| ds_api.js | ~60KB | 线上提取 | `_BHjFmfUMEtxhI(__$c, env)` → __bc + mns0201 |
| ds_v2.js | ~62KB | 线上提取 | `_AUuXfEG27Xa3x(__$c, env)` → mns0301 |
| sign.js | 自研 | 编码链 | 入口：MD5×2 + mnsv2 + b64Encode + UTF8 |

## 签名链

```
node sign.js '<json_body>'
  → env.js → ds_loader.js → ds_api.js → ds_v2.js
  → window.mnsv2(u, m, w) → "mns0301_xxx" (200 chars)
  → {x0..x4} → JSON → UTF8 → CustomB64 → "XYS_" + result
```

## VMP 关键标识符

| 标识符 | 作用 | 创建者 |
|--------|------|--------|
| `_BHjFmfUMEtxhI` | VMP 解释器 A（创建 mns0201） | ds_loader.js 中的混淆代码 |
| `_AUuXfEG27Xa3x` | VMP 解释器 B（升级到 mns0301） | ds_loader.js 中的混淆代码 |
| `__$c` | VMP 字节码字符串 | ds_api.js / ds_v2.js 本地变量 |
| `__bc` | VMP 内部字节码 | ds_api.js 执行后创建 |
| `getdss` | 时间戳函数（VMP 调用） | ds_api.js 顶部定义 |

## 编码链常量

- Base64: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
- Payload: `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:hash, x4:dataType}`
- XYS_ 总长度: ~364 字符
- mnsv2 输出前缀: `mns0301_` (200 字符)

## API 测试标准

- HTTP 200 ✅
- x-s 解码后 x3 前缀 = `mns0301_` ✅
- homefeed 返回 code=0 + items>0 ✅

## 依赖

```bash
npm install crypto-js   # sign.js 需要（MD5）
```

## 相关 memory

- [[xhs-retrospective]] — 逆向过程复盘
- [[xhs-xyw-xrap-gap]] — XYW_ / x-rap-param 能力缺口
- [[crawler-conventions]] — 项目约定
