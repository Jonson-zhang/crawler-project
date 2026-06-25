# Cookie 引导流程

## 请求链

```
Step 1: 纯 Python 生成
  a1 = hex(ms_ts) + random30 + 平台码 + "000" + CRC32
  webId = MD5(a1)

Step 2: /api/sec/v1/scripting (POST)
  请求: {"callFrom": "web", "callback": "seccallback"}
  响应: {"data": {"data": "<JS字符串含 b/d>", "secPoisonId": "uuid"}}
  提取: websectiga (JSVMP 解密), sec_poison_id (Set-Cookie)

Step 3: /api/sec/v1/shield/webprofile (POST) ⚠️ 必须带完整签名
  指纹: {"uuid":"joiamkprgeyi238i", "requestId":"md5[:16]"}
  加密: 指纹JSON → std Base64 → DES ECB(key="zbp30y86") → hex
  请求: {"platform":"Windows", "profileData":"hex", "sdkVersion":"4.2.6", "svn":"2"}
  签名头: x-s + x-s-common + x-b3 + x-xray
  响应: Set-Cookie → gid, acw_tc

Step 4: /login/activate (POST) ⚠️ 必须带完整签名
  请求: {}
  签名头: x-s + x-s-common + x-b3 + x-xray
  响应: Set-Cookie → web_session
```

## 最终 Cookie 清单

| # | Cookie | 来源 | 长度 | 必需 |
|---|--------|------|------|------|
| 1 | a1 | Step 1 生成 | 52 | ✅ |
| 2 | webId | Step 1 MD5(a1) | 32 | ✅ |
| 3 | webBuild | 硬编码 "6.12.3" | - | ✅ |
| 4 | xsecappid | 硬编码 "xhs-pc-web" | - | ✅ |
| 5 | loadts | 毫秒时间戳 | 13 | ✅ |
| 6 | abRequestId | UUID4 | 36 | ✅ |
| 7 | websectiga | Step 2 JSVMP 解密 | 64 | ✅ |
| 8 | sec_poison_id | Step 2 Set-Cookie | 36 | ✅ |
| 9 | gid | Step 3 Set-Cookie | ~60 | ✅ |
| 10 | acw_tc | Step 3 Set-Cookie | ~48 | - |
| 11 | web_session | Step 4 Set-Cookie | 38 | ✅ |

## 常见失败原因

1. **shield/webprofile 没带签名** → cookie 受限 → homefeed items=0
2. **activate 没带签名** → web_session 不存在或无效
3. **abRequestId 缺失** → 早期版本最容易漏的 cookie
4. **sec_poison_id 缺失** → scripting 响应中的 Set-Cookie 没被正确读取
5. **websectiga 解密错误** → JSVMP 逻辑表 b/d 的解析偏移不对
