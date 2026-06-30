"""
国家医保局 — 纯协议 Python 客户端
================================

SM4 密钥: C3AE5873D08418DA (16字节ASCII)
SM2 密钥: FIELD_D base64解码 → hex (前32字节)
x-tif-signature: 不需要验证（随机字符串即可）

用法:
  python nhsa_pure.py "北京协和医院"
  python nhsa_pure.py "医院" --page 1 --size 5
"""

import json
import sys
import time
import random
import string
import hashlib
import requests
import argparse
import base64
from pathlib import Path

HERE = Path(__file__).parent

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
VERSION = "1.0.0"
SM4_KEY_ASCII = "C3AE5873D08418DA"

# SM4 key: ASCII bytes → hex for gmssl
SM4_KEY_HEX = SM4_KEY_ASCII.encode("ascii").hex()

# SM2 key: FIELD_D base64 → 前32字节
FIELD_D_B64 = "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC"
FIELD_D_BYTES = base64.b64decode(FIELD_D_B64)  # 33 bytes
SM2_KEY_HEX = FIELD_D_BYTES[:32].hex()  # 64 hex chars (前32字节)

# APIs
PAGE_URL = "https://fuwu.nhsa.gov.cn/nationalHallSt/#/search/medical"
SELECT_KEYS_URL = "https://fuwu.nhsa.gov.cn/ebus/fuwu/api/pss/pw/sysDict/selectByKeys"
QUERY_HOSPITAL_URL = "https://fuwu.nhsa.gov.cn/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"


def gen_nonce(n=8):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(n))


def sm4_encrypt(plaintext: str) -> str:
    """SM4-CBC encrypt, IV=0, PKCS7 padding"""
    from gmssl.sm4 import CryptSM4, SM4_ENCRYPT

    crypt = CryptSM4()
    crypt.set_key(bytes.fromhex(SM4_KEY_HEX), SM4_ENCRYPT)

    data = plaintext.encode("utf-8")
    pad_len = 16 - len(data) % 16
    padded = data + bytes([pad_len] * pad_len)

    result = b""
    prev = bytes(16)  # IV = 0
    for i in range(0, len(padded), 16):
        block = bytes(a ^ b for a, b in zip(padded[i:i + 16], prev))
        enc = crypt.crypt_ecb(block)
        result += enc
        prev = enc
    return result.hex().upper()


def sm4_decrypt(hex_data: str) -> str:
    """SM4-CBC decrypt, IV=0, remove PKCS7 padding"""
    from gmssl.sm4 import CryptSM4, SM4_DECRYPT

    crypt = CryptSM4()
    crypt.set_key(bytes.fromhex(SM4_KEY_HEX), SM4_DECRYPT)

    data = bytes.fromhex(hex_data)
    result = b""
    prev = bytes(16)
    for i in range(0, len(data), 16):
        block = data[i:i + 16]
        dec = crypt.crypt_ecb(block)
        result += bytes(a ^ b for a, b in zip(dec, prev))
        prev = block

    # Remove PKCS7 padding
    pad = result[-1]
    if 1 <= pad <= 16:
        result = result[:-pad]
    return result.decode("utf-8", errors="replace")


def sm2_sign(message: str) -> str:
    """SM2签名: 使用 FIELD_D 前32字节作为私钥"""
    from gmssl.sm2 import CryptSM2
    import binascii

    # FIELD_D bytes → hex for gmssl
    priv_key = FIELD_D_BYTES[:32].hex()
    pub_key = "04" + "00" * 64  # dummy public key (gmssl needs it but gmssl validates)

    # Use the internal SM2 from app.js format
    # gmssl might not be compatible — fallback to sm-crypto via subprocess
    pass


def sm2_sign_node(message: str) -> str:
    """SM2签名: 通过 sm-crypto (npm) 计算"""
    import subprocess

    js_code = f"""
    const sm2 = require('sm-crypto').sm2;
    const msg = {json.dumps(message)};
    const key = '{SM2_KEY_HEX}';
    const sig = sm2.doSignature(msg, key, {{hash: true}});
    console.log(sig);
    """
    r = subprocess.run(
        ["node", "-e", js_code],
        capture_output=True, text=True, cwd=str(HERE), timeout=10,
    )
    if r.returncode != 0:
        raise RuntimeError(f"SM2 sign error: {r.stderr}")
    return r.stdout.strip()


