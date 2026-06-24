# sdenv 通用逆向指南

> 基于兰州交通大学（zbzx.lzjtu.edu.cn）实战经验提炼。

## 一、什么时候用 sdenv

**判断标准（三步识别法）**：

```
curl -sI "https://目标站点/目标路径" -H "UA: Chrome"

返回结果判断：
├─ HTTP 200 → 不是瑞数，不需要 sdenv
├─ HTTP 412 → 是瑞数，继续
│   └─ 响应体含 $_ts.nsd + $_ts.cd → RS6 ✅
│   └─ Set-Cookie 含 XxxS (HttpOnly) → RS6 ✅
└─ HTTP 403 + body 含 __jsl_clearance → JSL 加速乐，不是 sdenv 的目标
```

**一句话**：只有返回 412 + 响应体里有 `$_ts.cd` 的站点才需要 sdenv。

## 二、配置清单（四个必改项）

以兰州交通大学项目为例，标注每个值的作用和来源：

```javascript
// ═══ 必改项①：目标域名 ═══
const HOST = 'zbzx.lzjtu.edu.cn';          // 从哪里获取: 浏览器地址栏

// ═══ 必改项②：入口路径（返回 412 的页面） ═══
const ENTRY_PATH = '/zbxx/hwl.htm';        // 从哪里获取: curl 确认返回 412 的路径

// ═══ 必改项③：User-Agent ═══
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...';
// 从哪里获取: Chrome DevTools → Network → 任意请求 → Request Headers
// ⚠️ UA 必须与后续 Python 请求一致！案例 case: 瑞数 nmpa 踩坑记录 #2

// ═══ 必改项④：Cookie 名（S 和 P 两个） ═══
// 从哪里获取: curl -sI https://目标 | grep Set-Cookie
// 兰州交通大学的例子：
//   Set-Cookie: evbSrBv8QGpBO=xxx    → Cookie S (服务端下发)
//   客户端会生成: evbSrBv8QGpBP=xxx   → Cookie P (JS 生成)
// ⚠️ 不同站点的 Cookie 名前缀完全不同！
```

**实战操作步骤**：

```bash
# 第 1 步：获取 412 响应，识别 Cookie 名
curl -sI -H "UA: Chrome/130..." "https://目标站点/路径" | grep -i "set-cookie"

# 输出示例：
# Set-Cookie: evbSrBv8QGpBO=abcd...; Path=/; Secure; HttpOnly
#               ↑ 记下这个名字（每个站点不同！）

# 第 2 步：获取 412 响应体，确认 $_ts 结构
curl -sL -H "UA: Chrome/130..." "https://目标站点/路径" | head -50
# 确认有: $_ts.nsd=数字; $_ts.cd="字符串";

# 第 3 步：找外部 RS JS 文件
curl -sL -H "UA: Chrome/130..." "https://目标站点/路径" | grep -oP 'src="[^"]*\.js"'
# 确认 JS 文件存在且可访问
```

## 三、generate_cookies.js 通用模板

下面是一份**只需改四个配置项**就能用于新站点的模板：

```javascript
#!/usr/bin/env node
'use strict';
const { jsdomFromUrl } = require('sdenv');

// ════════════════════════════════════════════
//  站点配置（换新站点只改这 4 个值）
// ════════════════════════════════════════════
const HOST = '替换为域名';                         // 如 zbzx.lzjtu.edu.cn
const ENTRY_PATH = '/替换为入口路径';              // 如 /zbxx/hwl.htm
const UA = '替换为真实浏览器 UA';                  // Chrome 130+ 的 UA
const BASE_URL = `https://${HOST}`;

async function main() {
  // 第一步：sdenv 加载 412 页面
  const dom = await jsdomFromUrl(`${BASE_URL}${ENTRY_PATH}`, {
    userAgent: UA,
    consoleConfig: { error: () => {} },   // 静默 JS 错误
  });
  const { cookieJar, window } = dom;

  // 第二步：等待 RS JSVMP 执行完成
  // sdenv 内部流程：
  //   浏览器环境注入 → $_ts 初始化 → RS VM 加载 → 字节码解释执行
  //   → 环境指纹采集 → Huffman/AES/CRC32/Base64 → document.cookie 写入
  //   → location.replace 跳转 → sdenv:exit 事件
  await new Promise(resolve => {
    window.addEventListener('sdenv:exit', () => resolve());
    window.addEventListener('sdenv:location.replace', () => {});
    setTimeout(resolve, 10000);   // 兜底
  });

  // 第三步：提取 Cookie
  const cookies = cookieJar.getCookieStringSync(BASE_URL);
  try { window.close(); } catch (e) {}

  // 第四步：输出给调用方（Python/其他）
  if (cookies) {
    process.stdout.write(JSON.stringify({
      success: true,
      cookies: cookies,
      error: null,
    }));
  } else {
    process.stdout.write(JSON.stringify({
      success: false,
      cookies: null,
      error: '未生成 Cookie',
    }));
  }

  setTimeout(() => process.exit(0), 500);
}

main().catch(err => {
  process.stdout.write(JSON.stringify({
    success: false, cookies: null, error: err.message,
  }));
  setTimeout(() => process.exit(1), 500);
});
```

## 四、Python 调用模板

```python
import json
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).parent

