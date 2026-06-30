"""
暴力破解 x-tif-signature — 用已验证的 SM4 密钥加密数据，
然后尝试各种 SHA256/SM3 公式匹配签名。
"""

import hashlib
import json
import time
import subprocess
import sys
import string
import random
from pathlib import Path

HERE = Path(__file__).parent

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
SM4_KEY_ASCII = "C3AE5873D08418DA"
SM4_KEY_HEX = SM4_KEY_ASCII.encode().hex()  # "43334145353837334430383431384441"

def sha256(s):
    if isinstance(s, str): s = s.encode()
    return hashlib.sha256(s).hexdigest()

def gen_nonce(n=8):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(n))

def encrypt_params(params, ts=None, nonce=None):
    """用已验证的 SM4 key + SM2 key 生成加密请求"""
    import subprocess

    if ts is None:
        ts = int(time.time())
    if nonce is None:
        nonce = gen_nonce()

    cmd = f"""
const sm4 = require('sm-crypto').sm4;
const sm2 = require('sm-crypto').sm2;
const AC = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const SM4_KEY_HEX = Buffer.from('C3AE5873D08418DA', 'ascii').toString('hex');
const SM2_KEY_HEX = Buffer.from(AC, 'ascii').toString('hex');

const params = {json.dumps(params)};
const plainJson = JSON.stringify(params);
const encData = sm4.encrypt(plainJson, SM4_KEY_HEX, {{mode:'cbc', iv:'00000000000000000000000000000000'}});
const inner = {{data:{{encData}}, appCode: AC, version: '1.0.0', encType: 'SM4', signType: 'SM2', timestamp: {ts}}};
const signData = sm2.doSignature(JSON.stringify(inner), SM2_KEY_HEX, {{hash: true}});
const body = {{data: {{data: {{encData}}, appCode: AC, version: '1.0.0', encType: 'SM4', signType: 'SM2', timestamp: {ts}, signData}}}};
console.log(JSON.stringify({{encData, signData, body: JSON.stringify(body), inner: JSON.stringify(inner)}}));
"""
    r = subprocess.run(
        ["node", "-e", cmd],
        capture_output=True, text=True, cwd=str(HERE), timeout=15
    )
    return json.loads(r.stdout.strip())

print("=== Testing selectByKeys (known plaintext, known encData) ===")
print(f"SM4 key: {SM4_KEY_ASCII}")
print(f"SM4 key hex: {SM4_KEY_HEX}")
print()

# Test: encrypt selectByKeys params
result = encrypt_params({"keys": ""}, ts=1782826049, nonce="test1234")
print(f"encData: {result['encData']}")
print(f"Expected: 4A8E4673BB18D86FE780DACC31C49FE3")
print(f"Match: {result['encData'].upper() == '4A8E4673BB18D86FE780DACC31C49FE3'}")
print()

# Now generate test cases with different timestamps to brute-force formula
# Use the known selectByKeys to test the x-tif-signature formula

# From jsdom captures, we have pairs of (body, headers).
# Let's try ALL reasonable SHA256 input formulas:

samples = [
    {
        "ts": 1782826049,
        "nonce": "test1234",
        "encData": "4A8E4673BB18D86FE780DACC31C49FE3",
        # We need the actual x-tif-signature from jsdom
        # This would be from a running jsdom instance
    }
]

# Since we can't match against real jsdom signatures without running it,
# let's instead build the formula discovery by running jsdom again
# and comparing against the output

print("=== Generating jsdom signature for comparison ===")
print("Running jsdom capture to get real x-tif-signature...")

jsdom_result = subprocess.run(
    ["node", str(HERE / "capture_key.js")],
    capture_output=True, text=True, cwd=str(HERE), timeout=45
)

# Parse the jsdom output
for line in jsdom_result.stderr.split("\n"):
    if "sig:" in line:
        real_sig = line.split("sig:")[1].strip()
        print(f"Real sig from jsdom: {real_sig}")
    if "ts:" in line and "sig:" not in line:
        # timestamp from body
        pass

print("\n=== Full jsdom stderr ===")
print(jsdom_result.stderr[-2000:])