def build_request(params: dict) -> dict:
    """构建加密请求 (SM4 + SM2)"""
    ts = int(time.time())
    nonce = gen_nonce()
    plain_json = json.dumps(params, ensure_ascii=False)

    # SM4 加密
    enc_data = sm4_encrypt(plain_json)

    # 内部对象
    inner = {
        "data": {"encData": enc_data},
        "appCode": APP_CODE,
        "version": VERSION,
        "encType": "SM4",
        "signType": "SM2",
        "timestamp": ts,
    }

    # SM2 签名
    sign_data = sm2_sign_node(json.dumps(inner, ensure_ascii=False))

    # 完整body
    body = {
        "data": {
            "data": {"encData": enc_data},
            "appCode": APP_CODE,
            "version": VERSION,
            "encType": "SM4",
            "signType": "SM2",
            "timestamp": ts,
            "signData": sign_data,
        }
    }

    body_json = json.dumps(body, ensure_ascii=False, separators=(",", ":"))

    # x-tif-signature: 随机SHA256（服务端不验证）
    x_tif_sig = hashlib.sha256((APP_CODE + str(ts) + nonce + body_json).encode()).hexdigest()

    return {
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "channel": "web",
            "x-tif-paasid": "undefined",
            "x-tif-signature": x_tif_sig,
            "x-tif-timestamp": str(ts),
            "x-tif-nonce": nonce,
        },
        "body": body,
        "body_json": body_json,
    }


class NhsaClient:
    """国家医保局 API 客户端"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        })

    def _get_page_cookie(self):
        """访问首页获取 acw_tc cookie"""
        try:
            resp = self.session.get(
                "https://fuwu.nhsa.gov.cn/nationalHallSt/",
                timeout=15,
                allow_redirects=True,
            )
            print(f"[Nhsa] Page visit: {resp.status_code}", file=sys.stderr)
            cookies = self.session.cookies.get_dict()
            if "acw_tc" in cookies:
                print(f"[Nhsa] Got acw_tc cookie", file=sys.stderr)
            return cookies
        except Exception as e:
            print(f"[Nhsa] Page visit error: {e}", file=sys.stderr)
            return {}

    def search_medical(self, keyword="", page_num=1, page_size=10):
        """查询医疗机构"""
        # 先获取 cookie（如需要）
        if "acw_tc" not in self.session.cookies.get_dict():
            self._get_page_cookie()

        # 构建加密请求
        params = {"keyword": keyword, "pageNum": page_num, "pageSize": page_size}
        encrypted = build_request(params)

        print(f"[Nhsa] x-tif-sig: {encrypted['headers']['x-tif-signature'][:16]}...", file=sys.stderr)
        print(f"[Nhsa] encData:  {encrypted['body']['data']['data']['encData'][:32]}...", file=sys.stderr)
        print(f"[Nhsa] signData: {encrypted['body']['data']['signData'][:40]}...", file=sys.stderr)

        # 发送请求
        resp = self.session.post(
            QUERY_HOSPITAL_URL,
            headers=encrypted["headers"],
            data=encrypted["body_json"],
            timeout=30,
        )

        result = resp.json()
        print(f"[Nhsa] Response: code={result.get('code')}, msg={result.get('message')}", file=sys.stderr)

        # 解密响应
        if result.get("code") == 0 and result.get("data", {}).get("data", {}).get("encData"):
            enc_data = result["data"]["data"]["encData"]
            try:
                decrypted = sm4_decrypt(enc_data)
                result["_decrypted"] = json.loads(decrypted)
                print(f"[Nhsa] Decrypted successfully", file=sys.stderr)
            except Exception as e:
                print(f"[Nhsa] Decrypt error: {e}", file=sys.stderr)
                result["_decrypted"] = None

        return result

    def close(self):
        self.session.close()


def main():
    parser = argparse.ArgumentParser(description="国家医保局 医疗机构查询 (纯协议)")
    parser.add_argument("keyword", nargs="?", default="北京协和医院")
    parser.add_argument("--page", "-p", type=int, default=1)
    parser.add_argument("--size", "-s", type=int, default=10)
    parser.add_argument("--json", action="store_true", help="JSON output")
    args = parser.parse_args()

    client = NhsaClient()
    try:
        result = client.search_medical(args.keyword, args.page, args.size)

        if args.json:
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if result.get("code") != 0:
            print(f"\nAPI 错误: code={result.get('code')}, message={result.get('message')}")
            return

        print(f"\n查询成功! code={result['code']}")
        decrypted = result.get("_decrypted")
        if decrypted:
            total = decrypted.get("total", 0)
            items = decrypted.get("list", [])
            print(f"共 {total} 条结果，当前显示 {len(items)} 条\n")
            for item in items[:10]:
                print(f"  {item.get('seq', '')}. {item.get('medName', '')} "
                      f"({item.get('medTypeName', '')}, {item.get('medLevelName', '')})")
                addr = item.get("addr", "")
                if addr:
                    print(f"     {addr[:60]}")
        else:
            print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])
    finally:
        client.close()


if __name__ == "__main__":
    main()
