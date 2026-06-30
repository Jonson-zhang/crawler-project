"""
暴力测试 x-tif-signature 的 SHA-256 输入组合。

已知:
- appCode = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"
- x-tif-signature = SHA-256 (64 hex)
- 样本: ts, nonce, signature, body(encData+signData+...)
"""

import hashlib
import json
from pathlib import Path

HERE = Path(__file__).parent

with open(HERE / "config" / "samples.json") as f:
    data = json.load(f)

appCode = data["appCode"]
samples = data["requests"]

def sha256(s):
    if isinstance(s, str):
        s = s.encode()
    return hashlib.sha256(s).hexdigest()

def check(name, computed, expected):
    match = "MATCH" if computed == expected else "no  "
    print(f"  [{match}] {name}")
    if computed == expected:
        print(f"  *** SIGNATURE MATCH FOUND: {name} ***")
        return True
    return False

def test_sample(s, body_json):
    """Test all possible SHA-256 input combinations for a given sample"""
    ts = str(s["timestamp"])
    nonce = s["nonce"]
    expected_sig = s["x_tif_signature"]
    encData = s["encData"]
    signData = s["signData"]

    print(f"\n{'='*80}")
    print(f"Sample: {s['id']}  keyword={s['search_keyword']}")
    print(f"  ts={ts}, nonce={nonce}")
    print(f"  expected sig={expected_sig}")

    body_str = json.dumps(body_json, ensure_ascii=False, separators=(",", ":"))

    # Build body without signData (to test if signature is computed before signData added)
    inner = body_json["data"].copy()
    outer_no_sign = {"data": inner.copy()}
    inner_no_sign = inner.copy()
    inner_no_sign.pop("signData", None)
    body_no_sign = json.dumps({"data": inner_no_sign}, ensure_ascii=False, separators=(",", ":"))

    # Build inner JSON string
    inner_str = json.dumps(inner, ensure_ascii=False, separators=(",", ":"))
    inner_no_sign_str = json.dumps(inner_no_sign, ensure_ascii=False, separators=(",", ":"))

    # Various combinations to test
    tests = {}

    # Basic combinations
    tests["appCode+ts+nonce"] = appCode + ts + nonce
    tests["ts+nonce+appCode"] = ts + nonce + appCode
    tests["appCode+nonce+ts"] = appCode + nonce + ts
    tests["ts+appCode+nonce"] = ts + appCode + nonce
    tests["nonce+ts+appCode"] = nonce + ts + appCode
    tests["nonce+appCode+ts"] = nonce + appCode + ts

    # With body
    tests["appCode+ts+nonce+body"] = appCode + ts + nonce + body_str
    tests["appCode+ts+nonce+body_noSign"] = appCode + ts + nonce + body_no_sign
    tests["ts+nonce+appCode+body"] = ts + nonce + appCode + body_str
    tests["ts+nonce+body"] = ts + nonce + body_str
    tests["ts+nonce+appCode+body_noSign"] = ts + nonce + appCode + body_no_sign

    # Just body parts
    tests["body"] = body_str
    tests["body_noSign"] = body_no_sign
    tests["encData+ts+nonce"] = encData + ts + nonce
    tests["ts+nonce+encData"] = ts + nonce + encData
    tests["appCode+encData+ts+nonce"] = appCode + encData + ts + nonce
    tests["appCode+ts+nonce+encData"] = appCode + ts + nonce + encData

    # inner JSON
    tests["appCode+ts+nonce+inner"] = appCode + ts + nonce + inner_str
    tests["appCode+ts+nonce+inner_noSign"] = appCode + ts + nonce + inner_no_sign_str
    tests["ts+nonce+inner"] = ts + nonce + inner_str
    tests["ts+nonce+inner_noSign"] = ts + nonce + inner_no_sign_str

    # inner JSON without wrapping data{}
    inner_data = json.dumps(inner_no_sign, ensure_ascii=False, separators=(",", ":"))
    tests["appCode+ts+nonce+innerData"] = appCode + ts + nonce + inner_data

    # Just timestamp nonce
    tests["ts+nonce"] = ts + nonce

    # With encData only
    tests["appCode+encData"] = appCode + encData

    # signData only
    tests["appCode+ts+nonce+signData"] = appCode + ts + nonce + signData
    tests["ts+nonce+signData"] = ts + nonce + signData

    # url + params
    url = "/ebus/fuwu/api/nthl/api/CommQuery/queryFixedHospital"
    tests["url+appCode+ts+nonce+body"] = url + appCode + ts + nonce + body_str
    tests["appCode+url+ts+nonce+body"] = appCode + url + ts + nonce + body_str

    for name, test_input in tests.items():
        result = sha256(test_input)
        check(name, result, expected_sig)

    return tests


