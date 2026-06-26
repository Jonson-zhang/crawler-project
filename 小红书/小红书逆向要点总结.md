# 小红书 Web API 逆向工程技术文档

> 版本: v2.0 | 日期: 2026-06-26 | 目标: Python 离线调用 homefeed API

---

## 一、项目概述

### 1.1 逆向目标

小红书 PC Web 端的首页推荐流 API（`/api/sns/web/v1/homefeed`）有严格的反爬保护，每个 POST 请求必须携带 6 项签名头和 11 项 Cookie，任何一个环节出错都会导致请求被拒或返回空数据。

本项目的逆向成果：**完全离线**（无需浏览器、无需 MCP、无需第三方逆向库）的 Python 自动化方案，涵盖签名生成、Cookie 引导、API 调用、翻页全链路。

### 1.2 核心挑战

| 挑战 | 难度 | 解决方案 |
|------|------|---------|
| x-s 签名 | 极高 | JSVMP 虚拟机离线执行（Node.js 补环境） |
| x-s-common 指纹 | 高 | Python 纯算：18 项浏览器指纹 + RC4 + CRC32 + 自定义 Base64 |
| Cookie 链式引导 | 高 | 4 步请求链，每步都需完整签名 |
| JSVMP 字节码升级 | 极高 | `_AUuXfEG27Xa3x` setter 拦截 + env slot 预填充 |
| 自定义编码表 | 中 | 64 字符自定义 Base64 表，Python/Node 双端一致实现 |

### 1.3 总体架构

```
main.py  (Python 入口：Cookie 引导 + 签名头生成 + API 请求 + 翻页)
  | subprocess daemon (stdin/stdout 通信)
  v
sign.js  (Node.js 常驻进程：x-s 签名生成)
  |-- env.js           原型链补环境 (~16KB)
  |-- ds_script.js     VMP 解释器 + mns0201，从 eval 抠出 (~430KB)
  |-- data/ds_api.js   签名辅助，从 eval 抠出 (~60KB)
  |-- data/ds_v2.js    VMP 升级 mns0201 -> mns0301，从 eval 抠出 (~62KB)
```

---

## 二、技术栈

### Python 端
- `curl_cffi` — 带 TLS 指纹伪装的 HTTP 客户端（impersonate chrome131）
- `pycryptodome` — RC4、DES 加密（x-s-common 指纹加密、Cookie 引导第 3 步）

### Node.js 端
- `crypto-js` — MD5 哈希（sign.js 签名输入）
- Node.js 原生 `crypto` — 供 env.js 中 `crypto.getRandomValues()` 使用

---

## 三、签名体系详解

小红书每个 API 请求需要带 **5 个自定义请求头**，缺一不可：

| 请求头 | 生成方 | 格式 | 说明 |
|--------|--------|------|------|
| `x-s` | sign.js (Node) | `XYS_` + 自定义 Base64 | 核心签名，内含 `mns0301_` VMP 哈希 |
| `x-s-common` | main.py (Python) | 自定义 Base64 | 14 字段设备指纹 |
| `x-t` | main.py (Python) | 13 位数字 | 毫秒时间戳 |
| `x-b3-traceid` | main.py (Python) | 16 位 hex | 随机 trace ID |
| `x-xray-traceid` | main.py (Python) | 32 位 hex | 时间戳位移 + 随机数 |

### 3.1 自定义 Base64 编码表

小红书没有使用标准 Base64，而是定义了一张 64 字符的专用编码表：

```
ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5
```

所有签名数据（x-s、x-s-common 以及两者的内部字段）都必须使用这张表编码。Python 端（`_b64e`）和 Node 端（`b64Encode`）实现完全一致的算法：

```
标准 Base64 算法（3 字节 -> 4 字符），但查表时使用自定义字符集。
分块循环步长 16383，防止长字符串 String.fromCharCode 溢出。
```

### 3.2 x-s 签名（JSVMP 虚拟机离线执行）

**这是整个逆向中最复杂的部分。**小红书使用自研的 JSVMP（JavaScript Virtual Machine Protection）虚拟机来保护签名算法。

#### 3.2.1 编码流程

```
url + JSON.stringify(body)
        |
        v
     payload
    /    |    \
   v     v     v
 MD5(payload)  MD5(url)    payload
   = m          = w          = c
    \         /             /
     v       v             v
   window.mnsv2(c, m, w)    ← JSVMP 虚拟机执行
        |
        v
   "mns0301_xxxx"  (200 chars)
        |
        v
   JSON({x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:hash, x4:type})
        |
        v
   encodeURIComponent -> byte[] -> 自定义Base64 -> "XYS_" +
```

