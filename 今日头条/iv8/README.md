# 今日头条 — iv8 新版 4-Module SDK 逆向

## 结论

| SDK 版本 | 方案 | 状态 |
|---------|------|:---:|
| 旧版 (02_code.js 605KB) | Node.js env_patch | ✅ (之前) |
| **新版 (4-Module CDN)** | **iv8** | **✅ 160 chars, API 通过** |
| 新版 (4-Module CDN) | Node.js env_patch | ❌ JSVMP typeof 差异 |

## 最终交付

```
今日头条/iv8/                         # 独立部署目录
├── toutiao_iv8.py                    # iv8 签名引擎 (主逻辑)
├── toutiao_api.py                    # Python API 入口
├── acrawler.js                       # JSVMP 解释器 (72KB)
├── sdk-glue.js                       # SDK 胶水层 (97KB)
├── bdms.js                           # JSVMP 签名引擎 (248KB)
├── runtime_bundler.js                # SDKRuntime 沙箱 (59KB)
├── config_24.js                      # 远程模块 (885B)
├── project_24.js                     # 远程模块 (346B)
├── strategy_24.js                    # 远程模块 (1005B)
├── IV8_REVERSE_TECH_DOC.md           # 完整逆向技术文档
└── README.md                         # 本文件 (使用说明)
```

**自包含**：所有 SDK 文件复制到本目录，不依赖外部路径。

## 运行

```bash
cd 今日头条/iv8
python toutiao_api.py              # 财经频道, 10 篇
python toutiao_api.py --count 15   # 15 篇
python toutiao_api.py --save feed.json
python toutiao_api.py --page <cursor>  # 翻页
```

## 关键技术路径

```
iv8 (C++ V8 引擎)
  ├─ acrawler.js  → JSVMP → byted_acrawler ✅
  ├─ sdk-glue.js  → Worker/Blob → _SdkGlueInit ✅
  ├─ bdms.js      → core-js → MessageChannel ✅
  ├─ runtime_bundler → SDKRuntime sandbox ✅
  ├─ remote ×3    → document.writeln 注入 ✅
  └─ fetch 拦截   → a_bogus 160 chars ✅

Node.js 对比:
  acrawler JSVMP: ❌ _$jsvmprt → undefined (typeof/原型链差异)
```

## iv8 必备 stub

1. `MessageChannel` — core-js Promise polyfill
2. `self = window` — bdms.js 全局引用
3. DOM stubs — `document.createElement` + `appendChild`
4. `module = { exports: {} }` — **必须在 acrawler.init() 之后设置**
5. `Worker + Blob + URL.createObjectURL` — sdk-glue webpack
6. `fetch` mock — HTTP 不被拦截即可
