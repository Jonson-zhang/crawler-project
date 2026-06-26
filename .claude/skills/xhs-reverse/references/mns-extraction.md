# x-s 逆向：抠 DS 脚本 + 补环境

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
        x0: "4.3.5",        // SDK 版本
        x1: "xhs-pc-web",   // App ID
        x2: "Windows",       // 操作系统
        x3: C,               // VMP 输出 (mns0301_xxx)
        x4: a ? "object" : "" // 数据类型
    };

    return "XYS_" + xE(lz(JSON.stringify(P)));
    //              ↑ UTF8   ↑ 自定义 Base64
}
```

## 为什么不从 Network 下载脚本

线上的 `ds_loader.js` (148KB) + `ds_api.js` (60KB) + `ds_v2.js` (62KB) 是**拆分文件**。
浏览器实际运行时会通过 **4 个 `eval` 调用**加载合并、去混淆后的版本，文件大小不同：

| 从 Network 下载 | 从浏览器 eval 抠出 |
|----------------|-------------------|
| ds_loader.js (148KB) | ds_script.js (430KB) — 合并版 |
| ds_api.js (60KB) | ds_api.js (60KB) |
| ds_v2.js (62KB) | ds_v2.js (62KB) |

**必须从 eval 抠**，否则 VMP 基础模块不完整。

## 在浏览器中抠 DS 脚本（eval 定位法）

```
1. 打开 https://www.xiaohongshu.com/explore
2. F12 → Sources → 搜索 "X-s"
3. 定位到 seccore_signv2 → 设断点
4. step into → 进入 mnsv2 → 断在 VMP 函数开头
5. 回溯 Call Stack → 找到 eval 调用帧
6. 复制每个 eval 的参数（即 DS 源码）保存为：
   - eval 1 → ds_script.js (~430KB)
   - eval 2 → ds_api.js (~60KB)
   - eval 3+4 → ds_v2.js (~62KB)
7. 确认：grep 搜索 "eval(" → 确保没有遗漏（总计 4 个）
```

## 补环境加载与测试

1. 编写 `env.js`，使用原型链补环境（见 [env-patching.md](env-patching.md)）
2. 编写 `sign.js`，包含 `_AUuXfEG27Xa3x` setter 拦截（见 [env-patching.md](env-patching.md) 关键技巧章节）
3. 按顺序加载：`ds_script.js` → `ds_api.js` → `ds_v2.js`
4. 无需加载 `sdt_source_init.js`（它是另一个 VMP 解释器变体，会导致栈溢出）
5. 验证：`window.mnsv2("test", "test", "test")` 输出前缀为 `mns0301_`

## 验证方法

- 输入 `("url", "md5(url+body)", "md5(url)")` → 输出 `mns0301_xxx`（200 字符）
- x-s 总长度 ~364 字符（XYS_ 前缀 + 自定义 Base64）
- 解码 x-s 后 JSON 结构：`{x0, x1, x2, x3, x4}`
- x3 前缀必须为 `mns0301_`，不是 `mns0201_`
- 与浏览器请求对比 x3 前缀一致
