"""
SM4 密钥查找 v2 — 同时尝试加密和解密方向
关键: 解密已知密文，检查结果是否像有效 JSON
"""

import base64
import hashlib
import string
from gmssl.sm4 import CryptSM4, SM4_ENCRYPT, SM4_DECRYPT
from gmssl import sm3 as gmssl_sm3_func

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
TARGET_ENC = bytes.fromhex("4A8E4673BB18D86FE780DACC31C49FE3")

def sm3_hash(data):
    """gmssl SM3 hash"""
    if isinstance(data, str):
        data = data.encode()
    # gmssl sm3_hash expects a list of ints
    data_list = list(data)
    return gmssl_sm3_func.sm3_hash(data_list)

def pkcs7_unpad(data):
    """Remove PKCS7 padding"""
    if len(data) == 0:
        return data
    pad = data[-1]
    if pad > 16 or pad == 0:
        return data  # Invalid padding
    if all(b == pad for b in data[-pad:]):
        return data[:-pad]
    return data

def sm4_decrypt_cbc(key_bytes, ciphertext):
    """SM4-CBC decrypt, IV=0"""
    crypt = CryptSM4()
    crypt.set_key(key_bytes, SM4_DECRYPT)

    result = b""
    prev = bytes(16)  # IV = 0
    for i in range(0, len(ciphertext), 16):
        block = ciphertext[i:i+16]
        dec = crypt.crypt_ecb(block)
        result += bytes(a ^ b for a, b in zip(dec, prev))
        prev = block
    return result

def sm4_encrypt_cbc(key_bytes, plaintext):
    """SM4-CBC encrypt, IV=0, PKCS7 padding"""
    crypt = CryptSM4()
    crypt.set_key(key_bytes, SM4_ENCRYPT)

    pad_len = 16 - (len(plaintext) % 16)
    padded = plaintext + bytes([pad_len] * pad_len)

    result = b""
    prev = bytes(16)  # IV = 0
    for i in range(0, len(padded), 16):
        block = bytes(a ^ b for a, b in zip(padded[i:i+16], prev))
        enc = crypt.crypt_ecb(block)
        result += enc
        prev = enc
    return result

def looks_valid(data):
    """Check if decrypted data looks like valid JSON/string"""
    try:
        text = data.decode('utf-8', errors='replace')
        if text.startswith('{') or text.startswith('[') or text.startswith('"'):
            return True, text
        # Check if it's all printable
        if all(c in string.printable for c in text):
            return True, text
    except:
        pass
    return False, repr(data)

# ===========================================================
# Build key candidates
# ===========================================================

key_candidates = []

# FIELD_D base64 decode
FIELD_D_B64 = "AJxKNdmspMaPGj+onJNoQ0cgWk2E3CYFWKBJhpcJrAtC"
d_bytes = base64.b64decode(FIELD_D_B64)
print(f"FIELD_D: {len(d_bytes)} bytes = {d_bytes.hex()}")

# Try all 16-byte slices of d
for start in range(len(d_bytes) - 15):
    key_candidates.append((f"d[{start}:{start+16}]", d_bytes[start:start+16]))

# Also try reversed byte order
key_candidates.append(("d[1:17]_reversed", d_bytes[1:17][::-1]))
key_candidates.append(("d[0:16]_reversed", d_bytes[:16][::-1]))
key_candidates.append(("d[17:33]_reversed", d_bytes[17:33][::-1]))

# Byte-swapped versions (common in C implementations)
import struct
for start in range(len(d_bytes) - 15):
    chunk = d_bytes[start:start+16]
    # Interpret as 4 uint32s in big-endian, swap to little-endian
    try:
        words = struct.unpack('>4I', chunk)
        swapped = struct.pack('<4I', *words)
        key_candidates.append((f"d[{start}:{start+16}]_beswap", swapped))
    except:
        pass

# From FIELD_A
FIELD_A = "NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P"
key_candidates.append(("a_ascii[:16]", FIELD_A.encode()[:16]))

# Try FIELD_A as base32
try:
    a_b32 = base64.b32decode(FIELD_A)
    print(f"FIELD_A base32: {len(a_b32)} bytes = {a_b32.hex()}")
    for start in range(len(a_b32) - 15):
        key_candidates.append((f"a_b32[{start}:{start+16}]", a_b32[start:start+16]))
