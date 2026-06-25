---
name: xhs-offline-vm
description: 小红书离线 VM 签名方案 — XYS_ 签名链、VMP 环境阻塞点、下一步
metadata:
  node_type: memory
  type: project
  originSessionId: 56372508-3582-40ae-a666-c28c940a1b11
---

# 小红书离线 VM 签名 — 2026-06-25

> **核心目标：纯离线 Node.js/Python 产出 XYS_ 签名，不需要浏览器自动化。**

## 一、签名链已确认 ✅

| 环节 | 实现 |
|------|------|
| K.Pu (MD5) | 标准 MD5 — Python/Node 均可 |
| K.lz (UTF-8) | encodeURIComponent → 字节数组 |
| K.xE (Base64) | 自定义码表 `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5` |
| Payload | `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:mnsv2Hash, x4:dataType}` |
| mnsv2 | `window.mnsv2(url+body, MD5(url+body), MD5(url))` → `"mns0301_<base64>"` (200字符) |

**阻塞点：`window.mnsv2` 是 VMP 字节码运行时动态创建的函数，离线环境中 4 个 DS 脚本加载后仍未出现。**

## 二、当前困境

### 2.1 已尝试：在 Node.js 中硬跑 DS 脚本

```
env.js → ds_api(59K)→ ds_v2(61K)→ fp(395K)
结果: 4个脚本全部加载不崩溃，但 window.mnsv2 = undefined
```

### 2.2 根因分析

不是在 Node.js 里逐行调试环境就能解决的——FP 脚本 395KB、ds_v2 61KB 的 VMP 字节码内部逻辑对离线环境的要求是黑盒的。**试错式补环境效率极低。**

### 2.3 正确方向（来自文章经验）

文章的核心步骤：
1. 在 `window.mnsv2` 调用处下断点
2. 断住后点进去进 VM → VM 文件开头打上断点
3. 刷新页面断住 → **回溯堆栈**，去到进入虚拟机的前一个堆栈
4. 把所有 eval/VM 文件的断点都打上 → 拷出来 → 补几行环境 → 跑

**关键动作是"回溯堆栈"**——去观察浏览器里 VMP 到底通过什么路径把 mnsv2 赋给 window 的，而不是在 Node.js 里硬跑猜测。

---

## 二、文件结构

```
小红书/
├── env.js                     # 离线 DOM 环境（当前会话新建） — 400+行，完整原型链+window全局
├── env.dom.js                 # 旧版 DOM 环境（之前保留） — 887行，更完整的 Web IDL
├── sign.js                    # Node.js 签名入口 — require env + ds_script → seccore_signv2
├── sign_xys.js                # Node.js XYS_ 编码工具（b64Encode/encodeUtf8/md5/seccore_signv2）
├── sign_xys.py                # Python XYS_ 编码工具（同上，含 Signer 类）
├── request.py                 # Python 请求桥接（curl_cffi, subprocess 调用 sign.js）
├── main.py                    # 旧版纯 Python 签名
├── login.py                   # 登录脚本（DrissionPage/CDP）
│
├── data/
│   ├── ds_api_raw.js          # ⭐ 线上 DS v1 (_BHjFmfUMEtxhI) — 59KB 完整 raw
│   ├── ds_v2_6545c_online.js  # DS v2 格式化版（__$c 被截断，不可用！）
│   ├── fp_raw.js              # ⭐ 线上 FP 脚本 (_0x2301/_0x1d86/VMP子函数) — 395KB
│   ├── ds_script.js           # 组合版（bf7d4e+ds_api+ds_v2+fp 拼接）
│   ├── vendor.js              # webpack chunk — 含 seccore_signv2, 自定义 base64
│   ├── index_online.js        # 线上 index.js (5MB)
│   ├── cookies.json           # cookies（无 web_session，仅 a1/webId 等）
│   ├── homefeed.json          # 上次抓取的首页笔记样本
│   └── *.js                   # 其余旧版离线文件
```

---

