# 小红书 Web API 签名参数逆向文档 v1.0

> 本文档记录小红书首页推荐流 API (`/api/sns/web/v1/homefeed`) 所需全部请求头的定位与逆向方法。
> 从零开始，不依赖任何闭源库。

---

## 一、参数总览

| 参数 | 来源 | 逆向方法 | 实现文件 |
|------|------|---------|---------|
| `x-s` | 核心签名 | 浏览器断点 → 抠 VM → 补环境 | `sign.js` + `data/ds_v2.js` |
| `x-t` | 毫秒时间戳 | 直接观察 | `main.py:_xt()` |
| `x-b3-traceid` | 链路追踪 ID | 观察请求头规律 | `main.py:_xb3()` |
| `x-xray-traceid` | 链路追踪 ID | 观察请求头规律 | `main.py:_xxray()` |
| `x-s-common` | 通用签名 | 静态分析 + 逐层拆解 | `main.py:make_xsc()` |
| `Cookie` 引导 | 游客会话 | 逆向服务端流程 + 自研签名 | `main.py:boot_guest_cookies()` |

---

## 二、x-s — 核心签名

### 2.1 定位

浏览器打开小红书 → F12 Network → 找任意 API 请求 → 搜索 Request Headers 中的 `x-s`。

`x-s` 格式固定为 `XYS_` + 自定义 Base64 字符串。解码 Base64 后得到 JSON：

```json
{"x0":"4.3.5","x1":"xhs-pc-web","x2":"Windows","x3":"mns0301_加密数据","x4":"object"}
```

其中 `x3` 是核心，前缀 `mns0301_` 后的加密数据由 `window.mnsv2()` 函数生成。

### 2.2 抠 VM 代码

在浏览器 Sources 面板搜索 `"X-s"`：

```
搜索 → "X-s" → 定位到赋值语句 → 上一步 → break on `v(x, s)`
→ 进入 v 函数 → 看到 `window.mnsv2(c, d)` 调用
→ 在 mnsv2 处设断点 → step into → 进入 VM
→ 在 VM 文件开头设断点 → 刷新页面
→ 回溯 Call Stack → 找到 eval 调用
→ 在所有 eval 处设断点 → 逐个抠出 VM 代码
```

抠出的文件：
- `ds_script.js` (430KB) — mns0201 版本 + 混淆 loader
- `ds_v2.js` (62KB) — mns0201 → mns0301 升级模块

### 2.3 补环境

VM 代码依赖浏览器环境（`window` / `document` / `navigator` 等），需要在 Node.js 中模拟。

`env.js` (16KB) 按以下顺序补：
1. 函数原型保护：备份 `Function.prototype.toString` 防止检测
2. `window` / `global` / `self` 循环引用
3. `document` 基础 DOM 元素
4. `navigator` 浏览器特征（platform、language、plugins 等）
5. `screen` 屏幕信息
6. `localStorage` / `sessionStorage` 存储 API
7. `location` URL 解析
8. Canvas / WebGL 指纹检测桩
9. 定时器、事件系统桩

### 2.4 覆盖升级

`ds_script.js` 注册的 `window.mnsv2` 是 mns0201 版本，主要数据接口（homefeed、search 等）需要 mns0301。

`ds_v2.js` 加载时会通过 `_AUuXfEG27Xa3x` setter 覆盖升级为 mns0301：

```javascript
// sign.js 中的覆盖逻辑
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _oa; },
  set: function (fn) {
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        for (var i = 0; i < 200; i++) {
          if (env[i] === undefined) {
            var s = function () {}; s.prototype = {}; env[i] = s;
          }
        }
        return fn.call(window, bc, env);
      };
    }
  }
});
eval(fs.readFileSync("data/ds_v2.js", "utf8"));
// 此时 window.mnsv2 已被 ds_v2.js 替换为 mns0301
```

### 2.5 为什么必须找到 4 个 eval

**这是 1.md 中最关键的一步，也是最容易遗漏的。**

线上代码通过 4 个 `eval()` 分散加载 VM 模块：

| eval | 内容 | 产物 | 作用 |
|------|------|------|------|
| 第 1 个 | 混淆 loader + 运行时 | `ds_script.js` (430KB) | 注册 mns0201 版本的 `window.mnsv2` |
| 第 2 个 | API 辅助模块 | `ds_api.js` | 时间戳同步等辅助函数 |
| 第 3~4 个 | VM 升级模块 | `ds_v2.js` (62KB) | mns0201 → mns0301 升级 |

