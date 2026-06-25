# 好医生 CME 自动化

> 基于油猴脚本逻辑，Python + Playwright 重写。支持 cmechina.net、haoyisheng.com、bjsqypx 三个站点。

## 两种使用方式

### 🍪 Cookie 模式（推荐—无需浏览器手动登录）

```bash
# 1. 从浏览器获取 Cookie
#    F12 → Application → Cookies → www.cmechina.net
#    复制每个 cookie 的 name 和 value 到 cookies.json

# 2. 填入 cookies.json
{
  "client_id": "你的值",
  "cmesid": "你的值",
  "JSESSIONID": "你的值",
  "login_token_uid": "你的值",
  "uniqueVisitorId": "你的值"
}

# 3. 开始—全程无头，无需登录
python bot.py 202601017869  # 课程ID
python bot.py --url "https://www.cmechina.net/cme/study2.jsp?course_id=202601017869&courseware_id=01" --headless
```

**原理**: 浏览器登录后，`JSESSIONID` + `login_token_uid` 就是服务端认可的登录凭证。Playwright 启动时通过 `context.add_cookies()` 注入这些 cookie，后续所有请求自动携带。

### 🔑 浏览器登录模式（备选）

```bash
python bot.py --url "https://..."   # 打开窗口手动登录，登录态保存到 browser_data/
```

首次使用或 cookie 过期后用这种方式。

## 参数速查

| 参数 | 说明 | 示例 |
|------|------|------|
| `202601017869` | 直接传 course_id（纯数字） | `python bot.py 202601017869` |
| `--url` | 完整 URL | `--url "https://..."` |
| `--cookies` | 指定 cookie JSON 路径 | `--cookies my_cookies.json` |
| `--headless` | 无头模式 | `python bot.py 123 --headless` |
| `--relogin` | 清除旧登录态重新登录 | `python bot.py --relogin` |

## Cookie 文件

只用 5 个关键 cookie（从浏览器端到端测试确认）：

| Cookie | 作用 |
|--------|------|
| `JSESSIONID` | Java 会话 ID（核心） |
| `login_token_uid` | 登录令牌 |
| `client_id` | 客户端标识 |
| `cmesid` | CME 平台会话 |
| `uniqueVisitorId` | 访客标识 |

`cookies.json` 被 `.gitignore` 排除，不会提交到仓库。

## cmechina.net 流程

```
study2.jsp（视频 + 侧栏 9 节课）
    │
    ├─ skip_video()      jumpToTime(duration-0.5) + localStorage 标记
    ├─ 等 4s 学时上报
    ├─ reload → 冷启动 → "待考试" → 进 exam.jsp
    ├─ take_exam()       暴力枚举 → 通过
    └─ 侧栏点下一节 → 循环
```
