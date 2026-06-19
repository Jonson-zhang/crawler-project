"""

合肥滨湖国际会展中心 — 展会信息获取

逆向:
  网站: https://www.hfhuizhan.com/schedule
  加密: AES-128-CBC, key=$shanghaidianqi$, iv=2023050814260000, PKCS7

"""

import json
import requests
from crypto_utils import encrypt as encrypt_data, decrypt as decrypt_data


# === 修改下面这个月份即可获取对应数据 ===

MONTH = "2026-01"
API_URL = "https://www.hfhuizhan.com/prod-api/hfhz-exhibition/back/exhibition/listExhibitionNotPage"

HEADERS = {
    "Content-Type": "application/json;charset=UTF-8",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.hfhuizhan.com/schedule",
}


def fetch_exhibitions(year_month: str) -> dict:
    encrypted = encrypt_data(json.dumps({"yyyyMM": year_month}))
    body = json.dumps({"data": encrypted}, ensure_ascii=False)
    resp = requests.post(API_URL, data=body, headers=HEADERS, timeout=30)

    # API returns raw encrypted base64 text, decrypt → JSON
    return json.loads(decrypt_data(resp.text.strip()))


if __name__ == "__main__":
    result = fetch_exhibitions(MONTH)
    print(f"月份: {MONTH}  共 {len(result.get('data', []))} 场展会")
    print(json.dumps(result, ensure_ascii=False, indent=2))