如果只找到前 2 个 eval，`window.mnsv2` 只能产出 `mns0201_`，验证如下：

```
仅加载 ds_script (eval 1):
  window.mnsv2(input) → "mns0201_hdH79KQjs+h9sXYnhZNRGh..."

加载 ds_script + ds_v2 (eval 1+3+4):
  window.mnsv2(input) → "mns0301_gRaKqtrzeR67KaHAED0id11mr6cJRG5V..."
```

**mns0201 版本不能用于数据接口**。1.md 原文记录：

> "生成的结果有个前缀 mns0301，但并不是所有接口都是0301，也有0201,0101，而上面的代码生成的结果貌似都是0201，而主要的数据接口基本都是0301的，这就是问题所在。"

这就是为什么必须搜出全部 4 个 eval——少了任何一个都会导致 `window.mnsv2` 停留在 mns0201，homefeed 等接口拿不到数据。1.md 作者最初也只找到 2 个 eval，花了额外时间重新搜寻才把 3~4 号 eval 抠出来。

#### 在浏览器中定位 eval 的方法

```
1. 在 VM 文件开头设断点 → 刷新页面 → 断住
2. 回溯 Call Stack → 找到调用 VM 的上一个堆栈帧
3. 在堆栈帧的 eval 位置设断点
4. 刷新页面 → 逐个断住 → 把 eval 的参数（VM 源码）拷出
5. 反复检查：grep 搜索 "eval" → 确认是否还有遗漏的 eval 调用
6. 直到断点总数 = 4 → 全部抠出
```

### 2.6 调用方式

```python
# main.py
def _xs(path, body):
    r = subprocess.run(
        ["node", "sign.js", path, json.dumps(body)],
        capture_output=True, text=True, timeout=30)
    return json.loads(r.stdout)  # {"X-s": "XYS_...", "X-t": "..."}
```

sign.js 内部：
```javascript
var c = url + JSON.stringify(body);
var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
// h = "mns0301_加密数据"
return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({
  x0: "4.3.5", x1: "xhs-pc-web", x2: "Windows",
  x3: h, x4: body ? "object" : ""
})));
```

---

## 三、x-t — 毫秒时间戳

### 3.1 定位

浏览器 Request Headers 中 `x-t` 的值是当前时间的毫秒级 Unix 时间戳。

### 3.2 实现

```python
def _xt():
    return int(time.time() * 1000)
```

### 3.3 验证

和浏览器请求对比：`x-t` ≈ `Date.now()`，允许 ±200ms 误差。

---

## 四、x-b3-traceid — 链路追踪 ID

### 4.1 定位

浏览器 Request Headers 中 `x-b3-traceid` 为 16 位小写 hex 字符串。每次请求不同，无跨请求关联规律。

### 4.2 实现

```python
def _xb3():
    return "".join(random.choices("abcdef0123456789", k=16))
```

---

## 五、x-xray-traceid — 链路追踪 ID

### 4.1 定位

浏览器 Request Headers 中 `x-xray-traceid` 为 32 位 hex 字符串。

### 4.2 观察推导

连续请求对比发现规律：
- 前 16 位随时间递增，步长 ≈ 请求间隔的毫秒数
- 后 16 位完全随机

解码前 16 位：`hex_to_int(前16位) >> 23 ≈ Date.now()`，即时间戳左移 23 位后合并一个递增计数器。

### 4.3 实现

```python
def _xxray():
    return (
        hex(int(time.time() * 1000) << 23)[2:].zfill(16) +
        hex(random.getrandbits(64))[2:].zfill(16)
    )
```

---

## 六、x-s-common — 通用签名（自研）

### 6.1 定位

浏览器每个 API 请求都带 `x-s-common`。值解码后是 JSON 结构，包含 14 个字段。

### 6.2 编码管线

```
JSON → URL Encode (safe:~()*!./:?=&-_) → byte array → 自定义 Base64
```

自定义 Base64 表：`ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`

解码方法：
```python
def _b64d(s):
    # 4 字符 → 3 字节，填充位跳过
    ...
```

### 6.3 JSON 结构

解码后的 x-s-common 包含以下字段：

