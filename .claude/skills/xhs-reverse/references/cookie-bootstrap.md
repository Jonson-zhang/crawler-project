# Cookie 引导流程

**关键前提**：引导阶段的每个请求都必须带完整 5 项签名头（x-s + x-s-common + x-t + x-b3-traceid + x-xray-traceid），否则服务端会静默降级。

## 请求链

```
Step 1: 纯 Python 生成
  a1 = hex(ms_ts) + random30 + 平台码 + CRC32
  webId = MD5(a1)

Step 2: /api/sec/v1/scripting (POST)
  请求: {"callFrom": "web", "callback": "seccallback"}
  响应: {"data": {"data": "<JS字符串含 b/d>", "secPoisonId": "uuid"}}
  提取: websectiga (JSVMP 解密 b/d 字段), sec_poison_id (Set-Cookie)
  ⚠️ 此步骤**不需要** x-s 签名头，基础 Cookie 即可

Step 3: /api/sec/v1/shield/webprofile (POST) ⚠️ 必须带完整 5 项签名
  指纹: {"uuid":"joiamkprgeyi238i", "requestId":"md5[:16]"}
  加密: 指纹JSON → std Base64 → DES ECB(key="zbp30y86") → hex
  请求: {"platform":"Windows", "profileData":"hex", "sdkVersion":"4.2.6", "svn":"2"}
  响应: Set-Cookie → gid, acw_tc

Step 4: /login/activate (POST) ⚠️ 必须带完整 5 项签名
  请求: {}
  响应: Set-Cookie → web_session（访客模式也可能得到）
```

## 最终 Cookie 清单

| # | Cookie | 来源 | 必需 |
|---|--------|------|------|
| 1 | a1 | Step 1 生成 (52 char) | 是 |
| 2 | webId | Step 1 MD5(a1) (32 char) | 是 |
| 3 | webBuild | 从浏览器 Cookie 获取当前值 | 是 |
| 4 | xsecappid | 硬编码 "xhs-pc-web" | 是 |
| 5 | loadts | 毫秒时间戳 (13 char) | 是 |
| 6 | abRequestId | UUID4 (36 char) | 是 |
| 7 | websectiga | Step 2 JSVMP 解密 (64 char) | 是 |
| 8 | sec_poison_id | Step 2 Set-Cookie (36 char) | 是 |
| 9 | gid | Step 3 Set-Cookie (~60 char) | 是 |
| 10 | acw_tc | Step 3 Set-Cookie (~48 char) | 可选 |
| 11 | web_session | Step 4 Set-Cookie (38 char) | **homefeed 不需要** |

## 访客 Cookie 真相

**homefeed API 不需要 web_session。** 以下 9 项 Cookie 就足够：

```
a1, webId, webBuild, xsecappid, loadts, abRequestId,
websectiga, sec_poison_id, gid
```

## 常见失败原因

1. **shield/webprofile 没带 x-s/x-s-common** → cookie 受限 → homefeed items=0
2. **activate 没带 x-s** → 响应 461 或 200 但无 web_session
3. **abRequestId 缺失** → 容易被遗漏的 cookie
4. **sec_poison_id 缺失** → scripting 响应的 Set-Cookie 未被正确读取
5. **websectiga 解密错误** → JSVMP 逻辑表 b/d 解析偏移不对
6. **引导阶段 Cookie 只用 requests.Session 自动管理** → Set-Cookie 自动携带
