# 小红书 Web API 逆向 Skill

## 硬约束

| # | 规则 | 违反后果 |
|---|------|---------|
| 1 | 禁止第三方逆向成品库 | 算法不可控，升级即失效 |
| 2 | 禁止 MCP/浏览器桥接/自动化工具生成签名 | 不是离线方案 |
| 3 | 补环境用原型链，不用 jsdom | jsdom 严格构造器 throw `Illegal constructor` |
| 4 | 每个 API 请求必须带 **x-s + x-s-common + x-t + x-b3 + x-xray** | 缺一项 → 406 或静默降级 |
| 5 | 线上资源禁止截断/格式化 | 一个字节偏差即可致 VMP 字节码解析失败 |
| 6 | 从浏览器 **eval** 抠 DS 脚本 | Network 版是拆分文件，不是浏览器真正执行版本 |

## 签名参数速查

| 参数 | 生成方 | 公式 |
|------|--------|------|
| **x-s** | Node.js (sign.js) | `XYS_` + B64(UTF8(JSON({x0-x4}))) 其中 x3=window.mnsv2() |
| **x-s-common** | Python | JSON(14字段) → URLEncode → 自定义Base64 |
| **x-t** | Python | `int(time.time()*1000)` |
| **x-b3-traceid** | Python | `random.hex(16)` |
| **x-xray-traceid** | Python | `(ts<<23) \| random` → hex |

## 架构

```
main.py （Python：Cookie引导 + 签名 + API请求 + 翻页）
  │ subprocess daemon
  ▼
sign.js （Node.js：x-s 签名）
  ├─ env.js          ← 原型链补环境
  ├─ ds_script.js    ← VMP基础+mns0201（eval抠出, ~430KB）
  ├─ data/ds_api.js  ← 签名辅助（eval抠出, ~60KB）
  └─ data/ds_v2.js   ← VMP升级mns0301（eval抠出, ~62KB）
```

**env.js / sign.js 分离**：补环境与签名逻辑分开，出问题只改对应文件。

---

# 逆向工作流

## 入口判断

| 你现在的状态 | 从哪个阶段开始 |
|------------|-------------|
| 完全从零开始，第一次接触 | → Phase 1 |
| 已抓到真实 homefeed 请求，已定位 seccore_signv2 | → Phase 2 |
| 已抠出 DS 脚本，Node.js 加载报错或产出不对 | → Phase 3 |
| x-s 已通过，需要实现其他签名头 | → Phase 4 |
| 有 Cookie 但不知道引导流程 | → Phase 5 |
| 全部实现了但 homefeed items=0 或 406 | → Phase 6 + 常见卡点 |

---

## Phase 1：捉包定位

**目标**：拿到真实 homefeed 请求样本 + 定位签名函数。

### 操作

1. `camoufox-reverse` 打开 `https://www.xiaohongshu.com/explore`
2. Network 过滤 `homefeed`，滚动触发 POST
3. 完整捕获请求头（6 项签名）、请求体（JSON）、响应体（前几页数据）
4. Sources 搜索 `seccore_signv2` → 定位到 `window.mnsv2(u, m, w)` 调用
5. Call Stack 回溯 → 找出**全部 4 个 eval** 及加载顺序

### 产出

- 1 个完整的 homefeed 请求标本
- `seccore_signv2` 函数体
- 4 个 eval 的位置和参数（DS 源码）

### ✅ 退出条件

已知 x-s = `seccore_signv2()` → `window.mnsv2(u,m,w)` → VMP 解释器。

### ❌ 禁止

- 在定位到函数前开始补环境
- 从 Network 面板下载 `ds_loader.js`（那是拆分版）
- 在没拿到真实请求前"猜"参数格式

---

## Phase 2：抠脚本

**目标**：把 DS 模块从浏览器 eval 中完整地抠到本地文件。

### 操作

| 来源 | 保存为 | 大小 | 说明 |
|------|--------|------|------|
| eval 1 | `ds_script.js` | ~430KB | VMP 基础 + mns0201（合并版） |
| eval 2 | `data/ds_api.js` | ~60KB | 签名辅助 |
| eval 3+4 | `data/ds_v2.js` | ~62KB | VMP 升级 |

1. 在 4 个 eval 处分别设断点
2. 复制 eval 的参数（即 DS 源码），**不要格式化、不要截断、不要改任何字符**
3. 保存到本地，验证文件大小与浏览器中一致

### 从 vendor-dynamic.js 提取编码链

`encodeUtf8`、`b64Encode` 来自 vendor-dynamic.js 的 webpack module。
或者直接用 `CryptoJS.MD5()` + 手写 B64 编码等价实现。

### ✅ 退出条件