#### 3.2.2 签名核心

```javascript
function seccore_signv2(url, body) {
  var c = url + JSON.stringify(body);
  var h = window.mnsv2(c, CryptoJS.MD5(c).toString(), CryptoJS.MD5(url).toString());
  return "XYS_" + b64Encode(encodeUtf8(JSON.stringify({
    x0: "4.3.5",
    x1: "xhs-pc-web",
    x2: "Windows",
    x3: h,
    x4: body ? "object" : ""
  })));
}
```

其中 `window.mnsv2` 并非真实浏览器函数，而是 JSVMP 虚拟机的产物——需要通过补环境 + 加载 3 个 DS 脚本才能生成。

### 3.3 x-s-common 签名（Python 纯算）

x-s-common 是**完全用 Python 自研实现**的签名头，不依赖 Node.js。

#### 3.3.1 数据结构

```json
{
  "s0": 5,            // 平台码: 5 = Windows
  "s1": "",           // 预留
  "x0": "1",          // localStorage b1b1 标记
  "x1": "4.3.5",      // 库版本
  "x2": "Windows",    // 操作系统
  "x3": "xhs-pc-web", // App ID
  "x4": "6.12.3",     // webBuild 版本号
  "x5": "<a1 cookie>",// 设备标识 a1
  "x6": "",           // 预留（旧版放 x-s）
  "x7": "",           // 预留（旧版放 x-t）
  "x8": "<b1>",       // RC4 加密的 18 项浏览器指纹
  "x9": "<crc32>",    // b1 的 CRC32 校验
  "x10": 0,           // 请求计数器
  "x11": "normal"     // 固定值
}
```

#### 3.3.2 浏览器指纹（18 项）

```python
fingerprint = {
    "x33": "0",      # webdriver 标记
    "x34": "0",      # 插件数量
    "x35": "0",      # mimeTypes 数量
    "x36": "1-20",   # 随机屏幕色深偏移
    "x37": "..."     # navigator 属性位图 (24位)
    "x38": "..."     # 浏览器特性位图 (39位)
    "x39": 0,        # 请求计数器
    "x42": "3.5.4",  # 指纹库版本
    "x43": "Canvas not supported",  # Canvas 指纹
    "x44": "<timestamp>",  # 时间戳
    "x45": "__SEC_CAV__1-1-1-1-1|__SEC_WSA__|",  # 安全标记
    "x46": "false",  # iframe 检测
    "x48": "",       # WebGL 指纹
    "x49": "{list:[],type:}",  # 字体列表
    "x50": "",       # 音频指纹
    "x51": "",       # 电池状态
    "x52": "",       # 连接类型
    "x82": "_0x17a2|_0x1954"  # 混淆标记
}
```

#### 3.3.3 b1 加密流程

```
18 项指纹 -> JSON.stringify -> RC4(key="xhswebmplfbt") -> URLEncode -> 自定义Base64
```

注意 CRC32 必须使用 JavaScript 风格的有符号 32 位整数（位运算查表法实现），不能直接用 Python 的 `zlib.crc32`。

### 3.4 x-t / x-b3 / x-xray（辅助签名）

这三个相对简单，直接 Python 生成：

```python
x_t    = int(time.time() * 1000)            # 毫秒时间戳
x_b3   = random.hex(16)                     # 随机 16 位 hex
x_xray = hex(ts << 23) + hex(random 64bit)  # 时间戳位移 | 随机数
```

---

## 四、JSVMP 虚拟机逆向

### 4.1 什么是 JSVMP

小红书自研的 JavaScript 虚拟机保护方案，将签名算法编译成自定义字节码，在浏览器中通过解释器执行。核心函数 `window.mnsv2(bc, env)` 接收字节码和运行环境数组，输出签名哈希。

### 4.2 虚拟机版本演进

| 版本 | 前缀 | 文件名 | 大小 | 说明 |
|------|------|-------|------|------|
| mns0201 | `mns0201_` | ds_script.js | ~430KB | 基础 VMP + 第 1 代解释器 |
| mns0301 | `mns0301_` | ds_v2.js | ~62KB | 升级版，覆盖 mns0201 |

