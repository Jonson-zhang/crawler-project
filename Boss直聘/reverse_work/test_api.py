"""
Boss直聘 joblist API 端到端测试
流程: 获取Cookie → 请求API → 拿seed → 生成token → 重试
"""
import subprocess, json, time, sys, os, urllib.parse
from pathlib import Path
import curl_cffi.requests as requests

BASE = Path(__file__).parent

def _load_abc():
    """加载 security JS 到 Node.js，返回 ABC.z(seed, ts) 函数的 Python 调用桥"""
    js_path = str(BASE / "config" / "security-7c91433f.js").replace("\\", "/")
    js_wrapper = f"""
global.window = globalThis; global.self = globalThis;
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
var code = fs.readFileSync('{js_path}', 'utf8');
eval(code);

var seed = process.argv[2];
var ts = parseInt(process.argv[3]);
process.stdout.write(new ABC().z(seed, ts));
"""
    # 缓存到临时文件减少 subprocess 开销
    tmpfile = BASE / "config" / "_abc_runner.js"
    tmpfile.write_text(js_wrapper, encoding='utf-8')

    def gen_token(seed: str, ts: int) -> str:
        r = subprocess.run(
            ['node', str(tmpfile), seed, str(ts)],
            capture_output=True, text=True, cwd=str(BASE), timeout=10
        )
        if r.returncode != 0:
            raise RuntimeError(f"Node error: {r.stderr}")
        return r.stdout.strip()

    return gen_token


def test_joblist():
    gen_token = _load_abc()

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
    })

    # Step 1: 手动设置基础 Cookie（浏览器通过 JS 自动生成，curl 需要手动注入）
    ts_sec = int(time.time())
    session_id = str(ts_sec)[-8:] + str(int(time.time() * 1000) % 100000000).zfill(8)
    __a = f"{session_id}.{ts_sec}..{ts_sec}.1.1.1.1"
    session.cookies.set("__a", __a, domain=".zhipin.com", path="/")
    session.cookies.set("__c", str(ts_sec), domain=".zhipin.com", path="/")
    session.cookies.set("__g", "-", domain=".zhipin.com", path="/")
    session.cookies.set("__l", f"l=%2Fwww.zhipin.com%2Fweb%2Fgeek%2Fjobs&r=&g=&s=3&friend_source=0", domain=".zhipin.com", path="/")
    print(f"[1] Cookies set: __a={__a}, __c={ts_sec}",)

    # Step 2: 第一次 API 请求，预计 code=37，拿到 seed
    print("[2] First API request (expect code=37 + seed)...")
    params = {"city": "101010100", "query": "python", "page": "1", "_": str(int(time.time() * 1000))}
    resp = session.get(
        "https://www.zhipin.com/wapi/zpgeek/search/joblist.json",
        params=params,
        headers={"Referer": "https://www.zhipin.com/web/geek/jobs?city=101010100&query=python"},
        impersonate="chrome131",
    )
    data = resp.json()
    print(f"    code={data.get('code')}, message={data.get('message')}")

    if data.get('code') == 0:
        jobs = data.get('zpData', {}).get('jobList', [])
        print(f"    SUCCESS! {len(jobs)} jobs returned (no token needed)")
        return data

    # Step 3: 用 code=37 返回的 seed 生成 token
    zp = data.get('zpData', {})
    seed = zp.get('seed')
    ts = zp.get('ts')
    name = zp.get('name')
    print(f"[3] Got seed: {seed}, ts={ts}, name={name}")

    if not seed or not ts:
        print("    No seed in response, cannot proceed")
        return data

    token = gen_token(seed, ts)
    print(f"    Generated token: {token[:50]}... (len={len(token)})")

    # Step 4: 重试请求，带上 token
    print("[4] Retry with __zp_stoken__ cookie...")
    session.cookies.set('__zp_stoken__', token, domain='.zhipin.com', path='/')

    params["_"] = str(int(time.time() * 1000))
    resp = session.get(
        "https://www.zhipin.com/wapi/zpgeek/search/joblist.json",
        params=params,
        headers={"Referer": "https://www.zhipin.com/web/geek/jobs?city=101010100&query=python"},
        impersonate="chrome131",
    )
    data = resp.json()
    print(f"    code={data.get('code')}, message={data.get('message')}")
    zp = data.get('zpData', {})

    if data.get('code') == 37:
        # 还是 37？可能是重复 token 或需要新的 seed
        print(f"    Still code=37. New seed: {zp.get('seed')}, ts={zp.get('ts')}")
    elif data.get('code') == 0:
        jobs = data.get('zpData', {}).get('jobList', [])
        print(f"    SUCCESS! {len(jobs)} jobs found")
        for j in jobs[:3]:
            print(f"      - {j.get('jobName', '?')} @ {j.get('brandName', '?')}")
    return data


if __name__ == "__main__":
    for attempt in range(3):
        print(f"\n{'='*60}")
        print(f"Attempt {attempt + 1}")
        print(f"{'='*60}")
        try:
            data = test_joblist()
            if data.get('code') == 0:
                break
        except Exception as e:
            print(f"    Error: {e}")
        time.sleep(2)
