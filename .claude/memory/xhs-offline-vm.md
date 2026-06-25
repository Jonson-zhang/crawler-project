---
name: xhs-offline-vm
description: 小红书离线 VM 签名方案 - mns0201 已可用，mns0301 待攻克，下一步浏览器打断点溯源
metadata:
  node_type: memory
  type: project
  originSessionId: 56372508-3582-40ae-a666-c28c940a1b11
---

# 小红书离线 VM 签名 - 2026-06-25

> 核心目标：纯离线 Node.js/Python 产出 XYS_ 签名。**禁止使用浏览器自动化工具。**

## 一、已达成

### 1.1 4 文件离线架构

| 文件 | 大小 | 用途 |
|------|------|------|
| env.js | 16KB | 浏览器环境（1.md 验证能跑的版本） |
| ds_script.js | 421KB | VMP 字节码（1.md 版，233K bytecode） |
| sign.js | 3KB | 签名入口 `node sign.js '<json>'` |
| request.py | 9KB | 双模式：SSR 提取（无需 cookie）+ API 翻页（需 web_session） |

### 1.2 mns0201 可用

`node sign.js` 产出 364 字符 `XYS_` 签名，服务器返回 HTTP 200（非 406），但 mnsv2 hash 前缀是 `mns0201_`。

### 1.3 编码链已确认

MD5 + UTF-8 (encodeURIComponent) + 自定义 Base64 (`ZmserbBoHQtNP+...`) + payload `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:hash, x4:dataType}`

### 1.4 SSR 数据提取可用

`python request.py` 直接 GET HTML 解析，无需 cookie 和签名，每次 20+ 条笔记。

## 二、阻塞点

### 2.1 mns0201 vs mns0301

- 1.md ds_script: `__$c` 233K bytecode → mns0201 (旧版)
- 线上 ds_v2: `__$c` 7.5K bytecode → 应该产出 mns0301（新版）
- 需要在 1.md env 上加载在线版 bytecode，但 VMP 解释器状态不匹配

### 2.2 在线 ds_v2 离线加载失败

用 1.md env + 在线 ds_v2 时：
- Proxy 自动填充 300 个 env 槽位 → 解决 `undefined is not a constructor`
- 仍崩溃于 `Cannot read properties of undefined (reading III)`（VMP 内部状态，希腊字母 Iota）
- 根因：在线 bytecode 依赖 FP 脚本(395KB)初始化的 VMP 运行时状态，这部分在 Node.js 中未正确建立

### 2.3 不再在 Node.js 里硬跑

试错效率太低。正确做法是**浏览器打断点溯源**——看清 mnsv2 到底被谁、以什么方式创建。

## 三、下一步

1. js-reverse 浏览器打开 xiaohongshu.com
2. `delete window.mnsv2` → `Object.defineProperty(window, 'mnsv2', { set(v) { debugger; ... } })`
3. 重新 eval 4 个 DS 脚本
4. 陷阱触发 → `get_paused_info` 获调用栈 → 确定创建路径
5. 根据调用栈定位需要补的具体 env

## 四、相关 memory

- [[online-resources-keep-raw]] — 线上资源必须保持原始完整，禁止截断
- [[crawler-conventions]] — 项目约定