必须产出 `mns0301_` 前缀的签名，`mns0201_` 会导致服务端拒绝（HTTP 406）。

### 4.3 eval 抠脚本（关键步骤）

**这是最容易踩的坑。** 小红书的 DS 脚本通过浏览器中 4 个 `eval()` 调用分发，而非 Network 面板中的独立文件。

| 来源 | 大小（eval版） | 大小（Network版） | 是否可使用 |
|------|---------------|-------------------|-----------|
| eval 1 | ~430KB | 148KB (ds_loader.js) | 只能用 eval 版 |
| eval 2 | ~60KB | 多个拆分文件 | 只能用 eval 版 |
| eval 3-4 | ~62KB | 多个拆分文件 | 只能用 eval 版 |

**原因**：浏览器在运行时通过 eval 将多个模块**合并执行**，合并后的 `window` 全局状态与拆分文件完全不同。Network 版的 `ds_loader.js` 是加载器，缺少实际执行逻辑。

**正确做法**：
1. 在浏览器 Sources 面板中搜索 `seccore_signv2` 定位调用点
2. 从 Call Stack 回溯找到 4 个 eval 调用
3. 在每个 eval 处设断点，复制 eval 的参数（即完整的合并后源码）
4. 验证文件大小与浏览器中的一致
5. **绝对不要格式化、美化、改任何字符**（一个字节偏差即可导致 VMP 字节码解析失败）

### 4.4 补环境（原型链方式）

JSVMP 解释器依赖浏览器环境（`window`、`document`、`navigator` 等）。但**不能用 jsdom**——jsdom 的严格构造函数会抛出 `Illegal constructor`。

#### 4.4.1 核心原则：诊断驱动

```
1. 先让代码跑起来 -> 暴露缺失
2. 根据报错逐项补 -> 不猜、不预补
3. 直接赋值跑通后 -> 替换为原型链
4. 关键方法 -> setNative (toString 保护)
5. getter/setter -> Object.defineProperty
```

#### 4.4.2 最小环境

```javascript
window = globalThis;  // 直接用 Node.js 全局，不隔离
global.window = window;
global.self = window;

// 通过 new 建立完整原型链，而非直接赋值 __proto__
function HTMLElement() {}
function HTMLHtmlElement() {}
HTMLHtmlElement.prototype = new HTMLElement();
```

#### 4.4.3 Native toString 保护

JSVMP 会检测函数 `toString()` 是否返回 `[native code]`。需要拦截 `Function.prototype.toString`：

```javascript
const memoryMap = new Map();
const rawToString = Function.prototype.toString;

Function.prototype.toString = function () {
  return typeof this === "function" && memoryMap.get(this)
    || rawToString.call(this);
};

function setNative(func, name) {
  Object.defineProperty(func, "name", { value: name, writable: false });
  memoryMap.set(func, `function ${name}() { [native code] }`);
}
```

#### 4.4.4 完整环境清单

env.js 需要补的环境（约 410 行，以原型链 + watch Proxy 方式实现）：

| 对象 | 关键属性 |
|------|---------|
| `window` | watch Proxy 包裹 globalThis |
| `document` | cookie, documentElement, body, head, createElement 等 |
| `navigator` | userAgent, platform, language, webdriver, cookieEnabled |
| `location` | href, protocol, host, origin 等 |
| `screen` | width/height 1920x1080, colorDepth 24 |
| `history` | length, pushState, replaceState (setNative) |
| `localStorage/sessionStorage` | getItem/setItem (setNative) |
| `performance` | now(), timing 对象 |
| `XMLHttpRequest` | open/send/setRequestHeader (空实现) |
| `CanvasRenderingContext2D` | fillText, measureText, getImageData 等 |
| `crypto` | getRandomValues (Node.js 原生 crypto 桥接) |

### 4.5 _AUuXfEG27Xa3x setter 拦截（VMP 升级核心技巧）

**这是整个逆向中最精巧的技术。** 加载 ds_v2.js 后 VMP 从 mns0201 升级到 mns0301，但升级过程中解释器会执行 `new env[i]()`——env 数组有空 slot（undefined）导致 `undefined is not a constructor`。

解决方案：在加载 ds_v2.js **之前**，用 `Object.defineProperty` 拦截全局属性 `_AUuXfEG27Xa3x` 的 setter：

