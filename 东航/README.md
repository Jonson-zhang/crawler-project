# 东航机票爬虫 — WASM 逆向工程

## 概述

对东航 (ceair.com) 移动端机票搜索 API 进行逆向分析：

- **API**: `POST https://m.ceair.com/m-base/sale/shoppingv2`
- **加密方式**: WASM white-box AES-CBC
- **WASM 类型**: Emscripten wasm2js（WASM → JavaScript 编译，无 .wasm 二进制文件可用）
- **反爬**: Aliyun WAF v3 (`acw_sc__v3`) + Tongdun/TrustDecision 指纹 SDK (`ssxmod_itna`)

## ✅ 验证状态

| 项目 | 状态 | 说明 |
|------|------|------|
| WASM AES-CBC 加解密 | ✅ | Node.js sign.js 独立运行，roundtrip 验证通过 |
| 请求体加密格式 | ✅ | `{"req":"base64..."}` JSON POST |
| 响应体解密格式 | ✅ | `{"res":"base64..."}` → 解密 → JSON flights |
| Python 爬虫 | ✅ | 端到端验证：40 航班数据成功返回 |
| 无浏览器 Docker 运行 | ✅ | sign.js 仅需 Node.js 标准库，无 DOM 依赖 |

## 文件结构

```
东航/
├── sign.js                # Node.js 加密模块（环境补丁 + WASM 加载 + 加解密）
├── crawler.py             # Python 爬虫客户端（Cookie 管理 + API 调用）
├── cookies.json           # 用户 Cookie 配置（需从浏览器获取，见下文）
├── wbsk_Wbox.js           # Emscripten wasm2js 模块（~1MB，CDN 原始文件）
├── wbsk_skb_orig.js       # 浏览器原始加密包装器（未修改）
├── wbsk_skb_live.js       # CDN 当前版本快照
├── phantom-limb.js         # 触摸事件模拟器（非加密相关）
├── tingyun-origin.js       # Tingyun（听云）RUM SDK
├── reserve.js             # SPA reserve 页面 bundle（内含 HTTP 服务 + 加密）
├── ceair_crypto.js         # 旧版加密脚本（已被 sign.js 取代）
└── README.md
```

## 环境补丁分析

### Emscripten wasm2js（非 wasm-bindgen）

| 需求 | 状态 | 说明 |
|------|------|------|
| `global.Module` | ✅ `require('./wbsk_Wbox.js')` | wasm2js 在 Node 环境通过 `module.exports` 返回 |
| `window` / `document` | ❌ 不需要 | Emscripten 走 `ENVIRONMENT_IS_NODE` 路径 |
| `crypto` | ❌ 不需要 | 白盒 AES，密钥在代码中 |
| `self` / `globalThis` | ❌ 不需要 | 非 wasm-bindgen 体系 |
| DOM APIs | ❌ 不需要 | 加密函数纯计算，无 DOM 依赖 |

### 与 wasm-bindgen 的差异

| 特性 | wasm-bindgen | Emscripten wasm2js |
|------|-------------|-------------------|
| 原生 .wasm 文件 | ✅ 有 | ❌ 编译为 JS |
| 导入函数 | `wbg.__xxx` (30+) | 无（内嵌运行时） |
| stub 生成 | `wasm-objdump -x` → `gen_stub_template.js` | 不适用（无 .wasm 文件） |
| 函数调用 | 直接调用 WASM 导出 | `Module.cwrap()` 包装 |
| 环境需求 | self/window/document/crypto | 仅 Node.js 标准库 |

## WASM 导出函数（已验证）

| 函数 | 用途 | 签名（Emscripten cwrap 元数据） |
|------|------|-------------------------------|
| `wbsk_AES_ecb_encrypt` | ECB 加密 | `(input:Uint8Array, inlen, outadd:ptr, lenadd:ptr) → number` |
| `wbsk_AES_ecb_decrypt` | ECB 解密 | `(input:Uint8Array, inlen, outadd:ptr, lenadd:ptr) → number` |
| `wbsk_AES_cbc_encrypt` | CBC 加密 | `(input, inlen, outadd:ptr, lenadd:ptr, iv:Uint8Array, ivlen) → number` |
| `wbsk_AES_cbc_decrypt` | CBC 解密 | `(input, inlen, outadd:ptr, lenadd:ptr, iv:Uint8Array, ivlen) → number` |
| `wbsk_skb_encrypt` | 高层封装 | 未在本实现中使用 |
| `wbsk_skb_decrypt` | 高层封装 | 未在本实现中使用 |

