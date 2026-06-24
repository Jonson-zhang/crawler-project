# 小红书离线签名 — 状态报告

## 架构

```
方案 A: Node.js 补环境 (sign.js)
  Python → subprocess node sign.js → {x-s, x-t}
  vendor.js + env.dom.js → VMP 创建 mnsv2 → seccore_signv2

方案 B: Python 纯算 (sign.py)  ← 当前推荐
  sign.py 内直接实现 XXTEA + 自定义 Base64 + MD5
  无需 vendor.js, 无需 Node.js
```

## 目录 (7 文件)

```
小红书/
├── VM_STATUS.md     # 本文档
├── sign.py          # Python 纯算签名 ✅
├── sign.js          # Node.js 补环境签名 (备用)
├── main.py          # Python 入口
├── env.dom.js       # 浏览器原型链补环境
└── data/
    ├── vendor.js    # webpack bundle
    └── cookies.json
```

## seccore_signv2 公式 (已验证)

```python
url = "/api/sns/web/v1/homefeed"
body = '{"cursor_score":"","num":20}'
combined = url + body

hc = MD5(combined)   # hex
hu = MD5(url)        # hex

x3 = mnsv2(combined, hc, hu)   # XXTEA/RC4 → custom Base64

payload = {"x0":"4.3.5","x1":"xhs-pc-web","x2":"Windows","x3":x3,"x4":"object"}
xs = "XYS_" + custom_base64(payload.to_json_utf8)
xt = str(int(time.time()*1000))
```

### 自定义 Base64

x-s payload: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
mns0201:      `MfgqrsbcyzPQRStuvC7mn501HIJBo2DEFTKdeNOwxWXYZap89+/A4UVLhijkl63G`

## mnsv2 算法 (来自 CSDN 文章)

### 版本对比

| 版本 | 算法 | payload | 前缀 | 状态 |
|------|------|---------|------|------|
| mns0201 | XXTEA (key=e6483ca2a1eed5e3, Δ=0x3C6EF373) | 89B | mns0201_ | ✅ Python 已实现 |
| mns0301 | RC4 (预置 S-box, 256B) | 135B | mns0301_ | ❌ 需 S-box |

### mns0201 XXTEA (已实现)

```python
XXTEA_KEY = b"e6483ca2a1eed5e3"  # 16B ASCII
XXTEA_DELTA = 0x3C6EF373         # 修正版魔数

payload_89B:
  [0:4]   magic "xh\)" 
  [4:8]   随机数 u32
  [8:16]  时间戳 u64
  [16:20] flags u32 (=15)
  [20:36] MD5(url+body) XOR 0x5A
  [36:52] MD5(url) XOR 0xA5
  [52:56] URL 长度 u32
  [56:89] 预留 (0x00)
→ XXTEA(key, delta) → Base64(mns0201字母表) → "mns0201_" + result

当前状态: ✅ 实现 + format 正确 (132 chars output)
            ❌ server 返回 406 (需要 mns0301)
```

### mns0301 RC4 (待实现)

```
payload_135B:
  [0:4]   magic "xh\)"
  [4:8]   随机数 u32
  [8:16]  当前时间戳 ms u64
  [16:24] 页面加载时间戳 ms u64
  [24:28] 固定值 (15-17) u32
  [28:32] 点击计数器 u32
  [32:36] mouseenter 计数器 u32
  [36:44] 随机浮点数 f64
  [44:97] a1 cookie (53B, 前缀 "4" + 52B hex)
  [97]    \n
  [98:108] xsecappid "xhs-pc-web"
  [108]   \x01
  [109:135] extra (1B random + 17B fixed + 8B random)
→ RC4(S-box) → Base64(XHS字母表) → "mns0301_" + result

当前状态: ❌ 缺 RC4 S-box (256B 置换表)
```

## 下一步

1. **提取 RC4 S-box**: 从 VMP eval 代码 (vendor.js 模块 68274) 中搜索 256 元素数组
2. **构造 135B payload**: 需要 a1 cookie 值和正确的计数器
3. **测试 mns0301**: 预期 server 返回 200
