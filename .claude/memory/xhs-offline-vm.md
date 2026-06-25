---
name: xhs-offline-vm
description: 小红书离线 VM 签名方案 — 4 文件架构、mns0201 可用、mns0301 待攻克
metadata:
  node_type: memory
  type: project
  originSessionId: 56372508-3582-40ae-a666-c28c940a1b11
---

# 小红书离线 VM 签名 — 2026-06-25

> **核心目标：纯离线 Node.js/Python 产出 XYS_ 签名，不需要浏览器自动化。**

## 一、当前可用方案（mns0201）

### 1.1 4 个文件架构

| 文件 | 大小 | 用途 |
|------|------|------|
| `env.js` | 16KB | DOM 环境模拟（来自 1.md 验证能跑的版本） |
| `ds_script.js` | 421KB | VMP 字节码（`_AUuXfEG27Xa3x` + `__$c` 233K bytecode） |
| `sign.js` | 3KB | 签名入口（require env+ds → `seccore_signv2()` → JSON） |
| `request.py` | 6KB | Python 请求桥接（subprocess 调用 sign.js → curl_cffi POST） |

### 1.2 签名链

```
node sign.js '<json_body>'
  → require('./env')     → DOM 全局对象
  → require('./ds_script') → _AUuXfEG27Xa3x 解释器 → window.mnsv2 创建
  → CryptoJS.MD5×2 + window.mnsv2() + b64Encode + encodeUtf8
  → stdout: {"X-s":"XYS_...","X-t":"..."}  (364 字符)
```

### 1.3 验证结果

- `node sign.js` → 产出 364 字符 XYS_ 签名 ✅
- HTTP POST → 返回 200（非 406）✅
- mnsv2 hash 前缀: `mns0201_`（不是 mns0301_）

### 1.4 依赖

```bash
npm install crypto-js   # sign.js 需要
pip install curl_cffi   # request.py 需要
```

---

## 二、mns0201 vs mns0301

| | mns0201 | mns0301 |
|---|---|---|
| __$c 字节码 | 1.md 旧版 (233K 字符) | 线上新版 (55K 字符) |
| VMP 解释器 | 1 个 DS 脚本 (`_AUuXfEG27Xa3x`) | 需要 DS v1 + DS v2 + FP 共 3 个 |
| 离线状态 | ✅ 能跑 | ❌ FP 脚本在 Node.js 中崩溃 |
| 服务器接受 | ✅ HTTP 200 | 未验证（离线未产出） |

**1.md 的 mns0201 能正常签名。mns0301 需要 FP 脚本适配，但文章作者自己也是先拿到 0201 后发现需要 4 个 VM 文件才拿到 0301。**

---

## 三、env.js 选型

**用 1.md 的 env.js（16KB, 414 行），不用自己写的 env.js。**

核心区别：1.md 用 Map + 全局 `Function.prototype.toString` 替换，VMP 内部创建的函数走 fallback 不报错。我们的逐个函数设 toString 的方式覆盖不全。

---

## 四、关键数据

- 自定义 Base64: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
- Payload: `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:mnsv2Hash, x4:"object"/"string"}`
- mnsv2 输入: `(url+body, MD5(url+body), MD5(url))`
- XYS_ 长度: 364 字符

## 五、相关 memory

- [[crawler-conventions]] — 项目约定
