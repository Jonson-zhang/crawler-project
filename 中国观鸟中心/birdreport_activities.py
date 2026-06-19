"""
中国观鸟中心 - 观鸟活动数据采集
API: POST https://api.birdreport.cn/front/activity/search
"""

import time
import uuid
import json
import requests

from birdreport_crypto import sort_ascii, rsa_encrypt_long, aes_decrypt, build_sign

API_URL = "https://api.birdreport.cn/front/activity/search"


def search_activities(page: int, limit: int = 20) -> list:
    """查询观鸟活动数据，返回记录列表"""
    # 1. 构建 payload
    params = {"limit": str(limit), "page": str(page)}
    sorted_params = sort_ascii(params)
    json_data = json.dumps(sorted_params, separators=(",", ":"))

    # 2. 生成请求参数
    timestamp = int(time.time() * 1000)
    request_id = uuid.uuid4().hex
    sign = build_sign(json_data, request_id, timestamp)

    # 3. RSA 加密 payload
    encrypted_data = rsa_encrypt_long(json_data)

    # 4. 发送请求
    headers = {
        "timestamp": str(timestamp),
        "requestId": request_id,
        "sign": sign,
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "accept": "application/json, text/javascript, */*; q=0.01",
        "referer": "https://www.birdreport.cn/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    }

    resp = requests.post(API_URL, data=encrypted_data, headers=headers, timeout=30)
    resp.raise_for_status()
    result = resp.json()

    if result.get("code") != 0:
        raise Exception(f"API 返回错误: {result}")

    # 5. AES 解密响应
    decrypted = aes_decrypt(result["data"])
    data = json.loads(decrypted)
    if isinstance(data, list):
        return data
    return data.get("records", [])


def main():
    for page in range(1, 5):  # 获取多少页数据（每页20条）
        print(f"\n{'=' * 80}")
        print(f"  观鸟活动数据 - 第 {page} 页")
        print(f"{'=' * 80}\n")

        records = search_activities(page)

        for i, item in enumerate(records, 1):
            global_idx = (page - 1) * 20 + i
            print(f"  {global_idx:3d}. {item.get('pointName', 'N/A')}")
            print(f"       地点: {item.get('address', 'N/A')}")
            print(
                f"       时间: {item.get('startTime', 'N/A')} ~ {item.get('endTime', 'N/A')}"
            )
            print(f"       用户: {item.get('username', 'N/A')}")
            print(f"       物种数: {item.get('taxonCount', 'N/A')}")
            print()

        if page < 2:
            time.sleep(1)


if __name__ == "__main__":
    main()
