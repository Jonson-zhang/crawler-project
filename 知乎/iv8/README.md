# 知乎 — iv8 方案

## 原理

知乎 API 需要两个签名头：`x-zse-96` ~
~`x-zst-81`。

签名算法在 webpack chunk（`479.js` ~ 3.4MB）中，依赖少量浏览器 API。

原方案用 Node.js `vm` 沙箱 + 手动补环境。iv8 用 C++ V8 引擎 + 原生浏览器 API，
无需补环境代码。

## 对比

| | Node.js (原方案) | iv8 (新方案) |
|---|---|---|
| 运行时 | Node.js vm 沙箱 | C++ V8 引擎 |
| 补环境 | `env.js` 40 行手动补 | 0 行，iv8 内置 |
| 进程 | `subprocess(["node", "sign.js"])` | 纯 Python |
| 跨语言调用 | Python → stdin/stdout → Node | 直接 `signer.sign()` |
| 初始化 | ~200ms (node 冷启动) | ~3ms (V8 Isolate) |
| 后续签名 | ~5ms per call | ~1ms per call |
| 环境指纹 | JS 层模拟 | C++ 层原生 |

## 文件

| 文件 | 说明 |
|------|------|
| `zhihu_sign.py` | iv8 签名器，替代 `sign.js` + `env.js` |
| `test_api.py` | API 验证脚本 |

## 使用

```python
from zhihu_sign import ZhihuSigner

signer = ZhihuSigner()
headers = signer.sign("/api/v4/me", d_c0="xxx")
# → {"x-zse-96": "2.0_...", "x-zst-81": "3_2.0..."}
```

```bash
# 命令行测试
python zhihu_sign.py "/api/v3/feed/topstory/recommend?action=down" "d_c0_value"
```

## 整合到现有流程

原 `main.py` 用 `subprocess(["node", "sign.js"])` 调用签名，
可替换为 `ZhihuSigner`：

```python
# 原方案 (main.py)
def _sign(self, url_full):
    r = subprocess.run(["node", "sign.js"], ...)

# iv8 方案 (main_iv8.py)
from zhihu_sign import ZhihuSigner
_signer = ZhihuSigner()
def _sign(self, url_full):
    return _signer.sign(url_full, self._d_c0)
```

`main_iv8.py` 是完整整合版，依赖 `pip install iv8 requests urllib3`，
不再依赖 Node.js。

## 知乎检测特点

知乎对浏览器 API 的依赖比 Boss直聘浅得多：

- **不检测 prototype** — `Object.getOwnPropertyDescriptor` 不过度探测
- **不检测 Canvas/WebGL** — 没有画布指纹
- **不检测 VMP** — 没有虚拟机保护混淆
- **主要依赖 `crypto.webcrypto`** — `getRandomValues` 被调用用于签名加密
- **`fetch` / `XMLHttpRequest`** — 仅占位用，不实际请求

因此 iv8 的默认配置就能通过，不需要像 Boss直聘那样精心定制 canvas 指纹。
