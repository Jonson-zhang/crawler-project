"""
从万达影城获取热映电影数据
API: GET https://www.wandacinemas.com/api/proxy/content/pc/movie/hot_show.api
"""

import time
import hashlib
import json
import requests

# ====== 常量 ======
CLIENT_KEY = "B3AA12B0145E1982F282BEDD8A3305B89A9811280C0B8CC3A6A60D81022E4903"
SALE_SUBJECT_CODE = "Wanda"
C_CODE = "1_3"
APP_ID = "3"
VER = "v1.0.0"

API_BASE_URL = "https://www.wandacinemas.com/api/proxy/content"
API_PATH = "/pc/movie/hot_show.api"


def generate_signature(timestamp: int, path: str, query_string: str) -> str:
    """
    生成 mx-api 的 check 字段（MD5 签名）

    对应 JS 中的 generateSignature(t, e, i):
      n = saleSubjectCode + cCode + clientKey + timestamp
      GET: n += path, i && (n += "?" + i)
      return hexMD5(n)
    """
    n = SALE_SUBJECT_CODE + C_CODE + CLIENT_KEY + str(timestamp)
    n += path
    if query_string:
        n += "?" + query_string
    return hashlib.md5(n.encode("utf-8")).hexdigest()


def build_mx_api_header(timestamp: int) -> str:
    """构建 mx-api 请求头"""
    query_string = f"tt={timestamp}"
    check = generate_signature(timestamp, API_PATH, query_string)

    header_obj = {
        "ver": VER,
        "sCode": SALE_SUBJECT_CODE,
        "_mi_": "",
        "width": 1280,
        "json": True,
        "cCode": C_CODE,
        "check": check,
        "ts": timestamp,
        "heigth": 720,
        "appId": APP_ID,
    }
    return json.dumps(header_obj)


def get_hot_movies():
    """获取热映电影列表"""
    timestamp = int(time.time() * 1000)
    url = f"{API_BASE_URL}{API_PATH}?tt={timestamp}"
    mx_api = build_mx_api_header(timestamp)

    headers = {
        "mx-api": mx_api,
        "accept": "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
        "referer": "https://www.wandacinemas.com/MovieList",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    }

    print(f"[*] 请求 URL: {url}")
    print(f"[*] mx-api: {mx_api}")

    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main():
    data = get_hot_movies()

    if data.get("code") != 0:
        print(f"[!] API 返回错误: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return

    hot_movies = data["data"]["hotMovie"]
    print(f"\n{'='*80}")
    print(f"  万达影城热映电影 ({len(hot_movies)} 部)")
    print(f"{'='*80}\n")

    for i, movie in enumerate(hot_movies, 1):
        print(f"  {i:2d}. {movie['nameCN']}")
        if movie.get("nameEN"):
            print(f"      英文名: {movie['nameEN']}")
        print(f"      类型: {movie.get('genreIds', 'N/A')}")
        print(f"      时长: {movie.get('duration', 'N/A')} 分钟")
        print(f"      制式: {movie.get('editionIds', 'N/A')}")
        print(f"      国家: {movie.get('productionCountry', 'N/A')}")
        print(f"      上映日期: {movie.get('releaseDateStr', 'N/A')}")
        if movie.get("shortComment"):
            print(f"      简介: {movie['shortComment']}")
        print()

    print(f"{'='*80}")

    # ====== 验证: 用一次固定时间戳验证签名正确性 ======
    print("\n[*] 签名验证 (用真实请求的值回测):")
    test_ts = 1781531754552
    test_query = f"tt={test_ts}"
    test_check = generate_signature(test_ts, API_PATH, test_query)
    expected_check = "987b83b4f836fc066f6167a0bfb97539"
    print(f"    时间戳: {test_ts}")
    print(f"    签名字符串: {SALE_SUBJECT_CODE}{C_CODE}{CLIENT_KEY}{test_ts}{API_PATH}?{test_query}")
    print(f"    计算 check: {test_check}")
    print(f"    期望 check: {expected_check}")
    print(f"    匹配: {'PASS' if test_check == expected_check else 'FAIL'}")


if __name__ == "__main__":
    main()
