# Python + sdenv 配合实战教程

> 适用读者：了解 Python 基础，想用 sdenv 过瑞数反爬但没接触过 Node.js 跨语言调用。

---

## 目录

1. [前置准备](#零前置准备)
2. [Step 1：最小可行——直接让 JS 认浏览器](#一step-1-直接运行看能不能出结果)
3. [Step 2：Python 第一次对接——subprocess 传参拿 Cookie](#二step-2python-第一次对接子进程传参)
4. [Step 3：加超时 + 异常处理——别让卡死拖垮 Python](#三step-3加超时-和-异常处理生成函数封装)
5. [Step 4：重试机制——偶尔的网络波动](#四step-4重试机制偶尔的网络闪烁)
6. [Step 5：带 Cookie 请求业务 API——真正干活](#五step-5带-cookie-请求业务-api)
7. [Step 6：多页翻页 + 结果排版——实用到交付](#六step-6翻页-结果排版)
8. [Step 7：完整生产级模板](#七step-7完整生产级模板)
9. [附录：换新站点只需改的地方](#换新站点只需要改哪些)

---

## 零、前置准备

### 环境确认

```bash
node -v     # v20.x 或 v22+（v21 不兼容）
npm -v      # 确认 npm 可用
```

### 安装 sdenv

```bash
cd 你的项目目录
npm install sdenv
```

### 验证 sdenv 可用

创建一个测试文件 `_test_sdenv.js`：

```javascript
const { jsdomFromUrl } = require("./node_modules/sdenv");

(async () => {
    try {
        const dom = await jsdomFromUrl("https://www.baidu.com", {
            userAgent: "Mozilla/5.0 ... Chrome/143 ...",
            consoleConfig: { error: () => {} },
        });
        console.log("SUCCESS: " + dom.window.document.title);
        process.exit(0);
    } catch (e) {
        console.error("FAILED: " + e.message);
        process.exit(1);
    }
})();
```

```bash
node _test_sdenv.js
# 输出: SUCCESS: 百度一下，你就知道
```

---

## 一、Step 1：直接运行，看能不能出结果

**目标**：不写 Python，先在 Node.js 里验证 sdenv 对目标网站能生成 Cookie。

```javascript
// step1_bare.js
const { jsdomFromUrl } = require("sdenv");

async function main() {
    const dom = await jsdomFromUrl("https://www.ouyeel.com/steel", {
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/143.0.0.0 Safari/537.36",
        consoleConfig: { error: () => {} },
    });

    const { cookieJar, window } = dom;

    // 等 VM 执行完
    await new Promise((resolve) => {
        window.addEventListener("sdenv:exit", () => resolve());
        setTimeout(resolve, 15000);
    });

    const cookies = cookieJar.getCookieStringSync("https://www.ouyeel.com");
    console.log("Cookie: " + cookies);
    console.log("Length: " + (cookies ? cookies.length : 0));
}

main();
```

```bash
node step1_bare.js
# 输出:
# Cookie: T0k1m0u5AfREO=5iIw...; cookiesession1=678A...; T0k1m0u5AfREP=N21I...
# Length: 401
```

**这一步说明**：sdenv 对目标网站是有效的。如果这步失败了（Cookie 长度为 0），后续都不用看了——先排查 sdenv 本身的问题（Node.js 版本、UA 是否正确、网站是否真的是瑞数）。

---

## 二、Step 2：Python 第一次对接——子进程传参

**目标**：Python 启动 Node.js 子进程，传入配置，拿回 Cookie。

### JS 端：接收 Python 传入的参数

```javascript
// step2_bridge.js
const { jsdomFromUrl } = require("sdenv");

async function main() {
    // Python 通过命令行参数传入 JSON
    const cfg = JSON.parse(process.argv[2] || "{}");
    const url = cfg.url || "https://www.ouyeel.com";
    const path = cfg.entryPath || "/steel";

    const dom = await jsdomFromUrl(url + path, {
        userAgent:
            cfg.userAgent ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
        consoleConfig: { error: () => {} },
    });

    await new Promise((resolve) => {
        dom.window.addEventListener("sdenv:exit", () => resolve());
        setTimeout(resolve, 15000);
    });

    const cookies = dom.cookieJar.getCookieStringSync(url);

    // ★ 关键：往 stdout 输出纯 JSON（日志走 stderr）
    process.stdout.write(
        JSON.stringify({
            success: !!cookies && cookies.length > 50,
            cookies: cookies || "",
        })
    );
    process.exit(0);
}

main().catch((err) => {
    process.stdout.write(
        JSON.stringify({ success: false, error: err.message })
    );
    process.exit(1);
});
```

### Python 端：最简调用

```python
# step2_basic.py
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).parent

def get_cookies():
    """调用 sdenv，返回 Cookie 字符串"""
    cfg = json.dumps({
        "url": "https://www.ouyeel.com",
        "entryPath": "/steel",
    })

    result = subprocess.run(
        ["node", str(HERE / "step2_bridge.js"), cfg],
        capture_output=True,
        text=True,
        timeout=30,
    )

    data = json.loads(result.stdout.strip())
    if not data.get("success"):
        raise RuntimeError(data.get("error", "Cookie 生成失败"))

    return data["cookies"]


if __name__ == "__main__":
    cookies = get_cookies()
    print("Cookie:", cookies)
    print("Length:", len(cookies))
```

```bash
python step2_basic.py
# Cookie: T0k1m0u5AfREO=5iIw...; T0k1m0u5AfREP=N21I...
# Length: 401
```

### 这一步的关键理解

```
Python 端                               Node.js 端
────────                               ─────────

① 构造 JSON 配置
   {"url":"...", "entryPath":"/steel"}

② subprocess.run(["node",
   "bridge.js", JSON字符串])
          │
          │          ───────────▶   ③ process.argv[2] 收到 JSON
          │                         ④ jsdomFromUrl() 加载页面
          │                         ⑤ RS6 VM 执行
          │                         ⑥ cookieJar 输出 Cookie
          │                         ⑦ stdout: {"success":true, ...}
          │
⑧ result.stdout ◀───────────────────
⑨ json.loads → data["cookies"]
⑩ 返回 "key1=val1; key2=val2"
```

**三个铁律**：

| 铁律 | 理由 |
|------|------|
| Python → JS 用 `process.argv[2]` 传 JSON | 唯一安全通道。不要用环境变量（会被 shell 转义）、不要用 stdin（可能冲突） |
| JS → Python 用 `stdout` 写 JSON | 数据通道。`stderr` 留给报错和 sdenv 日志 |
| Python `capture_output=True` + `timeout=30` | 捕获输出 + 超时保护 |

---

## 三、Step 3：加超时和异常处理——生成函数封装

**目标**：Cookie 生成函数可以放心放在任何 Python 脚本里调用，不会拖死主流程。

```python
# step3_robust.py
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
BRIDGE_JS = HERE / "step2_bridge.js"


def generate_cookie(url: str, path: str, ua: str = None) -> str:
    """
    调用 sdenv 生成 Cookie 字符串。

    返回: "key1=val1; key2=val2"
    异常: subprocess.TimeoutExpired — Node.js 卡死（超时）
          RuntimeError              — sdenv 没生成有效 Cookie
          FileNotFoundError         — 没装 node
    """
    cfg = json.dumps({
        "url": url,
        "entryPath": path,
        "userAgent": ua,  # None → JS 端用默认值
    })

    print(f"  [sdenv] 启动: {url}{path}", file=sys.stderr)

    try:
        result = subprocess.run(
            ["node", str(BRIDGE_JS), cfg],
            capture_output=True, text=True,
            timeout=30,                        # ★ 30 秒超时
            encoding="utf-8", errors="replace",
            cwd=str(HERE),                     # ★ 工作目录对齐
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("sdenv 执行超时 (30s)——RS6 VM 可能卡死")
    except FileNotFoundError:
        raise RuntimeError("未找到 Node.js。请安装 Node.js v20+。")

    # stderr 可能有 sdenv 日志或警告
    stderr = result.stderr.strip()
    if stderr:
        for line in stderr.split("\n")[:3]:
            if "error" in line.lower():
                print(f"  [sdenv:stderr] {line[:120]}", file=sys.stderr)

    # 从 stdout 解析 JSON
    stdout = result.stdout.strip()
    if not stdout:
        raise RuntimeError("sdenv 无输出（stdout 为空）")

    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        # 可能有日志混在 JSON 前面，尝试提取
        import re

        match = re.search(r'\{.*"success".*\}', stdout, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise RuntimeError(f"sdenv 输出不是 JSON: {stdout[:200]}")

    if not data.get("success"):
        raise RuntimeError(data.get("error", "Cookie 生成失败"))

    return data["cookies"]


# ═══ 调用 ═══
if __name__ == "__main__":
    try:
        cookies = generate_cookie(
            url="https://www.ouyeel.com",
            path="/steel",
        )
        print(f"[OK] Cookie 长度: {len(cookies)}")
        print(f"     前 60 字符: {cookies[:60]}...")
    except RuntimeError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        sys.exit(1)
```

```bash
python step3_robust.py
#   [sdenv] 启动: https://www.ouyeel.com/steel
# [OK] Cookie 长度: 401
#      前 60 字符: T0k1m0u5AfREO=5iIw...; cookiesession1=678A...
```

---

## 四、Step 4：重试机制——偶尔的网络波动

**目标**：网络抖动时自动重试，不惊动用户。

```python
# step4_retry.py
import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).parent
BRIDGE_JS = HERE / "step2_bridge.js"

# ═══ 从 step3_robust.py 复制 generate_cookie 函数 ═══
# （此处省略，实际使用时 import）

def generate_cookie_with_retry(
    url: str,
    path: str,
    ua: str = None,
    max_retries: int = 3,
    retry_delay: float = 2.0,
) -> str:
    """
    带重试的 Cookie 生成。

    参数:
        url:         目标站点（如 https://www.ouyeel.com）
        path:        返回 202/412 的挑战路径（如 /steel）
        ua:          User-Agent（None 用默认值）
        max_retries: 最大重试次数
        retry_delay: 重试间隔（秒）
    """
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            print(
                f"  [sdenv] 第 {attempt}/{max_retries} 次尝试...",
                file=sys.stderr,
            )
            return generate_cookie(url, path, ua)

        except RuntimeError as e:
            last_error = e
            msg = str(e)

            # 这两类错误重试没意义，直接失败
            if "未找到 Node.js" in msg:
                raise
            if "无输出" in msg:
                raise

            # 超时或网络错误 → 可重试
            if attempt < max_retries:
                print(
                    f"  [sdenv] 失败，{retry_delay}s 后重试: {msg[:100]}",
                    file=sys.stderr,
                )
                time.sleep(retry_delay)
            else:
                print(
                    f"  [sdenv] {max_retries} 次重试全部失败",
                    file=sys.stderr,
                )

    raise RuntimeError(f"Cannot generate cookie after {max_retries} retries") from last_error


# ═══ 调用 ═══
if __name__ == "__main__":
    try:
        cookies = generate_cookie_with_retry(
            url="https://www.ouyeel.com",
            path="/steel",
        )
        print(f"[OK] {len(cookies)} 字符")
    except RuntimeError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        sys.exit(1)
```

```bash
python step4_retry.py
#   [sdenv] 第 1/3 次尝试...
# [OK] 401 字符
```

### 重试策略口决

| 错误类型 | 是否重试 | 理由 |
|---------|:---:|------|
| 超时（30s 无响应） | ✅ | 可能是网络抖动 |
| Cookie 长度不够 | ✅ | 偶尔 VM 没跑完 |
| `FileNotFoundError`（没装 node） | ❌ | 重试 100 次也没用 |
| stdout 为空（JS 脚本崩溃） | ❌ | 代码问题，不是网络问题 |

---

## 五、Step 5：带 Cookie 请求业务 API

**目标**：完整闭环——生成 Cookie → 写入 Session → 调 API → 拿到数据。

```python
# step5_full_flow.py
import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

import requests

HERE = Path(__file__).parent
BRIDGE_JS = HERE / "step2_bridge.js"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

# ═══ Cookie 生成函数（同 step3） ═══
# 此处假设已 import 或定义


def search_products(session, channel="RJ", page=0, size=50):
    """调用欧冶搜索 API（这一步是业务逻辑，每个网站不同）"""
    url = "https://www.ouyeel.com/search-ng/complexSearch/queryResult"

    criteria = json.dumps(
        {"channel": channel, "pageIndex": page, "pageSize": size},
        separators=(",", ":"),
    )

    resp = session.post(
        url,
        data={"criteriaJson": criteria},
        headers={
            "Accept": "application/json, text/plain, */*",
            "Referer": f"https://www.ouyeel.com/steel/search?channel={channel}&pageIndex={page}&pageSize={size}",
            "User-Agent": UA,
            "Origin": "https://www.ouyeel.com",
        },
    )

    if resp.status_code != 200:
        raise RuntimeError(f"API 返回 HTTP {resp.status_code}")

    data = resp.json()
    items = json.loads(data.get("resultList", "[]"))
    return items


# ═══ 主流程 ═══
if __name__ == "__main__":
    # ① 生成 Cookie
    cookie_str = generate_cookie(
        url="https://www.ouyeel.com",
        path="/steel",
    )

    # ② 写入 Session
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    for item in cookie_str.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            session.cookies.set(k, v)

    # ③ 调 API
    items = search_products(session, channel="RJ", page=0, size=10)

    # ④ 显示结果
    print(f"\n共 {len(items)} 条结果:")
    for i, item in enumerate(items[:10], 1):
        name = item.get("productName", "?")
        spec = item.get("spec", "")
        weight = item.get("balanceWeight", 0)
        price = item.get("publishPrice", 0)
        print(f"  {i:2d}. {name:10s} {spec:14s} {float(weight):6.2f}t {int(price):6d}元")

    session.close()
```

```bash
python step5_full_flow.py
#   [sdenv] 启动: https://www.ouyeel.com/steel
# 共 10 条结果:
#   1. 电镀锌板卷   0.60*1273*C     8.29t   4256元
#   2. 冷轧板卷    1.60*957*C      1.61t   3596元
#   ...
```

---

## 六、Step 6：翻页 + 结果排版

**目标**：多页获取 + 表头对齐输出，接近可以直接用的形态。

```python
# step6_pagination.py
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

HERE = Path(__file__).parent
BRIDGE_JS = HERE / "step2_bridge.js"

# ═══ 配置（放在文件顶部，用户只改这里） ═══
CONFIG = {
    "url": "https://www.ouyeel.com",
    "entryPath": "/steel",
    "channel": "RJ",
    "pages": 2,          # 获取几页
    "pageSize": 20,      # 每页数量
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)


# ═══ 核心函数 ═══

def generate_cookie(url, path):
    """同 step3"""
    # ... 省略重复代码 ...


def search_page(session, channel, page, size):
    """获取单页数据"""
    url = "https://www.ouyeel.com/search-ng/complexSearch/queryResult"
    criteria = json.dumps(
        {"channel": channel, "pageIndex": page, "pageSize": size},
        separators=(",", ":"),
    )
    resp = session.post(
        url,
        data={"criteriaJson": criteria},
        headers={
            "Accept": "application/json, text/plain, */*",
            "Referer": f"https://www.ouyeel.com/steel/search?channel={channel}&pageIndex={page}&pageSize={size}",
            "User-Agent": UA,
            "Origin": "https://www.ouyeel.com",
        },
    )
    data = resp.json()
    return json.loads(data.get("resultList", "[]"))


def print_table(items, page_num, page_size):
    """格式化输出"""
    # 表头（只在第一页打印）
    if page_num == 0:
        print(
            f"\n{'':>3s} {'品名':10s} {'规格':14s} {'库存(t)':>7s} {'单价(元)':>8s} {'卖家':8s} {'仓库':16s}"
        )
        print("-" * 75)

    for i, item in enumerate(items, 1):
        name = str(item.get("productName", "-"))[:10]
        spec = str(item.get("spec", "-"))[:14]
        weight = item.get("balanceWeight", 0) or 0
        price = item.get("publishPrice", 0) or 0
        seller = str(item.get("providerShortName", "-"))[:8]
        wh = str(item.get("warehouseName", "-"))[:16]

        idx = page_num * page_size + i
        print(
            f"  {idx:3d} {name:10s} {spec:14s} {float(weight):7.2f} {int(price):8d} {seller:8s} {wh:16s}"
        )


# ═══ 主流程 ═══
if __name__ == "__main__":
    # ① 生成 Cookie
    cookie_str = generate_cookie(CONFIG["url"], CONFIG["entryPath"])

    # ② 初始化
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    for item in cookie_str.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            session.cookies.set(k, v)

    # ③ 翻页获取
    all_items = []
    for page in range(CONFIG["pages"]):
        items = search_page(session, CONFIG["channel"], page, CONFIG["pageSize"])
        print_table(items, page, CONFIG["pageSize"])
        all_items.extend(items)

        if page < CONFIG["pages"] - 1:
            time.sleep(1)  # 礼貌间隔

    print(f"\n--- 共 {len(all_items)} 条 ---")
    session.close()
```

```bash
python step6_pagination.py
#       品名       规格             库存(t)  单价(元) 卖家    仓库
# ---------------------------------------------------------------------------
#     1 电镀锌板卷   0.60*1273*C     8.29     4256 宝钢股份  上海宝钢运输有限...
#    ...
#    20 热镀锌板卷   0.90*935*C      4.05     3916 宝钢股份  上海宝钢运输有限...
#    21 无取向电工钢 0.50*1200*C     4.23     4256 宝钢股份  湛江宝钢高强钢科...
#    ...
#    40 电镀锌板卷   0.65*1452*C     3.13     3896 宝钢股份  上海宝钢运输有限...
#
# --- 共 40 条 ---
```

---

## 七、Step 7：完整生产级模板

整合上述所有内容，换新站点只改顶部 `CONFIG`：

```python
#!/usr/bin/env python3
"""
sdenv 瑞数 Cookie 生成器 — 通用模板
=====================================

换新站点只需:
  1. 修改 CONFIG 中 url + entryPath
  2. 修改 fetch_data() 中的业务 API 逻辑
  3. python 本文件

依赖:
  pip install requests
  npm install sdenv (在本目录或上级目录)
"""

import json
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("请先安装: pip install requests", file=sys.stderr)
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════
#  站点配置 — 换新站只改这里
# ═══════════════════════════════════════════════════════════════

CONFIG = {
    "host": "https://www.ouyeel.com",
    "entryPath": "/steel",
    "channel": "RJ",
    "pages": 1,
    "pageSize": 20,
}

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

HERE = Path(__file__).parent

# ═══════════════════════════════════════════════════════════════
#  sdenv 桥接（通用层，换站不改）
# ═══════════════════════════════════════════════════════════════

SDENV_BRIDGE_TEMPLATE = r"""
// sdenv 桥接脚本（内嵌 Python 模板）
const { jsdomFromUrl } = require('{sdenv_path}');

async function main() {{
    const cfg = JSON.parse(process.argv[2]);
    const targetUrl = cfg.url + cfg.entryPath;

    const dom = await jsdomFromUrl(targetUrl, {{
        userAgent: cfg.userAgent || '{default_ua}',
        consoleConfig: {{ error: () => {{}} }},
    }});

    await new Promise(r => {{
        dom.window.addEventListener('sdenv:exit', () => r());
        setTimeout(r, 15000);
    }});

    const cookies = dom.cookieJar.getCookieStringSync(cfg.url);
    process.stdout.write(JSON.stringify({{
        success: !!(cookies && cookies.length > 50),
        cookies: cookies || '',
    }}));
    process.exit(0);
}}

main().catch(e => {{
    process.stdout.write(JSON.stringify({{ success: false, error: e.message }}));
    process.exit(1);
}});
"""


def _get_sdenv_path():
    """查找 sdenv 安装位置（从本目录或父目录的 node_modules）"""
    for base in [HERE, HERE.parent, HERE.parent.parent]:
        candidate = base / "node_modules" / "sdenv"
        if candidate.exists():
            return str(candidate).replace("\\", "/")
    raise RuntimeError(
        "未找到 sdenv。请在本目录或父目录运行: npm install sdenv"
    )


def _write_bridge_js():
    """生成桥接脚本到临时文件"""
    import tempfile

    sdenv_path = _get_sdenv_path()
    bridge_code = SDENV_BRIDGE_TEMPLATE.format(
        sdenv_path=sdenv_path,
        default_ua=UA,
    )
    # 转义大括号（format 的副作用）
    bridge_code = bridge_code.replace("{{", "{").replace("}}", "}")
    # 还原 UA 和 sdenv_path 中的花括号
    bridge_code = bridge_code.replace("r'''", '"""')

    tmp = tempfile.NamedTemporaryFile(
        mode="w", suffix=".js", delete=False, encoding="utf-8"
    )
    tmp.write(bridge_code)
    tmp.close()
    return Path(tmp.name)


def generate_cookie(
    host: str = None,
    path: str = None,
    ua: str = None,
    max_retries: int = 3,
) -> str:
    """生成瑞数 Cookie"""
    url = host or CONFIG["host"]
    entry_path = path or CONFIG["entryPath"]
    user_agent = ua or UA

    bridge_js = _write_bridge_js()
    last_error = None

    for attempt in range(1, max_retries + 1):
        try:
            cfg = json.dumps({
                "url": url,
                "entryPath": entry_path,
                "userAgent": user_agent,
            })

            result = subprocess.run(
                ["node", str(bridge_js), cfg],
                capture_output=True, text=True,
                timeout=30, encoding="utf-8", errors="replace",
            )

            stdout = result.stdout.strip()
            if not stdout:
                raise RuntimeError("stdout 为空")

            # 提取 JSON（可能混有日志）
            match = re.search(r'\{.*"success".*\}', stdout, re.DOTALL)
            if not match:
                raise RuntimeError(f"stdout 不是 JSON: {stdout[:200]}")

            data = json.loads(match.group())
            if not data.get("success"):
                raise RuntimeError(data.get("error", "无 Cookie"))

            return data["cookies"]

        except (RuntimeError, subprocess.TimeoutExpired) as e:
            last_error = e
            if "Node.js" in str(e) or "stdout 为空" in str(e):
                raise
            if attempt < max_retries:
                time.sleep(2)
        finally:
            if attempt == max_retries or "Node.js" in str(last_error or ""):
                try:
                    bridge_js.unlink(missing_ok=True)
                except Exception:
                    pass

    raise RuntimeError(f"重试 {max_retries} 次仍失败") from last_error


# ═══════════════════════════════════════════════════════════════
#  业务逻辑层 — 换站必改
# ═══════════════════════════════════════════════════════════════

def fetch_data(session, **kwargs):
    """★★★ 这个函数每个站点不同 ★★★"""
    channel = kwargs.get("channel", CONFIG["channel"])
    page = kwargs.get("page", 0)
    size = kwargs.get("size", CONFIG["pageSize"])

    url = f"{CONFIG['host']}/search-ng/complexSearch/queryResult"
    criteria = json.dumps(
        {"channel": channel, "pageIndex": page, "pageSize": size},
        separators=(",", ":"),
    )

    resp = session.post(
        url,
        data={"criteriaJson": criteria},
        headers={
            "Accept": "application/json, text/plain, */*",
            "Referer": f"{CONFIG['host']}/steel/search?channel={channel}&pageIndex={page}&pageSize={size}",
            "User-Agent": UA,
            "Origin": CONFIG["host"],
        },
    )
    resp.raise_for_status()
    data = resp.json()
    return json.loads(data.get("resultList", "[]"))


def display_results(items, page=0):
    """★★★ 这个函数每个站点不同 ★★★"""
    page_size = CONFIG["pageSize"]

    if page == 0:
        print(
            f"\n{'':>3s} {'品名':10s} {'规格':14s} {'库存(t)':>7s} {'单价':>8s}"
        )
        print("-" * 55)

    for i, item in enumerate(items, 1):
        name = str(item.get("productName", "-"))[:10]
        spec = str(item.get("spec", "-"))[:14]
        weight = item.get("balanceWeight", 0) or 0
        price = item.get("publishPrice", 0) or 0

        idx = page * page_size + i
        print(f"  {idx:3d} {name:10s} {spec:14s} {float(weight):7.2f} {int(price):8d}")


# ═══════════════════════════════════════════════════════════════
#  主流程
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    # ① Cookie
    cookie_str = generate_cookie()

    # ② Session
    session = requests.Session()
    session.headers.update({"User-Agent": UA})
    for item in cookie_str.split("; "):
        if "=" in item:
            k, v = item.split("=", 1)
            session.cookies.set(k, v)

    # ③ 翻页
    all_items = []
    for p in range(CONFIG["pages"]):
        items = fetch_data(session, page=p)
        display_results(items, page=p)
        all_items.extend(items)
        if p < CONFIG["pages"] - 1:
            time.sleep(1)

    print(f"\n--- 共 {len(all_items)} 条 ---")
    session.close()
```

---

## 换新站点只需要改哪些

### Step 1：确认是瑞数

```bash
curl -sI "https://目标域名/路径" -H "User-Agent: Mozilla/5.0..."
# 看返回码是不是 202 或 412
# 看 body 有没有 $_ts.cd
```

### Step 2：改 CONFIG

```python
CONFIG = {
    "host": "https://你的域名",
    "entryPath": "/你的挑战路径",
    # 下面三项可以删除或替换为你的业务参数
    "pages": 1,
    "pageSize": 20,
}
```

### Step 3：改 fetch_data()

把函数里的 URL、参数、headers 换成你的业务 API。

### Step 4：改 display_results()

从 `item` 中提取你关心的字段，格式化输出。

### Step 5：运行

```bash
npm install sdenv    # 首次
python 你的文件.py
```

---

## 文件清单（Step 1→7 完整演进）

| 文件 | 内容 | 行数 |
|------|------|:---:|
| `step1_bare.js` | 纯 JS 验证 | 25 |
| `step2_bridge.js` | JS 桥接（接收 Python 参数） | 35 |
| `step2_basic.py` | Python 最简调用 | 30 |
| `step3_robust.py` | + 超时 + 异常处理 | 60 |
| `step4_retry.py` | + 重试机制 | 70 |
| `step5_full_flow.py` | + API 调用 → 完整闭环 | 90 |
| `step6_pagination.py` | + 翻页 + 排版 | 110 |
| `step7_production.py` | 生产级模板（本章第七节） | 200 |
