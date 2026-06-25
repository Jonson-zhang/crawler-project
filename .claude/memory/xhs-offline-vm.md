---
name: xhs-offline-vm
description: 小红书离线 VM 签名 - mns0301 已攻克！4 文件架构完整可用
metadata:
  node_type: memory
  type: project
  originSessionId: 56372508-3582-40ae-a666-c28c940a1b11
---

# 小红书离线 VM 签名 - 2026-06-25 🔥 mns0301 攻克

> 核心目标：纯离线 Node.js/Python 产出 XYS_ 签名。**已达成。**

## 一、4 文件架构 ✅

| 文件 | 大小 | 用途 |
|------|------|------|
| env.js | 16KB | 1.md 验证能跑的浏览器环境 |
| ds_script.js | 421KB | 1.md VMP 字节码 (233K bytecode, mns0201 baseline) |
| sign.js | 4KB | 签名入口 + mns0201→mns0301 覆盖升级 |
| request.py | 10KB | SSR 提取 + API 翻页 |

## 二、签名链 ✅

```
node sign.js '<json_body>'
  → env.js → ds_script.js (mns0201 baseline)
  → ds_api_raw.js + online ds_v2 overlay → mns0201→mns0301 升级
  → CryptoJS.MD5×2 + window.mnsv2() + b64Encode + encodeUtf8
  → stdout: {"X-s":"XYS_...","X-t":"..."}
```

mnsv2 hash 前缀: `mns0301_` ✅ (200 字符)

## 三、mns0301 覆盖机制

1. 1.md env + ds → 创建 mnsv2 (mns0201)
2. 加载在线 ds_api_raw.js (59K, `_BHjFmfUMEtxhI`) 
3. Hook `_AUuXfEG27Xa3x` → 拦截在线解释器 (401K 字符) → 自动填充 env 数组
4. 加载在线 ds_v2 (formatted, 423K) → 解释器运行在线 bytecode (7558 chars) → 覆盖升级 mnsv2
5. mnsv2 产出从 `mns0201_` 变为 `mns0301_`

## 四、API 测试结果

- HTTP 200 (签名被服务器接受) ✅
- 需要有效 web_session cookie 才能获取数据

## 五、依赖

```bash
npm install crypto-js   # sign.js 需要
pip install curl_cffi   # request.py 需要
```

## 六、关键数据

- Base64: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
- Payload: `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:hash, x4:dataType}`
- XYS_ 长度: 364 字符

## 七、相关 memory

- [[online-resources-keep-raw]] — 线上资源必须保持原始完整
- [[crawler-conventions]] — 项目约定
