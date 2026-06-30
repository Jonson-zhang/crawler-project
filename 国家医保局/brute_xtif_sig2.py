"""
Comprehensive x-tif-signature algorithm test with SM3 support.
Tests SHA-256 and SM3 with various input combinations.
"""

import hashlib
import json
import hmac
from gmssl import sm3 as gmssl_sm3

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"

def sha256(s):
    if isinstance(s, str): s = s.encode()
    return hashlib.sha256(s).hexdigest()

def sm3_hash(s):
    if isinstance(s, str): s = s.encode()
    return gmssl_sm3.sm3_hash(s)

def hmac_sha256(key, msg):
    if isinstance(key, str): key = key.encode()
    if isinstance(msg, str): msg = msg.encode()
    return hmac.new(key, msg, hashlib.sha256).hexdigest()

def hmac_sm3(key, msg):
    if isinstance(key, str): key = key.encode()
    if isinstance(msg, str): msg = msg.encode()
    return gmssl_sm3.sm3_hmac(key, msg)

# Samples collected from browser
samples = [
    {
        "id": "original_1", "ts": 1782800508, "nonce": "j4lcSGER",
        "sig": "74a3810c74c3756004939862cbc2562e53bb37bbfb2712a451067b318e67e93d",
        "encData": "3DFBCA4667B978F639BB23B95DCE4CC74CE34C33DC32F1068E9E23CA546C9EA8CCD20943B4DAE96380B41164D761DE9742C84A985FE3BABC31CB352556BB87C9C1495DB24A29AB6BC3A85AB7FCA00F33C56677481A67C67F739EE2C7D589054DC373615B5DDB33C24C5B31E61CB7643E8CCAA19EAE1FD36157CF9869E3A3753ED0B4E7BB97C60BF8E5275CAFCAFD1E13E384C10195003FD638576645B5EF45EA",
        "signData": "7Zt7WRSWxvewzbOLik413DqMxY6KEGuakCpbck1A4N+V4FrGbC4PK7l0TFhzx7PKLrt8UXktVPSyBaJzqxBOtQ==",
        "body": None,
    },
    {
        "id": "original_2", "ts": 1782800606, "nonce": "z0796vho",
        "sig": "a6bc0d91456741e40df7b48e44ae839f4d135a76088345836da5f3d657a4160d",
        "encData": "3DFBCA4667B978F639BB23B95DCE4CC74CE34C33DC32F1068E9E23CA546C9EA8CCD20943B4DAE96380B41164D761DE9742C84A985FE3BABC31CB352556BB87C9C1495DB24A29AB6BC3A85AB7FCA00F33C56677481A67C67F739EE2C7D589054DC373615B5DDB33C24C5B31E61CB7643E8CCAA19EAE1FD36157CF9869E3A3753ED0B4E7BB97C60BF8E5275CAFCAFD1E13E384C10195003FD638576645B5EF45EA",
        "signData": "n4KFoJXnMbZwaJXSTx4XhLq6MvGkIwRDny7xYyM3aH5m6e4qbhLQ11wjuAHZF9eAR3YSiiUKtU3ojXqr9B9yyw==",
        "body": None,
    },
    {
        "id": "original_3", "ts": 1782800689, "nonce": "f4i8YgEf",
        "sig": "db9da30631b8635869d0ea7bc6e39c79b891a3a7b7ea4000b1fa217386d843b4",
        "encData": "3DFBCA4667B978F639BB23B95DCE4CC74CE34C33DC32F1068E9E23CA546C9EA8CCD20943B4DAE96380B41164D761DE9742C84A985FE3BABC31CB352556BB87C9C1495DB24A29AB6BC3A85AB7FCA00F33C56677481A67C67F739EE2C7D589054DC373615B5DDB33C24C5B31E61CB7643E8CCAA19EAE1FD36157CF9869E3A3753ED0B4E7BB97C60BF8E5275CAFCAFD1E13E384C10195003FD638576645B5EF45EA",
        "signData": "N8IYwsVDuVZ7yHOyiiuujXgrhP15J6jSWW5GyqP1v0jTTZ07kS+3Xg8FD4vr6fFylEQhS7w/vwZt87LtKjpLkQ==",
        "body": None,
    },
    {
        "id": "live_queryFixedHospital", "ts": 1782823012, "nonce": "e4JiQEaa",
        "sig": "aa9d7e69a4ff1121e12201b2791da9e0a5595594e0f0540d4fc5f7ddd070ee24",
        "encData": "3DFBCA4667B978F639BB23B95DCE4CC74CE34C33DC32F1068E9E23CA546C9EA8464E107F1E6350E50C7A229C736A86FD9CD3B52C19A7CCD1D89EC94F6254903D46A733513B9D7FA150A1097A3B0DF19D23AE57A579165AFFE7C8E189FF7C2FE98F18DA6981D0598239780FA7C358D03DDCA72DB9D7E46A1FC083358BDB8F72C20602F95D92716984A66B8ADBBEC944436812D63DF0F07F2178EBA1DD03B373F0A97A9D6E94EDAD43A0A62C75C728481F",
        "signData": "c7vnPV0NUhfx6qKMmPqPYTVIsWeIAzkMqQx6WAASKfm+B5wFgL6f42iN+qjCUEIV2Bhv6iRdhVVsmIq2Gaexnw==",
        "body": None,
    },
    {
        "id": "live_selectByKeys", "ts": 1782822947, "nonce": "b3bXYPuP",
        "sig": "7aa3d65b74b802970b95d5d056dc474c8c6ce4bd06ed8f5d1bcde4b20d252712",
        "encData": "4A8E4673BB18D86FE780DACC31C49FE3",
        "signData": "NpQJxVDZyPKKof/6dzrfS4mt9tbuIfwcOddoRD5GDpVLVbLBHb+g4mhLyZ6Nbpw/p0qE/1fIQoBms7QIkWxpNQ==",
        "body": None,
    },
]

