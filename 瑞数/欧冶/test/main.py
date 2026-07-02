import subprocess
import sys
from pathlib import Path

import requests
from lxml import etree

session = requests.session()

headers = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Pragma": "no-cache",
    "Referer": "https://www.ouyeel.com/steel/",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
}

url = "https://www.ouyeel.com/steel"
response = session.get(url, headers=headers)
response.encoding = "utf-8"
html = etree.HTML(response.text)

meta_content = html.xpath("//meta/@content")[-1]
js_code = html.xpath("//script[1]/text()")[0]

wailian_js_code_url = (
    "https://www.ouyeel.com" + html.xpath("//script[2]/@src")[0]
)
wailian_js_code = session.get(wailian_js_code_url, headers=headers).text

HERE = Path(__file__).parent
TEMPLATE = HERE / "03_loader.js"

# 替换占位符 → 生成完整的 JS 代码
template = TEMPLATE.read_text("utf-8")
code = (
    template.replace("meta_content", meta_content)
    .replace("'js_code'", js_code)
    .replace("'wailian_js_code'", wailian_js_code)
    .replace('require("./02_code")', "")  # 该文件不存在，注释掉
)

# 写到临时文件，用 subprocess 代替 execjs（避免 GBK 编码问题）
tmp_js = HERE / "_run.js"
tmp_js.write_text(code, encoding="utf-8")

result = subprocess.run(
    ["node", str(tmp_js)],
    capture_output=True,
    text=True,
    timeout=30,
    encoding="utf-8",
    errors="replace",
)

tmp_js.unlink(missing_ok=True)  # 清理临时文件

# stdout 包含 v_log 的输出 + 最后的 "cookie 长度"
# 取最后一行（loader.js 的 console.log 输出）
lines = result.stdout.strip().split("\n")
cookie_line = ""
for line in reversed(lines):
    line = line.strip()
    if line and not line.startswith("["):  # 跳过日志行（如 [EventTarget] ...）
        cookie_line = line
        break

if not cookie_line:
    err = result.stderr.strip()[:300]
    print(f"JS 执行失败: {err}", file=sys.stderr)
    sys.exit(1)

# 格式: "cookie_string 304"
parts = cookie_line.rsplit(" ", 1)
js_cookie = parts[0]
cookie_len = parts[1] if len(parts) > 1 else str(len(js_cookie))

# 输出到 stderr 避免编码问题（cookie 可能含不可打印字符）
print(f"Cookie: {len(js_cookie)} 字节", file=sys.stderr)

cookie_key_value = js_cookie.split(";")[0].split("=")
session.cookies.update({cookie_key_value[0]: cookie_key_value[1]})

response = session.get(url, headers=headers)
response.encoding = "utf-8"
print(response.text[:500], response.status_code)

