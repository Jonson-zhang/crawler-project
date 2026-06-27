---
name: python-js-semantic-gaps
description: Python 签名生成代码中反复出现的 Python/JS 语义差异 —— 空 dict 判空、双重序列化、base64 对齐
metadata:
  type: project
---

# Python/JS 语义差异 — 签名生成中反复踩的 4 个坑

Boss直聘、知乎、小红书三个站点中，Python 端签名组装代码反复出现的错误模式。

## 1. 空 dict 的真值判断

**在 JS 中**：`if ({})` → `true`（对象永远是 truthy）
**在 Python 中**：`if {}` → `False`（空 dict 是 falsy）

**后果**：`body={}` 时，Python 生成 `body_str = ""`，JS 生成 `body_str = "{}"` → mnsv2 输入不同 → 签名完全不对。

**症状**：activate 接口返回 406（签名被拒），但 homefeed（带 body 的 POST）正常。

```python
# ❌ 错误
body_str = json.dumps(body) if body else ""

# ✅ 正确
body_str = json.dumps(body) if body is not None else ""
```

**影响站点**：小红书 activate（body={}）、知乎 GET 请求。

## 2. 双重 JSON 序列化

**问题**：`_json_to_bytes(dict)` 内部已经做了 `json.dumps`。如果再传 `json.dumps` 的结果 → 字符串被再次 JSON 编码 → 引号被 escape → 整个 payload 错位。

```python
# ❌ 错误 — payload 是字符串，传入后被再次 json.dumps
payload = json.dumps({"x0": "4.3.5", "x3": h, ...})
result = _b64e(_json_to_bytes(payload))

# ✅ 正确 — 直接传 dict
result = _b64e(_json_to_bytes({"x0": "4.3.5", "x3": h, ...}))
```

**症状**：x-s 前缀与 Node.js 完全不同（`HdTq` vs 正确的 `2UQh`），无论怎么改 env 都不变。

**影响站点**：小红书 x-s 编码。

## 3. Base64 编码表对齐

小红书使用自定义 Base64 编码表 `ZmserbBoHQt...`（非标准 `ABCDEFGHIJ...`）。

Python 端和 JS 端必须使用**完全相同**的表和分块算法。分块步长差了 1 就会导致最后一个 chunk 的 padding 错位。

**验证方法**：同一输入，Python 和 JS 各跑一次，对比 Base64 结果逐字符是否相同。

## 4. JSON 键顺序

Python `json.dumps` 默认保持插入顺序（dict 3.7+），JS `JSON.stringify` 也保持插入顺序。但如果用了 `separators=(...)` 参数不一致，空格差异会导致签名不同。

```python
# ❌ 有空格
json.dumps({"a": 1, "b": 2})  # → '{"a": 1, "b": 2}'

# ✅ 无空格，与 JS JSON.stringify 对齐
json.dumps({"a": 1, "b": 2}, separators=(",", ":"))  # → '{"a":1,"b":2}'
```

**影响站点**：所有需要 Python 和 JS 产出一致签名的场景。

## 验证方法

当签名被 API 拒时，第一步**总是**对比 Python 和 JS 的**签名输入**是否逐字节相同（而不是对比最终输出）：

```
JS  mnsv2 输入:   url + JSON.stringify(body)   ← 对吗？
Python mnsv2 输入: url + json.dumps(body)       ← 对吗？
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^
                    这两者必须逐字节相同
```

**Why:** Python 签名生成代码中 90% 的 bug 是 Python/JS 语义差异，不是算法错误。先检查输入再怀疑输出。
**How to apply:** 签名被拒时，第一步在 Python 和 JS 端分别打印 c/md5_c/md5_url 三个参数，对比是否完全相同。如果不同 → 修复 Python 端序列化逻辑。如果相同 → 才考虑环境/算法差异。
