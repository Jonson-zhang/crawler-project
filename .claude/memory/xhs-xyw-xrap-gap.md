---
name: xhs-xyw-xrap-gap
description: 小红书 XYW_ 签名和 x-rap-param 暂不需要，但知道何时该加
metadata:
  type: project
---

# 小红书签名能力缺口 — XYW_ / x-rap-param

> **当前不需要实现**，v1.0 只做 homefeed（游客推荐流），XYS_ 签名足够。
> 记在这里是为了将来扩展时不用重新调研。

## 何时需要

| 接口类型 | 示例 | 需要 XYW_ | 需要 x-rap-param |
|---------|------|-----------|-----------------|
| homefeed | 游客推荐流（当前已实现） | ❌ | ❌ |
| user_posted | 用户主页帖子列表 | ✅ | ❌ |
| otherinfo | 用户其他信息 | ✅ | ❌ |
| 搜索 | 搜索笔记/用户 | ✅ 或 XYS_ | ✅ |
| 发布笔记 | POST 发布 | ✅ 或 XYS_ | ✅ |
| feed（非 homefeed） | 关注流/附近 | ❌ | ✅ |

## XYW_ 是什么

- 2026 年 3 月左右新增的签名格式
- 专门用于**用户数据类接口**（user_posted / otherinfo 等）
- XYS_ 发这些接口直接返回 HTTP 406
- 底层：AES-128-CBC，key=`7cc4adla5ay0701v`，iv=`4uzjr7mbsibcaldp`
- 纯 Python 可实现，不依赖 Node.js

## 参考实现

xhshow 库（已安装在本机 .venv）：

| 文件 | 内容 |
|------|------|
| `.venv/Lib/site-packages/xhshow/core/xyw_crypto.py` | 纯 Python AES-128-CBC + PKCS7 + XYW_ payload 构建 |
| `.venv/Lib/site-packages/xhshow/core/xrap.py` | x-rap-param 生成算法 |
| `.venv/Lib/site-packages/xhshow/client.py` | `sign_xyw()` / `sign_headers(x_rap=True)` |

## 实现优先级（未来）

1. **XYW_** — 只要想调用户数据接口就绕不开
2. **x-rap-param** — 搜索和发布功能才用到

## 相关 memory

- [[xhs-offline-vm]] — 当前 XYS_ 签名实现
- [[crawler-conventions]] — 项目约定