```javascript
var _ra, _oa = global._AUuXfEG27Xa3x;

Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  get: function () { return _ra || _oa; },
  set: function (fn) {
    // toString().length > 100000 精准识别 VMP 升级函数
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        // 预填充 env 数组中所有空 slot 为可构造的空函数
        for (var i = 0; i < 200; i++) {
          if (env[i] === undefined) {
            var s = function () {};
            s.prototype = {};
            env[i] = s;
          }
        }
        return fn.call(window, bc, env);
      };
    }
  },
  configurable: true, enumerable: true,
});

// 然后才加载 ds_v2.js
eval(fs.readFileSync("data/ds_v2.js", "utf8"));
```

**三个关键点**：
1. `toString().length > 100000` — VMP 混淆函数体积极大，此条件精准匹配
2. `env[i] = function(){}` — 必须是可构造的函数，不能是普通对象
3. 200 个 slot — 保守覆盖，不够再加

### 4.6 脚本加载顺序

```
env.js -> ds_script.js -> ds_api.js -> ds_v2.js
```

顺序错乱会导致 `window.mnsv2` 未定义或版本不对。

### 4.7 常驻进程模式

sign.js 支持两种运行模式，Python 端使用常驻模式消除冷启动开销：

```python
class SignDaemon:
    """启动一次 Node.js 进程，后续通过 stdin/stdout JSON 行协议通信"""
    def __init__(self):
        self._proc = subprocess.Popen(
            ["node", "sign.js", "--daemon"],
            stdin=PIPE, stdout=PIPE, stderr=PIPE,
            text=True, cwd=BASE_DIR,
        )
    def sign(self, path, body=None):
        req = json.dumps({"path": path, "body": body or {}})
        self._proc.stdin.write(req + "\n")
        self._proc.stdin.flush()
        return json.loads(self._proc.stdout.readline())
```

每次冷启动需 ~1 秒（VMP 初始化），常驻模式消除此开销。

---

## 五、Cookie 引导流程

`web_session` 不是本地生成的，而是小红书服务端在最终接口的 `Set-Cookie` 响应头中下发的。获取它需要 4 步链式引导：

```
Step 1: 本地生成 a1 + webId           -> 伪造匿名设备身份
Step 2: /sec/v1/scripting             -> 解密 JSVMP 获取 websectiga
Step 3: /sec/v1/shield/webprofile     -> DES ECB + 签名 -> 获取 gid
Step 4: /login/activate               -> 验证链 -> Set-Cookie 下发 web_session
```

### 5.1 Step 1 — 伪造客户端身份（a1 + webId）

```python
def _gen_a1():
    ts = hex(int(time.time() * 1000))[2:]           # 时间戳 hex
    base = ts + random.choices(ALPHABET, k=30)       # 30 位随机字符
           + "5" + "0" + "000"
    crc = zlib.crc32(base.encode())                  # CRC32 校验
    a1 = (base + str(crc))[:52]                      # 截取 52 位
    webId = hashlib.md5(a1.encode()).hexdigest()     # MD5
    return a1, webId
```

a1 结构：`[13位时间戳hex] + [30位随机字母数字] + 5 + 0 + 000 + [CRC32]`，共 52 字符。

### 5.2 Step 2 — 解密 websectiga（JSVMP 逆向）

`/api/sec/v1/scripting` 返回的 JS 代码经过了 JSVMP 加密。需要逆向其解密逻辑提取 `websectiga`：

```
"b" 字段 -> Base64 解码 -> 每字符 ASCII - 1 -> 5 位一组还原逻辑数组
"d" 字段 -> JSON 解析索引数组 -> d[92]:d[93] 切片段 -> d[target[675+i][2]] 交叉取 8 位 x 7 轮
-> 还原 56 字符 websectiga
```

```python
def _gen_websectiga(js_text):
    b = re.search(r'"b":"(.*?)",', js_text).group(1)
    d = json.loads(re.search(r'"d":(.*?)\}\)', js_text).group(1))

    # Base64 解码 b 字段
    decoded = base64.b64decode(b + "=" * (4 - len(b) % 4)).decode()

    # 每字符减 1，5 位一组还原逻辑数组
    logic = []
    chunk = []
    for c in decoded:
        if len(chunk) == 5:
            logic.append(chunk)
            chunk = []
        chunk.append(ord(c) - 1)
    if chunk:
        logic.append(chunk)

    # 交叉取 8 位 x 7 轮还原 56 字符
    target = logic[d[92] : d[93] + 1]
    kb = [d[target[675 + i][2]] for i in range(0, 128, 2)]
    return "".join(chr(kb[i + j]) for i in range(56, -1, -8) for j in range(8))
```

