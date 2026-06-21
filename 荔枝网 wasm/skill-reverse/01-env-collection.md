# 荔枝网 逆向 — 题型判断与诊断记录

## 题型判断 (web-reverse-algorithm → 01-decision-tree)

| 问题 | 答案 |
|------|------|
| 真正决定成败的请求 | GET gdtv-api.gdtv.cn/api/channel/v1/news |
| 目标字段 | Header: X-ITOUCHTV-Ca-Signature, X-ITOUCHTV-Ca-Timestamp, X-ITOUCHTV-Ca-Key |
| 题型 | **Wasm/协议题 + Header 签名联动** |
| 当前阻塞点 | 入口已找到，需补环境跑通 WASM |

## Writer / Builder / Entry / Source 分层

```
writer:  chunk-libs.js → S() → 组装最终 headers (X-ITOUCHTV-*)
          ↑
builder: chunk-libs.js → m() → 调用 WASM export "a"
          ↑
entry:   WASM func[32] <a>  (Type[13]: 11×i32 → i32)
          ↑
source:  vendor_w.js + lizhi.wasm (wbg-bindgen 生成)
```

## 环境诊断 (web-reverse-env P0+P1)

### P0（先让代码进入 builder）
- [x] window / self / globalThis: self→window 链
- [x] document: { location }
- [x] navigator: 基本属性
- [x] location: href, origin, host, protocol 等

### P1（对齐 builder 输入）
- [x] Date: new Date(), getTime(), getTimezoneOffset()
- [x] Map: new Map(), .set()
- [x] TextEncoder/TextDecoder: utf-8 编解码
- [x] crypto: 不需要（此 WASM 不导入 crypto 相关函数）

### 不需要的环境
- canvas/webgl/audio — 此 WASM 不检测
- localStorage/sessionStorage — 不涉及
- plugins/mimeTypes — 不涉及
- Worker — 不涉及

## 关键发现

1. **WASM 反检测**：vendor_w.js 中的混淆代码通过 `__wbg_newwithargs` + `__wbg_call_cb65541` 动态执行了
   环境检测逻辑，需要 `location instanceof Location` 和正确的全局变量关系。

2. **delete global/process** 是必要的：WASM 初始化时会检测 Node.js 环境。

3. **wbg eval 是真实 eval**：不能返回 0，必须返回 eval 结果。
