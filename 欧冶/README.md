# 欧冶钢材网 - 瑞数逆向

## 目标

- **网站**: https://www.ouyeel.com
- **搜索页**: https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50
- **API**: `POST https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult`
- **加密**: 瑞数 v4 反爬系统
- **动态参数**: K5nOZLud（URL 查询参数），T0k1m0u5AfREO/T0k1m0u5AfREP（Cookie）

---

## 逆向结论

### 瑞数版本：v4

特征：
- 初始请求返回 **202**，包含 `<meta>` 标签 + `$_ts` 全局对象
- 动态 JS 路径：`/vdGfdDb5PQO5/xxxxxxxx.6771a74.js`
- `$_ts.cd` — 自定义 base64 编码的挑战 bytecode（~2200 字符）
- `$_ts.nsd` — 种子值，每请求不同
- 引擎 JS 使用 `while(1)+switch` 控制流平化 + 虚拟字节码解释器
- 变量名模式：`_$bu`, `_$a$`, `_$_r`, `$_ts`, `_$kD`, `_$f9`

### 挑战流程

```
客户端                          欧冶服务器
  │                                │
  │── POST /api (无Cookie) ──────→ │
  │←──── 202 + 挑战HTML ────────── │  (设 T0k1m0u5AfREO + cookiesession1)
  │    ├─ <meta content="...">     │
  │    ├─ $_ts.cd = "..."          │
  │    ├─ $_ts.nsd = N             │
  │    └─ <script src="engine.js"> │
  │                                │
  │── GET engine.js ─────────────→ │
  │←──── engine JS (202KB) ─────── │
  │                                │
  │  浏览器执行引擎 JS：             │
  │  1. 检查 $_ts.cd 存在          │
  │  2. 解码 bytecode（while+switch│
  │     虚拟解释器）                │
  │  3. 执行环境检测：              │
  │     - navigator.userAgent      │
  │     - screen 属性               │
  │     - document.cookie          │
  │     - 时间偏差                  │
  │     - canvas 指纹               │
  │  4. 计算结果 → $_ts.lcd()      │
  │  5. 设置 T0k1m0u5AfREP        │
  │  6. 清理痕迹                    │
  │                                │
  │── 自动重试原API (带 Cookie) ──→ │
  │←──── 200 + 业务数据 ─────────── │
```

### 最终方案

| 组件 | 方式 | 说明 |
|------|------|------|
| **Cookie 获取** | **浏览器辅助**（首次需要） | 需通过真实浏览器（Firefox/Chrome）完成首次瑞数挑战 |
| **API 调用** | **curl_cffi**（纯 HTTP） | `impersonate='firefox135'` 匹配 Firefox TLS 指纹 |
| **TLS 指纹** | **纯算** | curl_cffi 自动处理 JA3/JA4 指纹匹配 |
| **分页** | **纯算** | 修改 criteriaJson 中的 pageIndex/pageSize |

---

## 文件说明

| 文件 | 类型 | 用途 |
|------|------|------|
| `main.py` | **入口** | Python CLI + curl_cffi API 调用 |
| `env.js` | 补环境 | Node.js 环境补丁配置 |
| `sign.js` | 补环境 | Node.js 挑战求解入口 |
| `cookies.json` | 数据 | 保存的有效 Cookie |
| `cookie_fetcher.py` | 工具 | Cookie 管理和 API 测试 |
| `README.md` | 文档 | 本文件 |

### 分析/参考文件

| 文件 | 用途 |
|------|------|
| `202_response.html` | 瑞数 202 挑战响应（含 $_ts.cd / meta 结构） |
| `sample_response.json` | API 成功响应示例 |
| `ruishu_engine_1.js` | 瑞数引擎 JS 文件 1（202KB，while+switch 解释器） |
| `ruishu_engine_2.js` | 瑞数引擎 JS 文件 2（152KB） |

---

## 使用方式

### 方式 A: Python CLI（推荐）

```bash
# 交互模式
python main.py --interactive

# 查询第一页热卷
python main.py --page 0 --size 50 --channel RJ

# 查询冷轧第二页
python main.py --page 1 --size 50 --channel LC
```

**前置条件**: `cookies.json` 中有有效 Cookie。

### 方式 B: 获取 Cookie

如果 Cookie 过期，通过 Camoufox/Chrome/Firefox 访问：
1. 打开 https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50
2. 等待页面加载完成（瑞数挑战自动解决）
3. F12 → Application → Cookies → 复制 `www.ouyeel.com` 下所有 Cookie
4. 保存到 `cookies.json`

### 方式 C: curl 直接调用

