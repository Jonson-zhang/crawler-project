from curl_cffi import requests
import json
import time
import subprocess
from functools import partial
import re
 
subprocess.Popen = partial(subprocess.Popen, encoding="utf-8")
 
headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "cache-control": "no-cache",
    "content-type": "application/json;charset=UTF-8",
    "origin": "https://www.xiaohongshu.com",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "referer": "https://www.xiaohongshu.com/",
    "sec-ch-ua": "\"Microsoft Edge\";v=\"147\", \"Not.A/Brand\";v=\"8\", \"Chromium\";v=\"147\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0",
    "x-b3-traceid": "c7100fa63ec79a91",
    "x-rap-param": "ByQBBQAAAAEAAAAUAAACBAUGKZUAACd0AAAAIAAAAAAAAAAAdXcxbHHVjMIgW5NvdW8C4ZTYLnHqAAAAEPZBoXxDYIKrViUYpoFmhbAeknMerqyvqU+pRsxxs4Aua7D0fYq336lpGQ76IfAYjRriwbp8OBKDbaJtFzvJqWxk7aCoUUTmAzcr/DwEyGS+ZeHgy7pTX6g8mWP3rkXRBuljOMNrQQ117tKVuPqVxNnoqb9jXvV8vmMpL6xF8YzFeykCUoruJgl4xGCWcy3PLVQXJwCFTfUvKWu0LqvHQJ2HmF0rNdHqsF7voTI/NHEnLB8qBo5ATleJgRGmbxwyCSg13Qd6vasXPEosZL33+tb0GmyEw0pLFWGX990+BaEw2u27jNSQQ/WZKeYuiOPMKNcDLgXP3FJWlaiIzbPbkvcf7TA3cOGSxFG6fqLb6LrzPWa/NoBR4Efbfbo03JCqlkLWDE0tQ5fH+2+fv4K2hQ9ZKTijh94M9QChmwqrSk/62ba7f77Mh81ffsl+G3hCFxcC2Scy3dij3/Y/VkE5RZgbAtGyJNydEgf9OFWsge328J+VNWuGFJ1vcCD0l07GI0nZy/gtKc8bZQrDtlklMA0oSyhuQEuhGnNOPXDnICnz5bd7+XG1a9j/sSCCE9b2Csx14FaMQBz+RglhOxcmRNfPXQWM1R8RElufAUGce1ZHnucLI1jVbdjXHDhFuQuR4evoRhjRRazu5M0QwGKEPNvdqcofVSlcO4XK5vBcWo9EAAAB/g==",
    # "x-s": "XYS_2UQhPsHCH0c1PUhMHjIj2erjwjQhyoPTqBPT49pjHjIj2eHjwjQgynEDJ74AHjIj2ePjwjQTJdPIPAZlg94aGLTlG94tGjRzGMpp2DEbqemk8rP72sTUGn+awepncA4x2bSozFDUyfE++7iF8o+k/MpazF8UJppGLgSIpnzsnr+oJLby4ebDLA+FnnlG+op6GMQkG9kTyezypnp0GS8C2fFFyd8n2juFapc7PnV3Pn4mPrkHaMY/GfzPwb46Pn8+c9EIqMQCLDkcpnbLP9lt2rT/Jfznnfl0yLLIaSQQyAmOarEaLSz+qSiMzeYDwrHh89+Sy9uly/YV87zsNUHVHdWFH0ijJ9Qx8n+FHdF=",
    "x-s-common": "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",
    "x-t": "1776697339937",
    "x-xray-traceid": "ced5b4f809c1f4c5647b2630fbac3718",
    "xy-direction": "15"
}
cookies = {
    "abRequestId": "bc87e19f-1473-5802-857f-aa14072c42f5",
    "a1": "197c660cf2d0j0l1bdwbkv2cyce6csd6n3v6nths750000683082",
    "webId": "c09b78e6b3cb4b550c9d51b97c057cd0",
    "gid": "yjWSKK8f0jIdyjWSKK8Siq9xJf8V81yDfEDThMWhJSvSdK28KSMfKI888KYq8YJ88SyyYWqJ",
    "xsecappid": "xhs-pc-web",
    "ets": "1775377444539",
    "web_session": "030037af50bba6105e57685aaa2e4a4bf09fbb",
    "webBuild": "6.7.0",
    "loadts": "1776689467785",
    "unread": "{%22ub%22:%2269d63940000000001b0206cf%22%2C%22ue%22:%2269db583e000000001f00105f%22%2C%22uc%22:24}",
    "websectiga": "3633fe24d49c7dd0eb923edc8205740f10fdb18b25d424d2a2322c6196d2a4ad",
    "sec_poison_id": "e64b0814-2c32-4e43-95db-06461048956b",
    "acw_tc": "0a4ad7e117766973343914607e250d37a80ffd693c1972c70a2e1f4fab6fee"
}
url = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
data = {
    "cursor_score": "",
    "num": 31,
    "refresh_type": 1,
    "note_index": 25,
    "unread_begin_note_id": "",
    "unread_end_note_id": "",
    "unread_note_count": 0,
    "category": "homefeed_recommend",
    "search_key": "",
    "need_num": 6,
    "image_formats": [
        "jpg",
        "webp",
        "avif"
    ],
    "need_filter_image": False
}
data = json.dumps(data, separators=(',', ':'))
 
 
 
 
# 加载签名 JS
q = "/api/sns/web/v1/homefeed"
 
cmd = ["node", "./function.js", q, data]
text = subprocess.check_output(cmd, encoding='utf-8')
# print(text)
match = re.search(r'X-s:\s*(.+)', text)
if match:
    x_s = match.group(1).strip()
    print(f"提取的 X-s 值: {x_s}")
else:
    print("错误: 未能从 JS 输出中提取 X-s")
    print("完整输出:", text)
    exit(1)
 
# 生成时间戳（必须在签名生成后立即生成，避免过期）
x_t = str(int(time.time() * 1000))
 
# 添加签名到 headers
headers['x-s'] = x_s
headers['x-t'] = x_t
 
print(f"x-t: {x_t}")
 
# 使用 curl_cffi 的 requests，模拟浏览器
response = requests.post(url, headers=headers, cookies=cookies, data=data, impersonate="chrome131")
 
# 格式化输出结果
print(f"\n{'='*60}")
print(f"请求状态: {response.status_code}")
print(f"{'='*60}\n")
 
if response.status_code == 200:
    result = response.json()
    if result.get('success'):
        items = result.get('data', {}).get('items', [])
        print(f"&#9989; 获取成功！共 {len(items)} 条笔记\n")
        print(f"{'='*60}")
 
        for idx, item in enumerate(items, 1):
            note = item.get('note_card', {})
            user = note.get('user', {})
            interact = note.get('interact_info', {})
 
            print(f"\n&#128221; 笔记 {idx}:")
            print(f"   标题: {note.get('display_title', '无标题')}")
            print(f"   作者: {user.get('nick_name', '未知')}")
            print(f"   点赞: {interact.get('liked_count', '0')}")
            print(f"   类型: {note.get('type', 'unknown')}")
            print(f"   ID: {item.get('id', '')}")
 
        print(f"\n{'='*60}")
        print(f"cursor_score: {result.get('data', {}).get('cursor_score', '')}")
        print(f"{'='*60}\n")
    else:
        print(f"&#10060; 请求失败: {result.get('msg', '未知错误')}")
        print(f"响应内容: {response.text}")
else:
    print(f"&#10060; HTTP错误: {response.status_code}")
    print(f"响应内容: {response.text}")