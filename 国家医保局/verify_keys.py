"""
密钥验证脚本 - 用捕获的样本验证密钥是否正确

用法:
  python verify_keys.py          # 用已知明文测试密钥
  python verify_keys.py --brute   # 尝试常见密钥派生方式
"""

import json
import hashlib
import sys
from pathlib import Path
from gmssl import sm3, sm4 as gmssl_sm4, func

HERE = Path(__file__).parent
SAMPLES_FILE = HERE / "config" / "samples.json"
APP_JS = HERE / "config" / "app.js"

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"


def load_samples():
    with open(SAMPLES_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def verify_x_tif_signature(app_code, timestamp, nonce, expected_signature):
    """验证 x-tif-signature 算法"""
    candidates = [
        ("SHA256(appCode+ts+nonce)", hashlib.sha256(f"{app_code}{timestamp}{nonce}".encode()).hexdigest()),
        ("SHA256(ts+nonce+appCode)", hashlib.sha256(f"{timestamp}{nonce}{app_code}".encode()).hexdigest()),
        ("SHA256(appCode+nonce+ts)", hashlib.sha256(f"{app_code}{nonce}{timestamp}".encode()).hexdigest()),
        ("SHA256(nonce+ts+appCode)", hashlib.sha256(f"{nonce}{timestamp}{app_code}".encode()).hexdigest()),
        ("SM3(appCode+ts+nonce)", sm3.sm3_hash(func.bytes_to_list(f"{app_code}{timestamp}{nonce}".encode()))),
        ("SM3(ts+nonce+appCode)", sm3.sm3_hash(func.bytes_to_list(f"{timestamp}{nonce}{app_code}".encode()))),
    ]

    for name, result in candidates:
        if result == expected_signature:
            print(f"  ✓ {name}")
            return name

    return None


def test_sm4_key(key_hex, enc_data_hex):
    """测试 SM4 密钥"""
    try:
        key = bytes.fromhex(key_hex)
        data = bytes.fromhex(enc_data_hex)

        crypt = gmssl_sm4.CryptSM4()
        crypt.set_key(key, gmssl_sm4.SM4_DECRYPT)
        plaintext = crypt.crypt_cbc(b'\x00' * 16, data)

        # 移除 PKCS7 padding
        pad_len = plaintext[-1]
        if 0 < pad_len <= 16:
            plaintext = plaintext[:-pad_len]

        text = plaintext.decode('utf-8', errors='ignore')
        if text and len(text) > 5 and text[0] in '{[':
            return True, text
        return False, text
    except Exception as e:
        return False, str(e)[:50]


def generate_key_candidates():
    """生成密钥候选"""
    candidates = []

    # 1. SM3 of appcode
    h = sm3.sm3_hash(func.bytes_to_list(APP_CODE.encode()))
    candidates.append(("SM3(appCode)", h[:32]))

    # 2. MD5
    md5 = hashlib.md5(APP_CODE.encode()).hexdigest()
    candidates.append(("MD5(appCode)", md5))

    # 3. SHA256 first 16 bytes
    sha = hashlib.sha256(APP_CODE.encode()).hexdigest()[:32]
    candidates.append(("SHA256(appCode)[:16]", sha))

    # 4. Direct truncation
    candidates.append(("appCode[:16]", APP_CODE[:16].ljust(16, '0').encode().hex()))

    # 5. SM3(nhsa + appCode)
    h2 = sm3.sm3_hash(func.bytes_to_list(f"nhsa{APP_CODE}".encode()))
    candidates.append(("SM3(nhsa+appCode)[:16]", h2[:32]))

    # 6. Common used fixed keys
    candidates.append(("zeros", "00" * 16))
    candidates.append(("nhsa_fixed_1", "6E68736131323334353637383930313233"))

    # 7. SM3 of "fuwu.nhsa.gov.cn"
    h3 = sm3.sm3_hash(func.bytes_to_list("fuwu.nhsa.gov.cn".encode()))
    candidates.append(("SM3(fuwu.nhsa.gov.cn)[:16]", h3[:32]))

    return candidates


def main():
    samples = load_samples()
    print("=" * 60)
    print("  国家医保局 密钥验证")
    print("=" * 60)

    # 1. 验证 x-tif-signature 算法
    print("\n[1] 验证 x-tif-signature 算法:")
    for req in samples["requests"]:
        print(f"\n  Request: ts={req['timestamp']}, nonce={req['nonce']}")
        algo = verify_x_tif_signature(APP_CODE, str(req['timestamp']), req['nonce'], req['x_tif_signature'])
        if algo:
            print(f"  → 算法匹配!")
        else:
            print(f"  → 未匹配 (需包含 body 或其他参数)")

    # 2. 验证 SM4 密钥
    print("\n[2] 测试 SM4 密钥候选:")
    enc_data = samples["requests"][0]["encData"]
    print(f"  encData: {enc_data[:40]}...")

    candidates = generate_key_candidates()
    found = False
    for name, key in candidates:
        success, result = test_sm4_key(key, enc_data)
        if success:
            print(f"  ✓ {name}: {key}")
            print(f"    解密结果: {result[:100]}")
            found = True

    if not found:
        print(f"  ✗ 未找到匹配的密钥 (共测试 {len(candidates)} 个候选)")
        print(f"  → 密钥需要从浏览器中手动提取")
        print(f"  → 方法: 运行 extract_from_browser.py 脚本")

    print("\n" + "=" * 60)
    print("验证完成")


if __name__ == "__main__":
    main()