```bash
curl -s -X POST 'https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -H 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0' \
  -H 'Cookie: T0k1m0u5AfREP=xxx; T0k1m0u5AfREO=xxx; cookiesession1=xxx' \
  -d 'criteriaJson={"pageSize":50,"channel":"RJ","pageIndex":0,"jsonParam":{"channel":"RJ"}}'
```

---

## 已知限制

1. **RuiShu v4 引擎无法在纯 Node.js 环境下执行完成**
   - 原因：字节码解释器的 `while(1)+switch` 循环在缺少真实浏览器属性时进入无限循环
   - 缓解：使用 curl_cffi 指纹 + 有效 Cookie 直接调用 API

2. **Cookie 会过期**
   - T0k1m0u5AfREO: 长期有效（2036年过期）
   - T0k1m0u5AfREP: 短期有效（数小时内）
   - 过期需要重新通过浏览器获取

3. **curl_cffi 需要特定版本**
   - 需要支持 `impersonate='firefox135'` 参数
   - 后续 Firefox 版本升级可能需要调整

---

## iv8 继续完善

### 当前状态

iv8 已成功加载并启动瑞数引擎 JS（175KB），引擎解码 `$_ts.cd` 字节码后开始执行挑战，
但字节码中的环境检查需要精确匹配浏览器 DOM。

### 已定位的瓶颈

引擎启动后在 `_$eQ()` 函数处抛出：
```
TypeError: Cannot read properties of undefined (reading 'getAttribute')
```

问题根源：iv8 的 C++ 类型 DOM 与 POJO stub 之间存在差异。瑞数字节码访问 DOM 元素
时获取到 `undefined`。

### 解决思路

1. **完善 DOM stubs**（当前 `test_iv8.py` 中的方案）
   - 使用 iv8 C++ 原生 DOM + `Object.defineProperty` 逐属性覆盖
   - 关键属性：`document.body` / `document.documentElement` / `getAttribute` / `removeChild`
   - 参考 `.claude/memory/iv8-dom-stubs.md`

2. **启用 trace\_property\_access 精确采集**
   - 在 Camoufox 中启用 `enable_trace=True` 启动浏览器
   - 导航到目标页面采集瑞数 JS 实际访问的所有 DOM 属性
   - 将采集结果逐条映射到 iv8 environment

3. **切换 Firefox 指纹**
   - iv8 默认使用 Chrome 124 UA，瑞数可能基于 UA 切换验证逻辑
   - 通过 `Object.defineProperty` 覆盖 `navigator.userAgent` 为 Firefox 135

### 参考

- `.claude/memory/iv8-nodejs-workflow.md` — iv8 工作流总纲
- `.claude/memory/iv8-dom-stubs.md` — DOM stub 方案
- `.claude/memory/iv8-doc-cookie.md` — document.cookie 处理
- `.claude/memory/iv8-navigator-plugins.md` — navigator 属性覆盖
- `欧冶/test_iv8.py` — 当前 iv8 测试脚本

---

## sdenv / jsdom 补环境方案

### 当前状态

sdenv（npm 包 v1.1.3）的 C++ 原生扩展（documentAll.node）在当前 Windows 环境下无法编译（缺少 VS Build Tools）。改用纯 jsdom 方案：

- `欧冶/sdenv/ouyeel_env.js` — 纯 JS 浏览器环境补丁（替代 sdenv C++ 扩展）
- `欧冶/sdenv/generate_cookie.js` — 基于 jsdom 的 Cookie 生成器
- `欧冶/sdenv/package.json` — 依赖声明

已完成的补丁：document.all、navigator、screen、location、document、performance、
window 方法、Canvas 2D、WebGL、AudioContext、WebSocket、Storage 等。

### 已知问题

jsdom 环境下瑞数引擎执行到 `_$kD` 内部时出错：

```
Cannot read properties of undefined (reading 'length')
```

原因：瑞数 6 代引擎 JS 的字节码解释器中，环境检测逐项比对对象属性，
任一缺失的属性值（undefined）会在后续计算中导致 `Array(length)` 构造异常。
需要精确匹配所有被访问的属性。

### 三条路径对比

| 方案 | 状态 | 优势 | 劣势 |
|------|------|------|------|
| **curl_cffi + 人工 Cookie** | ✅ 可用 | 简单、快速 | Cookie 过期需手动刷新 |
| **Camoufox 自动获取 Cookie** | ✅ 可用 | 全自动 | 需启动浏览器（~3s） |
| **jsdom/sdenv 纯算** | ❌ 不完整 | 无需浏览器、最快 | 环境补丁需逐项调试 |

### 推荐使用流程

```
Camoufox 浏览器（自动过瑞数）
  → 提取 T0k1m0u5AfREP 等 Cookie
  → 保存到 cookies.json
  → curl_cffi Firefox 135 指纹调用 API
  → Cookie 过期时自动重启 Camoufox
```

见 `main_sdenv.py`。

