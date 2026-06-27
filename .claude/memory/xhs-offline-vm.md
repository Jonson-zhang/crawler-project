---
name: xhs-offline-vm
description: 小红书 VMP 签名方案 — 融合 jsr-reverse 阶段路由 + web-reverse-env 诊断驱动 + XHS 特定技巧
metadata:
  type: project
---

# 小红书离线 VMP 签名 — 已攻克 (2026-06-26)

## 方法论融合

基于三个 skill 的整合：

```
jsr-reverse        → 阶段路由（locate→recover→runtime→validation）
web-reverse-env    → 诊断驱动补环境（protect-native + observe-runtime）
xhs-reverse        → XHS 特定知识（eval 抠法 + setter 拦截 + x-s-common + Cookie 引导）
```

## 关键突破

### 1. eval 抠 DS 脚本（locate→recover）

浏览器 4 个 eval 调用分发 DS 模块。
**Network 中的独立文件不是真正执行版本** — 必须从 eval 抠合并后的 ~430KB ds_script.js。

### 2. _AUuXfEG27Xa3x setter 拦截（runtime）

ds_v2 的 VMP 字节码升级时，env 数组有空 slot → `undefined is not a constructor`。
解决：拦截 setter，在 VMP 升级前预填充 200 个 env slot 为可构造的空函数。
详见 [[xhs-setter-intercept]]。

### 3. 原型链不用 jsdom（runtime）

`window = globalThis` + `new HTMLElement()` 建立原型链。
jsdom 的严格构造函数 throw "Illegal constructor"，无法用于 VMP。

### 4. Cookie 引导每步都要签名（validation）

shield/webprofile 和 activate 若不带完整签名，服务端静默降级 → items=0。

## 实现

- `小红书/v2.0/` — Node.js 完整离线方案：env.js + sign.js(daemon) + main.py
- `小红书/iv8/` — iv8 C++ V8 方案（2026-06-27）：纯 Python，无 Node.js、无补环境。迁移踩坑记录见 iv8 系列记忆。

## 相关 memory

- [[xhs-setter-intercept]] — setter 拦截技术详解
- [[env-sign-separation]] — env.js / sign.js 分离架构
- [[online-resources-keep-raw]] — 线上资源禁止截断
- [[iv8-dom-stubs]] — iv8 迁移：DOM 方法必须 stub
- [[iv8-iife-scope]] — iv8 迁移：IIFE 隔离作用域
- [[iv8-foreach-closure]] — iv8 迁移：.forEach() 闭包修复
- [[iv8-navigator-plugins]] — iv8 迁移：navigator.plugins 空数组
