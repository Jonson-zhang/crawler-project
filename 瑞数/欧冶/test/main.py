import requests, json
from lxml import etree
import subprocess
from pathlib import Path

HERE = Path(__file__).parent

session = requests.session()

# cookies = {
#     'T0k1m0u5AfREO': '5Kr8BmXYwVMluL1aO0gpc_cDiXGdFCbURnA8VZsnecdkKUUjexNAV5HpxpqCLIXDDUof6GO4POMxq.R.UhcO7rq',
#     'cookiesession1': '678A3E1A457B65ECF826195EF85DB9D7',
#     'T0k1m0u5AfREP': '257NKRclB.IdZ8daPthMu4Oo.XYTAdWKORWc.yrkhtxU1pqkAoB0qq0JxSOB0a12wnhpj4q03lieIk8bJrgr0B0iuL4Ns4iYesI5jCd_qlOn9qUtbAxHbCii5FrEin6YwMVecF5wTUJZ3rhYViQvAzsNxPVISCrj13mHcBIoMurwitNrfZphTHI.f0NpDlqxjIjQ5HIGYTZwoQ63V.SsrD1ZylTG3ZeH8dYYSU9V4JE',
# }

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
    # 'Cookie': 'T0k1m0u5AfREO=5Kr8BmXYwVMluL1aO0gpc_cDiXGdFCbURnA8VZsnecdkKUUjexNAV5HpxpqCLIXDDUof6GO4POMxq.R.UhcO7rq; cookiesession1=678A3E1A457B65ECF826195EF85DB9D7; T0k1m0u5AfREP=257NKRclB.IdZ8daPthMu4Oo.XYTAdWKORWc.yrkhtxU1pqkAoB0qq0JxSOB0a12wnhpj4q03lieIk8bJrgr0B0iuL4Ns4iYesI5jCd_qlOn9qUtbAxHbCii5FrEin6YwMVecF5wTUJZ3rhYViQvAzsNxPVISCrj13mHcBIoMurwitNrfZphTHI.f0NpDlqxjIjQ5HIGYTZwoQ63V.SsrD1ZylTG3ZeH8dYYSU9V4JE',
}

url = "https://www.ouyeel.com/steel"
response = session.get(url, headers=headers)
response.encoding = "utf-8"
html = etree.HTML(response.text)

meta_content = html.xpath("//meta/@content")[-1]
js_code = html.xpath("//script[1]/text()")[0]
wailian_js_code_url = (
    "https://www.ouyeel.com" + html.xpath("//script[2]/@src")[0]
)  # 获取第一次请求时，页面中的外链地址
wailian_js_code = session.get(
    wailian_js_code_url, headers=headers
).text  # 访问上一步得到的外链，获取外链的代码

# print(wailian_js_code)

# 将meta_content、js_code和wailian_js_code 替换03_loader.js中的变量
with open("03_loader.js", "r", encoding="utf-8") as fp:
    code = fp.read()

code = code.replace(
    "meta_content", json.dumps(meta_content)
)  # 03_loader中的 'meta_content' 两边不要带引号，
code = code.replace("'js_code'", js_code)
code = code.replace("'wailian_js_code'", wailian_js_code)

# 如果有必要，可以保存一个调试文件看一眼
# with open("debug_loader.js", "w", encoding = "utf-8") as f:
#     f.write(code)

js_compile = execjs.compile(code)

# 配合03_loader，检查content是否正确赋值
# debug_data = js_compile.call("get_debug_info")
# print("发起请求获取的值:", meta_content)
# print("JS 内部变量值:  ", debug_data['variable'])
# print("DOM 节点属性值: ", debug_data['dom_content'])

js_cookie = js_compile.call("get_cookie")

print(js_cookie, len(js_cookie))

cookie_key_value = js_cookie.split(";")[0].split("=")
session.cookies.update({cookie_key_value[0]: cookie_key_value[1]})

response = session.get(url, headers=headers)
response.encoding = "utf-8"
print(response.text, response.status_code)
