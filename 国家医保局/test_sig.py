"""Test x-tif-signature formulas with captured r,s values"""
import hashlib

sig = "5411e6aad6b3e7b6669b574a28d46f2ce44bec3a3394f0ed2bbac6bdf34f0118"
ds_r = "e6e5543c7e9d7e653922f5a7c2a4b61c33451c9178bc015ebace46fa1526ccbc"
ds_s = "8a7d511e9063ddf4be3769539d9f6069b6196490255526179323f66c500ec02e"
ds_msg = "appCode=T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ&data={}&encType=SM4&signType=SM2&timestamp=1782828871&version=1.0.0&key=NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P"
ds_key = "009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42"
ts = "1782828871"
AC = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"

def sha(s):
    if isinstance(s, str): s = s.encode()
    return hashlib.sha256(s).hexdigest()

def check(name, val):
    m = "MATCH!" if val == sig else ""
    print(f"  {name:35s} {val[:32]}... {m}")

fullHex = ds_r + ds_s
fullBytes = bytes.fromhex(fullHex)

print(f"Target: {sig}")
print()

check("SHA256(r_hex)", sha(ds_r))
check("SHA256(fullHex)", sha(fullHex))
check("SHA256(fullBytes)", sha(fullBytes))
check("SHA256(doSigMsg)", sha(ds_msg))
check("SHA256(r_lower)", sha(ds_r.lower()))
check("SHA256(s_hex)", sha(ds_s))
check("SHA256(key+msg)", sha(ds_key + ds_msg))
check("SHA256(r+s+msg)", sha(ds_r + ds_s + ds_msg))
check("SHA256(r+ts)", sha(ds_r + ts))

msgNoKey = ds_msg.replace("&key=NMVFVILMKT13GEMD3BKPKCTBOQBPZR2P", "")
check("SHA256(msg_no_key)", sha(msgNoKey))

# First 32 bytes of SHA256 output
shaOfMsg = hashlib.sha256(ds_msg.encode()).digest()
check("SHA256(msg) full", shaOfMsg.hex())

# SM3
from gmssl import sm3 as gmssl_sm3
def sm3_hash(s):
    if isinstance(s, str): s = s.encode()
    return gmssl_sm3.sm3_hash(list(s))

print()
check("SM3(r_hex)", sm3_hash(ds_r))
check("SM3(fullHex_r||s)", sm3_hash(fullHex))
check("SM3(doSigMsg)", sm3_hash(ds_msg))
check("SM3(msg_no_key)", sm3_hash(msgNoKey))