| 字段 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `s0` | int | 5 | Windows 平台码 (Mac=?, Linux=?) |
| `s1` | str | "" | 预留 |
| `x0` | str | "1" | localStorage.getItem("b1b1") |
| `x1` | str | "4.3.5" | 语言/库版本号 |
| `x2` | str | "Windows" | 操作系统 |
| `x3` | str | "xhs-pc-web" | App ID |
| `x4` | str | "6.12.3" | webBuild 版本号 |
| `x5` | str | a1 值 | Cookie a1 |
| `x6` | str | "" | 预留（旧版放 x-s） |
| `x7` | str | "" | 预留（旧版放 x-t） |
| `x8` | str | b1 值 | **RC4 加密的 18 项指纹子集** |
| `x9` | int | CRC32(b1) | JS 风格有符号 int |
| `x10` | int | fp.x39 | 请求计数器 |
| `x11` | str | "normal" | 固定值 |

### 6.4 x8 (b1) — RC4 加密指纹

b1 是 x-s-common 中最核心的字段。生成过程：

```
18 项指纹子集 → JSON → RC4(key="xhswebmplfbt") → Latin1 解码
→ URL Encode (safe:!*'()~_-) → byte array → 自定义 Base64
```

#### 18 项指纹子集

| 键 | 值 | 含义 |
|----|-----|------|
| `x33` | "0" | 微信内置浏览器检测 |
| `x34` | "0" | Brian Paul 虚拟渲染器检测 |
| `x35` | "0" | Modernizr 检测 |
| `x36` | random(1-20) | window.history.length |
| `x37` | "0\|0\|..." | 环境检测标志位 1 (24 位) |
| `x38` | "0\|0\|1\|..." | 环境检测标志位 2 (39 位) |
| `x39` | 0 | localStorage 计数器 (`sc`) |
| `x42` | "3.5.4" | FingerprintJS 版本 |
| `x43` | "Canvas not supported" | canvas 指纹 |
| `x44` | 毫秒时间戳 | 当前时间 |
| `x45` | "__SEC_CAV__1-1..." | 风控 SDK 打点 |
| `x46` | "false" | navigator.webdriver 属性检测 |
| `x48` | "" | 预留 |
| `x49` | "{list:[],type:}" | 预留结构 |
| `x50`-`x52` | "" | 预留 |
| `x82` | "_0x17a2\|_0x1954" | iframe contentWindow 差异 |

#### RC4 加密

```python
from Crypto.Cipher import ARC4

cipher = ARC4.new(b"xhswebmplfbt")
ciphertext = cipher.encrypt(b1_json.encode("utf-8"))
```

### 6.5 x9 — CRC32 校验

对 b1 字符串做 JavaScript 风格的 CRC32。与 Python `zlib.crc32()` 的不同在于有符号位处理：

```
JS CRC32:
  表: 标准 CRC32 多项式 0xEDB88320
  初始值: -1 (0xFFFFFFFF)
  结果: (-1 ^ crc) → 如果 >= 2^31 则减 2^32
```

```python
def _js_crc32(s):
    tbl = [0] * 256
    for i in range(256):
        c = i
        for _ in range(8):
            c = 0xEDB88320 ^ (c >> 1) if c & 1 else c >> 1
        tbl[i] = c
    c = 0xFFFFFFFF
    for b in s.encode("utf-8"):
        c = tbl[(c ^ b) & 0xFF] ^ (c >> 8)
    r = 0xFFFFFFFF ^ c
    return r - 0x100000000 if r >= 0x80000000 else r
```

### 6.6 完整实现

```python
def make_xsc(a1, fp=None):
    fp = fp or _make_fp()
    b1 = _make_b1(fp)        # RC4 加密指纹
    x9 = _js_crc32("" + "" + b1)  # CRC32(b1)
    obj = {
        "s0": 5, "s1": "",
        "x0": "1", "x1": "4.3.5", "x2": "Windows", "x3": "xhs-pc-web",
        "x4": "6.12.3", "x5": a1, "x6": "", "x7": "",
        "x8": b1, "x9": x9, "x10": fp["x39"], "x11": "normal",
    }
    return _b64e(_json_to_bytes(obj))
```

完整实现见 `main.py:make_xsc()`。

---

## 七、Cookie 引导 — 游客会话自动获取

### 7.1 流程概览

```
Step 1: 生成 a1/webId (纯 Python)
  → hex(ts) + random30 + "50000" + CRC32 → a1
  → MD5(a1) → webId

Step 2: /api/sec/v1/scripting (JSVMP 解密)
  → POST 获取 b/d 字段
  → Base64 解码 → 减 1 → 按 5 分组 → d[92:94] 切片 → 解码 websectiga
  → 响应 Set-Cookie: sec_poison_id

Step 3: /api/sec/v1/shield/webprofile (DES ECB + 签名)
  → 指纹 JSON → Base64 → DES(key="zbp30y86") → hex
  → POST → 响应 Set-Cookie: gid, acw_tc

Step 4: /login/activate (签名)
  → POST {} → 响应 Set-Cookie: web_session
```