def get_rs_cookies() -> str | None:
    """调用 Node.js 子进程获取 RS Cookie"""
    result = subprocess.run(
        ["node", str(BASE_DIR / "generate_cookies.js")],
        capture_output=True, text=True, cwd=str(BASE_DIR), timeout=60,
    )
    # 从 stdout 中提取 JSON（可能混有 sdenv 日志）
    import re
    match = re.search(r'\{.*"success".*\}', result.stdout, re.DOTALL)
    if not match:
        return None
    data = json.loads(match.group())
    return data["cookies"] if data.get("success") else None

# 使用
cookies = get_rs_cookies()
# cookies → "keyS=abc; keyP=def"
```

## 五、常见故障排查

### 故障 1：Cookie 始终为空

```javascript
// 症状：sdenv:exit 触发但 cookieJar 为空
// 排查：
// ① 检查 UA 是否与真实浏览器一致
// ② 打开 sdenv 的错误日志：
const dom = await jsdomFromUrl(url, {
  userAgent: UA,
  // 临时启用错误输出
  consoleConfig: { error: console.error },
});

// ③ 检查是不是 RS4/5 而非 RS6：
//    RS4/5 的 jsdomFromUrl 可能不支持，需要 jsdomFromText + 手动执行
```

### 故障 2：TLS Renegotiation 报错

```
Error: write EPROTO ... wrong version number
```

**原因**：目标站点使用旧版 OpenSSL，Node.js v17+ 不再支持旧式 TLS 协商。

**解决**：设代理中转
```bash
# 启动本地代理（如 mitmproxy / charles）
set HTTPS_PROXY=http://127.0.0.1:8888
node generate_cookies.js
```

### 故障 3：sdenv 返回 Cookie 但 Python 请求失败

```
HTTP 200 + 空 body / 还是返回 412
```

**排查清单**：
1. ✅ Cookie 是否完整传递给 Python？（S 和 P 两个都传了？）
2. ✅ User-Agent 是否和生成 Cookie 时一致？
3. ✅ Referer 头是否设置？
4. ✅ `Sec-Fetch-Site: same-origin` 等 Fetch Metadata 头是否带上？
5. ✅ TLS 指纹——`requests` 的指纹和 Chrome 不同，部分站点会检测

### 故障 4：Cookie 有效但数据抓不全

**原因**：页面使用 AJAX 动态加载内容（如 DWR / XHR）。

**解决**：用 sdenv 直接加载目标页面（而非 Python requests）

```javascript
// 变体：sdenv 加载数据页（带已有 cookieJar）
const dom2 = await jsdomFromUrl(dataUrl, {
  cookieJar,           // 重用已认证的 cookieJar
  userAgent: UA,
  consoleConfig: { error: () => {} },
});
await new Promise(r => setTimeout(r, 5000)); // 等待 AJAX
const html = dom2.window.document.documentElement.outerHTML;
// 此时 html 已包含 AJAX 加载后的完整内容
```

## 六、sdenv 能力边界

| ✅ 能做 | ❌ 不能做 |
|---------|----------|
| 过瑞数 4/5/6 代 412 挑战 | 过 Cloudflare Turnstile / 5 秒盾 |
| 生成 RS Cookie（S + P） | 过极验滑动验证码 |
| jsdom 环境执行 JS（DWR/XHR） | 过 Akamai（需要独立方案） |
| 反复生成有效 Cookie（每次调 jsdomFromUrl） | 过 JSL 加速乐（`__jsl_clearance`） |
| 纯 Node.js 运行，无浏览器依赖 | 处理需要 WebRTC/WebSocket 的站点 |

## 七、新站点逆向检查清单

```
[ ] Step 1: curl -sI → 确认返回 412
[ ] Step 2: curl -sL → 确认 body 有 $_ts.nsd 和 $_ts.cd
[ ] Step 3: 确认 Set-Cookie 中的 Cookie S 名称
[ ] Step 4: 从浏览器复制真实 UA
[ ] Step 5: 改 generate_cookies.js 四个配置项
[ ] Step 6: node generate_cookies.js → 确认能输出 Cookie
[ ] Step 7: curl --cookie "..." → 确认能拿到 200
[ ] Step 8: 改写 Python main.py 的目标 URL 和解析逻辑
[ ] Step 9: python main.py → 确认完整流程通过
```

## 八、与兰州交通大学项目的差异点

换新站点时需要额外关注的差异：

| 差异维度 | 兰州交大 | 可能是 |
|---------|---------|--------|
| Cookie 名 | `evbSrBv8QGpBO/P` | 每次不同，curl 看 Set-Cookie |
| 入口路径 | `/zbxx/hwl.htm` | 不同路径结构 |
| 数据加载方式 | DWR AJAX | 可能是服务端渲染 / fetch / WebSocket |
| 分页方式 | 网站群 CMS `.page` 导航 | 可能是滚动加载 / 按钮点击 |
| 协议 | HTTPS (旧版 OpenSSL) | 可能是 HTTP / 新版 HTTPS |
| 内容格式 | HTML table | 可能是 JSON API / XML |
