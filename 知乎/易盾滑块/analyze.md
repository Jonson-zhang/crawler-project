# 知乎登录 — 网易易盾验证码分析

## 识别结果

**不是普通滑块，是网易易盾 (NetEase Dun/NECaptcha) 智能验证码。**

### 证据

```
GET /api/v3/oauth/captcha/v2?type=captcha_sign_in
  → {
      "script": [
        "https://cstaticdun.126.net/load.min.js",        ← 网易易盾 SDK
        "https://captcha.zhihu.com/api/v1/captcha/js?... ← 知乎配置桥接
      ]
    }
```

- `cstaticdun.126.net` = NetEase 的 cdnetworks CDN
- `initNECaptcha(...)` = NetEase Captcha 初始化
- `captchaId: f9341635f02d4eb3acd723624d9c00c6` = 易盾分配的识别码

### 易盾 vs 瑞数的本质区别

| 维度 | 瑞数 (RS6) | 网易易盾 |
|------|-----------|---------|
| 反爬类型 | **签名型**（JSVMP 生成 Cookie） | **验证码型**（视觉 + 行为 + 设备指纹） |
| 核心挑战 | 算法还原 | **图像识别 + 轨迹模拟 + 设备指纹** |
| Cookie 生成 | ✅ 纯 JS 可还原（sdenv/补环境） | ❌ 依赖服务端 AI 风控判定 |
| 纯协议方案 | ✅ sdenv/execjs 可行 | ❌ **不可行** |
| 必需能力 | 浏览器环境模拟 | **计算机视觉 + 轨迹生成 + 浏览器渲染** |
| 绕过方式 | 补环境执行 JSVMP | **浏览器自动化 或 第三方打码平台** |

## 易盾验证码流程

```
1. 前端请求: GET /api/v3/oauth/captcha/v2
     ↓
2. 后端返回: captchaId + sessionId + 易盾 SDK URL
     ↓
3. 浏览器加载: cstaticdun.126.net/load.min.js
     ↓
4. SDK 初始化: initNECaptcha({captchaId, onVerify, ...})
     ↓
5. 弹出验证码: 滑块 / 点选 / 语序 / 无感 (由易盾后端风控决定类型)
     ↓
6. 用户完成: 前端收集轨迹数据 + 设备指纹 + challenge
     ↓
7. SDK 回调: onVerify(token) → 前端将 token 提交给知乎后端
     ↓
8. 知乎后端: 用 token 向易盾服务端二次验证
     ↓
9. 通过 → 返回登录成功的 Cookie
```

## 可行的方案

### 方案 A：浏览器自动化（推荐，可直接运行）

用 cloakbrowser 打开知乎登录页 → 用户手动完成验证码 → 程序自动捕获登录后的 Cookie → 持久化复用。

```
优点：零成本、可靠、一次登录长期复用
缺点：首次需人工介入
```

### 方案 B：第三方打码平台

2captcha / 超级鹰 等平台有专门的易盾接口，自动识别滑块缺口 + 生成轨迹。

```
优点：全自动
缺点：收费、有调用频率限制
```

### 方案 C：Cookie 持久化

如果之前已登录过知乎浏览器，导出 Cookie → Python requests 直接复用。

```
优点：零成本、零人工
缺点：Cookie 过期后需重新获取
```
