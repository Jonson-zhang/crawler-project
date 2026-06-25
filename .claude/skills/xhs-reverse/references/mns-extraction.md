# x-s 逆向：VM 抠代码 + 补环境

## 定位

```
F12 Sources → 搜索 "X-s"
→ 定位赋值语句 → break on v(x, s)
→ 进入 v 函数 → 看到 window.mnsv2(c, d) 调用
```

## 抠 VM 代码

```
1. 在 window.mnsv2 处设断点 → step into → 进入 VM
2. 在 VM 文件开头设断点 → 刷新页面 → 断住
3. 回溯 Call Stack → 找到调用 VM 的上一个堆栈帧
4. 在堆栈帧的 eval 位置设断点
5. 刷新页面 → 断住 → 拷出 eval 参数（VM 源码）
6. grep 搜索 "eval" → 确认是否还有遗漏
7. 重复直到断点总数 = 4
```

## 4 个 eval 的分布

| eval | 产物 | 文件 | 作用 |
|------|------|------|------|
| 1 | ds_script.js | 430KB | 混淆 loader + mns0201 版本 mnsv2 |
| 2 | ds_api.js | 60KB | 时间戳同步等辅助函数 |
| 3-4 | ds_v2.js | 62KB | mns0201 → mns0301 升级模块 |

## 为什么是 4 个

```
仅 eval1 (ds_script):
  window.mnsv2(input) → "mns0201_..."

eval1 + eval3+4 (ds_v2.js):
  window.mnsv2(input) → "mns0301_..."
```

**mns0201 版本不能用于数据接口（homefeed/search 等）。**

1.md 原文：
> "生成的结果有个前缀 mns0301，但并不是所有接口都是0301，也有0201,0101，而上面的代码生成的结果貌似都是0201，而主要的数据接口基本都是0301的，这就是问题所在。"

## 覆盖升级机制

ds_script.js 先注册 mns0201 版本的 `window.mnsv2`。ds_v2.js 加载时内部会调用原始的 `window.mnsv2()` 拿中间结果，然后通过 `_AUuXfEG27Xa3x` setter 替换为 mns0301：

```javascript
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

## x-s 内部结构

```
XYS_ + 自定义Base64({
  x0: "4.3.5",       // 语言版本号
  x1: "xhs-pc-web",  // App ID
  x2: "Windows",      // 操作系统
  x3: "mns0301_加密数据",  // window.mnsv2() 的输出
  x4: "object" / ""   // POST 有 body 时 = "object", GET 为空
})
```

## env.js 补环境要点

VM 代码依赖浏览器环境，需要在 Node.js 中模拟：

1. `Function.prototype.toString` 保护
2. `window` / `global` / `self` 循环引用
3. `document` 基础 DOM（createElement、querySelector 等）
4. `navigator` 特征（platform、language、plugins、webdriver）
5. `screen` 分辨率
6. `localStorage` / `sessionStorage`
7. `location` URL 解析
8. Canvas / WebGL 检测桩
9. 定时器、事件系统桩