# Build body JSON for each sample
for s in samples:
    inner = {
        "data": {"encData": s["encData"]},
        "appCode": APP_CODE, "version": "1.0.0",
        "encType": "SM4", "signType": "SM2",
        "timestamp": s["ts"], "signData": s["signData"],
    }
    s["body"] = {"data": inner}
    s["body_str"] = json.dumps(s["body"], ensure_ascii=False, separators=(",", ":"))
    s["inner_str"] = json.dumps(inner, ensure_ascii=False, separators=(",", ":"))
    s["inner_no_sign"] = json.dumps(
        {k: v for k, v in inner.items() if k != "signData"},
        ensure_ascii=False, separators=(",", ":")
    )
    s["ts_str"] = str(s["ts"])


def check_all(name, formula, func=sha256):
    """Check if formula works across ALL samples"""
    results = []
    all_match = True
    for s in samples:
        try:
            inp = formula(s)
            computed = func(inp)
            match = computed == s["sig"]
            if not match:
                all_match = False
            results.append((s["id"], match, computed[:16]))
        except Exception as e:
            results.append((s["id"], False, f"ERR: {e}"))
            all_match = False
    return all_match, results

def test_formula(name, formula):
    print(f"\n--- {name} ---")
    match_sha, res_sha = check_all(name, formula, sha256)
    match_sm3, res_sm3 = check_all(name, formula, sm3_hash)

    if match_sha:
        print(f"  *** SHA256 MATCH ACROSS ALL SAMPLES ***")
    if match_sm3:
        print(f"  *** SM3 MATCH ACROSS ALL SAMPLES ***")

    if not match_sha and not match_sm3:
        print(f"  SHA256: {' '.join(f'{r[0]}={r[1]}' for r in res_sha)}")
        print(f"  SM3:    {' '.join(f'{r[0]}={r[1]}' for r in res_sm3)}")

    return match_sha or match_sm3


# Define formulas as lambda: sample -> input_string
formulas = {}

# Basic
formulas["ts+nonce"] = lambda s: s["ts_str"] + s["nonce"]
formulas["appCode+ts+nonce"] = lambda s: APP_CODE + s["ts_str"] + s["nonce"]
formulas["ts+nonce+appCode"] = lambda s: s["ts_str"] + s["nonce"] + APP_CODE
formulas["nonce+ts+appCode"] = lambda s: s["nonce"] + s["ts_str"] + APP_CODE

# Body variants
formulas["body"] = lambda s: s["body_str"]
formulas["inner"] = lambda s: s["inner_str"]
formulas["inner_noSign"] = lambda s: s["inner_no_sign"]
formulas["encData+ts+nonce"] = lambda s: s["encData"] + s["ts_str"] + s["nonce"]
formulas["signData+ts+nonce"] = lambda s: s["signData"] + s["ts_str"] + s["nonce"]

