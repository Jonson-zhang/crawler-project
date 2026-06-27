# 小红书 — iv8 方案 ✅

纯 Python 签名 + 爬取，无需 Node.js、无需补环境。

## 原理

用 iv8 (C++ V8 引擎) 替代 `sign.js` + `env.js` + Node.js 子进程。

核心实现：
- `Object.defineProperty(document, 'cookie', {get: ...})` — 精确控制 cookie 返回
- `(function(){ds_script})()` — IIFE 隔离 VMP 解释器作用域
- `.forEach()` — VMP setter 拦截闭包隔离
- `_json_to_bytes(dict)` — 直接传 dict，避免双重 JSON 编码

## 文件

| 文件 | 说明 |
|------|------|
| `xhs_sign.py` | iv8 签名器（~210 行） |
| `main_iv8.py` | Python 入口：Cookie 引导 + API 请求 + 翻页 |
| `ds_script.js` | VMP 解释器（430KB） |
| `data/ds_api.js` | 签名辅助（60KB） |
| `data/ds_v2.js` | VMP 升级 mns0201→mns0301（62KB） |

## 使用

```bash
pip install iv8 curl-cffi pycryptodome

# 爬推荐流（含自动 Cookie 引导）
python main_iv8.py

# 爬 5 页 + 显示正文
python main_iv8.py --pages 5 --detail
```

## 踩坑

### Python 空 dict 是 falsy ≠ JS truthy

`body={}` 在 Python 中 `if body` 为 False，JS 中 truthy。导致 activate 的 `x4` 和 `body_str` 与 Node.js 不一致。修复：`if body is not None`。

### `_json_to_bytes` 双重 JSON 编码

`_json_to_bytes(dict)` 内部会 `json.dumps`。`sign()` 中先 `json.dumps` 再传入 → 双重编码 → x-s 与 Node.js 完全不同。

### iv8 document 不可替换

`document = {...}` 无法全局生效。用 `Object.defineProperty(document, 'cookie', {...})` 精确覆盖 getter。

### DOM 方法必须 stub

iv8 C++ `removeChild` 校验参数类型，VMP 会触发 TypeError。