def main():
    # Build the body_json from samples for testing
    # The body structure is: {"data": {"data": {"encData": ...}, "appCode": ..., ...}}
    for s in samples:
        body_json = {
            "data": {
                "data": {"encData": s["encData"]},
                "appCode": appCode,
                "version": data["version"],
                "encType": data["encType"],
                "signType": data["signType"],
                "timestamp": s["timestamp"],
                "signData": s["signData"],
            }
        }
        test_sample(s, body_json)

    # Also test against one sample more exhaustively
    print(f"\n\n{'='*80}")
    print("EXHAUSTIVE: Testing all 3 samples to find consistent pattern...")
    print(f"{'='*80}")

    s1 = samples[0]
    body1 = {
        "data": {
            "data": {"encData": s1["encData"]},
            "appCode": appCode, "version": data["version"],
            "encType": data["encType"], "signType": data["signType"],
            "timestamp": s1["timestamp"], "signData": s1["signData"],
        }
    }
    body1_str = json.dumps(body1, ensure_ascii=False, separators=(",", ":"))

    # Also test inner structure variations
    inner1 = body1["data"]

    # What if signature is HMAC-SHA256 with appCode as key?
    import hmac
    ts = str(s1["timestamp"])
    nonce = s1["nonce"]

    def hmac_sha256(key, msg):
        return hmac.new(key.encode() if isinstance(key, str) else key,
                       msg.encode() if isinstance(msg, str) else msg,
                       hashlib.sha256).hexdigest()

    print("\nHMAC-SHA256 tests (appCode as key):")
    check("HMAC(ts+nonce+body)", hmac_sha256(appCode, ts+nonce+body1_str), s1["x_tif_signature"])
    check("HMAC(ts+nonce)", hmac_sha256(appCode, ts+nonce), s1["x_tif_signature"])
    check("HMAC(body)", hmac_sha256(appCode, body1_str), s1["x_tif_signature"])
    check("HMAC(encData)", hmac_sha256(appCode, s1["encData"]), s1["x_tif_signature"])

    # SHA256 of hex decoded data?
    print("\nHex-decoded tests:")
    encData_bytes = bytes.fromhex(s1["encData"])
    check("SHA256(encData_bytes)", sha256(encData_bytes), s1["x_tif_signature"])

    # Maybe SM3?
    try:
        from gmssl import sm3
        def sm3_hash(s):
            if isinstance(s, str):
                s = s.encode()
            return sm3.sm3_hash(s)

        print("\nSM3 tests:")
        check("SM3(appCode+ts+nonce+body)", sm3_hash(appCode+ts+nonce+body1_str), s1["x_tif_signature"])
    except ImportError:
        print("\nSM3: gmssl not installed, skip")

    # What about SM3(key as bytes)?
    appCode_bytes = appCode.encode()
    appCode_hex = appCode_bytes.hex()  # "543938485043474e355a5656514253384c5a514e4f4145585649394759484b51"
    print(f"\nappCode hex: {appCode_hex}")
    print(f"appCode hex length: {len(appCode_hex)} chars")

    # What if they compute SHA256 over appCode hex string?
    check("SHA256(appCode_hex+ts+nonce+body)", sha256(appCode_hex+ts+nonce+body1_str), s1["x_tif_signature"])


if __name__ == "__main__":
    main()
