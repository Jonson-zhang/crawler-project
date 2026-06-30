# 东航 iv8 — 纯 Python 非浏览器自动化方案

## 当前状态（2026-06-29）

**混合方案可用**：iv8 做 WASM 加解密 + DrissionPage 做 HTTP。

**纯 iv8 端到端暂不可用**：Tongdun SDK 可在 iv8 中运行并生成 blackbox 指纹 token，
但服务器端 AI 将 iv8 stub 返回的 Canvas/WebGL 指纹识别为"数据伪造"，拒绝下发 `ssxmod_itna` Cookie。

详见 [../NOTES.md#八iv8-方案研究2026-06-29](../NOTES.md#八iv8-方案研究2026-06-29)

## 快速开始

```bash
# 推荐：混合方案（iv8 加密 + 浏览器 HTTP）
python test_hybrid.py 上海 北京 20260630

# 加密/解密单独使用
python ceair_iv8.py encrypt '{"routes":[...]}'
python ceair_iv8.py decrypt 'base64...'

# 纯 iv8 尝试（会被 WAF 拦截 — TLS 指纹 + 缺 ssxmod）
python test_iv8.py 上海 北京
```

## API

```python
from ceair_iv8 import CeairWasm

with CeairWasm() as w:
    enc = w.encrypt({"routes": [...]})   # → {"req": "base64..."}
    data = w.decrypt(enc["req"])         # → dict (原始 payload)
```

## 文件

| 文件 | 作用 | 状态 |
|------|------|------|
| `ceair_iv8.py` | `CeairWasm` — iv8 内嵌 V8 做加解密 | ✅ 生产可用 |
| `test_hybrid.py` | iv8 加密 + DrissionPage HTTP | ✅ 推荐 （39 flights / 9.4s） |
| `test_iv8.py` | 纯 iv8 + curl_cffi 端到端 | ❌ WAF 拦截 |
| `test_tongdun.py` | Tongdun SDK 在 iv8 中直接加载 | 研究参考 — blackbox 生成但服务器拒绝 |
| `iv8_polyfills.js` | Blob Worker + URL.createObjectURL shim | Tongdun SDK 适配 |
| `config.json` | 默认出发/到达/日期 | |

## 已验证

- [x] iv8 encrypt ↔ Node.js sign.js decrypt（跨兼容）
- [x] Node.js sign.js encrypt ↔ iv8 decrypt（跨兼容）
- [x] Emscripten wasm2js 在 iv8 WEB 模式零补丁运行
- [x] Tongdun fm.js (510KB) 在 iv8 中完整加载并执行
- [x] Worker + postMessage 双向通信（通过 polyfill）
- [x] blackbox token 生成（`tddfeyJ2IjoiNC4yLjQi...`）
- [ ] Tongdun 服务器验证通过 → ssxmod_itna 下发
