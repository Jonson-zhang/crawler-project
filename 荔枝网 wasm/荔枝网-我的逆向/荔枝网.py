import requests, subprocess, json, time, os

headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9",
    "content-type": "application/json",
    "origin": "https://gdtv.cn",
    "priority": "u=1, i",
    "referer": "https://gdtv.cn/",
    "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    "x-itouchtv-ca-key": "89541943007407288657755311868534",
    "x-itouchtv-ca-signature": "kf31QQIc9z8khqU4vMlgn5CS5+MIGUhkZAeeIiekl48=",
    "x-itouchtv-ca-timestamp": "1768916277608",
    "x-itouchtv-client": "WEB_PC",
    "x-itouchtv-device-id": "WEB_35493ea0-f2f4-11f0-aaaa-252666417e3c",
}


params = {
    "beginScore": 0,  # 这是时间戳，修改后，可以完成页面上“换一批”的功能。需要同步修改js中的参数
    "channelId": "246",  # 要和js代码中的参数一致
    "pageSize": "11",  # 要和js代码中的参数一致
}


# 1. 调用 Node.js（使用绝对路径避免工作目录问题）
script_dir = os.path.dirname(os.path.abspath(__file__))
code_js = os.path.join(script_dir, "code.js")
out = subprocess.check_output(["node", code_js], cwd=script_dir)
data = json.loads(out.decode())
# print(data)
for k, v in data.items():
    print(k, v)
    if k == "X-ITOUCHTV-Ca-Timestamp":
        headers[k] = str(v)
    else:
        headers[k] = v


# # 5. 发请求
response = requests.get(
    "https://gdtv-api.gdtv.cn/api/channel/v1/news", params=params, headers=headers
)
print(response.json())
