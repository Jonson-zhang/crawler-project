# x-s-common 逆向

## 编码管线

```
JSON → URL Encode (safe: ~()*!./:?=&-_) → byte array → 自定义 Base64
```

自定义 Base64 表：`ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`

## JSON 结构（14 字段完整版）

```json
{
  "s0": 5,                       // 平台码 (Windows=5)
  "s1": "",                      // 预留
  "x0": "1",                     // localStorage.getItem("b1b1")
  "x1": "4.3.5",                 // 语言/库版本号
  "x2": "Windows",               // 操作系统
  "x3": "xhs-pc-web",            // App ID
  "x4": "6.12.3",                // webBuild 版本号
  "x5": "<a1值>",                // Cookie a1
  "x6": "",                      // 预留（旧版放 x-s）
  "x7": "",                      // 预留（旧版放 x-t）
  "x8": "<b1值>",                // RC4 加密的 18 项指纹子集
  "x9": <int>,                   // CRC32(b1) - JS 风格有符号 int
  "x10": 0,                      // 请求计数器 (fp.x39)
  "x11": "normal"                // 固定值
}
```

## b1 生成（x8 字段）

### 18 项指纹子集

| 键 | 值 | 含义 |
|----|-----|------|
| x33 | "0" | 微信内置浏览器检测 |
| x34 | "0" | Brian Paul 虚拟渲染器 |
| x35 | "0" | Modernizr 检测 |
| x36 | random(1-20) | window.history.length |
| x37 | "0\|0\|..." (24位) | 环境检测标志位 1 |
| x38 | "0\|0\|1\|..." (39位) | 环境检测标志位 2 |
| x39 | 0 | localStorage 计数器 |
| x42 | "3.5.4" | FingerprintJS 版本 |
| x43 | "Canvas not supported" | canvas 指纹桩 |
| x44 | ms_ts | 当前毫秒时间戳 |
| x45 | "__SEC_CAV__1-1-1-1-1\|__SEC_WSA__\|" | 风控 SDK 打点 |
| x46 | "false" | navigator.webdriver 属性 |
| x48 | "" | 预留 |
| x49 | "{list:[],type:}" | 预留结构 |
| x50-x52 | "" | 预留 |
| x82 | "_0x17a2\|_0x1954" | iframe contentWindow 差异 |

### RC4 加密

```python
from Crypto.Cipher import ARC4
cipher = ARC4.new(b"xhswebmplfbt")
ciphertext = cipher.encrypt(b1_json.encode("utf-8"))
# → Latin1 解码 → URL encode (safe:!*'()~_-) → bytearray → 自定义 Base64
```

## CRC32 (x9 字段)

JavaScript 风格 CRC32，与 Python `zlib.crc32()` 的区别在手写查表和符号位处理：

```python
def _js_crc32(s):
    tbl = [0] * 256
    for i in range(256):
        c = i
        for _ in range(8):
            c = 0xEDB88320 ^ (c >> 1) if c & 1 else c >> 1
        tbl[i] = c
    c = 0xFFFFFFFF
    for b in s.encode("utf-8"):
        c = tbl[(c ^ b) & 0xFF] ^ (c >> 8)
    r = 0xFFFFFFFF ^ c
    return r - 0x100000000 if r >= 0x80000000 else r
```

## 硬编码版 vs 完整版

| | 硬编码版 | 完整版 |
|---|---------|--------|
| 字段数 | 5 | 14 |
| 大小 | 152B | 1320B |
| a1 | "" | 真实值 |
| x2 | API path | "Windows" |
| b1 (x8) | 不存在 | RC4 加密指纹 |
| CRC32 (x9) | 不存在 | JS 有符号 int |
| homefeed 可用 | ✅ | ✅ |
| shield/webprofile 可用 | ❌ | ✅ |

硬编码版 JSON：
```json
{"a1":"","x1":"4.3.5","x2":"/api/sns/web/v1/homefeed","x3":"xhs-pc-web","x4":"<md5(path)>"}
```

**关键发现**：硬编码版在 homefeed 能过，但在 shield/webprofile 引导时不能过。每个请求对 x-s-common 的要求不完全相同。
