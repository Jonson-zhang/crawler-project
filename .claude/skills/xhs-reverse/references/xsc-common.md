# x-s-common 逆向

## 编码管线

```
JSON → URL Encode → byte array → 自定义 Base64
```

自定义 Base64 表：`ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`

## JSON 结构

x-s-common 解码后是一个 JSON 对象，字段数可能随版本增加（当前为 15 字段）。

核心字段：

| 字段 | 含义 | 示例值 | 说明 |
|------|------|--------|------|
| s0 | 平台码 | 5 | Windows=5 |
| s1 | 预留 | "" | |
| x0 | 标记位 | "1" | localstorage.getItem("b1b1") |
| x1 | 版本号 | "4.3.5" | SDK 版本 |
| x2 | 操作系统 | "Windows" | 从 navigator.platform 提取 |
| x3 | App ID | "xhs-pc-web" | 固定值 |
| x4 | webBuild | 从浏览器 Cookie/webBuild 获取 | **每次逆向从浏览器提取，不硬编码** |
| x5 | a1 值 | Cookie 中的 a1 | 52 字符 |
| x6 | 预留 | "" | |
| x7 | 预留 | "" | |
| x8 | b1 指纹 | RC4 加密的 18 项指纹子集 | 最长最复杂的字段 |
| x9 | CRC32(b1) | int | JS 风格有符号 CRC32 |
| x10 | 请求计数器 | 0 | |
| x11 | 类型 | "normal" | |
| x12 | 时间戳对 | 毫秒时间戳 | 新版本新增字段 |

**从浏览器获取当前 webBuild**：
- Cookie `webBuild` 字段
- 或 `document.cookie` 中查找
- 或从 x-s-common 解码后看 x4 字段

## b1 生成（x8 字段）

### 18 项指纹子集

| 键 | 值 | 含义 |
|----|-----|------|
| x33 | "0" | 微信内置浏览器检测 |
| x34 | "0" | Brian Paul 虚拟渲染器 |
| x35 | "0" | Modernizr 检测 |
| x36 | random(1-20) | window.history.length |
| x37 | "0|0|..." (24位) | 环境检测标志位 1 |
| x38 | "0|0|1|..." (39位) | 环境检测标志位 2 |
| x39 | 0 | localStorage 计数器 |
| x42 | "3.5.4" | FingerprintJS 版本 |
| x43 | "Canvas not supported" | canvas 指纹桩 |
| x44 | ms_ts | 当前毫秒时间戳 |
| x45 | "__SEC_CAV__1-1-1-1-1|__SEC_WSA__|" | 风控 SDK 打点 |
| x46 | "false" | navigator.webdriver 属性 |
| x48 | "" | 预留 |
| x49 | "{list:[],type:}" | 预留结构 |
| x50-x52 | "" | 预留 |
| x82 | "_0x17a2|_0x1954" | iframe contentWindow 差异 |

### RC4 加密

```python
from Crypto.Cipher import ARC4
cipher = ARC4.new(b"xhswebmplfbt")
ciphertext = cipher.encrypt(b1_json.encode("utf-8"))
# → Latin1 解码 → URL encode → bytearray → 自定义 Base64
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

## 解码验证方法

1. 从浏览器 Network 面板复制 x-s-common 值
2. 自定义 Base64 解码 → JSON
3. 逐字段与自己生成的值对比
4. 特别注意 x8(b1) 长度和 x9(CRC32) 是否有符号
