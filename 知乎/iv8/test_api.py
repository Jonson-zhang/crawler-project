"""验证 iv8 知乎签名是否通过 API"""
import json, sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from zhihu_sign import ZhihuSigner
import requests

# 1. 获取 d_c0（首次访问知乎自动下发）
s = requests.Session()
s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"})
r = s.get("https://www.zhihu.com/", timeout=10)
d_c0 = s.cookies.get("d_c0", "")
print(f"d_c0: {d_c0[:20] if d_c0 else '(未获取到)'}...")

# 2. iv8 签名
signer = ZhihuSigner()
try:
    url = "/api/v3/feed/topstory/recommend?action=down&ad_interval=-10&desktop=true&page_number=1"
    sig = signer.sign(url, d_c0)
    print(f"x-zse-96: {sig['x-zse-96'][:50]}...")
    print(f"x-zst-81: {sig['x-zst-81'][:50]}...")

    # 3. 调用 API
    s.headers["x-zse-96"] = sig["x-zse-96"]
    s.headers["x-zst-81"] = sig["x-zst-81"]
    s.headers["x-api-version"] = "3.0.53"
    s.headers["x-requested-with"] = "fetch"

    r2 = s.get(f"https://www.zhihu.com{url}", timeout=15)
    data = r2.json()

    print(f"\nAPI status: {r2.status_code}")
    print(f"数据条数: {len(data.get('data', []))}")
    if data.get("data"):
        for i, item in enumerate(data["data"][:5], 1):
            t = item.get("target", {})
            q = t.get("question", {})
            title = q.get("title") or t.get("title", "?")
            print(f"  {i}. {title}")
finally:
    signer.close()