except Exception as e:
    print(f"FIELD_A b32 error: {e}")

# FIELD_C - SM2 key material
# 65 bytes = 04 || x(32) || y(32)
# The SM4 key might be derived from x or y coordinate

# AppCode derivations
app_sm3_hex = sm3_hash(APP_CODE)
key_candidates.append(("sm3(appCode)[:16]", bytes.fromhex(app_sm3_hex)[:16]))
key_candidates.append(("sm3(appCode)[16:32]", bytes.fromhex(app_sm3_hex)[16:32]))
key_candidates.append(("sha256(appCode)[:16]", hashlib.sha256(APP_CODE.encode()).digest()[:16]))
key_candidates.append(("md5(appCode)", hashlib.md5(APP_CODE.encode()).digest()))

# appCode as raw bytes (32 bytes)
app_hex = APP_CODE.encode().hex()  # 64 hex chars
key_candidates.append(("appCode_hex[:16]", bytes.fromhex(app_hex)[:16]))
key_candidates.append(("appCode_hex[16:32]", bytes.fromhex(app_hex)[16:32]))
key_candidates.append(("appCode_ascii[:16]", APP_CODE.encode()[:16]))

# SM3(appCode + publicKey)
key_candidates.append(("sm3(appCode+A)[:16]", bytes.fromhex(sm3_hash(APP_CODE + FIELD_A))[:16]))
key_candidates.append(("sm3(A+appCode)[:16]", bytes.fromhex(sm3_hash(FIELD_A + APP_CODE))[:16]))

# Test all-zero key
key_candidates.append(("zeros", bytes(16)))

# Known SM4 test vector key
key_candidates.append(("sm4_test", bytes.fromhex("0123456789abcdeffedcba9876543210")))

print(f"\n=== Testing {len(key_candidates)} candidate keys ===")
print(f"Target ciphertext: {TARGET_ENC.hex()} ({len(TARGET_ENC)} bytes)\n")

# ===========================================================
# Decryption direction: try each key → check if output looks valid
# ===========================================================

valid_results = []
for name, key in key_candidates:
    try:
        dec = sm4_decrypt_cbc(key, TARGET_ENC)
        unpadded = pkcs7_unpad(dec)
        valid, text = looks_valid(unpadded)
        if valid or len(unpadded) < 100:
            print(f"[{name:30s}] dec={unpadded.hex():32s} unpadded=\"{text[:80]}\"")
            if valid:
                valid_results.append((name, key, unpadded))
    except Exception as e:
        pass

# Also try ECB mode
print("\n=== ECB mode ===")
crypt = CryptSM4()
for name, key in key_candidates:
    try:
        crypt.set_key(key, SM4_DECRYPT)
        dec = crypt.crypt_ecb(TARGET_ENC)
        unpadded = pkcs7_unpad(dec)
        valid, text = looks_valid(unpadded)
        if valid:
            print(f"[ECB] [{name:30s}] dec={unpadded.hex():32s} unpadded=\"{text[:80]}\"")
            valid_results.append((f"ECB:{name}", key, unpadded))
    except:
        pass

# ===========================================================
# If decryption found plausible results, verify with encryption
# ===========================================================
if valid_results:
    print(f"\n=== Verifying {len(valid_results)} candidates via encrypt==encData ===")
    for name, key, plaintext in valid_results:
        try:
            enc = sm4_encrypt_cbc(key, plaintext)
            if enc == TARGET_ENC:
                print(f"\n*** VERIFIED: key={name}")
                print(f"    key_hex = {key.hex()}")
                print(f"    plaintext = {plaintext}")
                break
        except:
            pass
else:
    print("\nNo valid decryption results found.")
    print("The SM4 key source might be different from what we expected.")

    # Last resort: try XORing with the d_bytes to see patterns
    print(f"\n=== XOR analysis of FIELD_D_bytes ===")
    print(f"d_bytes[1:17].hex() = {d_bytes[1:17].hex()}")
    print(f"d_bytes[17:33].hex() = {d_bytes[17:33].hex()}")
    print(f"XOR of halves = {bytes(a^b for a,b in zip(d_bytes[1:17], d_bytes[17:33])).hex()}")
