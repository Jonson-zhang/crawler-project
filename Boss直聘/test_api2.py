"""
Boss直聘精确比对测试：相同 session -> 无token请求 -> 获取seed -> 生成token -> 带token重试
使用 Python requests + curl_cffi 精确模拟浏览器行为
"""
import time, json, subprocess, urllib.parse
from pathlib import Path
BASE = Path(__file__).parent

def gen_token(seed, ts):
    """调用 Node.js sign_abc.js 生成 token"""
    r = subprocess.run(
        ['node', str(BASE / 'config' / 'sign_abc.js'), seed, str(ts)],
        capture_output=True, text=True, cwd=str(BASE / 'config'), timeout=10
    )
    if r.returncode != 0:
        raise RuntimeError(f"sign_abc.js error: {r.stderr}")
    return r.stdout.strip()

def test_once(cookies_str=None):
    import curl_cffi.requests as requests
    session = requests.Session()

    # Set up cookies if provided
    if cookies_str:
        for c in cookies_str.split('; '):
            if '=' in c:
                k, v = c.split('=', 1)
                if k.startswith('__zp_'):
                    session.cookies.set(k, v, domain='.zhipin.com', path='/')
                elif k == '__a':
                    session.cookies.set(k, v, domain='.zhipin.com', path='/')
                elif k == '__c':
                    session.cookies.set(k, v, domain='.zhipin.com', path='/')

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.zhipin.com/web/geek/jobs?city=101010100&query=python",
    }

    ts = int(time.time() * 1000)
    params = {"city": "101010100", "query": "python", "page": "1", "_": str(ts)}

    # Step 1: First request WITHOUT __zp_stoken__
    print("[1] Request WITHOUT token...")
    resp = session.get(
        "https://www.zhipin.com/wapi/zpgeek/search/joblist.json",
        params=params, headers=headers, impersonate="chrome131"
    )
    data = resp.json()
    code = data.get('code')
    print(f"    code={code}, message={data.get('message','')}")

    if code == 0:
        return data

    if code != 37:
        print(f"    Unexpected code: {code}")
        return data

    # Step 2: Get seed from response and generate token
    zp = data.get('zpData', {})
    seed = zp.get('seed')
    rts = zp.get('ts')
    name = zp.get('name')
    print(f"[2] seed={seed[:30]}... ts={rts} name={name}")

    if not seed or not rts:
        return data

    token = gen_token(seed, rts)
    # URL encode the token for cookie storage (matching browser behavior)
    encoded_token = urllib.parse.quote(token, safe='')
    print(f"    Token raw_len={len(token)}, encoded_len={len(encoded_token)}, preview={token[:50]}...")

    # Step 3: Retry WITH token
    session.cookies.set('__zp_stoken__', encoded_token, domain='.zhipin.com', path='/')

    ts2 = int(time.time() * 1000)
    params["_"] = str(ts2)
    print(f"[3] Retry WITH token...")
    resp = session.get(
        "https://www.zhipin.com/wapi/zpgeek/search/joblist.json",
        params=params, headers=headers, impersonate="chrome131"
    )
    data = resp.json()
    code = data.get('code')
    print(f"    code={code}, message={data.get('message','')}")

    if code == 0:
        jobs = data.get('zpData', {}).get('jobList', [])
        print(f"    SUCCESS: {len(jobs)} jobs")
    elif code == 37:
        zp2 = data.get('zpData', {})
        print(f"    New seed: {zp2.get('seed','')[:30]}...")

    return data

if __name__ == "__main__":
    # 使用浏览器当前的 __a 和 __c cookies
    browser_cookies = "__a=26709070.1782456825..1782456825.2.1.2.2; __c=1782456825"

    for i in range(3):
        print(f"\n{'='*60}")
        print(f"Round {i+1}")
        print(f"{'='*60}")
        data = test_once(browser_cookies)
        if data.get('code') == 0:
            break
        time.sleep(2)