### 5.3 Step 3 — 获取 gid（DES ECB + 签名）

```python
def _get_gid(session):
    fp_json = json.dumps({
        "uuid": "joiamkprgeyi238i",
        "requestId": hashlib.md5(str(time.time())).hexdigest()[:16],
    })
    fp_b64 = base64.b64encode(fp_json.encode()).decode()

    # DES ECB 加密，key = "zbp30y86"
    padded = fp_b64.encode() + b"\x00" * (8 - len(fp_b64) % 8)
    pf = DES.new(b"zbp30y86", DES.MODE_ECB).encrypt(padded).hex()

    session.post(
        "https://as.xiaohongshu.com/api/sec/v1/shield/webprofile",
        json={"platform": "Windows", "profileData": pf, "sdkVersion": "4.2.6", "svn": "2"},
        headers=sign_headers(url, cookies, data),  # 必须带完整签名
    )
```

**关键**：此步骤和下一步 **必须带完整签名头**（x-s + x-s-common + x-t + x-b3 + x-xray），否则虽然 HTTP 200，但服务端不会下发正确的 Cookie，导致后续 homefeed 返回 `items=0`。

### 5.4 Step 4 — 激活会话（获取 web_session）

```python
def _activate(session):
    session.post(
        "https://edith.xiaohongshu.com/api/sns/web/v1/login/activate",
        json={},
        headers=sign_headers(url, cookies, {}),  # 全套签名
    )
    return session.cookies.get("web_session")  # 服务端 Set-Cookie 下发
```

**本质**：服务端验证前面三步积累的 Cookie 链条（a1 -> websectiga -> gid -> 签名）全部合法后，才在响应头下发 `web_session`。前面任何一环不合法，此步就返回空。

---

## 六、完整数据流

```
用户执行: python main.py
    |
    |-- 检查 cookies.json 中是否有 web_session
    |   |
    |   |-- 无 -> boot_guest_cookies() 执行 4 步引导
    |   |        Step 1: 本地生成 a1 + webId
    |   |        Step 2: POST /sec/v1/scripting -> 解密 websectiga
    |   |        Step 3: POST /sec/v1/shield/webprofile -> gid (DES + 签名)
    |   |        Step 4: POST /login/activate -> web_session (签名)
    |   |        -> 保存到 cookies.json
    |   |
    |   |-- 有 -> 直接使用
    |
    |-- 启动 sign.js daemon (常驻 Node.js 进程)
    |
    |-- For page in 1..N:
    |     |
    |     |-- 生成签名头:
    |     |     sign.js daemon -> x-s (mns0301 VMP)
    |     |     Python -> x-s-common (18项指纹 + RC4 + CRC32)
    |     |     Python -> x-t, x-b3, x-xray
    |     |
    |     |-- POST /api/sns/web/v1/homefeed
    |     |     Headers: x-s, x-s-common, x-t, x-b3, x-xray
    |     |     Cookies: a1, webId, websectiga, gid, web_session 等 11 项
    |     |     Body: {cursor_score, num, refresh_type, ...}
    |     |
    |     |-- 解析响应:
    |     |     items[] -> note_card -> display_title, author, likes
    |     |     cursor_score -> 下一页
    |     |
    |     +-- sleep(1.5s) 翻页间隔
```

---

## 七、核心经验总结

### 7.1 方法论

1. **先定位再补环境** — 没看到 `seccore_signv2` 之前不写 env.js，避免无效工作
2. **诊断驱动补环境** — 先让代码跑起来暴露缺失，再逐项补，不猜不预补
3. **从 eval 抠，不从 Network 下** — 430KB（eval 合并版）≠ 148KB（Network 拆分版），这是最容易踩的坑
4. **线上资源不改一个字节** — 格式化/美化 DS 源码 = 自毁，VMP 字节码对字符级精确
5. **对比法是最强 debug 工具** — 任何异常，先抓浏览器真实请求做逐字节对照

### 7.2 技术精华

