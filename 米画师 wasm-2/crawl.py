"""
米画师 (mihuashi.com) 爬虫 — 使用 WASM 签名绕过反爬
用法: python crawl.py [max_pages]
"""

import sys
import time
import requests
from sign import sign

BASE_URL = "https://www.mihuashi.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.5",
    "web-version": "frontend",
    "referer": BASE_URL + "/",
}
PER_PAGE = 20


def signed_get(url: str) -> dict:
    """发送带签名的 GET 请求"""
    ts = int(time.time())
    sig = sign(url, ts)
    h = HEADERS.copy()
    h["m-s"] = sig
    h["m-t"] = str(ts)
    resp = requests.get(url, headers=h, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"API error: {data}")
    return data


def crawl_artists(max_pages: int = 3):
    """爬取画师列表"""
    print("=" * 50)
    print("米画师 — 画师列表")
    print("=" * 50)
    total = 0
    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/api/v1/artists?page={page}&per_page={PER_PAGE}"
        try:
            data = signed_get(url)
            artists = data.get("artists", [])
            for a in artists:
                total += 1
                skills = ", ".join(a.get("skills", [])[:3]) if a.get("skills") else ""
                print(f"  #{total:3d}  [{a.get('role', '?')}] {a.get('name', '?')}  {skills}")
            if page >= data.get("total_pages", 0):
                print(f"\n  [已到最后一页，共 {data['total_pages']} 页]")
                break
        except Exception as e:
            print(f"  [页 {page} 出错: {e}]")
            break
    print(f"\n共获取 {total} 位画师")


def main():
    max_pages = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    print(f"每页 {PER_PAGE} 条，最多 {max_pages} 页\n")

    # 测试签名是否正常
    try:
        data = signed_get(f"{BASE_URL}/api/v1/configure/vacation")
        print(f"[INFO] 签名验证通过, vacation={data.get('vacation')}\n")
    except Exception as e:
        print(f"[FATAL] 签名失败: {e}")
        sys.exit(1)

    crawl_artists(max_pages)


if __name__ == "__main__":
    main()
