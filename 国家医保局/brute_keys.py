"""Systematic SM4 key search against known ciphertexts"""
import re, sys, json, hashlib
sys.stdout.reconfigure(encoding='utf-8')
from gmssl import sm3, sm4, func

# Known ciphertexts (first block)
CIPHER_BLOCK = bytes.fromhex('3DFBCA4667B978F639BB23B95DCE4CC7')
IV = b'\x00' * 16

APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ'

def decrypt_block(key_bytes):
    """Decrypt single block, return bytes"""
    crypt = sm4.CryptSM4()
    crypt.set_key(key_bytes, sm4.SM4_DECRYPT)
    return crypt.crypt_cbc(IV, CIPHER_BLOCK[:16])

def is_valid_plaintext(pt):
    """Check if decrypted data looks like valid JSON"""
    try:
        text = pt.decode('ascii', errors='replace')
        return text[0] in '{"' and all(32 <= ord(c) < 127 or c in '\t\n\r' for c in text)
    except:
        return False

# Load decoded strings
with open('config/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

arr_match = re.search(r'_0x1f98dd=\[(.*?)\];a4_0x5d42=function', content, re.DOTALL)
strings = re.findall(r"'([^']*)'|\"([^\"]*)\"", arr_match.group(1))
flat = [s[0] or s[1] for s in strings]

# Generate key candidates
candidates = []

# 1. From string table hex entries
for i, s in enumerate(flat):
    if len(s) == 32 and all(c in '0123456789abcdefABCDEF' for c in s):
        key = s.lower().ljust(32, '0')[:32]
        candidates.append(('str_hex_%d' % i, bytes.fromhex(key)))

# 2. Hash derivations from promising strings
for i, s in enumerate(flat):
    if len(s) >= 8 and len(s) <= 40:
        h = hashlib.md5(s.encode()).digest()
        candidates.append(('md5_str_%d' % i, h))
        h2 = bytes.fromhex(sm3.sm3_hash(func.bytes_to_list(s.encode()))[:32])
        candidates.append(('sm3_str_%d' % i, h2))

# 3. Hash of appCode
candidates.append(('md5_appCode', hashlib.md5(APP_CODE.encode()).digest()))
candidates.append(('sm3_appCode', bytes.fromhex(sm3.sm3_hash(func.bytes_to_list(APP_CODE.encode()))[:32])))
candidates.append(('sha256_appCode', hashlib.sha256(APP_CODE.encode()).digest()[:16]))

# 4. Common fixed keys
candidates.append(('zeros', b'\x00' * 16))
candidates.append(('appCode_trunc', APP_CODE[:16].encode().ljust(16, b'\x00')))

# 5. SM3 of combinations
for prefix in ['nhsa', 'fuwu.nhsa.gov.cn', 'nationalHallSt', 'queryFixedHospital']:
    h = bytes.fromhex(sm3.sm3_hash(func.bytes_to_list(f'{prefix}{APP_CODE}'.encode()))[:32])
    candidates.append(('sm3_%s_appCode' % prefix, h))

# Test all candidates
print(f'Testing {len(candidates)} key candidates...')
found = []
for name, key in candidates:
    pt = decrypt_block(key)
    if is_valid_plaintext(pt):
        found.append((name, key.hex(), pt.decode('ascii', errors='replace')))
        print(f'  MATCH: {name} = {key.hex()} -> {pt}')

if not found:
    print('No match found. Looking for partial matches...')
    for name, key in candidates:
        pt = decrypt_block(key)
        text = pt.decode('ascii', errors='replace')
        if text[0] in '{"':
            print(f'  PARTIAL: {name} -> {text}')
        elif ord(text[0]) > 32:
            print(f'  Note: {name} -> {repr(text[:8])}')

print(f'\nDone. Tested {len(candidates)} candidates.')