# Combined
formulas["appCode+ts+nonce+body"] = lambda s: APP_CODE + s["ts_str"] + s["nonce"] + s["body_str"]
formulas["ts+nonce+appCode+body"] = lambda s: s["ts_str"] + s["nonce"] + APP_CODE + s["body_str"]
formulas["appCode+ts+nonce+inner"] = lambda s: APP_CODE + s["ts_str"] + s["nonce"] + s["inner_str"]
formulas["appCode+ts+nonce+inner_noSign"] = lambda s: APP_CODE + s["ts_str"] + s["nonce"] + s["inner_no_sign"]
formulas["ts+nonce+inner_noSign"] = lambda s: s["ts_str"] + s["nonce"] + s["inner_no_sign"]
formulas["ts+nonce+body"] = lambda s: s["ts_str"] + s["nonce"] + s["body_str"]
formulas["appCode+ts+nonce+encData"] = lambda s: APP_CODE + s["ts_str"] + s["nonce"] + s["encData"]

# With APP_CODE as hex
formulas["appCodeHex+ts+nonce+body"] = lambda s: APP_CODE.encode().hex() + s["ts_str"] + s["nonce"] + s["body_str"]

# Use signData mix
formulas["ts+nonce+body+signData"] = lambda s: s["ts_str"] + s["nonce"] + s["body_str"] + s["signData"]
formulas["appCode+ts+nonce+body+signData"] = lambda s: APP_CODE + s["ts_str"] + s["nonce"] + s["body_str"] + s["signData"]

# HMAC
formulas["HMAC_SHA256_appCode_key_ts+nonce+body"] = lambda s: hmac_sha256(APP_CODE, s["ts_str"] + s["nonce"] + s["body_str"])
formulas["HMAC_SM3_appCode_key_ts+nonce+body"] = lambda s: hmac_sm3(APP_CODE, s["ts_str"] + s["nonce"] + s["body_str"])

# Special: maybe body without signData and then compute
formulas["body_no_sign_wrapper"] = lambda s: json.dumps(
    {"data": {k: v for k, v in s["body"]["data"].items() if k != "signData"}},
    ensure_ascii=False, separators=(",", ":")
)

# Sort the keys differently for JSON
formulas["body_sorted_keys"] = lambda s: json.dumps(s["body"], ensure_ascii=False)
formulas["inner_sorted_keys"] = lambda s: json.dumps(s["body"]["data"], ensure_ascii=False)

# URL-related
formulas["url+ts+nonce"] = lambda s: "/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital" + s["ts_str"] + s["nonce"]

# What if just the body bytes are signed?
formulas["body_bytes_hex"] = lambda s: s["body_str"]


# Test all formulas
print("=" * 80)
print("Testing x-tif-signature formula candidates (SHA-256 + SM3)")
print("=" * 80)

found = False
for name in formulas:
    if test_formula(name, formulas[name]):
        found = True
        print(f"\n*** FOUND: {name} ***")
        break

if not found:
    print("\n\nNo direct match found. Testing more combinations...")

    # More exhaustive: try every ordering of ts, nonce, appCode
    from itertools import permutations
    parts = ["ts", "nonce", "appCode", "body", "inner", "inner_noSign"]

    print("\nTesting permutations of [ts, nonce, appCode]:")
    for perm in permutations(["ts", "nonce", "appCode"]):
        name = "+".join(perm)
        def make_formula(p):
            return lambda s, p=p: "".join(
                s["ts_str"] if x == "ts" else s["nonce"] if x == "nonce" else APP_CODE
                for x in p
            )
        test_formula(f"perm:{name}", make_formula(perm))

    print("\nTesting permutations of [ts, nonce, appCode, body]:")
    for perm in permutations(["ts", "nonce", "appCode", "body"]):
        name = "+".join(perm)
        def make_formula(p):
            return lambda s, p=p: "".join(
                s["ts_str"] if x == "ts" else s["nonce"] if x == "nonce" else APP_CODE if x == "appCode" else s["body_str"]
                for x in p
            )
        test_formula(f"perm:{name}", make_formula(perm))

    # Test with different JSON encoding options
    print("\nTesting without JSON separators:")
    for s in samples:
        s["body_str_no_sep"] = json.dumps(s["body"], ensure_ascii=False)
        s["inner_str_no_sep"] = json.dumps(s["body"]["data"], ensure_ascii=False)

    test_formula("appCode+ts+nonce+body_no_sep", lambda s: APP_CODE + s["ts_str"] + s["nonce"] + s["body_str_no_sep"])

    # What about just appCode hex + ts + nonce?
    test_formula("appCodeHex+ts+nonce", lambda s: APP_CODE.encode().hex() + s["ts_str"] + s["nonce"])

    # What if encData is computed differently - just hash of the body data part?
    test_formula("body_data_only", lambda s: json.dumps({"data": {"encData": s["encData"]}}))
    test_formula("appCode+ts+nonce+data_encdata", lambda s: APP_CODE + s["ts_str"] + s["nonce"] + json.dumps({"data": {"encData": s["encData"]}}))
