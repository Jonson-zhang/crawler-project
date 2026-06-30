"""
国家医保局 — 最终纯协议客户端
================================

已破解:
  ✅ x-tif-signature = SHA256(timestamp + nonce + timestamp)
  ✅ SM4 key = "C3AE5873D08418DA" (CBC/IV=0/PKCS7)
  ✅ SM2 key = FIELD_D base64 → hex (32 bytes)
  ✅ selectByKeys 不需要验证 x-tif-sig (随机值可过)

阻塞:
  ❌ acw_tc cookie: 阿里云WAF JS Challenge，需浏览器执行JS获取
  ❌ queryFixedHospital 需要 acw_tc (无cookie返回173370)

方案:
  A. CDP Bridge (立即可用): python cdp_bridge.py "关键词"
  B. 纯协议 + CDP获取cookie: 浏览器取acw_tc → 本脚本发送请求
  C. 纯协议 + acw_tc破解: 逆向acw_tc生成JS

用法:
  python nhsa_final.py "医院"
  --cookie "acw_tc=xxx"   # 从CDP浏览器获取的cookie
"""

import hashlib
import time
import json
import random
import string
import base64
import sys
import argparse
from gmssl.sm4 import CryptSM4, SM4_ENCRYPT, SM4_DECRYPT

try:
    import requests
except ImportError:
    requests = None

# === 常量 ===
APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
VERSION = "1.0.0"
SM4_KEY_ASCII = "C3AE5873D08418DA"
SM4_KEY_HEX = SM4_KEY_ASCII.encode().hex()

# SM2 私钥: FIELD_D base64 → hex (前32字节)
FIELD_D_B64 = "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC"
FIELD_D_BYTES = base64.b64decode(FIELD_D_B64)
SM2_KEY_HEX = FIELD_D_BYTES[:32].hex()

API_BASE = "https://fuwu.nhsa.gov.cn"
QUERY_URL = f"{API_BASE}/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"
SELECT_KEYS_URL = f"{API_BASE}/ebus/fuwu/api/pss/pw/sysDict/selectByKeys"


def gen_nonce(n=8):
    chars = string.ascii_letters + string.digits
    return "".join(random.choice(chars) for _ in range(n))


def x_tif_signature(ts, nonce):
    return hashlib.sha256(f"{ts}{nonce}{ts}".encode()).hexdigest()


def sm4_encrypt(plaintext: str) -> str:
    crypt = CryptSM4()
    crypt.set_key(bytes.fromhex(SM4_KEY_HEX), SM4_ENCRYPT)
    data = plaintext.encode("utf-8")
    pad = 16 - len(data) % 16
    padded = data + bytes([pad] * pad)
    result = b""
    prev = bytes(16)
    for i in range(0, len(padded), 16):
        block = bytes(a ^ b for a, b in zip(padded[i:i + 16], prev))
        result += crypt.crypt_ecb(block)
        prev = block
    return result.hex().upper()


def sm2_sign_node(message: str) -> str:
    import subprocess
    js = f"""const sm2=require('sm-crypto').sm2;
console.log(sm2.doSignature({json.dumps(message)},
'{SM2_KEY_HEX}',{{hash:true,der:false}}));"""
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=".")
    if r.returncode != 0:
        raise RuntimeError(f"SM2 error: {r.stderr}")
    return r.stdout.strip()


def build_request(params: dict) -> dict:
    ts = int(time.time())
    nonce = gen_nonce()
    plain_json = json.dumps(params, ensure_ascii=False)
    enc_data = sm4_encrypt(plain_json)

    inner = {
        "data": {"encData": enc_data},
        "appCode": APP_CODE, "version": VERSION,
        "encType": "SM4", "signType": "SM2", "timestamp": ts,
    }
    inner_json = json.dumps(inner, ensure_ascii=False)
    sign_data = sm2_sign_node(inner_json)

    body = {
        "data": {
            "data": {"encData": enc_data},
            "appCode": APP_CODE, "version": VERSION,
            "encType": "SM4", "signType": "SM2",
            "timestamp": ts, "signData": sign_data,
        }
    }

    return {
        "headers": {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "channel": "web",
            "x-tif-paasid": "undefined",
            "x-tif-signature": x_tif_signature(ts, nonce),
            "x-tif-timestamp": str(ts),
            "x-tif-nonce": nonce,
        },
        "body": body,
        "body_json": json.dumps(body, ensure_ascii=False, separators=(",", ":")),
    }


def search(keyword="", page=1, size=10, cookie=None):
    if not requests:
        raise RuntimeError("pip install requests")

    s = requests.Session()
    s.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    if cookie:
        s.headers["Cookie"] = cookie

    encrypted = build_request({"keyword": keyword, "pageNum": page, "pageSize": size})

    print(f"[Nhsa] ts={encrypted['headers']['x-tif-timestamp']} nonce={encrypted['headers']['x-tif-nonce']}", file=sys.stderr)
    print(f"[Nhsa] x-tif-sig={encrypted['headers']['x-tif-signature'][:16]}...", file=sys.stderr)
    print(f"[Nhsa] encData={encrypted['body']['data']['data']['encData'][:32]}...", file=sys.stderr)

    resp = s.post(QUERY_URL, headers=encrypted["headers"],
                  data=encrypted["body_json"], timeout=30)

    result = resp.json()
    code = result.get("code", -1)
    msg = result.get("message", "")
    print(f"[Nhsa] Response: code={code} msg={msg}", file=sys.stderr)

    if code == 0:
        enc = result.get("data", {}).get("data", {}).get("encData", "")
        if enc:
            crypt = CryptSM4()
            crypt.set_key(bytes.fromhex(SM4_KEY_HEX), SM4_DECRYPT)
            data = bytes.fromhex(enc)
            prev = bytes(16)
            dec = b""
            for i in range(0, len(data), 16):
                block = data[i:i + 16]
                dec_block = crypt.crypt_ecb(block)
                dec += bytes(a ^ b for a, b in zip(dec_block, prev))
                prev = block
            pad = dec[-1]
            if 1 <= pad <= 16:
                dec = dec[:-pad]
            result["_decrypted"] = json.loads(dec.decode("utf-8", errors="replace"))
            print(f"[Nhsa] Decrypted successfully", file=sys.stderr)

    return result


def main():
    parser = argparse.ArgumentParser(description="国家医保局 医疗机构查询 (纯协议)")
    parser.add_argument("keyword", nargs="?", default="北京协和医院")
    parser.add_argument("--page", "-p", type=int, default=1)
    parser.add_argument("--size", "-s", type=int, default=10)
    parser.add_argument("--cookie", "-c", help="acw_tc cookie值 (从浏览器获取)")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    result = search(args.keyword, args.page, args.size, args.cookie)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if result.get("code") != 0:
        print(f"\nAPI 错误: code={result.get('code')}, {result.get('message')}")
        return

    dec = result.get("_decrypted")
    if dec:
        print(f"\n查询成功! 共 {dec.get('total', 0)} 条")
        for item in dec.get("list", [])[:5]:
            print(f"  {item.get('medName', '')} "
                  f"({item.get('medTypeName', '')}, {item.get('medLevelName', '')})")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2)[:2000])


if __name__ == "__main__":
    main()
