# 从零开始逆向新站点/新版本

## MCP 选用

- **代码定位/断点调试** → `js-reverse` MCP（Chrome DevTools 协议）
- **脚本抓取/绕过 TLS 指纹** → `camoufox-reverse` MCP（Camoufox 浏览器）

## 阶段 1：抓包（30 分钟）

1. 用 `camoufox-reverse` 打开小红书 → Network → 触发首页瀑布流
2. 识别所有自定义请求头（x-s, x-t, x-s-common, x-b3, x-xray）
3. 保存 2-3 组不同端点的请求作为基准（请求头 + 请求体 + 响应体）
4. 从响应或 Cookie 中确认当前 webBuild 版本号

## 阶段 2：Cookie 分析（1 小时）

1. 清空 Cookie → 刷新页面 → 观察哪些 Cookie 被 Set
2. 找出 Cookie 的设置来源：
   - 服务端 Set-Cookie（Response Headers）
   - API 响应中 Set-Cookie（如 gid → shield/webprofile）
3. 确认"最少必需 Cookie"集合 — **homefeed 不需要 web_session**
4. 参考 [cookie-bootstrap.md](cookie-bootstrap.md)

## 阶段 3：x-s 定位与抠代码（3-6 小时）

1. 用 `js-reverse` 打开页面 → `search_in_sources("x-s")` → 找到赋值语句
2. 定位 `seccore_signv2` 函数 → 溯源到 `window.mnsv2` 调用
3. 用 `list_scripts` 找到 DS 脚本 URL
4. 用 `save_script_source` 保存所有 DS 脚本
5. 补环境（原型链方式，见 [env-patching.md](env-patching.md)）
6. 按序加载：`ds_loader.js` → `ds_api.js` → `ds_v2.js`
7. 验证：`window.mnsv2("u","m","w")` → 输出前缀 `mns0301_`

## 阶段 4：其他签名头（2-4 小时）

按复杂度从低到高：

1. **x-t**：毫秒时间戳
2. **x-b3-traceid**：16 位 hex 随机
3. **x-xray-traceid**：时间戳编码 + 随机数
4. **x-s-common**：解码 → 分析 JSON 结构 → 逐字段实现（见 [xsc-common.md](xsc-common.md)）

## 阶段 5：Cookie 引导自动化（3-6 小时）

1. 重现浏览器的 Cookie 设置请求链
2. **每个引导请求都要带完整签名**
3. 验证：自己的 cookie 发 homefeed → code=0 + items>0
4. 参考 [cookie-bootstrap.md](cookie-bootstrap.md)

## 阶段 6：集成测试

1. 全链路自动化：Cookie 引导 → API 请求 → 翻页
2. 连续跑 10 次确认稳定性
3. Cookie 缓存：引导一次后可复用

## 每个阶段的验证方法

| 阶段 | 验证 | 通过标准 |
|------|------|---------|
| Cookie 分析 | 用自己的 cookie 发 API | items 数量和浏览器一样 |
| x-s | 和自己抠的代码对比 | x3 前缀为 mns0301_ |
| x-s-common | 解码后字段级对比 | JSON 结构和值一致 |
| Cookie 引导 | 引导后 homefeed | code=0 + items>0 |
| 集成 | 连续翻页 | 每页都有数据 |
