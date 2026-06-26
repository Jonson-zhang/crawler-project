"""
Boss直聘 joblist API - 完整流程
1. 获取基础 Cookie → 请求 API → 拿 seed → 生成 token → 重试
"""
import time, subprocess, json, urllib.parse
from pathlib import Path
import curl_cffi.requests as requests

BASE = Path(__file__).parent
TEST_E2E_JS = BASE / "test_e2e.js"

def gen_token(__a, __c, seed, ts):
    """调用 Node.js vm 沙箱生成 __zp_stoken__"""
    r = subprocess.run(
        ["node", str(TEST_E2E_JS), __a, __c, seed, str(ts)],
        capture_output=True, text=True, cwd=str(BASE), timeout=15
    )
    if r.returncode != 0:
        raise RuntimeError(f"Node error: {r.stderr}")
    return r.stdout.strip()

def get_jobs(city="101010100", query="python", page=1):
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": f"https://www.zhipin.com/web/geek/jobs?city={city}&query={query}",
        "traceId": str(int(time.time()*1000000))[:20],
    })

    # 设置基础 Cookie
    ts_sec = int(time.time())
    sid = str(ts_sec)[-8:] + str(int(time.time() * 1000) % 100000000).zfill(8)
    __a = f"{sid}.{ts_sec}..{ts_sec}.2.1.2.2"
    __c = str(ts_sec)

    session.cookies.set("__a", __a, domain=".zhipin.com", path="/")
    session.cookies.set("__c", __c, domain=".zhipin.com", path="/")
    session.cookies.set("__g", "-", domain=".zhipin.com", path="/")
    session.cookies.set("ab_guid", str(int(time.time()*1000))[:12] + "-test", domain="www.zhipin.com", path="/")

    # 先调 zpToken 预热
    try:
        session.post("https://www.zhipin.com/wapi/zppassport/set/zpToken", json={},
                     headers={"Content-Type": "application/json"}, impersonate="chrome131")
    except: pass

    # 设置完整 Cookie 链
    session.cookies.set("__l", f"l=%2Fwww.zhipin.com%2Fweb%2Fgeek%2Fjobs%3Fcity%3D{urllib.parse.quote(city)}%26query%3D{urllib.parse.quote(query)}&r=&g=&s=3&friend_source=0",
                        domain=".zhipin.com", path="/")

    # 第一步：请求 API（预计 code=37，返回 seed）
    ts_req = int(time.time() * 1000)
    url = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"
    params = {"city": city, "query": query, "page": str(page), "_": str(ts_req)}

    resp = session.get(url, params=params, impersonate="chrome131")
    data = resp.json()

    if data.get("code") == 0:
        return data.get("zpData", {}).get("jobList", [])

    if data.get("code") != 37:
        return {"error": f"Unexpected code={data.get('code')}", "data": data}

    # 第二步：用 seed 生成 token
    zp = data.get("zpData", {})
    seed = zp.get("seed")
    api_ts = zp.get("ts")

    if not seed or not api_ts:
        return {"error": "No seed in response", "data": data}

    token = gen_token(__a, __c, seed, api_ts)
    session.cookies.set("__zp_stoken__", urllib.parse.quote(token, safe=""), domain=".zhipin.com", path="/")

    # 第三步：用 token 重试
    ts_req2 = int(time.time() * 1000)
    params["_"] = str(ts_req2)
    resp = session.get(url, params=params, impersonate="chrome131")
    data = resp.json()

    if data.get("code") == 0:
        return data.get("zpData", {}).get("jobList", [])
    elif data.get("code") == 37:
        return {"error": f"code=37 again, token rejected", "zpData": data.get("zpData"), "token_len": len(token)}
    else:
        return {"error": f"code={data.get('code')}, msg={data.get('message', '')}", "token_len": len(token), "zpData": data.get("zpData"), "full": json.dumps(data, ensure_ascii=False)[:500]}

if __name__ == "__main__":
    print("Boss直聘 joblist API 测试")
    print("=" * 50)
    result = get_jobs("101010100", "python")
    if isinstance(result, list):
        print(f"SUCCESS! {len(result)} jobs found:")
        for j in result[:5]:
            print(f"  [{j.get('jobName', '?')}] @ {j.get('brandName', '?')} - {j.get('salaryDesc', '?')}")
    else:
        print(f"FAILED: {result}")
