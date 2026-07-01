# 欧冶钢材网 - 瑞数逆向

## 目标

- **网站**: https://www.ouyeel.com
- **搜索页**: https://www.ouyeel.com/steel/search?channel=RJ&pageIndex=1&pageSize=50
- **API**: `POST https://www.ouyeel.com/search-ng/commoditySearch/queryCommodityResult`
- **加密**: 瑞数反爬系统（4/5代）
- **动态参数**: `K5nOZLud`（URL 查询参数），`T0k1m0u5AfREO/T0k1m0u5AfREP`（Cookie）

---

## 分析结论

### 瑞数版本

根据以下特征确定为 **瑞数 4/5 代**：

- 初始请求返回 202 状态码
- 包含 `<meta>` 标签的挑战值
- 动态 JS 路径格式：`/vdGfdDb5PQO5/JlwbhPfc3stb.6771a74.js`
- 变量命名模式：`_$bu`, `_$a$`, `$_r`, `$_ts`, `$_kD` 等
- 使用 while(1)+switch 控制流平化混淆

### 已知结论

| 发现 | 说明 |
|------|------|
| K5nOZLud 首次请求必须 | 首次请求需要 K5nOZLud 参数，否则返回 202 |
| Cookie 是关键认证 | T0k1m0u5AfREO（httpOnly）+ T0k1m0u5AfREP（非 httpOnly） |
| HTTP/2 连接复用 | 浏览器已验证的连接不需要 K5nOZLud，后续请求直接 200 |
| curl/httpx 外部请求 | 即使携带相同 Cookie，因无共享 HTTPS 连接仍返回 202 |
| 浏览器内 XHR 可绕过 | 从 Camoufox 页面上下文中发起的 XHR 请求直接 200 |

### API 请求格式

```
POST /search-ng/commoditySearch/queryCommodityResult
Content-Type: application/x-www-form-urlencoded

criteriaJson={"pageSize":50,"channel":"RJ","pageIndex":0,"maxPage":50,"jsonParam":{"channel":"RJ","keywordAnalyseResult":null}}
```

**分页参数**: `pageIndex` 从 0 开始（0=第一页），`pageSize` 每页数量

**频道代码**:
| 代码 | 频道 | 代码 | 频道 |
|------|------|------|------|
| RJ | 热卷 | LC | 冷轧 |
| ZX | 中厚板 | GX | 管材 |
| TP | 特钢 | PZ | 盘条/棒线 |

---

## 使用方式

### 方式 1: Claude Code MCP（推荐，当前方式）

Camoufox 浏览器已启动，可直接从浏览器上下文调用 API。

```javascript
// 在 evaluate_js 中执行:
var xhr = new XMLHttpRequest();
xhr.open('POST', '/search-ng/commoditySearch/queryCommodityResult', true);
xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
xhr.onload = function() {
    console.log('Status:', xhr.status);
    console.log('Count:', JSON.parse(xhr.responseText).count);
    // 处理数据...
};
xhr.send('criteriaJson=' + encodeURIComponent(JSON.stringify({
    pageSize: 50, channel: 'RJ', pageIndex: 0, maxPage: 50,
    jsonParam: {channel: 'RJ', keywordAnalyseResult: null}
})));
```

### 方式 2: 浏览器代理服务

保持 Camoufox 浏览器运行，通过 WebSocket 或 HTTP 代理转发请求。

```
Camoufox Browser (已验证会话)
       ↓
API 请求通过 evaluate_js/XHR 发出
       ↓
返回数据直接可用
```

### 方式 3: 使用 curl_cffi + 有效 Cookie

```python
from curl_cffi import requests
# 携带 Cookie 和 Firefox 指纹
resp = requests.post('https://...', impersonate='firefox135', cookies={...})
```

注意：curl_cffi 在部分配置下仍可能返回 202，需要完整模拟浏览器指纹。

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `solver.py` | 主求解器（浏览器代理模式） |
| `cookie_fetcher.py` | Cookie 获取和管理工具 |
| `cookies.json` | 保存的 Cookie 文件 |
| `ruishu_js_1.js` | 瑞数 JS 文件 1（用于分析） |
| `ruishu_js_2.js` | 瑞数 JS 文件 2（用于分析） |
| `sample_response.json` | API 返回的示例响应数据 |

---

## 瑞数 JS 逆向要点（后续

### 完全逆向方案

如需实现无浏览器的独立求解，需要：

1. **分析 RuiShu JS 算法**
   - 破解 `while(1)+switch` 控制流平化
   - 提取 K5nOZLud 生成函数
   - 理解 `$_ts` 对象和 cookie 生成逻辑

2. **生成初始 Cookie**
   - 解析 202 响应中的 meta content
   - 执行 RuiShu JS 计算验证值
   - 设置 T0k1m0u5AfREO/T0k1m0u5AfREP Cookie

3. **K5nOZLud 动态生成**
   - 每请求生成一次
   - 与时间戳/会话绑定
   - 可能包含请求路径/参数的签名

### TLS 指纹匹配

外部请求必须匹配浏览器指纹：
- JA3/JA4 指纹
- HTTP/2 设置帧参数
- 支持的密码套件
- 扩展头顺序

可使用 `curl_cffi` (Python) 或 `curl-impersonate` (命令行)。

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-07-01 | 初始逆向完成，浏览器代理方案可用 |
