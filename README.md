#  JS 逆向工程实践

测试使用 AI 辅助完成各类网站的反爬机制逆向分析，涵盖 JSVMP、WASM、环境补丁、C++ V8 嵌入等多种技术路线。

---

## 一、项目目录

### 1. [瑞数](瑞数/) — RS6 反爬体系

**网站**: `www.ouyeel.com` (欧冶钢材)、`兰州交通大学招标平台`

**反爬**: 瑞数6代 (RS6) — JSVMP while(1) 字节码解释器 + 环境指纹验证

**逆向方案**:

| 方案 | 原理 | 状态 | 目录 |
|------|------|------|------|
| **sdenv** | C++ V8 Addon + jsdom，引擎级模拟浏览器 API | ✅ 生产可用 | [瑞数/欧冶/sdenv](瑞数/欧冶/sdenv/) |
| **iv8** | Python C++ V8 嵌入，同进程 3ms 调用 | ✅ 生产可用 | [瑞数/欧冶/iv8](瑞数/欧冶/iv8/) |
| **env-patch** | 纯 JS 原型链补环境，手动 Mock 每个 DOM API | ⚠️ RS6 升级后失效 | [瑞数/欧冶/env-patch](瑞数/欧冶/env-patch/) |

**方案选择**:
- RS6 2026-05 前：三种方案均可
- RS6 2026-07 升级后：**仅 sdenv/iv8 有效**（C++ 引擎层指纹验证，JS 补环境无法绕过）

**入口文件**:
- `sdenv/crawler.py` — sdenv 方案 Python 爬虫
- `sdenv/runner.js` — sdenv 方案 Node.js Cookie 生成器
- `iv8/main.py` — iv8 方案（一步到位：Cookie 生成 + API 查询）
- `env-patch/runner.js` — 手动补环境方案执行器（RS6 升级后失效）

---

### 2. [Boss直聘](Boss直聘/) — `__zp_stoken__` 签名

**网站**: `www.zhipin.com` (Boss直聘)

**反爬**: JSVMP 签名函数 `new ABC().z(seed, ts)` → `__zp_stoken__`

**逆向方案**:

| 方案 | 原理 | 目录 |
|------|------|------|
| **iv8** | Python C++ V8 嵌入，直接执行 JSVMP SDK | [Boss直聘/iv8](Boss直聘/iv8/) |
| **rs-reverse** | JSVMP 字节码静态分析 + 算法还原 | [Boss直聘/reverse_work/rs-reverse](Boss直聘/reverse_work/rs-reverse/) |

**iv8 核心思路**:
1. `ctx = iv8.JSContext(environment={...})` — 设置 location/navigator/screen
2. `ctx.eval(security_js)` — 加载 JSVMP SDK
3. `ctx.eval('new window.ABC().z(seed, ts)')` — 一行调用签名函数
4. `__zp_stoken__` 用于后续 API 请求

**入口文件**: `iv8/boss_iv8.py`, `iv8/zp_stoken.py`

---

### 3. [小红书](小红书/) — `x-s` 签名

**网站**: `www.xiaohongshu.com`

**反爬**: VMP 字节码解释器 + `ds_script.js`/`ds_api.js`/`ds_v2.js` 三层 SDK

**逆向方案**: iv8

**核心难点**:
- VMP 解释器动态赋值，`env` 数组有空槽 → 需要 **setter 拦截** 预填充构造函数
- Signature 依赖 `document.cookie` → Cookie 变化需 **Context 重建**
- 三个 JS 文件必须按特定顺序加载

**入口文件**: `iv8/xhs_sign.py`, `iv8/main_iv8.py`

---

### 4. [今日头条](今日头条/) — `a_bogus` 签名

**网站**: `www.toutiao.com`

**反爬**: JSVMP 字节码解释器 (`acrawler.js`) + 多层 SDK (`sdk-glue.js`/`bdms.js`/`runtime_bundler.js`)

**逆向方案**: iv8 + Fetch 拦截

**核心思路**:
1. `acrawler.js` → `byted_acrawler.init()` → 加载 JSVMP 解释器
2. 按序加载 7 个 SDK 文件（顺序不可打乱）
3. SDK 劫持 `window.fetch` 在 URL 附加 `&a_bogus=xxx`
4. mock `fetch` 捕获 URL 中的 `a_bogus`

**入口文件**: `iv8/toutiao_iv8.py`, `iv8/toutiao_api.py`, `env-sign/toutiao_comments.py`

---

### 5. [知乎](知乎/) — `x-zse` 签名

**网站**: `www.zhihu.com`

**反爬**: webpack chunk 加密 + 环境检测

**逆向方案**:

| 方案 | 原理 | 目录 |
|------|------|------|
| **iv8** | C++ V8 + stubs.js 补环境 | [知乎/iv8](知乎/iv8/) |
| **node_vm** | Node.js vm 沙箱 + 手动补环境 | [知乎/node_vm](知乎/node_vm/) |