| 技术 | 应用场景 | 要点 |
|------|---------|------|
| 自定义 Base64 | x-s、x-s-common 编码 | 改查表不改良算法，Python/Node 双端一致 |
| VMP setter 拦截 | mns0201 -> mns0301 升级 | `toString().length > 100000` 精准识别，预填充 env slot |
| 原型链补环境 | Node.js 运行浏览器代码 | `new Ctor()` 建链，不走 jsdom |
| Native toString 保护 | 反 toString 检测 | memoryMap + setNative |
| DES ECB 加密 | Cookie 引导 Step 3 | key="zbp30y86"，少见的 DES 用法 |
| JSVMP 解密 | Cookie 引导 Step 2 | "b"+"d" 字段交叉取字节 |
| RC4 + CRC32 | x-s-common b1 指纹加密 | key="xhswebmplfbt"，JS 风格有符号 CRC32 |
| daemon 常驻 | sign.js 性能优化 | stdin/stdout JSON 行协议，消除 1s 冷启动 |

### 7.3 禁止事项

| # | 禁止 | 原因 |
|---|------|------|
| 1 | 使用第三方逆向成品库 | 算法不可控，升级即失效 |
| 2 | 用 MCP/浏览器自动化生成签名 | 不是离线方案 |
| 3 | 补环境用 jsdom | 严格构造器抛 `Illegal constructor` |
| 4 | 从 Network 下载独立文件 | 拆分版 ≠ 浏览器执行版 |
| 5 | 格式化/美化 DS 源码 | 一个字节偏差 = VMP 字节码解析失败 |
| 6 | 隔离 window 对象 | `window = globalThis` 即可，不 Proxy 包裹 |
| 7 | daemon 每次重新启动 | VMP 初始化 ~1s，用常驻模式 |
| 8 | Cookie 引导漏签名 | HTTP 200 但 Cookie 降级 -> items=0 |

---

## 八、常见故障排查

| 现象 | 原因 | 检查位置 |
|------|------|---------|
| homefeed 返回 406 | x-s 前缀不是 `mns0301_` | sign.js: setter 拦截是否正确触发？ |
| homefeed 返回 code=0 items=0 | Cookie 引导漏签名 | main.py: Step 3/4 的 sign_headers 调用 |
| `undefined is not a constructor` | env slot 未预填充 | sign.js: setter 拦截覆盖了多少 slot？ |
| x-s-common 格式错误 | 字段数与浏览器不一致 | main.py: webBuild 版本号是否过期？ |
| `Maximum call stack size exceeded` | VMP 解释器递归过深 | `node --stack-size=65536 sign.js ...` |
| x-s 总长不对 | 编码链某一步出错 | 应该是 ~364 字符 |
| Cookie 引导第 3 步失败 | DES 加密 padded 错误 | bytes 长度是否 8 对齐？ |
| 翻页第 2 页起无数据 | cursor_score 未正确传递 | homefeed 响应的 `data.cursor_score` |

---

## 九、文件清单

```
小红书/v2.0/
|-- main.py              Python 主入口（~22KB）
|   |-- Cookie 引导（4 步）
|   |-- x-s-common 自研实现（18 项指纹 + RC4 + CRC32）
|   |-- x-t / x-b3 / x-xray 生成
|   |-- API 请求 + 翻页 + 结果输出
|
|-- sign.js              Node.js x-s 签名 daemon（~4.5KB）
|   |-- 加载 env.js + ds_script.js + ds_api.js + ds_v2.js
|   |-- _AUuXfEG27Xa3x setter 拦截
|   |-- stdin/stdout JSON 行协议
|   |-- seccore_signv2() 核心签名
|
|-- env.js               原型链补环境（~16KB）
|   |-- Function.prototype.toString 保护
|   |-- window/document/navigator/location/screen 等 15+ 浏览器对象
|   |-- Canvas/Storage/XHR/Performance 原型链
|   |-- Node.js crypto 桥接
|
|-- ds_script.js         VMP 解释器 + mns0201（~430KB，从 eval 抠出）
|   |-- 字符串表混淆 (_0x5ae8)
|   |-- 控制流平坦化 (while + switch)
|   |-- mns0201 VMP 解释器
|
|-- data/ds_api.js       签名辅助（~60KB，从 eval 抠出）
|-- data/ds_v2.js        VMP 升级 mns0201 -> mns0301（~62KB，从 eval 抠出）
|-- data/cookies.json    持久化的 Cookie（gitignore 排除）
|
|-- README.md            使用说明
|-- REVERSE_ENGINEERING.md  本文档
```

---

## 十、版本历史

| 日期 | 事件 |
|------|------|
| 2026-06-26 | v2.0 完成：mns0301 离线签名 + Cookie 引导 + 全链路自动化 |
