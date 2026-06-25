# 小红书 Web API 逆向 Skill

逆向小红书 PC Web 端 API 签名参数的完整方法论。

## 硬约束

1. **每个请求独立验证** — 一个参数在 A 请求上通过 ≠ 在 B 请求上也通过。必须对引导阶段和业务阶段的每个请求分别验证。
2. **Cookie 一个不能少** — 11 项 cookie，缺一个可能静默失败（code=0 但无数据）。
3. **引导请求和业务请求一样需要完整签名** — shield/webprofile、activate 必须带 x-s + x-s-common + x-b3 + x-xray。
4. **对比法优先** — 遇到 code=0 items=0 时，第一时间用真实浏览器抓请求做逐行对比，不要猜。

## 参数清单

| 参数 | 来源 | 复杂度 | 依赖 |
|------|------|--------|------|
| `x-s` | 线上 VM 抠代码 + 补环境 | 高 | Node.js + sign.js |
| `x-t` | `int(time.time() * 1000)` | 低 | 无 |
| `x-b3-traceid` | `random.choices(hex, k=16)` | 低 | 无 |
| `x-xray-traceid` | `(ts << 23) \| random` | 低 | 无 |
| `x-s-common` | 指纹 + RC4(b1) + MRC_CRC32 + b64 | 中 | pycryptodome |
| Cookie 引导 | 4 步请求链 + 自研签名 | 中 | pycryptodome |

## 流程速查

### 场景 1：从零开始逆向（新站点/新版本）

见 [references/new-site-workflow.md](references/new-site-workflow.md)

### 场景 2：Cookie 引导失败

1. 用浏览器抓一次完整的 shield/webprofile 请求
2. 和代码生成的请求逐行对比：cookie 字段数、x-s-common 长度、是否缺 x-b3/x-xray
3. 对照 [references/cookie-bootstrap.md](references/cookie-bootstrap.md)

### 场景 3：homefeed 返回 items=0

1. 先用真实浏览器的 cookie 跑一次 homefeed，确认接口本身能返回数据
2. 再用自己的 cookie 跑，对比请求头差异
3. 如果自己的 cookie 也能返回——说明引导没问题，是游客无推荐
4. 如果自己的 cookie 不返回——引导阶段的签名有问题，回到场景 2

### 场景 4：x-s 生成失败

1. `node sign.js` 直接报错 → env.js 环境变量缺失，参考 [references/mns-extraction.md](references/mns-extraction.md)
2. 输出 mns0201 而非 mns0301 → ds_v2.js 未加载或 setter 拦截失效
3. 输出为空 → eval 抠漏了，重新搜索

### 场景 5：x-s-common 验证未通过

1. 抓浏览器真实 x-s-common → 解码 → 对比 JSON 字段数和值
2. 逐字段排查：s0(平台码)、x1(版本号)、x4(webBuild)、x5(a1)、x8(b1)、x9(CRC32)
3. 对照 [references/xsc-common.md](references/xsc-common.md)

## Cookie 引导流程

```
Step 1: 生成 a1/webId
  → hex(ts) + random30 + "5" + "0" + "000" + CRC32 → a1 (52 位)
  → MD5(a1) → webId

Step 2: /api/sec/v1/scripting
  → POST → 获取 b/d 字段 → JSVMP 解密 → websectiga
  → 响应 Set-Cookie: sec_poison_id

Step 3: /api/sec/v1/shield/webprofile  ← 必须带完整签名
  → 指纹 JSON → Base64 → DES ECB(key="zbp30y86") → hex
  → POST → 响应 Set-Cookie: gid, acw_tc

Step 4: /login/activate  ← 必须带完整签名
  → POST {} → 响应 Set-Cookie: web_session
```

最终得到 11 项 cookie：a1, webId, webBuild, xsecappid, loadts, abRequestId, websectiga, sec_poison_id, gid, acw_tc, web_session。

## x-s-common 结构

```
JSON (14 字段):
  s0=5, s1="", x0="1", x1="4.3.5", x2="Windows", x3="xhs-pc-web",
  x4="6.12.3", x5=a1, x6="", x7="",
  x8=b1, x9=CRC32(b1), x10=0, x11="normal"

b1 生成:
  18项指纹子集 → JSON → RC4(key="xhswebmplfbt") → URL encode → bytearray → 自定义Base64

编码管线:
  JSON → url quote(safe:~()*!./:?=&-_) → byte array → 自定义Base64(ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5)
```

## 经验法则

1. **code=0 items=0 不是"无数据"，是 cookie 不完整** — 这是最常见的静默失败
2. **先对比再补环境** — 拿不到数据时，别急着加环境变量，先用真实浏览器的请求做对比
3. **硬编码版 x-s-common 在某些接口可能不够** — homefeed 能过不代表 shield/webprofile 能过
4. **4 个 eval 一个不能漏** — 少了任何一个，window.mnsv2 停留在 mns0201，数据接口不认
5. **补环境不是为了跑通，是为了跑对** — 跑通≠结果正确，必须和浏览器输出一致
6. **不要假定 TLS 指纹是根因** — curl_cffi 的 impersonate 对小红书 API 请求足够，SSR 页面才需要更强的 TLS
7. **x-rap-param 不是游客 homefeed 的必需品** — 不要为不需要的参数浪费精力