**入口文件**: `iv8/zhihu_sign.py`, `node_vm/main.py`

---

### 6. [东航](东航/) — WASM White-box AES

**网站**: `m.ceair.com` (东方航空移动端)

**反爬**:
- WASM white-box AES-CBC（Emscripten wasm2js 编译，无 .wasm 二进制）
- Aliyun WAF v3 (`acw_sc__v3`)
- Tongdun/TrustDecision 指纹 SDK (`ssxmod_itna`)

**逆向方案**:

| 方案 | 原理 | 目录 |
|------|------|------|
| **wasm2js 加载** | Node.js `require()` + `Module.cwrap()` 调用 AES 加解密 | [东航/](东航/) |
| **iv8 混合** | iv8 执行加解密，DrissionPage 发 HTTP | [东航/iv8](东航/iv8/) |
| **cloak** | CloakBrowser 桥接 + sign.js 加密 | [东航/cloak](东航/cloak/) |

**核心思路**:
1. `wbsk_Wbox.js` 是 Emscripten wasm2js 模块，Node.js `require()` 加载
2. `Module.cwrap('wbsk_AES_cbc_encrypt', ...)` 调用 WASM 导出
3. 白盒 AES 密钥嵌入 WASM 代码，无法外部提取
4. Cookie 需从浏览器导出（`acw_sc__v3` + `ssxmod_itna` 配对）

**入口文件**: `sign.js`, `crawler.py`

---

### 7. [QQ音乐](QQ音乐/) — Node.js 补环境

**网站**: `y.qq.com`

**反爬**: 签名/加解密函数

**逆向方案**: Node.js 补环境调用签名函数，Python 发起 HTTP 请求

**入口文件**: `v1.0/qqmusic.py`

---

### 8. [荔枝网 wasm](荔枝网%20wasm/) — WASM 逆向

**网站**: `gdtv-api.gdtv.cn` (荔枝网/广东广播电视台)

**反爬**: WASM 签名函数 `a()`

**逆向方案**: web-reverse-algorithm Skill 流程

**核心思路**:
- `sign.js` 加载 WASM → 调用 `a()` → 返回 `Map{header:value}`
- Python `crawler.py` 组装 headers → GET API

**入口文件**: `skill-reverse/crawler.py`, `AI补环境/gdtv_sign.py`

---

### 9. [米画师 wasm](米画师%20wasm/) — wasm-bindgen 逆向

**网站**: `mihuashi.com` (米画师)

**反爬**: WASM `signtool_sign` 模块 + 42 个 wbg 导入函数

**逆向方案**: wasm-bindgen stub 模板 + env 补丁

**核心思路**:
1. `wasm-objdump -x` 提取 WASM Type Section
2. `gen_stub_template.js` 生成 42 个 wbg stub
3. Node.js `WebAssembly.instantiate(WASM, {wbg: stubs})` 加载
4. 调用 WASM 导出函数获取 `M-S` 签名

**入口文件**: `sign.js`, `sign.py`, `crawl.py`

---

### 10. [国家医保局](国家医保局/) — SM2/SM4 纯算法

**网站**: 国家医疗保障局

**反爬**: SM2/SM4 国密算法加密

**逆向方案**: 纯 Python 算法还原（无 JS 执行）

**入口文件**: `nhsa_client_final.py`

---

### 11. [中国五矿招标平台](中国五矿招标平台/) — MCP 加密

**网站**: `ecuat.minmetals.com.cn`

**反爬**: 请求参数加密 (MCP)

**逆向方案**: JavaScript 算法还原

**入口文件**: `main.py`, `encrypt_utils.py`

---

### 12. [空气质量监测](空气质量监测/) — MCP 逆向

**网站**: `www.aqistudy.cn`

**反爬**: MCP (Mobile Communication Protocol) 加密

**逆向方案**: MCP 协议分析 + 解密还原

**入口文件**: `main.py`, `decrypt_utils.py`

---

### 13. [好医生](好医生/) — 自动化

**网站**: 好医生 CME 继续教育平台

**逆向方案**: Playwright 自动化 + Camoufox 反检测浏览器

**入口文件**: `main.py` (CLI: `python bot.py <课程URL>`)

---

### 14. [spa14-scrape-center](spa14-scrape-center/) — WASM 反编译

**网站**: `spa14.scrape.center`

**反爬**: WASM Sign 算法

**逆向方案**: WASM 反编译 + 算法还原

**入口文件**: `main.py`

---

### 15. 其他简单项目

| 目录 | 网站 | 反爬 | 方案 |
|------|------|------|------|
| [万达影城热映数据](万达影城热映数据/) | 万达影城 | MD5 签名头 `mx-api` | 纯 Python 算法还原 |
| [中国观鸟中心](中国观鸟中心/) | 中国观鸟记录中心 | RSA 分块加密 + AES-256-CBC 响应加密 | 纯 Python 算法还原 |
| [合肥滨湖国际会展中心](合肥滨湖国际会展中心/) | 会展中心 | AES-128-CBC 硬编码 key | 纯 Python 算法还原 |
| [自动化工具](自动化工具/) | — | debugger 反调试 | CDP 反调试器 + 油猴脚本 |

