# x-s 逆向：VM 抠代码 + 补环境

## 当前线上架构（2026）

x-s 签名链在 `vendor-dynamic.js`（webpack bundle，~1.3MB）中：

```javascript
function seccore_signv2(e, a) {
    var s = window.toString, u = e;
    if ("[object Object]" === s.call(a) || "[object Array]" === s.call(a))
        u += JSON.stringify(a);
    else if (typeof a === "string")
        u += a;

    var m = Pu([u].join("")),    // MD5(url+body)
        w = Pu(e),               // MD5(url)
        C = window.mnsv2(u, m, w);  // ← VMP 签名核心

    var P = {
        x0: "4.3.5",        // 语言/库版本
        x1: "xhs-pc-web",   // App ID
        x2: "Windows",       // 操作系统
        x3: C,               // VMP 输出 (mns0301_xxx)
        x4: a ? "object" : "" // POST/GET 区分
    };

    return "XYS_" + xE(lz(JSON.stringify(P)));
    //              ↑ UTF8   ↑ 自定义 Base64
}
```

## mnsv2 创建链

```
ds_loader.js (151KB, 混淆代码)
  → 创建 VMP 解释器基础（字节码执行引擎）

ds_api.js (60KB, 混淆代码)
  → 定义本地变量 __$c (VMP 字节码字符串)
  → 调用 glb['_BHjFmfUMEtxhI'](__$c, [,, undefined, Uint8Array, getdss])
  → 内部执行字节码，创建 __bc (2466 chars)
  → 创建 mns0201 版本的 window.mnsv2

ds_v2.js (62KB, 混淆代码)
  → 定义本地变量 __$c (另一份 VMP 字节码)
  → 调用 glb['_AUuXfEG27Xa3x'](__$c, [,, Function, document, performance, MutationObserver, Object])
  → 内部通过 Object.defineProperty setter 升级 mns0201 → mns0301
```

## 从浏览器提取脚本

### 用 js-reverse MCP

1. `new_page("https://www.xiaohongshu.com/explore")`
2. `list_scripts` → 过滤 `fe-static.xhscdn.com/as/` 找到 DS 脚本 URL
3. `save_script_source` 保存到本地

### 用 camoufox-reverse MCP

1. `navigate("https://www.xiaohongshu.com/explore")`
2. `scripts(action="list")` → 找到 DS 脚本
3. `scripts(action="save", url=..., save_path=...)` 保存

### 需要保存的脚本

| 脚本 URL 特征 | 保存为 | 大小 |
|-------------|--------|------|
| `as/v2/ds/` 开头的 JS | `ds_v2.js` | ~62KB |
| `as/v1/3e44/public/a9ef72` (sdt_source_init) | `sdt_source_init.js` | ~246KB |
| `as/v1/3e44/public/04b294` | `ds_loader.js` | ~151KB |
| `as/v1/f218/a15/public/` | `v1_f218.js` | ~149KB |
| `as/v2/fp/` | `fp.js` | ~396KB |
| `as/v1/3e44/public/bf7d4e` | `bf7d4e.js` | ~45B |
| `as.xiaohongshu.com/api/sec/v1/ds` | `ds_api.js` | ~60KB |

## 补环境加载与测试

1. 编写 `env.js`，使用原型链补环境（见 [env-patching.md](env-patching.md)）
2. 按顺序加载：`ds_loader.js` → `ds_api.js` → `ds_v2.js`
3. 无需加载 `sdt_source_init.js`（它是另一个 VMP 解释器变体，会导致栈溢出）
4. 验证：`window.mnsv2("test", "test", "object")` 输出前缀为 `mns0301_`

## 验证方法

- 输入 `("url", "md5(url+body)", "object")` → 输出 `mns0301_xxx`（200 字符）
- x-s 总长度 ~364 字符（XYS_ 前缀 + 自定义 Base64）
- 解码 x-s 后 JSON 结构：`{x0, x1, x2, x3, x4}`
- x3 前缀必须为 `mns0301_`，不是 `mns0201_`
