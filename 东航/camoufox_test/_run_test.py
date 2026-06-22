"""One-shot Camoufox test runner"""
import subprocess, json, sys, os
from pathlib import Path

os.chdir(Path(__file__).parent.parent)  # cd to 东航/
SD = Path(".")
SIGN_JS = SD / "sign.js"
BRIDGE = SD / "camoufox_test" / "camoufox_bridge.py"

# 1. Encrypt
payload = {
    "currentQueryType": "FLIGHT_LIST", "currentSegIndex": 0,
    "language": "zh", "selectedRoutes": [], "productType": "CASH",
    "routes": [{
        "arrCode": "CAN", "depCode": "CTU", "flightDate": "20250628",
        "arrCodeType": "1", "depCodeType": "1",
        "depCityName": "成都", "arrCityName": "广州",
        "segIndex": 0, "leftInner": "", "rightInner": "",
    }],
    "tripType": "OW", "cabinGrade": "",
}

p = subprocess.Popen(
    ["node", str(SIGN_JS), "encrypt"],
    cwd=str(SD), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
)
out, err = p.communicate(
    input=json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(),
    timeout=30,
)
if p.returncode:
    print(f"Encrypt error: {err.decode()[:500]}", file=sys.stderr)
    sys.exit(1)
enc = json.loads(out.decode().strip())
enc_req = enc["req"]
print(f"Encrypted: {len(enc_req)} chars")

# 2. Call Camoufox bridge
r = subprocess.run(
    [sys.executable, str(BRIDGE), enc_req],
    capture_output=True, text=True, timeout=180, cwd=str(SD),
)
print("=== STDERR ===")
print(r.stderr)
print("=== STDOUT ===")
print(r.stdout)
print(f"=== RC: {r.returncode} ===")
