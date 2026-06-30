"""
SM4 密钥查找 — 已知密文攻击

已知:
- 密文: 4A8E4673BB18D86FE780DACC31C49FE3 (selectByKeys 的 encData)
- 密钥材料: _0x3d8a47 的 a/b/c/d/e 五个字段
- 算法: SM4-CBC, IV = 00000000000000000000000000000000

策略: 尝试各种密钥候选，用小明文加密匹配密文
"""

import base64
import hashlib
from gmssl.sm4 import CryptSM4, SM4_ENCRYPT, SM4_DECRYPT

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
TARGET_ENC = bytes.fromhex("4A8E4673BB18D86FE780DACC31C49FE3")

# _0x3d8a47 decoded values (from PROGRESS.md and decode_key.py)
FIELD_A = "NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P"  # 32 chars
FIELD_C = base64.b64decode("BOPWXm5BZFVhVHZYc2hxbVh5YnB6ZUZ0U2twYkd2ZVRBb1RxWmhhc0ZwdUN1eURBZ2tOeUtjMnFRPT0=")  # SM2 key (65 bytes)

# FIELD_D: "33 bytes" base64 from _0x3d8a47['d']
# From PROGRESS.md, in find_key.js: 'AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC'
FIELD_D_B64 = "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC"
FIELD_E = APP_CODE  # appCode

def sm4_encrypt(key_bytes, plaintext_bytes):
    """SM4-CBC encrypt, IV=0, PKCS7 padding"""
    crypt = CryptSM4()
    crypt.set_key(key_bytes, SM4_ENCRYPT)

    # PKCS7 padding
    pad_len = 16 - (len(plaintext_bytes) % 16)
    padded = plaintext_bytes + bytes([pad_len] * pad_len)

    # CBC with IV=0
    result = b""
    prev = bytes(16)  # IV = 0
    for i in range(0, len(padded), 16):
        block = bytes(a ^ b for a, b in zip(padded[i:i+16], prev))
        enc = crypt.crypt_ecb(block)
        result += enc
        prev = enc
    return result

def try_key(name, key_hex, plains):
    """Try a key against all candidate plaintexts"""
    key_bytes = bytes.fromhex(key_hex) if len(key_hex) == 32 else key_hex
    for plaintext in plains:
        try:
            pt_bytes = plaintext.encode() if isinstance(plaintext, str) else plaintext
            enc = sm4_encrypt(key_bytes, pt_bytes)
            if enc == TARGET_ENC:
                print(f"MATCH! key={name} plaintext={plaintext!r}")
                print(f"  key_hex={key_bytes.hex()}")
                return True
        except Exception:
            pass
    return False

# ===========================================================
# Key candidates
# ===========================================================

key_candidates = []

# 1. From _0x3d8a47['d'] base64 decode
try:
    d_bytes = base64.b64decode(FIELD_D_B64)
    print(f"FIELD_D decoded: {len(d_bytes)} bytes = {d_bytes.hex()}")
    # Try first 16 bytes
    key_candidates.append(("d[0:16]", d_bytes[:16]))
    key_candidates.append(("d[1:17]", d_bytes[1:17]))
    key_candidates.append(("d[17:33]", d_bytes[17:33]))
except Exception as e:
    print(f"FIELD_D decode error: {e}")

# 2. From _0x3d8a47['a'] (32 chars, ascii → 16 bytes)
key_candidates.append(("a_bytes[:16]", FIELD_A.encode()[:16]))

# 3. From appCode derivations
key_candidates.append(("SM3(appCode)[:16]", bytes.fromhex(
    hashlib.new("sm3", APP_CODE.encode()).hexdigest())[:16] if hasattr(hashlib, 'sm3') else None))
# Use gmssl
from gmssl import sm3
appCode_sm3 = sm3.sm3_hash(APP_CODE.encode())
key_candidates.append(("sm3(appCode)[:16]", bytes.fromhex(appCode_sm3)[:16]))

key_candidates.append(("SHA256(appCode)[:16]", hashlib.sha256(APP_CODE.encode()).digest()[:16]))
key_candidates.append(("MD5(appCode)", hashlib.md5(APP_CODE.encode()).digest()))

# 4. appCode as hex bytes
key_candidates.append(("appCode_hex32", bytes.fromhex(APP_CODE.encode().hex())[:16]))
key_candidates.append(("appCode_ascii16", APP_CODE.encode()[:16]))

# 5. appCode mixed with public key
key_candidates.append(("sm3(appCode+pubkey)[:16]", bytes.fromhex(
    sm3.sm3_hash((APP_CODE + FIELD_A).encode()))[:16]))

# 6. From _0x3d8a47['a'] hex interpretation
# "NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P" could be base32
try:
    import base64 as b64
    a_b32 = b64.b32decode(FIELD_A)
    print(f"FIELD_A base32 decode: {len(a_b32)} bytes = {a_b32.hex()}")
    key_candidates.append(("a_base32[:16]", a_b32[:16]))
except Exception as e:
    print(f"FIELD_A base32 decode error: {e}")

# 7. FIELD_E (appCode) as raw bytes for key
key_candidates.append(("appCode_raw[:16]", APP_CODE.encode('ascii')[:16]))

# ===========================================================
# Plaintext candidates (1-15 bytes for single block CBC)
# ===========================================================
# selectByKeys API likely sends a short JSON or plain string

plains = [
    # Empty/trivial
    "{}", "[]", '""', "", "null",
    # Request patterns from browser capture
    '{"keys":"all"}',
    '{"type":"all"}',
    '{"dictType":""}',
    '{"code":""}',
    # Very common patterns
    '{"data":{}}',
    '{"data":[]}',
    '{"transferFlag":""}',
    # Just numbers
    "0", "1",
    # appCode itself
    APP_CODE,
    # AppCode's first 15 chars
    APP_CODE[:15],
]

# Use sm3 result (16 bytes of hash)
plains.extend([
    bytes.fromhex(appCode_sm3)[:15].hex(),  # unlikely but try
])

print(f"\nTesting {len(key_candidates)} keys × {len(plains)} plaintexts...")
print(f"Target: {TARGET_ENC.hex()}")

found = False
for name, key in key_candidates:
    if key is None:
        continue
    if try_key(name, key, plains):
        found = True
        break

if not found:
    print("\nNo match found with current candidates.")

    # Last resort: try ECB mode
    print("\nTrying ECB mode...")
    def sm4_encrypt_ecb(key_bytes, plaintext_bytes):
        crypt = CryptSM4()
        crypt.set_key(key_bytes, SM4_ENCRYPT)
        pad_len = 16 - (len(plaintext_bytes) % 16)
        padded = plaintext_bytes + bytes([pad_len] * pad_len)
        result = b""
        for i in range(0, len(padded), 16):
            result += crypt.crypt_ecb(padded[i:i+16])
        return result

    for name, key in key_candidates:
        if key is None:
            continue
        for pt in plains:
            try:
                pt_bytes = pt.encode() if isinstance(pt, str) else pt
                enc = sm4_encrypt_ecb(key, pt_bytes)
                if enc == TARGET_ENC:
                    print(f"ECB MATCH! key={name} plaintext={pt!r}")
                    print(f"  key_hex={key.hex()}")
                    found = True
            except:
                pass
        if found:
            break

if not found:
    print("\n=== SM4 Key Search Failed ===")
    print("Next steps:")
    print("1. Search app.js source for key initialization code")
    print("2. Try decrypting encData to find plaintext")
    print("3. Hook SM4.encrypt in jsdom directly")
