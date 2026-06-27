"""
Boss直聘 joblist API — 双路线

路线 A（推荐）：浏览器桥接 → code=0 ✅
  原理：在 Camoufox 浏览器中直接调用 API，浏览器自动通过安全检测
  用法：boss_bridge.py 或 MCP evaluate_js

路线 B（备选）：Node.js 补环境 → code=38 ⚠️
  原理：Node.js 中模拟浏览器环境运行加密 JS
  用法：python main.py (自动走此路线)

路线 B 的 code=38 意味着 token 有效但环境指纹不完全匹配，
可通过进一步精确匹配浏览器指纹修复。
"""
import time
import subprocess
import json
import urllib.parse
from pathlib import Path

import curl_cffi.requests as requests

BASE = Path(__file__).parent
SIGN_BOSS_JS = BASE / "sign_boss_v17.js"


def gen_token_from_seed(seed: str, ts: int) -> str:
    """路线 B：Node.js 环境生成 token"""
    r = subprocess.run(
        ["node", str(SIGN_BOSS_JS), seed, str(ts)],
        capture_output=True, text=True, cwd=str(BASE), timeout=30,
    )
    if r.returncode != 0:
        raise RuntimeError(f"Node.js error: {r.stderr}")
    return r.stdout.strip()


def get_jobs_nodejs(city="101010100", query="python", page=1):
    """
    路线 B：curl_cffi + Node.js token 生成

    流程：
      1. curl_cffi 访问 API → code=37, 获得 seed+ts
      2. Node.js 用 seed+ts 生成 __zp_stoken__
      3. curl_cffi 携带 token 重试 API
    """
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Referer": f"https://www.zhipin.com/web/geek/jobs?city={city}&query={query}",
            "Origin": "https://www.zhipin.com",
        }
    )

    # 基础 Cookie
    ts_sec = int(time.time())
    sid = str(ts_sec)[-8:] + str(int(time.time() * 1000) % 100000000).zfill(8)
    __a = f"{sid}.{ts_sec}..{ts_sec}.2.1.2.2"
    __c = str(ts_sec)

    session.cookies.set("__a", __a, domain=".zhipin.com", path="/")
    session.cookies.set("__c", __c, domain=".zhipin.com", path="/")
    session.cookies.set("__g", "-", domain=".zhipin.com", path="/")

    # Step 1: 请求 API（预期 code=37）
    url = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"
    resp = session.get(
        url,
        params={"city": city, "query": query, "page": str(page)},
        impersonate="chrome131",
    )
    data = resp.json()

    if data.get("code") == 0:
        return data.get("zpData", {}).get("jobList", [])

    if data.get("code") != 37:
        return {
            "error": f"Unexpected code={data.get('code')}",
            "message": data.get("message", ""),
        }

    # Step 2: 生成 token
    zp = data.get("zpData", {})
    seed = zp.get("seed")
    api_ts = zp.get("ts")
    if not seed or not api_ts:
        return {"error": "No seed/ts in response", "data": data}

    token = gen_token_from_seed(seed, api_ts)
    session.cookies.set(
        "__zp_stoken__", urllib.parse.quote(token, safe=""),
        domain=".zhipin.com", path="/",
    )

    # Step 3: 携带 token 重试
    resp = session.get(
        url,
        params={"city": city, "query": query, "page": str(page)},
        impersonate="chrome131",
    )
    data = resp.json()

    if data.get("code") == 0:
        return data.get("zpData", {}).get("jobList", [])
    else:
        return {
            "error": f"code={data.get('code')}",
            "message": data.get("message", ""),
            "token_len": len(token),
            "token_prefix": token[:20],
        }


def get_jobs_browser(city="101010100", query="python", page=1):
    """
    路线 A：浏览器桥接（在 Claude 中通过 MCP 使用）

    需要在当前 Claude 会话中已启动 Camoufox 浏览器并访问 zhipin.com
    然后调用：
      evaluate_js(search_js) → 返回 jobList
    """
    return {
        "error": "此函数需要在 Claude MCP 会话中使用",
        "usage": "请通过 MCP evaluate_js 调用 Boss API",
        "js_template": (
            '(async () => {'
            '  const resp = await fetch('
            f'    "/wapi/zpgeek/search/joblist.json'
            f'?city={city}&query={query}&page={page}",'
            '    { headers: { "Accept": "application/json" } }'
            '  );'
            '  return await resp.json();'
            '})()'
        ),
    }


if __name__ == "__main__":
    print("Boss直聘 joblist API — Node.js 路线测试")
    print("=" * 60)
    result = get_jobs_nodejs("101010100", "python")

    if isinstance(result, list):
        print(f"✅ code=0! {len(result)} jobs:")
        for j in result[:5]:
            print(
                f"  [{j.get('jobName', '?')}] "
                f"@ {j.get('brandName', '?')} "
                f"- {j.get('salaryDesc', '?')}"
            )
    else:
        print(f"结果: {result.get('error', 'unknown')}")
        print(f"  消息: {result.get('message', '')[:100]}")
        if result.get("token_prefix"):
            print(f"  Token: {result['token_prefix']}...")
