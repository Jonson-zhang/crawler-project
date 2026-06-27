# env-patch — 通用浏览器环境补丁（Object.create 原型链方案）

手工构建"看起来和真浏览器一样"的 Node.js 全局环境，不依赖 JSDOM。

## 核心原理

```
Object.create(ParentProto)  →  正确原型链
Symbol.toStringTag          →  Object.prototype.toString.call() 返回正确值
sn() / mf() / mc()          →  Function.prototype.toString() 返回 [native code]
Object.defineProperty       →  getter 属性（navigator、screen 等）
_setGlobal()                →  绕过 Node.js 21+ getter 保护
```

## 快速开始

```js
const { setupEnv } = require('../.claude/env-patch/env_patch.js');

setupEnv({
  url: 'https://target-site.com/',
  userAgent: 'Mozilla/5.0 ... Chrome/148 ...',
});

// 现在 global.window / document / navigator 等全部就绪
// 直接 eval 你的目标 JS 即可
```

## 配置项

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `url` | string | `'https://www.example.com/'` | 页面 URL |
| `userAgent` | string | Chrome 148 UA | UA 字符串 |
| `platform` | string | `'Win32'` | navigator.platform |
| `screenWidth/Height` | number | 1920/1080 | 屏幕尺寸 |
| `canvas` | boolean | true | Canvas 2D stub |
| `webgl` | boolean | false | WebGL stub |
| `plugins` | boolean | true | plugins/mimeTypes |
| `storage` | boolean | true | localStorage/sessionStorage |
| `extraConstructors` | boolean | true | 200+ 浏览器构造函数 |
| `crypto` | boolean | true | Node.js crypto → Web Crypto |
| `windowToGlobal` | boolean | true | window === global |

## 关键功能

- **Anchor URL 解析**：`document.createElement('a')` 支持 `href` setter 触发 URL 解析
- **HTMLCollection 索引**：`getElementsByTagName('head')[0]` 返回正确元素
- **Node.js getter 覆盖**：自动处理 `navigator`/`crypto`/`performance` 的只读 getter

## 文件

```
.claude/env-patch/
├── env_patch.js   # 主模块
└── README.md      # 本文件
```
