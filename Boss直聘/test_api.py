"""
Boss直聘 API 端到端测试
1. Node.js 生成 __zp_stoken__
2. Python 发送 API 请求
"""
import subprocess, json, time, sys
import urllib.request, urllib.parse
from pathlib import Path

BASE = Path(__file__).parent

# 第一步：Node.js 生成 token
def gen_token(seed, ts):
    """调用 Node.js 生成 __zp_stoken__"""
    code = f"""
global.window = globalThis;
global.self = globalThis;
global.document = {{
    createElement: function(t) {{ return {{ style: {{}}, setAttribute: function(){{}}, getAttribute: function(){{return null}}, contentWindow: globalThis }}; }},
    body: {{ appendChild: function(){{}} }},
    documentElement: {{ appendChild: function(){{}} }},
    getElementsByTagName: function(){{ return {{ item: function(){{return null}}, length: 0 }}; }},
    cookie: '',
}};
global.location = {{
    hostname: 'www.zhipin.com', href: 'https://www.zhipin.com/web/geek/jobs',
    host: 'www.zhipin.com', pathname: '/web/geek/jobs',
}};
var fs = require('fs');
var code = fs.readFileSync('{BASE / "config" / "security-7c91433f.js"}', 'utf8');
eval(code);
var result = new ABC().z('{seed}', {ts});
console.log(result);
"""
    r = subprocess.run(['node', '-e', code], capture_output=True, text=True, cwd=str(BASE), timeout=15)
    if r.returncode != 0:
        print(f"Node error: {r.stderr}")
        return None
    return r.stdout.strip()

# 第二步：用 Python 发送 API 请求
def test_api(token, cookies=None):
    """用生成的 token 测试 joblist API"""
    import curl_cffi.requests as requests

    url = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"
    params = {
        "city": "101010100",
        "query": "python",
        "page": "1",
        "_": str(int(time.time() * 1000)),
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.zhipin.com/web/geek/jobs?city=101010100&query=python",
        "X-Requested-With": "XMLHttpRequest",
    }

    session = requests.Session()
    cookie_str = f"__zp_stoken__={urllib.parse.quote(token, safe='')}; "
    if cookies:
        cookie_str += cookies

    resp = session.get(url, params=params, headers=headers, cookies={k:v for k,v in [c.split('=',1) for c in cookie_str.rstrip('; ').split('; ')]}, impersonate="chrome131")
    return resp.json()

if __name__ == "__main__":
    ts = int(time.time() * 1000)

    # 用 __a 作为 seed（从浏览器获取）
    seeds_to_try = [
        "42486448.1782455432..1782455432.5.1.5.5",  # __a cookie
    ]

    for seed in seeds_to_try:
        print(f"\n--- Testing seed: {seed[:40]}... ---")
        token = gen_token(seed, ts)
        if not token:
            print("  Token generation failed!")
            continue
        print(f"  Token: {token[:60]}... (len={len(token)})")

        # 用最基本的数据测试
        print(f"  Testing API...")
        result = test_api(token)
        code = result.get('code')
        zpData = result.get('zpData', {})
        job_count = len(result.get('zpData', {}).get('jobList', []))
        print(f"  Response: code={code}, jobs={job_count}, zpData={zpData}")
        if code == 0 and job_count > 0:
            print(f"  SUCCESS!")
            break
    else:
        print("\nNo seed worked. Seed needs to come from server.")