DS 脚本就位，编码链代码就位（或等价实现）。

### ❌ 禁止

- 从 Network 下载独立文件（`ds_loader.js` 148KB ≠ 浏览器执行版 430KB）
- 格式化/美化 DS 源码
- 用 `prettier` 或任何工具处理 DS 脚本

---

## Phase 3：补环境 + x-s 签名

**目标**：离线 Node.js 产出 `mns0301_` 前缀的签名。

### 3.1 补环境：诊断驱动（不要一上来补 900 行）

```
① 先让代码跑起来 → 暴露缺失
② 根据报错逐项补 → 不猜、不预补
③ 直接赋值跑通后 → 替换为原型链
④ 关键方法 → setNative (memoryMap + toString保护)
⑤ getter/setter → Object.defineProperty
```

**第一步最小环境**（来自实战验证）：

```javascript
window = globalThis;  // 关键：直接用 Node.js 全局
global.window = window;
global.self = window;

// 空构造器 + new Ctor() 建立原型链
function HTMLElement() {}
function HTMLHtmlElement() {}
HTMLHtmlElement.prototype = new HTMLElement();  // 通过 new 建立完整原型链
```

**Native toString 保护**：

```javascript
const memoryMap = new Map();
const rawToString = Function.prototype.toString;
Function.prototype.toString = function () {
  return typeof this === "function" && memoryMap.get(this) || rawToString.call(this);
};
function setNative(func, name) {
  Object.defineProperty(func, "name", { value: name, writable: false });
  memoryMap.set(func, `function ${name}() { [native code] }`);
}
```

### 3.2 加载顺序

```
env.js → ds_script.js → ds_api.js → ds_v2.js
```

### 3.3 🔑 VMP 升级的核心技巧

ds_v2.js 的 VMP 升级时，解释器 `new env[i]()` 构造对象。
env 数组有空 slot → `undefined is not a constructor`。

**解决**：加载 ds_v2.js **之前**，**动态发现** VMP 解释器（不硬编码变量名，混淆器每次生成不同标识符），批量设置 setter 拦截：

```javascript
// 扫描 global 上 toString().length > 100K 的函数 → VMP 解释器指纹
(function () {
  var _vmpFound = 0;
  Object.getOwnPropertyNames(global).forEach(function (name) {
    try {
      var val = global[name];
      if (typeof val !== "function" || val.toString().length <= 100000) return;
      _vmpFound++;
      var _ra, _oa = val;
      Object.defineProperty(global, name, {
        get: function () { return _ra || _oa; },
        set: function (fn) {
          if (typeof fn === "function" && fn.toString().length > 100000) {
            _ra = function (bc, env) {
              for (var i = 0; i < 200; i++)
                if (env[i] === undefined) { var s = function(){}; s.prototype={}; env[i]=s; }
              return fn.call(window, bc, env);
            };
          } else { _oa = fn; }
        },
        configurable: true, enumerable: true,
      });
    } catch (e) {}
  });
  if (_vmpFound === 0) console.error("未发现 VMP 解释器，setter 拦截未生效");
})();
eval(fs.readFileSync("data/ds_v2.js", "utf8"));
// window.mnsv2 现在产出 mns0301_
```

- **动态发现代替硬编码**：不依赖 `_AUuXfEG27Xa3x` 这一特定变量名，跨版本自适应
- `toString().length > 100000` 精准识别 VMP 混淆函数（字节码内嵌 → 函数体巨大）
- `env[i] = function(){}`（可构造，不是普通对象）
- 200 个 slot 保守覆盖，不够再加

### 3.4 编码链

```
url + JSON.stringify(body) → payload
  ├─ CryptoJS.MD5(payload) → m
  ├─ CryptoJS.MD5(url)     → w
  └─ window.mnsv2(payload, m, w) → "mns0301_xxx" (200 chars)

→ JSON({x0:"4.3.5",x1:"xhs-pc-web",x2:"Windows",x3:hash,x4:type})
→ encodeURIComponent → byte[] → 自定义Base64 → "XYS_"+
```

**自定义 Base64 表**：`ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`

### ✅ 退出条件

- `node sign.js '{...}'` → `mns0301_` 前缀
- x-s 总长 ~364 字符
- 与浏览器请求对比一致

### ❌ 禁止

- 用 jsdom
- 在无 setter 拦截时直接加载 ds_v2.js
- 创建隔离 window 对象（`window = globalThis` 即可）
- 一上来补 900 行

---

## Phase 4：辅助签名（Python 纯算）

**目标**：Python 独立生成 x-s-common、x-t、x-b3、x-xray。