## 三、阻塞点：FP 脚本在 Node.js 中无法加载 ❌

### 3.1 浏览器加载顺序（4 个 DS 脚本）

刷新日志确认，浏览器按以下顺序加载：

```
1. bf7d4e.js (45B 占位)
2. ds_api (api/sec/v1/ds) — _BHjFmfUMEtxhI
3. ds_v2 (as/v2/ds/6545c...) — _AUuXfEG27Xa3x
4. fp (as/v2/fp/643f...) — _0x2301/_0x1d86/VMP 子函数
```

**全部 4 个加载后，`window.mnsv2` 才会被创建。**

### 3.2 离线加载结果

| 脚本 | Node.js 状态 | 浏览器状态 |
|------|-------------|-----------|
| bf7d4e.js | ✅ 可加载 | ✅ |
| ds_api_raw.js (59KB) | ✅ `_BHjFmfUMEtxhI` 定义成功 | ✅ |
| ds_v2 (61KB raw) | ✅ `_AUuXfEG27Xa3x` 定义成功，`__$c` 完整 | ✅ |
| fp_raw.js (395KB) | ❌ 报错: `Function.prototype.bind called on incompatible undefined` | ✅ |

### 3.3 当前离线执行结果

```javascript
// require('./env') + require('./ds_script') 后：
window._BHjFmfUMEtxhI  → function ✅  (DS v1 解释器)
window._AUuXfEG27Xa3x  → function ✅  (DS v2 解释器)
window._dsf            → function ✅  (设备指纹)
window.mnsv2           → undefined ❌  (未创建)
```

**FP 脚本加载失败 → VMP 子函数未注册 → mnsv2 未创建**

### 3.4 文章的核心提示

微信文章里提到：**eval 不止两个，搜出来四五个都打上断点，最后发现总共四个 vm 文件**。

对应到小红书：不是只有 ds_api + ds_v2 两个，还需要 bf7d4e + fp 共 **4 个** DS 脚本。这和文章的经验一致。

---

## 四、已排除的方向

| 方向 | 结论 |
|------|------|
| 加载 index.js + Vue 运行时 | ❌ 不需要 — mnsv2 创建不依赖 Vue/SPA |
| 加载 vendor-dynamic.js | ❌ 不需要 — seccore_signv2 编码可离线实现 |
| 只加载 ds_api + ds_v2 | ❌ 不够 — 需要 fp 脚本 |
| Proxy 懒加载 env 数组 | ❌ VMP opcode 0x4f 按索引读 env，Proxy 不拦截内部变量 |
| 用 `_webmsxyw`(sabo) 替代 | ❌ 产出 XYW_，不是 XYS_ |
| 在浏览器内签名，Python 发请求 | ❌ 目标用户明确要离线 |

---

## 五、下一步

正确的做法（文章思路）：

1. **浏览器里给 `window.mnsv2` 赋值点打断点** — 用 `set_breakpoint_on_text` 搜 `mnsv2`
2. **断住后回溯堆栈** — 找到是哪个 VMP 子函数、以什么方式把 mnsv2 写进 window
3. **确认完整的 4 个 VM 文件** — 从堆栈里确认到底是 DS v1/v2/FP 中的哪个在什么时机创建 mnsv2
4. **拷出 + 最小补环境** — 只补 mnsv2 创建所需的那些属性，不追求完整 DOM

**不要在 Node.js 里硬跑 395KB 的 FP 脚本了。**

---

## 六、关键洞察（更新）

1. **VMP 环境不依赖 Vue/SPA** — 浏览器内 eval DS 脚本创建 mnsv2 时，页面只有基础 DOM
2. **FP 脚本是第 4 个 VM** — 和文章说的"总共四个 vm 文件"一致
3. **自定义 Base64 码表不变**: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
4. **离线架构 4 文件**: env.js + ds_script.js + sign.js + request.py
5. **禁止使用浏览器自动化** — 目标用户的明确要求

## 七、相关 memory

- [[crawler-conventions]] — 项目约定
