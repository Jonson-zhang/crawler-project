# 小红书 Homefeed v2.0

纯离线 Node.js/Python 产出完整签名 + 自动引导 + 翻页。

## 架构

```
main.py                ← Python 入口：Cookie 引导 + API 请求 + 翻页
  │ subprocess
  ▼
sign.js                ← Node.js 入口：x-s 签名生成
  ├─ env.js            ← 原型链补环境
  ├─ ds_script.js      ← VMP 解释器 (mns0201, 430KB)
  ├─ data/ds_api.js    ← 签名辅助 (60KB)
  └─ data/ds_v2.js     ← VMP 升级 (mns0201→mns0301, 62KB)
```

## 依赖安装

```bash
cd 小红书/v2.0
npm install    # 安装 crypto-js
```

## 使用

```bash
python main.py
# → 自动 Cookie 引导 → 获取首页推荐流 → 3 页翻页 → 终端输出结果
```

## 签名管线

| 参数 | 生成方 | 方式 |
|------|--------|------|
| x-s | sign.js | Node.js 补环境 (mns0301 VMP) |
| x-s-common | main.py | Python 纯算 (14字段 RC4 + CRC32) |
| x-t | main.py | Python `int(time()*1000)` |
| x-b3-traceid | main.py | Python `random.hex(16)` |
| x-xray-traceid | main.py | Python `(ts<<23)|random` |

## 关键技巧

**`_AUuXfEG27Xa3x` setter 拦截** — 这解决了 VMP 字节码升级时 `undefined is not a constructor` 的问题：

```javascript
// sign.js
Object.defineProperty(global, "_AUuXfEG27Xa3x", {
  set: function (fn) {
    if (typeof fn === "function" && fn.toString().length > 100000) {
      _ra = function (bc, env) {
        for (var i = 0; i < 200; i++) {
          if (env[i] === undefined) { var s = function(){}; s.prototype={}; env[i]=s; }
        }
        return fn.call(window, bc, env);
      };
    }
  }
});
```

原理：当 ds_v2.js 定义 VMP 升级函数时，自动包装一层 —
在 VMP 字节码执行前预填充 `env` 数组中的所有空 slot。
这样 `new env[0]()`, `new env[1]()` 等调用永远不会因构造器缺失而报错。
