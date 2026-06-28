---
name: env-patch-iv8-ceiling
description: JS 补环境天花板判定 — 3 轮迭代仍 code≠0 时切 iv8 的决策规则
metadata:
  type: project
---

# env_patch 天花板与 iv8 切换决策

## 背景

Boss直聘实战中补了 13 轮环境，从 code 37→38→37→38 循环，最终发现根因是 C++ 引擎层 `typeof` / 原型链 / hidden class 差异——JS 层无法模拟。切 iv8（C++ V8 + 原生浏览器 API）后一次通过。

## 决策规则

### 3 轮法则

```
env_patch 迭代 3 轮后:

  签名 crash 有堆栈？ → 栈定位到缺的属性 → 继续补（JS 层问题）
  签名不 crash，输出错误值/错误 code？
    → 用 DEBUG_PROXY 检查 undefined 是否清零
      → 清零了还错？ → 切 iv8
      → 没清零？ → 继续补 1 轮 → 清零后还错？ → 切 iv8
```

### 引擎层差异的典型信号

| 信号 | 说明 |
|------|------|
| VMP 不报错、不 crash，静默生成错误 token | 条件分支走了错误路径 |
| 浏览器 vs Node.js trace 在 `typeof` 处分叉 | Node.js 的 `typeof document.all` = `"undefined"`，浏览器 = `"object"` |
| 属性值完全一致，签名仍不同 | 问题不在属性值，在引擎层语义 |
| `instanceof` 在 Node.js 返回 false | 原型链对象来自不同 context |

## iv8 可行吗？

**Boss直聘**验证结果：VMP 53 个检查点，iv8 全过。真实 V8 引擎的 C++ API 与 Chrome 无法区分。

**小红书**验证结果：VMP 读 `doc.body` + `doc.cookie`，iv8 可通过，但迁移中踩了 Python 语义坑（空 dict 判空、双重序列化）——不是 iv8 环境问题。

**知乎**验证结果：无 VMP，最轻量。

**结论**：VMP 的检测目标不是 iv8 这类真实 V8 引擎，而是 jsdom / Node.js vm 这类 JS 层模拟。iv8 在绝大多数站点上可行。

## 与 env_patch 的关系

```
Node.js + env_patch          iv8
      ↓                        ↓
  勘探工具                  交付产物
  快速试错                  零依赖
  堆栈清晰                  纯 Python
  5 秒一轮                  3ms/次
```

**哪个工具做哪个阶段**：
- Node.js 勘探阶段（Phase 1-2）：env_patch + debug-proxy，搞清签名逻辑和环境依赖
- iv8 交付阶段（Phase 3-4）：把已验证的逻辑搬到 iv8，产 pure Python 模块

**不要**在 iv8 里做勘探（反馈慢、无堆栈），**不要**在 Node.js 里死磕引擎层问题（11 轮打水漂）。

## 参考

- [[iv8-nodejs-workflow]] — 完整两阶段工作流
- [[stop-loss-rules]] — 止损规则（5 分钟判死）
- `.claude/env-patch/README.md#env_patch-天花板` — 判定表 + 三站对比数据
