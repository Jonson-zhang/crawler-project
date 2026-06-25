---
name: online-resources-keep-raw
description: 从线上获取的任何 JS 源码/字节码必须保持原始完整，不截断、不格式化、不做任何修改
metadata:
  type: feedback
---

# 线上资源保持原始完整

**红线：从线上拿到的任何代码文件、字节码字符串，必须和原始文件一模一样，一个字节都不能改。**

## 为什么

- `save_script_source` 工具会格式化代码，可能导致：
  1. 长行被截断（如 `__$c` bytecode 233K → 只保存了 7.5K）
  2. Unicode 字符被损坏（如希腊字母 `Ι`(U+0399) vs 拉丁 `I` — VMP 用它们做对象 key）
  3. 多行字符串被拆分成不完整的片段
- 这种损坏是**静默的**——代码能加载、不报错，但产出的结果不对
- 小红书项目中因此浪费了大量时间用截断的 bytecode 测试，发现总是在 `mns0201` 原地打转

## 正确做法

1. 用 MCP `evaluate_script` + `fetch` 从浏览器获取原始响应
2. 通过 `btoa(unescape(encodeURIComponent(text)))` base64 编码后传输
3. 文件系统保存时直接写入原始字节，不做任何格式转换
4. 如果文件太大需要分段传输，**每段结尾必须是完整的**，拼接后和原始文件做 checksum 对比

## 相关 memory

- [[xhs-offline-vm]] — 小红书项目中因 bytecode 截断走了弯路
