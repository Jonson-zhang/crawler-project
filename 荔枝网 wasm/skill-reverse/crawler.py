"""
荔枝网 API — Python 调用侧 (web-reverse-algorithm Skill 流程)

writer: 本文件 → 组装 headers → GET gdtv-api
builder: sign.js → WASM a() → 返回 Map{header:value}
"""

import requests, subprocess, json, sys, os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SIGN_JS = os.path.join(SCRIPT_DIR, "sign.js")

# ---- 1. 调用 Node.js 生成签名 ----
try:
    out = subprocess.check_output(
        ["node", SIGN_JS],
        cwd=SCRIPT_DIR,
        timeout=30,
    )
    sig = json.loads(out.decode())
except subprocess.TimeoutExpired:
    print("[FAIL] Node.js 超时 (>30s)")
    sys.exit(1)
except subprocess.CalledProcessError as e:
    print(f"[FAIL] Node.js 退出码 {e.returncode}")
    if e.output:
        print(e.output.decode()[:500])
    sys.exit(1)

# ---- 2. 合并 headers ----
headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9",
    "content-type": "application/json",
    "origin": "https://www.gdtv.cn",
    "referer": "https://www.gdtv.cn/",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
}

for k, v in sig.items():
    headers[k] = str(v) if k == "X-ITOUCHTV-Ca-Timestamp" else v

# ---- 3. 请求 ----
resp = requests.get(
    "https://gdtv-api.gdtv.cn/api/channel/v1/news",
    params={
        "beginScore": "0",
        "channelId": "246",
        "pageSize": "30",
    },
    headers=headers,
    timeout=15,
)

print(f"HTTP {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    news = data.get("list", [])
    print(f"频道: {data.get('name', '?')}  |  条数: {len(news)}")
    for i, item in enumerate(news):
        inner = json.loads(item["data"])
        title = inner.get("title", "?")
        # 输出可读中文
        try:
            print(f"  [{i}] {title.rstrip()[:60]}")
        except UnicodeEncodeError:
            print(f"  [{i}] (title has {len(title)} chars)")
else:
    print(resp.text[:300])