### 7.2 关键发现：引导过程需要完整签名

**这是整个项目最重要的发现，也是最容易被忽略的坑。**

#### 现象

sign.js 生成的 x-s 完全正确，硬编码版 x-s-common 也能用，但 homefeed 始终返回 `items=0`。

#### 排查过程

依次排除了以下假设：

| 假设 | 验证方法 | 结论 |
|------|---------|------|
| TLS 指纹被检测 | 换 `curl_cffi` 的 `impersonate` 参数 (chrome120/124/131/edge101/safari17_0) | ❌ 全部只返回 10KB JS 壳，与 cookie 有关 |
| x-rap-param 缺失 | 引入 xhshow 生成完整 x-rap-param 头 | ❌ homefeed 仍然 items=0 |
| x-s-common 硬编码版不完整 | 用 RedCrack/xhshow 的完整版 x-s-common | ❌ homefeed 仍然 items=0 |
| **Cookie 引导过程没有完整签名** | 用 RedCrack 做 shield/webprofile 的签名，其余用 sign.js | ✅ homefeed 返回数据 |
| sign.js 的 x-s 不能用 | 用 RedCrack cookies + sign.js x-s + 硬编码 x-s-common | ✅ code=0 items=4 |

#### 根因

问题不在 homefeed 请求本身，而在**更早的 Cookie 引导阶段**。

```
之前（错误）:
  Step 3 shield/webprofile → 不带签名  → 服务端给了"受限"的 cookie
  Step 4 activate          → 不带签名  → 同上
  homefeed 请求 → x-s/x-s-common 正确 → 但 cookie 是"受限"的 → items=0

之后（正确）:
  Step 3 shield/webprofile → 带完整签名 → 服务端给了"完整"的 cookie
  Step 4 activate          → 带完整签名 → 同上
  homefeed 请求 → x-s/x-s-common 正确 → cookie 完整 → items=正常数据
```

#### 为什么容易忽略

- homefeed 返回 `code=0 success=True`，容易误以为一切正常
- `items=0` 看起来像"游客没推荐数据"，其实是 cookie 不完整
- shield/webprofile 和 activate 返回的 HTTP 状态也都正常，不会报错
- 只有对比 RedCrack 的引导流程后才锁定了根因

#### 正确的 homefeed 请求可以多精简

一旦 cookie 是通过完整签名引导出来的，homefeed 请求本身需要的头非常少：

```
必须: x-s (sign.js) + x-t + x-s-common (硬编码版即可)
可选: x-b3 + x-xray (防御性加上)
不需要: x-rap-param (游客 homefeed 不需要)
```

也就是说，x-s-common 不需要 b1/RC4 指纹，不需要 MRC CRC32——5 字段硬编码版完全够用。复杂度全部集中在 Cookie 引导的 shield/webprofile 那一个请求上。

### 7.3 a1 生成

```
a1 结构: hex(毫秒时间戳) + 30随机字符 + 平台码 + "000" + CRC32
         长度 52 位

平台码: 5 = Windows
```

```python
def _gen_a1():
    ts = hex(int(time.time() * 1000))[2:]
    base = ts + random30 + "5" + "0" + "000"
    crc = zlib.crc32(base.encode())
    a1 = (base + str(crc))[:52]
    webId = MD5(a1)
    return a1, webId
```

### 7.4 websectiga 解密

来自 `/api/sec/v1/scripting` 的响应 JSON 中 `data.data` 字段是一段 JS 文本，包含 `b` 和 `d` 两个变量：

- `b`: Base64 编码的 JSVMP 逻辑表
- `d`: 解密密钥数组

解密步骤：
1. Base64 解码 `b` → UTF-8 字符串
2. 每个字符 ord-1 → 按 5 个一组分组
3. 用 `d[92]` 到 `d[93]` 作为切片范围
4. 从切出的目标中每 2 个取 1 个 key byte → 共 64 字节
5. 倒序 8 字节一组 → 7 组 → 拼成 64 位 websectiga

```python
def _gen_websectiga(js_text):
    b = re.search(r'"b":"(.*?)",', js_text).group(1)
    d = json.loads(re.search(r'"d":(.*?)\}\)', js_text).group(1))
    # Base64 解码 → 减 1 → 按 5 分组
    decoded = b64decode(b).decode("utf-8")
    logic = [list of 5-char chunks, each char ord-1]
    # d[92]:d[93] 切片
    target = logic[d[92]:d[93]+1]
    # 每 2 取 1 → 倒序 7 组
    kb = [d[target[675+i][2]] for i in range(0, 128, 2)]
    return "".join(chr(kb[i+j]) for i in range(56,-1,-8) for j in range(8))
```

