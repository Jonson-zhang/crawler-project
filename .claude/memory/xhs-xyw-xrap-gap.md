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
| homefeed | 游客推荐流（当前已实现） | 否 | 可选 |
| user_posted | 用户主页帖子列表 | 是 | 是 |
| otherinfo | 用户其他信息 | 是 | 未知 |
| 搜索 | 搜索笔记/用户 | 是 或 XYS_ | 是 |
| 发布笔记/评论 | POST 发布 | 是 或 XYS_ | 是 |
| feed（非 homefeed）| 关注流/附近 | 否 | 是 |

> x-rap-param 在 homefeed 上不是必须的——不加也能正常拿数据。

## XYW_ 是什么

- 2026 年 3 月左右新增的签名格式
- 专门用于**用户数据类接口**（user_posted / otherinfo 等）
- XYS_ 发这些接口直接返回 HTTP 406
- 底层：AES-128-CBC，key= `7cc4adla5ay0701v`，iv= `4uzjr7mbsibcaldp`
- 纯 Python 可实现，不依赖 Node.js

## 实现优先级（未来）

1. **XYW_** — 只要想调用户数据接口就绕不开
2. **x-rap-param** — 搜索和发布功能才用到

## 相关 memory

- [[xhs-offline-vm]] — 当前 XYS_ 签名实现
- [[crawler-conventions]] — 项目约定
