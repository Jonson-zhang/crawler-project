---
name: iv8-doc-cookie
description: iv8 中 document 不可 POJO 替换，必须直接设 C++ document.cookie 才能让 VMP 产出 192 字符签名
metadata:
  type: project
---

# iv8 中 document 不可替换，必须直接赋值 document.cookie

## 问题

小红书 VMP 的 `mnsv2` 输出长度由 `document.cookie` 的值决定：
- `document.cookie = ""` → 128 字符
- `document.cookie = "a1=xxx; webId=xxx; ..."` → 192 字符（正确）

## 根因

iv8 的 `document` 是 C++ 全局对象，**不可通过赋值替换为 POJO**：

```python
# ❌ 无效 —— ctx.eval 内部 document = {...} 只创建局部变量
ctx.eval("document = { cookie: 'test' };")
ctx.eval("document.cookie")  # → "" (C++ document)

# ❌ 无效 —— window.document 同样不可替换
ctx.eval("window.document = { cookie: 'test' };")

# ✅ 有效 —— 直接修改 C++ document 的属性
ctx.eval("document.cookie = 'a1=test; webId=test';")
ctx.eval("document.cookie")  # → "a1=test; webId=test"
```

## 为什么 POJO stub 不行

小红书 VMP env 检测不是表面属性检查（`document.body`、`document.cookie` 都有），
而是更深层的原型链/构造器检测（如 `document.body.constructor.name`、`instanceof HTMLBodyElement` 等）。
POJO `{body: {}}` 无法通过这类检测。

iv8 C++ document 经过 DOM stub 后仍保持原型链完整性，VMP 才能正常执行。

## 结论

iv8 小红书签名已攻克——根因不是 document.cookie 而是三个 Python/JS 差异 bug：
1. Python `if body`（空 dict falsy）vs JS truthy
2. `_json_to_bytes(json.dumps(...))` 双重 JSON 编码
3. `document` 不可全局替换，需用 `Object.defineProperty` 覆盖 getter

`document.cookie` 设置方式仍然重要：必须用 `Object.defineProperty` 精确控制返回值，不能用 C++ cookie setter（自动加 `ets` 时间戳）。

**Why:** iv8 C++ 全局对象（document/navigator/screen）不可替换，只可修改属性。
**How to apply:** 在 iv8 中补环境时，不要尝试 `document = {...}`，改为 `document.cookie = "..."`、`document.querySelector = function(){}` 等逐属性覆盖。

[[iv8-dom-stubs]] [[iv8-iife-scope]] [[iv8-foreach-closure]] [[iv8-navigator-plugins]]