---

## 二、技术路线总结

### 核心技术对比

| 技术 | 原理 | 适用场景 | 性能 | 维护成本 |
|------|------|---------|------|---------|
| **iv8** | Python C++ V8 嵌入，C++ 层实现浏览器 API | JSVMP、签名函数、SDK 加载 | ~3ms/调用 | 低（引擎层一致） |
| **sdenv** | C++ V8 Addon + jsdom 完整页面环境 | RS6 完整 VM（while(1) + HTTP 重定向） | ~0.3s | 中 |
| **env-patch** | 纯 JS Object.create 原型链模拟 | 轻量级环境补丁、非 VMP 场景 | ~40ms | 高（每缺一个属性需手动补） |
| **WASM 加载** | `WebAssembly.instantiate` + stub 补丁 | wasm-bindgen / wasm2js 模块 | ~10ms | 中（wbg 变动需重生成） |
| **算法还原** | 反编译/静态分析 + Python 重写 | SM2/SM4/MD5/AES 等已知算法 | 最快 | 高（算法升级需重新分析） |
| **浏览器桥接** | CloakBrowser/Playwright 真实浏览器 | 反爬极严、仅需 Cookie 的场景 | ~3s | 低（但有浏览器依赖） |

### 方案选择决策树

```
你要逆向的 JS 是？
├─ JSVMP 字节码解释器（while(1) + switch）
│   ├─ RS6 完整 VM（重定向链 + Cookie 挑战）
│   │   → sdenv（首选）或 iv8
│   └─ 普通 VMP（如小红书/今日头条）
│       → iv8
├─ 单个签名函数（new ABC().z(seed, ts) → token）
│   → iv8（首选，3ms 级）
├─ WASM 模块
│   ├─ wasm-bindgen（有 .wasm + wbg 导入）
│   │   → gen_stub_template + Node.js 加载
│   ├─ wasm2js（无 .wasm，Emscripten 编译为 JS）
│   │   → Node.js require() 直接加载
│   └─ 纯算法（SM2/SM4/MCP）
│       → Python 算法还原
└─ 无混淆简单 API
    → requests 直接调用
```

---

## 三、核心技术详解

### iv8 — Python C++ V8 嵌入

iv8 是 Python 原生 C++ 扩展，将 V8 引擎嵌入 Python 进程。

**优点**:
- 同进程 `ctx.eval("js")` ~3ms，无需 subprocess 调 Node.js
- C++ 层实现 navigator/screen/document/canvas/WebGL 等浏览器 API
- 引擎层与真实 Chrome 一致，JSVMP 的 `typeof`/`instanceof`/`hidden class` 检测无法区分
- 无 Windows GBK 编码问题

**用法**:
```python
import iv8
ctx = iv8.JSContext(environment={
    "location": {"href": "https://..."},
    "navigator": {"userAgent": "...", "platform": "Win32"},
    "screen": {"width": 1920, "height": 1080},
})
ctx.__enter__()
ctx.eval(sdk_js)
result = ctx.eval("window.sign(data)")
ctx.__exit__(None, None, None)
```

### sdenv — C++ V8 Addon + jsdom

sdenv 是 C++ V8 原生插件 + 魔改 jsdom，提供完整 DOM/BOM API。

**优点**:
- 完整页面生命周期（302→412→200 + Cookie Jar）
- 真实 Canvas 渲染（node-canvas）
- XHR/fetch 真实网络请求，自动处理 Set-Cookie

### env-patch — 原型链补环境

纯 JS 构建"看起来和真浏览器一样"的原型链。

**三要素**:
1. **`safeFunction`** — 劫持 `Function.prototype.toString`，返回 `[native code]`
2. **原型链** — `EventTarget → Node → Element → HTMLElement → HTML*Element`
3. **Proxy 监控** — 拦截属性 get/set，`undefined` 即为缺失

**天花板**: JS 层补环境有天然上限。当 RS6 升级到服务端验证 C++ 引擎层指纹时，env-patch 生成的 Cookie 不再被服务器接受（HTTP 200 + 空 body）。

### WASM 逆向

两种 WASM 形态对应不同方案：

| 形态 | 特征 | 逆向方案 |
|------|------|---------|
| **wasm-bindgen** | 有 .wasm 文件，30+ wbg 导入函数 | `wasm-objdump -x Type` → `gen_stub_template.js` |
| **Emscripten wasm2js** | 无 .wasm 文件，编译为 JS | Node.js `require()` 直接加载 |

---

## 四、环境配置

```bash
# Python 依赖
uv add requests lxml iv8

# Node.js 依赖
npm install sdenv  # 仅瑞数 sdenv 方案需要
```

各项目详细配置见各自目录下的 README。
