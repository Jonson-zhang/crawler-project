# 小红书离线签名 — 状态报告

## seccore_signv2 完整公式

```javascript
function seccore_signv2(url, body) {
  var combined = url + JSON.stringify(body);         // url + body 拼接
  var hc = MD5(combined);                             // 模块 40055 K.Pu → hex string
  var hu = MD5(url);                                  // 模块 40055 K.Pu → hex string
  var x3 = window.mnsv2(combined, hc, hu);           // VMP 字节码 → "mns0301_<base64>"
  var payload = JSON.stringify({
    x0: "4.3.5",       // 版本
    x1: "xhs-pc-web",   // 平台
    x2: "Windows",       // OS
    x3: x3,              // mnsv2 签名
    x4: "object"         // 数据类型
  });
  return {
    "x-s": "XYS_" + customBase64(utf8encode(payload)),
    "x-t": String(Date.now()),
    "x-s-common": customBase64(JSON.stringify(fingerprint_data))
  };
}
```

### 自定义 Base64 字母表

```
x-s payload:  ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5 (64 chars)
```

## mnsv2 版本

| 版本 | 算法 | payload | 状态 |
|------|------|---------|------|
| mns0301 | RC4 (魔改, 预置S-box) | 144 bytes | ✅ 浏览器正常 |
| mns0201 | XXTEA (key=e6483ca2, Δ=0x3C6EF373) | 89 bytes | ❌ Node.js 产生空 hash |

## 各方案状态

### 方案 A: Node.js 补环境 (sign.js)
- vendor.js 加载 ✅ (~43ms)
- eval 代码执行 ✅ (288KB VMP 代码)
- mnsv2 函数创建 ✅  
- mnsv2 输出: `mns0201_0` ❌ (空 hash, 服务端 406)
- 根因: VMP 字节码内 XXTEA/RC4 实现需要完整浏览器指纹
  (Canvas/WebGL/Audio pixel values) 生成 256-byte S-box

### 方案 B: Python 纯算 (sign.py)
- XXTEA 实现 ✅
- mns0201 payload 构造 ✅
- 服务端 406 ❌ (mns0201 已废弃, 需 mns0301)

### 方案 C: 浏览器桥接 ✅
- Camoufox + 有效 cookies → SDK 自动签名
- 成功捕获 x-s/x-t headers (200 status)
- Python 通过 MCP 控制浏览器发请求

## 已知数据

### x-s-common 结构
```json
{
  "s0": 5, "s1": "",
  "x0": "1", "x1": "4.3.5", "x2": "Windows", "x3": "xhs-pc-web",
  "x4": "6.24.0", "x5": "<a1_cookie>", "x6": "", "x7": "", "x8": "",
  "x9": -1867254643, "x10": 0, "x11": "normal",
  "x12": "<timestamp>;<page_load_ts>"
}
```

### mns0301 真实输出
```
mns0301_gRaKquYBtF9a4f94ED0id5NkrTarR85VJgjxYULE2jn47z4du0nBKyytpaVQ
yp4+JGShbV6D1qIGPp2+OD4JRR0w7yWjOfE1wziPTG4FHme2TAk/4KgA0JHKXSJxL8i1
1CMCnpsRzRJ
→ 200 chars total (= 192 chars Base64 → 144 bytes encrypted)
```

## 文件清单 (6 files)

```
小红书/
├── VM_STATUS.md
├── sign.py          (Python XXTEA)
├── sign.js          (Node.js 补环境)
├── main.py          (Python 入口)
├── env.dom.js       (浏览器原型链)
└── data/
    ├── vendor.js    (webpack bundle, 1.36MB)
    └── cookies.json (fresh cookies)
```

## 下一步

要打通纯 Python 签名需要:
1. 从 vendor.js eval 代码 (288KB) 逆向 VMP 字节码 → 提取 RC4 S-box
2. 或从浏览器 Canvas/WebGL 指纹 → 重新生成 S-box
3. 实现 144-byte payload → RC4(S-box) → 自定义Base64

两个都需要深入的 VMP 字节码逆向工作。
