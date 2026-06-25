# 从零开始逆向新站点/新版本

## 阶段 1：抓包（30 分钟）

1. 浏览器 F12 → Network → 正常操作 → 观察所有 API 请求
2. 识别所有自定义请求头（x-s, x-t, x-s-common, x-b3, x-xray 等）
3. 保存 2-3 组不同端点的请求作为基准（请求体 + 请求头 + 响应体）
4. 留意 Cookie 中非标准的字段

## 阶段 2：Cookie 分析（1 小时）

1. 清空 Cookie → 刷新页面 → 观察哪些 Cookie 被 Set
2. 找出 Cookie 的设置来源：
   - 服务端 Set-Cookie（看 Response Headers）
   - JS 脚本写入（搜 `document.cookie`）
   - API 响应中 Set-Cookie（如 web_session）
3. 跟踪 Cookie 设置的请求顺序和时间线
4. 确认"最少必需 Cookie"集合 — 逐个去掉测试

## 阶段 3：x-s 定位与抠代码（3-6 小时）

1. 搜索 `"x-s"` (带引号) → 找到赋值语句
2. 溯源到加密函数入口（通常是 `window.mnsv2` 或类似命名）
3. 抠 VM 代码（参考 mns-extraction.md）
4. **确认 eval 数量**：搜 `eval` 关键字，确保没有遗漏
5. 补环境（env.js）
6. 验证：自己签名的 x-s 和浏览器的 x-s 对比
7. 解码两者，逐字段对比 x3 前缀（mns0201 vs mns0301）

## 阶段 4：其他签名头（2-4 小时）

按复杂度从低到高：

1. **x-t**：直接观察 = 毫秒时间戳
2. **x-b3-traceid**：观察规律 = random hex
3. **x-xray-traceid**：观察规律 = 时间戳编码
4. **x-s-common**：解码 → 分析 JSON 结构 → 逐字段实现

## 阶段 5：Cookie 引导自动化（3-6 小时）

1. 重现浏览器的 Cookie 设置请求链
2. **每个引导请求都要带完整签名**
3. 验证：自己的 cookie 发 API 请求，对比浏览器 cookie 的结果

## 阶段 6：集成测试

1. 全链路自动化：引导 → API 请求 → 翻页
2. 连续跑 10 次确认稳定性
3. Cookie 缓存：引导一次后可复用

## 每个阶段的验证方法

| 阶段 | 验证 | 通过标准 |
|------|------|---------|
| Cookie 分析 | 用自己的 cookie 发 API | items 数量和浏览器一样 |
| x-s | 和自己抠的代码对比 | x-s 前缀版本一致 |
| x-s-common | 解码后字段级对比 | JSON 结构和值一致 |
| Cookie 引导 | 引导后 homefeed | code=0 + items>0 |
| 集成 | 连续翻页 | 每页都有数据 |
