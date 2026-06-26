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

## Cookie 引导流程（web_session 获取）

`web_session` **不是本地生成的**，而是小红书服务端在最终接口通过 `Set-Cookie` 下发的。获取需要 4 步链式引导，层层递进：

```
Step 1: 本地生成 a1 + webId           → 伪造匿名设备身份
Step 2: /sec/v1/scripting             → 解密 JSVMP 获取 websectiga
Step 3: /sec/v1/shield/webprofile     → DES ECB + 签名头 → 获取 gid
Step 4: /login/activate               → 服务端验证链 → Set-Cookie 下发 web_session
```

### Step 1 — 伪造客户端身份

本地生成 `a1`（52 位：时间戳 hex + 30 位随机字符 + CRC32 校验）和 `webId`（a1 的 MD5），作为匿名设备标识写入 Cookie。

### Step 2 — 解密 websectiga

向 `/api/sec/v1/scripting` 请求 JSVMP 加密的 JS 代码，逆向解密提取 `websectiga`（小红书安全令牌）。需要还原 JSVMP 虚拟机的 "b" 字段 Base64 解码 + "d" 字段索引交叉取字节逻辑。

### Step 3 — 获取 gid

向 `/api/sec/v1/shield/webprofile` 发送请求（DES ECB 加密 + 全套自研签名头 `x-s`/`x-s-common`/`x-t`/`x-b3`/`x-xray`），服务端返回 `gid` 和 `acw_tc`。

### Step 4 — 激活会话（关键）

向 `/login/activate` 发 POST（同样需要全套签名头），服务端验证前面三步积累的 Cookie 链条（`a1` → `websectiga` → `gid` → 签名）**全部合法**后，在响应头中 `Set-Cookie: web_session=...` 下发。

**本质**：`web_session` 是小红书服务端对"你是一个合法浏览器"的最终背书。前面三步任何一个环节签名或指纹不对，Step 4 就拿不到它。

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
