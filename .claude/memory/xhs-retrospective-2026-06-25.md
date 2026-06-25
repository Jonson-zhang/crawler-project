---
name: xhs-retrospective
description: 小红书 XYS_ 签名逆向复盘 — 失误、经验、当前状态、下一步（2026-06-25）
metadata:
  type: project
---

# 小红书 XYS_ 签名逆向复盘

## 一、目标

纯离线 Node.js/Python 产出 XYS_ 签名，不需要浏览器自动化。

## 二、已确认的签名链

```
MD5(url+body) + MD5(url) → window.mnsv2(u, m, w) → {x0..x4} payload
→ JSON.stringify → encodeUtf8 → custom base64 → "XYS_" + result
```

- 自定义 Base64: `ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5`
- Payload: `{x0:"4.3.5", x1:"xhs-pc-web", x2:"Windows", x3:hash, x4:"object"/"string"}`
- 编码链来源: vendor.js webpack module 40055 (Pu=MD5, lz=UTF-8, xE=Base64), 浏览器 DevTools 提取

## 三、版本状态

### v0.1 — 可用但不规范

| 文件 | 来源 | 作用 |
|------|------|------|
| env.js | 1.md | 补环境 |
| ds_script.js | 1.md 旧版 VMP(233K bytecode) | 创建 mns0201 地基 |
| data/ds_api.js + ds_v2.js | 在线 | 覆盖升级 mns0201→mns0301 |
| sign.js | 自研 | 编码链+签名入口 |
| main.py | 自研 | API翻页(PAGES=N) |

结果: mns0301 ✅, HTTP 200 ✅, API翻页3页57条 ✅  
缺陷: 依赖别人逆向的旧代码, 覆盖升级不规范

### v0.2 — 纯在线方案, 待攻克

env.js + 4个在线DS脚本(bf7d4e+ds_api+ds_v2+fp)  
结果: env+ds_api ok, ds_v2 执行时 `Cannot read properties of undefined (reading ΙΙΙ)`  
递归Proxy/plain object/ctor填充env均无法绕过  
**关键发现: 在线DS脚本只创建4个VMP辅助函数, 不创建 window.mnsv2**

## 四、关键失误

1. **依赖旧代码不自知** — ds_script.js(421K)是1.md旧版, 不是线上当前版本
2. **save_script_source 截断** — 在线__$c字节码被截断, 格式化版膨胀6.6倍 → [[online-resources-keep-raw]]
3. **黑盒试错效率低** — Proxy/ctor/env各种补, 根因是字节码版本不同, 不是缺属性
4. **低估版本差异** — 1.md 233K vs 在线 7.5K bytecode, 差距30倍
5. **MD5实现反复** — 纯JS MD5多次出错, 最终用 Node.js crypto/Python hashlib

## 五、经验

1. 补环境框架可复用 — env_core.js 130行模板已存入 skills
2. 编码链可复用 — Base64/UTF-8/MD5 来自 vendor.js, 任何 XHS 接口共用
3. SSR HTML 解析 — 无需 cookie/签名, 适合快速验证
4. **浏览器断点溯源是唯一正解** — VMP字节码解释器不能黑盒补
5. **线上资源禁止截断/格式化** — 一个字节都不能改

## 六、下一步

1. **浏览器断点定位 mnsv2 创建路径**
   - set trap (defineProperty setter with debugger)
   - 页面加载后触发 homefeed 请求 → signAdaptor → mnsv2
   - 断住后拿到完整调用栈
2. 根据调用栈确定离线需要的最小环境
3. v0.2 目标: env.js + 4个在线DS原始脚本 + 触发逻辑 → mns0301 ✅, 零旧代码依赖

## 七、当前可用资产
- SSR 模式: python main.py 直取首页数据
- 编码链: encodeUtf8 / b64Encode / MD5
- 补环境核心: env_core.js (130行)
