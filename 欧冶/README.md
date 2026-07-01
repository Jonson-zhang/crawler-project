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
| `env.js` | 补环境 | Node.js 环境补丁（瑞数引擎执行尝试） |
| `sign.js` | 补环境 | Node.js 挑战求解器 |
| `cookies.json` | 数据 | 保存的有效 Cookie |
| `cookie_fetcher.py` | 工具 | Cookie 管理 |
| `README.md` | 文档 | 本文件 |

### 分析文件

| 文件 | 用途 |
|------|------|
| `202_fresh.html` | 202 挑战响应示例 |
| `202_response.html` | 原始 202 响应 |
| `sample_response.json` | API 成功响应示例 |
| `ruishu_fresh.js` | 最新瑞数引擎 JS（175KB）|
| `ruishu_engine_1.js` | 瑞数 JS 文件 1（202KB） |
| `ruishu_engine_2.js` | 瑞数 JS 文件 2（152KB） |
| `ruishu_js_1.js` | （旧）瑞数 JS 1 |
| `ruishu_js_2.js` | （旧）瑞数 JS 2 |
| `202_headers.txt` | 202 响应头 |
| `solver.py` | 旧版浏览器 MCP 求解器（放弃） |
| `test_ruishu.js` | 补环境测试脚本 |

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

## 后续优化方向

1. **iv8 方案**：使用 iv8（Python V8 绑定）执行瑞数引擎
   - iv8 是真正的 V8 C++ 引擎，与 Chrome 行为一致
   - 有望绕过字节码解释器的环境检测
   - 参考：`.claude/memory/iv8-nodejs-workflow.md`

2. **RuiShu 纯算**：逆向 `$_ts.cd` 解码算法 + 自定义 base64 表
   - 直接实现 bytecode 解释器
   - 需大量人力时间

3. **自动化 Cookie 刷新**：使用 Camoufox SDK 定时刷新 Cookie
