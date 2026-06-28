import requests, execjs, urllib

cookies = {
    "tt_webid": "7595560173936346687",
    "gfkadpd": "24,6457",
    "ttcid": "06670e610e5f42a9a754795203c2111929",
    "local_city_cache": "%E5%8C%97%E4%BA%AC",
    "ttwid": "1%7CN3hVUGP4iQ5BR2s53uQRDAtuYdPAvTDGIcEr9CBbqd8%7C1768479176%7Cb3588e05d97dcff733976978e5627627abff8ac9d80bb6ec06644475f531f012",
    "x-web-secsdk-uid": "07ca28de-85df-44eb-8319-a36ee0333775",
    "csrftoken": "5f1d25ee5128e7562b40d64302aa6b02",
    "_ga": "GA1.1.651003544.1768479182",
    "s_v_web_id": "verify_mkfeuecm_CVk0RsrR_ewAB_46JH_AWLu_Yd1l9c6hc09D",
    "tt_scid": "5d-MAR85DXYmPnn8nlhWOuz2VcZJDVTS5ySXut27YIFRloblmRFsSU3IA84exlUXc802",
    "_ga_QEHZPBE5HH": "GS2.1.s1768479182$o1$g1$t1768479858$j60$l0$h0",
}

headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9",
    "priority": "u=1, i",
    "referer": "https://www.toutiao.com/?wid=1768479180314",
    "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
}

params = {
    "channel_id": "3189399007",
    "min_behot_time": "1768479851",
    "offset": "0",
    "refresh_count": "1",
    "category": "pc_profile_channel",
    "client_extra_params": '{"short_video_item":"filter"}',
    "aid": "24",
    "app_name": "toutiao_web",
    "msToken": "gtABSux8LsTidatAsMKqxhVHKkE3BoV7rj3DtwE97eYLU806Wa8lVjosZLr54BOiPMydMfqOv66KUpqjJnowTU6A_bLe2Q2k3gxDwMM4nUiWvwKZfJdK8MMALrncFUc=",
}

p = urllib.parse.urlencode(params)
with open("./03_loader.js", "r", encoding="utf-8") as f:
    js_code = f.read()

params["a_bogus"] = execjs.compile(js_code).call("my_a_bogus", p)

response = requests.get(
    "https://www.toutiao.com/api/pc/list/feed",
    params=params,
    cookies=cookies,
    headers=headers,
)
print(response.text, response.status_code)
print(params["a_bogus"], len(params["a_bogus"]))
# 翻页的时候，只有min_behot_time 参数会变化，这个值是上次请求中的返回，赋给下一次请求，就实现了翻页
