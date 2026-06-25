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
| homefeed | 游客推荐流（当前已实现） | ❌ | 可选（加了可能降低风控） |
| user_posted | 用户主页帖子列表 | ✅ | ✅ |
| otherinfo | 用户其他信息 | ✅ | ❓ |
| 搜索 | 搜索笔记/用户 | ✅ 或 XYS_ | ✅ |
| 发布笔记/评论 | POST 发布 | ✅ 或 XYS_ | ✅ |
| feed（非 homefeed） | 关注流/附近 | ❌ | ✅ |

> x-rap-param 在 homefeed 上不是必须的——项目当前不加也能正常拿数据。
> 加了的可能是降低风控概率，不是功能必需。

## XYW_ 是什么

- 2026 年 3 月左右新增的签名格式
- 专门用于**用户数据类接口**（user_posted / otherinfo 等）
- XYS_ 发这些接口直接返回 HTTP 406
- 底层：AES-128-CBC，key=`7cc4adla5ay0701v`，iv=`4uzjr7mbsibcaldp`
- 纯 Python 可实现，不依赖 Node.js

## 各方案能力对比

| 能力 | 本项目 v1.0 | RedCrack (Cialle) | xhshow (Cloxl) |
|------|-----------|-------------------|----------------|
| x-s (XYS_) | ✅ Node.js subprocess | ✅ 纯 Python（DiyHasher+XOR+Base64） | ✅ 纯 Python |
| x-s-common（14字段）| ✅ 自研 Python | ✅ 自研 Python | ✅ 自研 Python |
| Cookie 引导 4 步 | ✅ 自研 Python | ✅ 自研 Python | ✅ 自研 Python |
| **x-rap-param** | ❌ | ✅ 纯 Python | ✅ 纯 Python |
| **XYW_** | ❌ | ❌ | ✅ 纯 Python（AES-128-CBC） |

> RedCrack 有 x-rap-param 但没有 XYW_。xhshow 两者都有。
> 本项目的 x-s 走 Node.js subprocess 路线，算法还原路线的 XYS_ 可参考 RedCrack/X_S.py。

## RedCrack 的 x-rap-param 触发范围

RedCrack 给以下 5 个接口启用了 x-rap-param（`web_encrypt_config.ini` 的 `XRAP_ENCRYPT_URL`）：

```
1. /api/sns/web/v1/homefeed        ← 当前项目唯一使用的接口
2. /api/sns/web/v1/search/notes    ← 搜索
3. /api/sns/web/v1/user_posted     ← 用户帖子列表（也是 XYW_ 触发场景）
4. /api/sns/web/v1/feed            ← 关注流
5. /api/sns/web/v1/comment/post    ← 发评论
```

## 参考实现

### RedCrack（x-rap-param）

| 文件（GitHub: Cialle/RedCrack） | 内容 |
|------|------|
| `request/web/encrypt/header/X_Rap_Param.py` | x-rap-param 生成（序列化指纹 + AES + XOR） |
| `request/web/encrypt/web_encrypt_config.ini` | `[XRAP_ENCRYPT]` 节中 XRAP_ENCRYPT_URL 列表 |
| `request/web/encrypt/header/X_S.py` | XYS_ 签名（DiyHasher 自定义哈希 + XOR + 自定义 Base64） |

### xhshow（XYW_ + x-rap-param）

| 文件（已安装在本机 .venv） | 内容 |
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