> 所有签名来自 Emscripten 编译元数据 + C 源码类型，非猜测。

## IV（固定值）

```js
const IV = [121, 96, 7, 103, 57, 95, 61, 124, 121, 96, 7, 103, 57, 95, 61, 124];
```

## 反爬 Cookie 体系

| Cookie | 来源 | 作用 | 获取方式 |
|--------|------|------|---------|
| `acw_tc` | 首次访问首页 Set-Cookie | Aliyun WAF 基础令牌 | 自动 |
| `acw_sc__v3` | WAF JS 挑战后 Set-Cookie | Aliyun WAF v3 会话 | **需从浏览器导出** |
| `ssxmod_itna` | Tongdun/TrustDecision SDK | 浏览器指纹 | **需从浏览器导出** |
| `ssxmod_itna2` | Tongdun/TrustDecision SDK | 补充指纹 | **需从浏览器导出** |
| `_c_WBKFRo` | WAF 令牌 | 请求关联 | 自动 |
| `SERVERID` | 负载均衡 | 会话保持 | 自动 |

### ⚠️ Cookie 绑定关系

**`acw_tc` + `ssxmod_itna` 必须配对使用**。每次访问首页获取的 `acw_tc` 是新的，旧的 `ssxmod_itna` 会因此失效。因此从浏览器导出 Cookie 时必须**同时导出全部 Cookie**，不能只导出 `ssxmod_itna`。

`crawler.py` 已实现：检测到 `cookies.json` 中有 `acw_tc` 时，跳过首页访问直接使用已有 Cookie，避免破坏配对关系。

## 使用方法

### 1. 获取完整 Cookie

在 Camoufox 或其他反检测浏览器中：
1. 访问 https://m.ceair.com/mapp/Home
2. 搜索一次机票（任意城市，触发指纹 SDK 完成初始化）
3. F12 → Application → Cookies → m.ceair.com + .ceair.com
4. 复制**全部** Cookie 到 `cookies.json`

```json
{
  "acw_tc": "7...",
  "acw_sc__v3": "6...",
  "ssxmod_itna": "1-...",
  "ssxmod_itna2": "1-...",
  "SERVERID": "...",
  "_c_WBKFRo": "...",
  "language": "zh_CN",
  "ec_i18n_site": "zh_CNY",
  "ec_salesChannel": "7701"
}
```

### 2. 搜索航班

```bash
python crawler.py SHA BJS 20260623
```

### 3. 仅加解密（不发起网络请求）

```bash
# 加密
echo '{"routes":[{"depCode":"SHA","arrCode":"BJS","flightDate":"20260623"}]}' | node sign.js encrypt

# 解密
echo 'base64string' | node sign.js decrypt
```

## 技术要点

1. **WASM 是 Emscripten wasm2js**：不是原生 .wasm 文件，无法使用 `wasm-objdump -x` 提取类型段。但 `Module.cwrap` 的参数类型来自 C 源码编译，属于验证过的信息，非猜测。

2. **白盒 AES**：密钥嵌入在 WASM 二进制代码中，无法从外部提取。只能在 Node.js 中加载完整的 wasm2js 模块来使用加密能力。

3. **Aliyun WAF v3**：服务器端 WAF 验证 `acw_sc__v3` 和 `ssxmod_itna` 的对应关系。Cookie 间有绑定关系——获取方式不能破坏这种绑定。

4. **无需 X-Tingyun/FECU**：本版本测试确认，仅需有效 Cookie 配对即可成功调用 API，无需额外的 X-Tingyun 头或 FECU 参数。旧文章中的 `hxk_fec` 和 `FECU` 参数可能已被移除或不再校验。

5. **环境最小化**：Emscripten 模块在 Node.js 下仅需 `global.Module` 和标准 Node API（fs、path、process），不需要浏览器 DOM/Crypto 等 API。

## 性能

```
SHA → BJS 2026-06-23：40 航班，响应 419KB，耗时 ~2 秒
```

## 限制

- `ssxmod_itna` Cookie 需从反检测浏览器获取，普通 requests 库无法生成
- Cookie 会随时间过期，需定期刷新
- Aliyun WAF 可能更新挑战算法

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 2.1 | 2026-06-21 | 验证完整 Cookie 体系（acw_sc__v3 + ssxmod_itna 配对），Python 爬虫端到端成功 |
| 2.0 | 2026-06-21 | 重构：sign.js + crawler.py，提取 WASM 导出列表，文档化环境补丁 |
| 1.0 | 2026-06-20 | 初始版本：ceair_crypto.js + crawler.py（硬编码 Cookie） |
