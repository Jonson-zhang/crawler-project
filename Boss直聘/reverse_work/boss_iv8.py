"""
Boss直聘 — iv8 方案 (C++ V8 + 浏览器 API 原生模拟)

iv8 是 Python 原生 C++ 扩展，嵌入 V8 引擎并在 C++ 层实现浏览器 API。
每个属性都在 C++ 层实现，JS 端完全感知不到差异。
指纹固定（内置 Chrome/Windows 默认值），不会像 Camoufox 随机化。
"""
import json
from urllib.parse import quote

import requests

import iv8

API_URL = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

HEADERS = {
    "user-agent": UA,
    "accept": "application/json, text/plain, */*",
    "content-type": "application/x-www-form-urlencoded",
    "origin": "https://www.zhipin.com",
    "referer": "https://www.zhipin.com/web/geek/jobs?query=python&city=101010100",
}


def search_jobs(city="101010100", query="python", page=1):
    """搜索 Boss直聘职位 — iv8 补环境方案"""

    session = requests.Session()

    # ===== 1. 首次请求 → code=37，获取 seed =====
    print(f"[1] 请求 API: city={city}, query={query} ...")
    data = {
        "scene": "1", "query": query, "city": city,
        "experience": "", "degree": "", "industry": "", "scale": "",
        "salary": "", "page": str(page), "pageSize": "15",
    }
    resp = session.post(API_URL, headers=HEADERS, data=data, timeout=15)
    payload = resp.json()
    code = payload.get("code")
    print(f"    code={code} msg={payload.get('message')}")

    if code == 0:
        jobs = (payload.get("zpData") or {}).get("jobList") or []
        print(f"    直接成功! {len(jobs)} jobs")
        return jobs

    if code != 37:
        print(f"    非预期 code")
        return None

    # ===== 2. 提取 seed/name/ts =====
    zp = payload["zpData"]
    seed, name, ts = zp["seed"], zp["name"], zp["ts"]
    print(f"[2] seed={seed[:20]}... name={name} ts={ts}")

    # ===== 3. 下载 security JS =====
    js_url = f"https://www.zhipin.com/web/common/security-js/{name}.js"
    print(f"[3] 下载 {js_url}")
    js_code = session.get(js_url, headers={"user-agent": UA}, timeout=15).text
    print(f"    JS 长度: {len(js_code)}")

    # ===== 4. iv8 执行，计算 token =====
    print("[4] iv8 计算 __zp_stoken__ ...")

    security_url = (
        f"https://www.zhipin.com/web/common/security-check.html"
        f"?seed={quote(seed)}&name={name}&ts={ts}&callbackUrl=&srcReferer"
    )

    environment = {
        "location": {
            "href": security_url,
            "origin": "https://www.zhipin.com",
            "protocol": "https:",
            "host": "www.zhipin.com",
            "hostname": "www.zhipin.com",
            "port": "",
            "pathname": "/web/common/security-check.html",
            "search": "?" + security_url.split("?", 1)[1],
            "hash": "",
        },
    }

    html_page = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>BOSS直聘</title></head>
<body>
<script src="{js_url}"></script>
</body></html>"""

    with iv8.JSContext(
        environment=environment,
        config={"timezone": "Asia/Shanghai"},
    ) as ctx:
        ctx.expose(
            {
                "baseURL": environment["location"]["href"],
                "html": html_page,
                "headers": [],
                "resources": {js_url: js_code},
            },
            "snapshot",
        )
        ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")

        seed_escaped = json.dumps(seed, ensure_ascii=False)
        token = ctx.eval(
            f"encodeURIComponent((new window.ABC).z({seed_escaped}, {int(ts)}));"
        )

    token_str = str(token)
    print(f"    token={token_str[:40]}... (len={len(token_str)})")

    # ===== 5. 带 token 重新请求 =====
    print("[5] 携带 __zp_stoken__ 重新请求 ...")
    session.cookies.set("__zp_stoken__", token_str)
    resp2 = session.post(API_URL, headers=HEADERS, data=data, timeout=15)
    payload2 = resp2.json()

    code2 = payload2.get("code")
    print(f"    code={code2} msg={payload2.get('message')}")

    if code2 == 0:
        jobs = (payload2.get("zpData") or {}).get("jobList") or []
        print(f"    [OK] 成功! {len(jobs)} 个职位:")
        for j in jobs:
            print(
                f"      [{j.get('jobName', '?')}] @ {j.get('brandName', '?')} "
                f"- {j.get('salaryDesc', '?')}"
            )
        return jobs
    else:
        print(f"    失败: {json.dumps(payload2, ensure_ascii=False)[:500]}")
        return None


if __name__ == "__main__":
    import sys

    city = sys.argv[1] if len(sys.argv) > 1 else "101010100"
    query = sys.argv[2] if len(sys.argv) > 2 else "python"

    print("=" * 60)
    print(f"Boss直聘 — iv8 (C++ V8 + 浏览器API) 方案")
    print("=" * 60)
    result = search_jobs(city, query)
    if result:
        print(f"\n共 {len(result)} 个结果")
