"""
国家医保局 API 密钥提取器
通过分析已保存的 app.js 和网络请求样本来提取 SM4 密钥和 SM2 签名密钥。

由于主 JS 文件 (app.1781684502962.js) 经过 OB 混淆，无法直接静态分析。
采用以下策略：
1. 分析已知的请求/响应样本进行已知明文攻击
2. 尝试常见的密钥派生模式
3. 如需要，使用 Node.js 子进程加载 app.js
"""

import json
import hashlib
import base64
import os
import re
from gmssl import sm4, sm2, sm3, func

SAMPLES_PATH = os.path.join(os.path.dirname(__file__), 'config', 'samples.json')
APP_JS_PATH = os.path.join(os.path.dirname(__file__), 'config', 'app.js')

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
VERSION = "1.0.0"
ENC_TYPE = "SM4"
SIGN_TYPE = "SM2"

# 国家医保局 API 密钥候选列表（常见的密钥派生模式）
# 这些密钥通过以下方式派生：
# 1. appCode 的哈希
# 2. 浏览器中提取的固定值
# 3. SM3(appCode) 的前16字节

SM4_KEY_CANDIDATES = []


def derive_candidate_keys():
    """生成所有可能的 SM4 密钥候选"""
    candidates = []

    # 1. appCode 的各种哈希
    candidates.append(('sm3_appcode', sm3.sm3_hash(func.bytes_to_list(APP_CODE.encode()))[:32]))

    # 2. MD5(appCode)
    md5 = hashlib.md5(APP_CODE.encode()).hexdigest()
    candidates.append(('md5_appcode', md5))

    # 3. SHA256(appCode) 的前32字符
    sha = hashlib.sha256(APP_CODE.encode()).hexdigest()[:32]
    candidates.append(('sha256_appcode_16', sha))

    # 4. appCode 的 base64 编码（可能有不同的编码方式）
    candidates.append(('appcode_direct', APP_CODE[:32].ljust(32, '0')))

    # 5. 常见固定密钥
    candidates.append(('sm4_fixed_1', 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ'[:32]))

    # 6. SM3("nhsa" + appCode)
    candidates.append(('sm3_nhsa_appcode', sm3.sm3_hash(func.bytes_to_list(f"nhsa{APP_CODE}".encode()))[:32]))

    return candidates


def test_sm4_key(key_hex, ciphertext_hex, known_plaintext_prefix=None):
    """
    测试 SM4 密钥是否能正确解密

    Args:
        key_hex: 32字符 hex 密钥
        ciphertext_hex: hex 密文
        known_plaintext_prefix: 已知的明文前缀（如 '{' 表示 JSON）

    Returns:
        (success: bool, plaintext: str or None)
    """
    try:
        key_bytes = bytes.fromhex(key_hex)
        ciphertext_bytes = bytes.fromhex(ciphertext_hex)

        crypt_sm4 = sm4.CryptSM4()
        crypt_sm4.set_key(key_bytes, sm4.SM4_DECRYPT)
        plaintext = crypt_sm4.crypt_cbc(
            iv=b'\x00' * 16,
            data=ciphertext_bytes
        )

        # 尝试解码
        try:
            text = plaintext.decode('utf-8', errors='ignore')
            # 移除 PKCS7 padding
            pad_len = plaintext[-1]
            if 0 < pad_len <= 16:
                text = plaintext[:-pad_len].decode('utf-8', errors='ignore')

            if known_plaintext_prefix and text.startswith(known_plaintext_prefix):
                return True, text
            elif text and len(text) > 10 and text[0] in '{[':
                return True, text
            return False, text
        except:
            return False, None
    except Exception as e:
        return False, str(e)


def extract_app_code_info():
    """从 app.js 中提取 appCode 相关信息"""
    if not os.path.exists(APP_JS_PATH):
        print(f"[!] app.js not found at {APP_JS_PATH}")
        return {}

    with open(APP_JS_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    info = {}

    # 搜索 appCode 相关的配置
    appcode_patterns = [
        r'appCode["\']?\s*[:=]\s*["\']([^"\']{20,})["\']',
        r'appCode:\s*["\']([^"\']{20,})["\']',
        r'["\']appCode["\']\s*:\s*["\']([^"\']{20,})["\']',
    ]

    for pattern in appcode_patterns:
        matches = re.findall(pattern, content)
        if matches:
            info['appCodes_found'] = list(set(matches))

    # 搜索 SM4 密钥相关
    key_keywords = [
        'secretKey', 'aesKey', 'sm4Key', 'encKey', 'privateKey',
        'publicKey', 'keyBytes', '_key', 'cipherKey'
    ]

    for kw in key_keywords:
        # 搜索关键字附近的 hex 字符串
        idx = content.find(kw)
        if idx > 0:
            context = content[max(0, idx - 200):idx + 200]
            hex_strings = re.findall(r'["\']([0-9A-Fa-f]{32,128})["\']', context)
            if hex_strings:
                info[f'{kw}_hex_nearby'] = hex_strings[:5]

    # 搜索可能的 hex 密钥（32、64、128 字符的 hex 字符串）
    all_hex = re.findall(r'["\']([0-9A-Fa-f]{32})["\']', content)
    if all_hex:
        # 过滤掉纯数字和重复字符
        filtered = [h for h in all_hex if len(set(h)) > 3]
        info['hex32_candidates'] = filtered[:20]

    return info


def main():
    print("=" * 60)
    print("  国家医保局 API 密钥提取器")
    print("=" * 60)

    # 1. 加载样本
    if os.path.exists(SAMPLES_PATH):
        with open(SAMPLES_PATH, 'r', encoding='utf-8') as f:
            samples = json.load(f)
        print(f"\n[+] Loaded {len(samples.get('requests', []))} request samples")
    else:
        print(f"[!] No samples file found")
        samples = {}

    # 2. 提取 app.js 中的密钥信息
    print("\n[*] Analyzing app.js for key material...")
    info = extract_app_code_info()
    for key, values in info.items():
        print(f"    {key}: {values}")

    # 3. 生成并测试候选密钥
    print("\n[*] Testing SM4 key candidates...")
    candidates = derive_candidate_keys()

    if samples.get('requests'):
        enc_data = samples['requests'][0]['encData']
        print(f"    Testing against encData: {enc_data[:40]}...")

        for name, key in candidates:
            success, result = test_sm4_key(key, enc_data, '{')
            status = "✓ MATCH" if success else "✗"
            if success:
                print(f"    [{status}] {name}: {key}")
                print(f"        Decrypted: {result[:100]}")
            else:
                pass  # print(f"    [{status}] {name}: {key}")

    # 4. 分析 x-tif-signature 生成算法
    print("\n[*] Analyzing x-tif-signature algorithm...")
    if samples.get('requests'):
        for req in samples['requests']:
            timestamp = str(req['timestamp'])
            nonce = req['nonce']
            signature = req['x_tif_signature']

            # 测试各种组合
            combos = [
                ('appCode+timestamp+nonce', f"{APP_CODE}{timestamp}{nonce}"),
                ('timestamp+nonce+appCode', f"{timestamp}{nonce}{APP_CODE}"),
                ('appCode+nonce+timestamp', f"{APP_CODE}{nonce}{timestamp}"),
                ('nonce+timestamp+appCode', f"{nonce}{timestamp}{APP_CODE}"),
                ('appCode+timestamp', f"{APP_CODE}{timestamp}"),
                ('timestamp+nonce', f"{timestamp}{nonce}"),
            ]

            for desc, combo in combos:
                h = hashlib.sha256(combo.encode()).hexdigest()
                if h == signature:
                    print(f"    ✓ x-tif-signature = SHA256({desc})")
                    print(f"      Test: {desc} -> {h}")

            # Also try SM3
            for desc, combo in combos:
                h = sm3.sm3_hash(func.bytes_to_list(combo.encode()))
                if h == signature:
                    print(f"    ✓ x-tif-signature = SM3({desc})")
                    print(f"      Test: {desc} -> {h}")

    # 5. 输出样本信息用于离线验证
    print("\n[*] Sample data for verify_signer_offline:")
    if samples.get('requests'):
        for req in samples['requests']:
            print(f"    Request: ts={req['timestamp']}, nonce={req['nonce']}")
            print(f"      x-tif-signature: {req['x_tif_signature']}")
            print(f"      signData: {req['signData'][:50]}...")

    print("\n" + "=" * 60)
    print("Key extraction complete. Check the output above.")
    print("If no keys were found, use Node.js bridge approach.")
    print("=" * 60)


if __name__ == '__main__':
    main()
