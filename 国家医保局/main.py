"""
国家医保局 - 医疗机构信息查询
=============================

API: POST https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital

加密方案:
  - 请求体: SM4-CBC 加密 + SM2 签名
  - 响应体: SM4-CBC 加密
  - 请求头: x-tif-signature (SHA-256) + x-tif-nonce + x-tif-timestamp

依赖:
  - gmssl (SM2/SM3/SM4 国密算法)
  - requests (HTTP 客户端)

用法:
  python main.py                        # 默认查询 "北京协和医院"
  python main.py "北京大学第一医院"       # 指定关键词
  python main.py --page 2 北京           # 指定页码

密钥配置:
  首次运行前需要获取加密密钥。有两种方式:
  1. 运行 key_extract.py 自动分析
  2. 手动配置 config/keys.json
"""

import sys
import json
import os
import argparse
import requests
from pathlib import Path

from utils.sm_crypto import SM4Cipher
from utils.signer import (
    build_request_body,
    build_request_headers,
    generate_nonce,
    generate_timestamp,
)

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

HERE = Path(__file__).parent
CONFIG_DIR = HERE / "config"
KEYS_FILE = CONFIG_DIR / "keys.json"
KEYS_EXAMPLE = CONFIG_DIR / "keys.example.json"

API_URL = "https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"

# 默认配置 (从浏览器抓包提取)
DEFAULT_CONFIG = {
    "appCode": "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ",
    "version": "1.0.0",
    "encType": "SM4",
    "signType": "SM2",
}

# SM4 密钥: 从浏览器提取的 16 字节 hex 字符串
# 获取方式: 见 README.md
SM4_KEY_HEX = None  # 需要配置
SM4_IV_HEX = "00000000000000000000000000000000"  # 全零 IV (CBC 模式)


def load_config():
    """加载配置"""
    config = dict(DEFAULT_CONFIG)

    if KEYS_FILE.exists():
        with open(KEYS_FILE, 'r', encoding='utf-8') as f:
            user_config = json.load(f)
            config.update(user_config)

    # 覆盖全局密钥
    global SM4_KEY_HEX
    if "sm4_key" in config:
        SM4_KEY_HEX = config["sm4_key"]

    return config


def search_medical(keyword: str = "", page_num: int = 1, page_size: int = 10,
                   **filters) -> dict:
    """
    查询定点医疗机构

    Args:
        keyword: 医疗机构名称关键词
        page_num: 页码 (从 1 开始)
        page_size: 每页条数
        **filters: 其他筛选条件 (如 medType, addr 等)

    Returns:
        API 响应 dict
    """
    config = load_config()

    if not SM4_KEY_HEX:
        raise RuntimeError(
            "SM4 密钥未配置！\n"
            f"请将密钥写入 {KEYS_FILE}\n"
            f"参考模板: {KEYS_EXAMPLE}"
        )

    # 1. 初始化 SM4 加密器
    sm4_key = bytes.fromhex(SM4_KEY_HEX)
    sm4_iv = bytes.fromhex(SM4_IV_HEX)
    sm4_cipher = SM4Cipher(sm4_key, sm4_iv)

    # 2. 构造查询参数
    query_params = {
        "keyword": keyword,
        "pageNum": page_num,
        "pageSize": page_size,
    }
    query_params.update(filters)

    # 3. 构造加密请求体
    body = build_request_body(
        plaintext=query_params,
        app_code=config["appCode"],
        version=config["version"],
        sm4_cipher=sm4_cipher,
        # sm2_signer 暂不配置 (SM2 key 需要额外提取)
    )
    body_json = json.dumps(body, ensure_ascii=False, separators=(',', ':'))

    # 4. 构造请求头
    headers = build_request_headers(
        app_code=config["appCode"],
        body_json=body_json,
    )

    # 5. 发送请求
    print(f"[请求] {API_URL}")
    print(f"[参数] keyword={keyword}, page={page_num}, size={page_size}")
    print(f"[Nonce] {headers['x-tif-nonce']}")
    print(f"[Timestamp] {headers['x-tif-timestamp']}")
    print(f"[Signature] {headers['x-tif-signature'][:16]}...")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0",
    })

    resp = session.post(API_URL, headers=headers, data=body_json, timeout=30)

    print(f"[响应] HTTP {resp.status_code}")

    # 6. 解密响应
    if resp.status_code == 200:
        result = resp.json()

        if result.get("code") == 0:
            # SM4 解密响应数据
            enc_data = result["data"]["data"]["encData"]
            decrypted = sm4_cipher.decrypt_hex(enc_data)
            result["data"]["data"]["decrypted"] = json.loads(decrypted.decode('utf-8'))

            # 提取医疗机构列表
            decrypted_data = result["data"]["data"]["decrypted"]
            if "list" in decrypted_data:
                print(f"[数据] 获取到 {len(decrypted_data['list'])} 条记录")
                if "total" in decrypted_data:
                    print(f"[总计] {decrypted_data['total']} 条")

        return result
    else:
        print(f"[错误] {resp.text[:200]}")
        return {"code": -1, "message": f"HTTP {resp.status_code}"}


def format_results(result: dict, verbose: bool = False):
    """格式化输出结果"""
    if result.get("code") != 0:
        print(f"❌ 查询失败: {result.get('message', 'Unknown error')}")
        return

    data = result.get("data", {}).get("data", {})
    decrypted = data.get("decrypted", {})

    if verbose:
        print(json.dumps(decrypted, ensure_ascii=False, indent=2))
        return

    # 表格输出
    records = decrypted.get("list", decrypted.get("records", []))
    total = decrypted.get("total", len(records))

    print(f"\n{'='*80}")
    print(f"  定点医疗机构查询结果 (共 {total} 条)")
    print(f"{'='*80}")
    print(f"{'序号':<6}{'机构名称':<30}{'机构类型':<16}{'等级':<8}{'地址':<30}")
    print(f"{'-'*80}")

    for i, item in enumerate(records):
        name = str(item.get('medName', item.get('name', '')))[:28]
        mtype = str(item.get('medTypeName', item.get('typeName', '')))[:14]
        level = str(item.get('medLevelName', item.get('levelName', '')))[:6]
        addr = str(item.get('addr', item.get('address', '')))[:28]
        print(f"{item.get('seq', i+1):<6}{name:<30}{mtype:<16}{level:<8}{addr:<30}")

    print(f"{'='*80}")


def main():
    parser = argparse.ArgumentParser(description="国家医保局 - 医疗机构信息查询")
    parser.add_argument("keyword", nargs="?", default="北京协和医院",
                        help="医疗机构名称关键词")
    parser.add_argument("--page", "-p", type=int, default=1, help="页码")
    parser.add_argument("--size", "-s", type=int, default=10, help="每页条数")
    parser.add_argument("--verbose", "-v", action="store_true", help="详细输出")
    parser.add_argument("--check-config", action="store_true", help="检查配置")

    args = parser.parse_args()

    if args.check_config:
        config = load_config()
        print("当前配置:")
        print(json.dumps(config, ensure_ascii=False, indent=2))
        return

    try:
        result = search_medical(
            keyword=args.keyword,
            page_num=args.page,
            page_size=args.size,
        )
        format_results(result, verbose=args.verbose)
    except RuntimeError as e:
        print(f"\n⚠️  {e}\n")
        print("请先配置密钥。运行以下命令获取帮助:")
        print("  python key_extract.py")
    except requests.exceptions.RequestException as e:
        print(f"❌ 网络错误: {e}")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