| 参数 | 实现 | 复杂度 |
|------|------|--------|
| x-t | `int(time.time() * 1000)` | 低 |
| x-b3 | `random.hex(16)` | 低 |
| x-xray | `hex((ts<<23) \| random)` | 低 |
| x-s-common | JSON(14字段) → RC4(key="xhswebmplfbt") → URLEncode → 自定义Base64 | 中 |

详细：→ [references/xsc-common.md](references/xsc-common.md)

---

## Phase 5：Cookie 引导

**目标**：Python 自动获取 11 项访客 Cookie。

```
a1/webId 生成 → scripting (websectiga) → shield/webprofile (gid) → activate (web_session)
```

**关键**：`shield/webprofile` 和 `activate` 必须带完整签名头。
否则 HTTP 200 但 Cookie 降级 → homefeed 返回 code=0 items=0。

详细：→ [references/cookie-bootstrap.md](references/cookie-bootstrap.md)

---

## Phase 6：集成验证

**目标**：全链路自动化，连续翻页有数据。

```python
# main.py 流程
1. Cookie 引导（自动，11项Cookie）
2. sign.js daemon 启动（常驻，消除冷启动 ~1s）
3. homefeed 请求（Python生成辅助签名 + daemon生成x-s）
4. 翻页（cursor_score 来自上一页响应）
```

### 验证清单

- [ ] `node sign.js` → `mns0301_`
- [ ] Python `make_xsc(a1)` → 字段数与浏览器一致
- [ ] Cookie 引导 4 步全成功
- [ ] homefeed → HTTP 200 + code=0 + items>0
- [ ] 翻页 3 页 → 每页都有数据

### ❌ 禁止

- 只验证 x-s 不验证完整头组合
- 一个端点通过就假设所有端点通过
- daemon 每次重新启动（用常驻模式）

---

## 常见卡点速查

| 现象 | 首先检查 | 详见 |
|------|---------|------|
| homefeed → 406 | x-s 解码后 x3 前缀是不是 `mns0301_`？ | Phase 3.3 |
| homefeed → code=0 items=0 | Cookie 引导每步都带了完整签名吗？ | Phase 5 + [坑 1](references/common-pitfalls.md) |
| 输出 mns0201 不是 mns0301 | setter 拦截是否正确触发？ | Phase 3.3 |
| `undefined is not a constructor` | env 预填充循环覆盖了多少 slot？ | Phase 3.3 |
| `Maximum call stack size exceeded` | `node --stack-size=65536` | Phase 3 |
| x-s-common 格式不对 | 字段数对不对？webBuild 版本号？ | Phase 4 + [xsc-common](references/xsc-common.md) |
| Cookie 引导第 3 步失败 | shield/webprofile 带完整签名没有？ | Phase 5 + [cookie-bootstrap](references/cookie-bootstrap.md) |
| 签名看起来对但请求失败 | 用浏览器抓一份真实请求做逐字节对比 | Phase 1 |

---

## 参考文档索引

| 文档 | 何时读 |
|------|--------|
| [env-patching.md](references/env-patching.md) | Phase 3 补环境：完整的原型链清单、setter 拦截详解、常见 env 报错 |
| [mns-extraction.md](references/mns-extraction.md) | Phase 2 抠脚本：eval 定位法、为什么不用 Network 版 |
| [xsc-common.md](references/xsc-common.md) | Phase 4 x-s-common：14字段结构、b1/RC4/CRC32 实现 |
| [cookie-bootstrap.md](references/cookie-bootstrap.md) | Phase 5 Cookie 引导：4步请求链、DES ECB、websectiga 解密 |
| [common-pitfalls.md](references/common-pitfalls.md) | 任何异常时：code=0 items=0、引导漏签名、硬编码版本号过时 |
| [new-site-workflow.md](references/new-site-workflow.md) | 从零开始新站点/新版本，按阶段分解的全流程 |

---

## 经验法则

1. **先定位再补环境** — 没看到 seccore_signv2 之前不写 env.js
2. **先粗后精** — 先跑通暴露缺失，再替换为原型链
3. **setter 拦截是 VMP 升级的充要条件** — 没它 = stuck 在 mns0201
4. **Cookie 引导每步都要完整签名** — 漏一步 = items=0
5. **对比法是最强 debug 工具** — 任何异常，先抓浏览器真实请求对照
6. **`window = globalThis`** — 不隔离、不 Proxy 包装
7. **从 eval 抠，不从 Network 下** — 430KB ≠ 148KB
8. **线上资源不改一个字节** — 格式化 = 自毁
9. **daemon 常驻** — 每次冷启动 VMP 初始化 ~1s
10. **webBuild 会变** — 每次从浏览器 Cookie 取当前值
11. **禁止第三方逆向库** — 所有签名自研
12. **每个端点独立验证** — 不能因 A 过了就假设 B 也过