### 7.5 gid 获取 (DES ECB)

```
指纹 JSON → std Base64 → DES ECB(key="zbp30y86") → hex
→ POST /api/sec/v1/shield/webprofile
→ 响应 Set-Cookie: gid, acw_tc
```

注意：此请求**必须带完整签名**。

### 7.6 web_session 激活

```
POST /login/activate {} → 响应 Set-Cookie: web_session
```

注意：此请求**必须带完整签名**。

### 7.7 Cookie 最终清单

引导完成后可获得 11 项 cookie：

| Cookie | 生成方式 | 作用 |
|--------|---------|------|
| `a1` | Python 自研 | 设备标识 (52 位) |
| `webId` | MD5(a1) | Web 设备 ID |
| `webBuild` | "6.12.3" | 前端构建版本 |
| `xsecappid` | "xhs-pc-web" | App ID |
| `loadts` | 毫秒时间戳 | 页面加载时间 |
| `abRequestId` | UUID4 | 请求追踪 |
| `websectiga` | JSVMP 解密 | 反爬 token |
| `sec_poison_id` | 服务端下发 | 二次校验 ID |
| `gid` | DES + shield API | 全局设备 ID |
| `acw_tc` | shield API Set-Cookie | 阿里云 WAF token |
| `web_session` | activate API | 游客会话 token |

---

## 八、验证方法

### 8.1 单参数验证

```bash
# x-s: 直接调 sign.js
node sign.js '/api/sns/web/v1/homefeed' '{"cursor_score":""}'
# 输出: {"X-s":"XYS_...","X-t":"...","X-s-common":"..."}

# x-s-common: Python 单元验证
python -c "from main import make_xsc; print(make_xsc('test_a1'))"
# 输出: 2UQAPsHC+aIjqArjwjHjNsQhPsHCH0rjNsQhPaHC... (1320B)
```

### 8.2 集成验证

```bash
cd 小红书/v1.0
npm install        # 仅需一次
python main.py     # 自动引导 + 3 页翻页
```

预期输出：
```
[1/4] a1=19ef... webId=8f7c...
[2/4] websectiga=9fe8...
[3/4] gid=ok acw_tc=?
[4/4] web_session=ok
[ok] 11 cookies 已保存 -> data/cookies.json

── 第 1/3 页 ──
   1. 📝 笔记标题
      @作者  ❤点赞数
   ...
============================================================
  共 XX 条笔记
```

### 8.3 硬编码版 vs 完整版对比

硬编码版 x-s-common (5 字段，152B)：
```python
{"a1":"","x1":"4.3.5","x2":"/api/sns/web/v1/homefeed","x3":"xhs-pc-web","x4":"md5(path)"}
```

完整版 x-s-common (14 字段，1320B)：
```python
{"s0":5,...,"x8":b1,"x9":CRC32(b1),...,"x11":"normal"}
```

两者均可用。完整版更贴近真实浏览器行为，降低风控风险。

---

## 九、文件清单

| 文件 | 大小 | 说明 |
|------|------|------|
| `main.py` | 17KB | 主入口：Cookie 引导 + 签名 + API 请求 |
| `sign.js` | 3KB | x-s 生成入口（调 VM + 覆盖升级 + b64 编码） |
| `env.js` | 16KB | Node.js 浏览器环境补丁 |
| `ds_script.js` | 430KB | 线上抠的混淆 loader (mns0201) |
| `data/ds_v2.js` | 62KB | 线上抠的 VM 升级模块 (mns0201→mns0301) |
| `data/ds_api.js` | 60KB | 签名辅助模块 |
| `package.json` | 295B | crypto-js 依赖声明 |
| `1.md` | 460KB | 原始逆向笔记（参考） |

---

## 十、升级应对

当小红书更新签名算法时，排查顺序：

1. **先看 x-s-common**：用浏览器抓一个真实 x-s-common，对比解码后的 JSON 结构。新字段或改值按最小改动修改 `_make_fp()` 和 `make_xsc()`。
2. **再看 Cookie 引导**：检查 `/api/sec/v1/shield/webprofile` 和 `/login/activate` 是否新增必需头。
3. **最后看 x-s**：如果 `sign.js` 报错，说明 VM 代码更新了，需要重新从线上抠 `ds_v2.js`，`env.js` 可能需要补新的环境变量。
