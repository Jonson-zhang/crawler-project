# 小红书 — iv8 方案

纯 Python 签名 + 爬取，无需 Node.js、无需补环境。

## 原理

用 iv8 (C++ V8 引擎) 替代 `sign.js` + `env.js` + Node.js 子进程：

| | Node.js (v2.0) | iv8 |
|---|:---:|:---:|
| 补环境 | `env.js` 400+ 行 Proxy/watch/setNative | 0 行，iv8 C++ 层内置 |
| DOM API | 全量 stub | 真实 DOM + 选择性 stub |
| VMP 加载 | `require()` 模块作用域 | IIFE 隔离 + DOM stub |
| 进程 | `subprocess(["node", "sign.js"])` | 纯 Python 函数调用 |
| 依赖 | Node.js + npm (crypto-js) | Python only (iv8 pip) |

## 文件

| 文件 | 说明 |
|------|------|
| `xhs_sign.py` | iv8 签名器（替代 sign.js + env.js，~240 行） |
| `main_iv8.py` | Python 入口：Cookie 引导 + API 请求 + 翻页 |
| `ds_script.js` | VMP 解释器（浏览器提取，430KB） |
| `data/ds_api.js` | 签名辅助（60KB） |
| `data/ds_v2.js` | VMP 升级 mns0201→mns0301（62KB） |

## 使用

```bash
pip install iv8 curl-cffi pycryptodome

# 测试签名
python xhs_sign.py "/api/sns/web/v1/homefeed"

# 爬推荐流（含自动 Cookie 引导）
python main_iv8.py

# 爬 5 页 + 显示正文
python main_iv8.py --pages 5 --detail
```

## 踩坑

### DOM stub 必须做

VMP 字节码解释器会调用 `removeChild`、`appendChild` 等 DOM API。iv8 的真实 DOM 会校验参数类型（`TypeError: Parameter 1 is not of type 'Node'`），必须 stub 为 noop。

### ds_script.js 必须 IIFE 隔离

Node.js 中 `ds_script.js` 通过 `require()` 加载（CommonJS 模块作用域），`var _0xe762c0` 等变量局部于模块。iv8 中所有代码在全局作用域，`ds_v2.js` 会覆盖 `_0xe762c0` → VMP 解释器闭包引用错 → 解码失败。IIFE 包裹 `ds_script.js` 模拟模块作用域。

### VMP setter 拦截必须用 .forEach()

`for` 循环 + `var` 声明的 `_ra`/`_oa` 在所有迭代间共享闭包 → 最后一个覆盖所有。`.forEach()` 每次回调有独立 `_ra`/`_oa`。

### navigator.plugins 必须为空数组

VMP 环境检测会查 `navigator.plugins.length`。真实 Chrome 有内置插件（Chrome PDF Viewer 等），env.js 设置为 `[]`。iv8 配置中显式设为 `[]`。
