#!/usr/bin/env python3
"""全自研 x-s-common + Cookie 引导 验证脚本"""

import json, hashlib, time, random, zlib, uuid, re, sys, subprocess, urllib.parse
from base64 import b64encode as std_b64
from Crypto.Cipher import DES, ARC4
from curl_cffi import requests as cr
from pathlib import Path

BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139.0.0.0 Safari/537.36"

# ===== 编码管线 =====
B64_CHARS = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"

def b64e(data):
    n, m, r = len(data), len(data) % 3, []
    for i in range(0, n - m, 16383):
        limit = min(i + 16383, n - m)
        for j in range(i, limit, 3):
            t = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            r.append(B64_CHARS[(t>>18)&63] + B64_CHARS[(t>>12)&63] + B64_CHARS[(t>>6)&63] + B64_CHARS[t&63])
    if m == 1:
        b = data[n-1]; r.append(B64_CHARS[b>>2] + B64_CHARS[(b<<4)&63] + "==")
    elif m == 2:
        p = (data[n-2]<<8) + data[n-1]
        r.append(B64_CHARS[p>>10] + B64_CHARS[(p>>4)&63] + B64_CHARS[(p<<2)&63] + "=")
    return "".join(r)

def json_to_bytes(obj):
    s = json.dumps(obj, separators=(",",":"), ensure_ascii=False)
    e = urllib.parse.quote(s, safe="~()*!./:?=&-_")
    b, i = bytearray(), 0
    while i < len(e):
        if e[i] == "%":
            b.append(int(e[i+1:i+3], 16)); i += 3
        else:
            b.append(ord(e[i])); i += 1
    return bytes(b)

# ===== a1/webId =====
A1_CHARS = "abcdefghijklmnopqrstuvwxyz1234567890"

def gen_a1():
    ts = hex(int(time.time()*1000))[2:]
    s = ts + "".join(random.choices(A1_CHARS, k=30)) + "5" + "0" + "000"
    crc = zlib.crc32(s.encode())
    a1 = (s + str(crc))[:52]
    return a1, hashlib.md5(a1.encode()).hexdigest()

# ===== websectiga 解密 =====
def gen_websectiga(js_text):
    b_m = re.search(r'"b":"(.*?)",', js_text)
    d_m = re.search(r'"d":(.*?)\}\)', js_text)
    b, d = b_m.group(1), json.loads(d_m.group(1))
    if len(b) % 4:
        b += "=" * (4 - len(b) % 4)
    decoded = __import__("base64").b64decode(b).decode("utf-8")
    logic, chunk = [], []
    for c in decoded:
        if len(chunk) == 5:
            logic.append(chunk); chunk = []
        chunk.append(ord(c) - 1)
    if chunk:
        logic.append(chunk)
    target = logic[d[92]:d[93]+1]
    kb = [d[target[675+i][2]] for i in range(0, 128, 2)]
    return "".join(chr(kb[i+j]) for i in range(56, -1, -8) for j in range(8))

# ===== 指纹 =====
def make_fp(ts=None):
    ts = ts or int(time.time()*1000)
    return {
        "x33":"0", "x34":"0", "x35":"0",
        "x36":str(random.randint(1, 20)),
        "x37":"0|0|0|0|0|0|0|0|0|1|0|0|0|0|0|0|0|0|1|0|0|0|0|0",
        "x38":"0|0|1|0|1|0|0|0|0|0|1|0|1|0|1|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0",
        "x39":0, "x42":"3.5.4", "x43":"Canvas not supported",
        "x44":str(ts), "x45":"__SEC_CAV__1-1-1-1-1|__SEC_WSA__|",
        "x46":"false", "x48":"", "x49":"{list:[],type:}",
        "x50":"", "x51":"", "x52":"",
        "x82":"_0x17a2|_0x1954",
    }

# ===== b1: RC4 加密指纹子集 =====
def make_b1(fp):
    keys = ["x33","x34","x35","x36","x37","x38","x39",
            "x42","x43","x44","x45","x46",
            "x48","x49","x50","x51","x52","x82"]
    s = json.dumps({k:fp[k] for k in keys}, separators=(",",":"), ensure_ascii=False)
    ct = ARC4.new(b"xhswebmplfbt").encrypt(s.encode("utf-8"))
    u = urllib.parse.quote(ct.decode("latin1"), safe="!*'()~_-")
    r = bytearray()
    for p in u.split("%"):
        if not p: continue
        ch = list(p)
        r.append(int("".join(ch[:2]), 16))
        for c in ch[2:]:
            r.append(ord(c))
    return b64e(bytes(r))

# ===== CRC32（JavaScript 风格）=====
def js_crc32(s):
    tbl = [0]*256
    for i in range(256):
        c = i
        for _ in range(8):
            c = 0xEDB88320 ^ (c>>1) if c & 1 else c>>1
        tbl[i] = c
    c = 0xFFFFFFFF
    for b in s.encode("utf-8"):
        c = tbl[(c ^ b) & 0xFF] ^ (c>>8)
    r = 0xFFFFFFFF ^ c
    return r - 0x100000000 if r >= 0x80000000 else r

# ===== x-s-common 完整版 =====
def make_xsc(a1, fp):
    b1 = make_b1(fp)
    x9 = js_crc32("" + "" + b1)
    obj = {
        "s0":5, "s1":"",
        "x0":"1", "x1":"4.3.5", "x2":"Windows", "x3":"xhs-pc-web",
        "x4":"6.12.3", "x5":a1, "x6":"", "x7":"",
        "x8":b1, "x9":x9, "x10":fp["x39"], "x11":"normal",
    }
    return b64e(json_to_bytes(obj))

# ===== 签名辅助 =====
def sign_xs(path, body):
    r = subprocess.run(
        ["node", str(SIGN_JS), path, json.dumps(body or {}, separators=(",",":"))],
        capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR))
    return json.loads(r.stdout.strip())

def sign_headers(session, url, body=None):
    path = "/" + url.split("/", 3)[-1]
    sx = sign_xs(path, body)
    cookies = {k: str(v) for k, v in session.cookies.get_dict().items()}
    a1 = cookies.get("a1", "")
    fp = make_fp()
    return {
        "content-type": "application/json;charset=UTF-8",
        "x-s": sx["X-s"], "x-t": sx["X-t"],
        "x-s-common": make_xsc(a1, fp),
        "x-b3-traceid": "".join(random.choices("abcdef0123456789", k=16)),
        "x-xray-traceid": (
            hex(int(time.time()*1000) << 23)[2:].zfill(16) +
            hex(random.getrandbits(64))[2:].zfill(16)
        ),
    }

# ==================== 主流程 ====================
def main():
    print("=== 全自研 Cookie 引导 ===")

    s = cr.Session()
    s.headers.update({
        "user-agent": UA,
        "accept": "application/json, text/plain, */*",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    })

    # Step 1: a1 + webId
    a1, webId = gen_a1()
    s.cookies.update({
        "a1": a1, "webId": webId, "webBuild": "6.12.3",
        "xsecappid": "xhs-pc-web", "loadts": str(int(time.time()*1000)),
        "abRequestId": str(uuid.uuid4()),
    })
    print(f"[1/4] a1={a1[:20]}... webId={webId[:16]}...")

    # Step 2: scripting
    r = s.post("https://as.xiaohongshu.com/api/sec/v1/scripting",
        json={"callFrom":"web","callback":"seccallback"},
        headers={"content-type":"application/json"},
        timeout=15, impersonate="chrome131")
    js_text = r.json()["data"]["data"]
    sec_pid = r.json()["data"].get("secPoisonId", str(uuid.uuid4()))
    s.cookies.update({"websectiga": gen_websectiga(js_text), "sec_poison_id": sec_pid})
    print(f"[2/4] websectiga={s.cookies['websectiga'][:20]}...")

    # Step 3: shield/webprofile (自研签名)
    fp_json = json.dumps({
        "uuid":"joiamkprgeyi238i",
        "requestId":hashlib.md5(str(time.time()).encode()).hexdigest()[:16]
    }, separators=(",",":"))
    fp_b64 = std_b64(fp_json.encode()).decode()
    raw = fp_b64.encode()
    pad = 8 - len(raw) % 8
    padded = raw if pad == 8 else raw + b"\x00" * pad
    pf = DES.new(b"zbp30y86", DES.MODE_ECB).encrypt(padded).hex()

    url = "https://as.xiaohongshu.com/api/sec/v1/shield/webprofile"
    data = {"platform":"Windows","profileData":pf,"sdkVersion":"4.2.6","svn":"2"}
    r = s.post(url, json=data, headers=sign_headers(s, url, data),
               timeout=15, impersonate="chrome131")
    gid_ok = "ok" if s.cookies.get("gid") else "no"
    acw_ok = "ok" if s.cookies.get("acw_tc") else "?"
    print(f"[3/4] shield/webprofile: gid={gid_ok} acw_tc={acw_ok}")

    # Step 4: activate (自研签名)
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/login/activate"
    r = s.post(url, json={}, headers=sign_headers(s, url, {}),
               timeout=15, impersonate="chrome131")
    d = r.json()
    ws = s.cookies.get("web_session")
    ws_ok = "ok" if ws else "no"
    print(f"[4/4] activate: code={d.get('code')} ws={ws_ok}")

    cookies = s.cookies.get_dict()
    print(f"[ok] cookies: {len(cookies)} keys ({', '.join(sorted(cookies.keys()))})")
    print()

    if not ws:
        print("[!] web_session 获取失败，退出")
        sys.exit(1)

    # 保存 cookie
    (BASE_DIR / "data").mkdir(parents=True, exist_ok=True)
    (BASE_DIR / "data" / "cookies.json").write_text(
        json.dumps(cookies, ensure_ascii=False, indent=2))

    # ===== 测试 homefeed =====
    print("=== homefeed 测试 ===")
    body = {
        "cursor_score":"", "num":10, "refresh_type":1, "note_index":0,
        "unread_begin_note_id":"", "unread_end_note_id":"", "unread_note_count":0,
        "category":"homefeed_recommend", "search_key":"",
        "need_num":10, "image_formats":["jpg","webp","avif"], "need_filter_image":False,
    }
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
    r = s.post(url, json=body, headers=sign_headers(s, url, body),
               timeout=20, impersonate="chrome131")
    data = r.json()
    items = data.get("data",{}).get("items",[])
    print(f"code={data.get('code')} items={len(items)}")
    for it in items[:5]:
        nc = it.get("note_card") or it
        print(f"  - {nc.get('display_title', '?')[:60]}")

    if not items and data.get("code") == 0:
        print("  (游客空推荐，正常)")

    # 翻页
    print()
    print("=== 连续翻页 ===")
    cursor, ni = "", 0
    for pg in range(1, 4):
        body["cursor_score"] = cursor
        body["note_index"] = ni
        r = s.post(url, json=body, headers=sign_headers(s, url, body),
                   timeout=20, impersonate="chrome131")
        d = r.json()
        its = d.get("data",{}).get("items",[])
        cursor = d.get("data",{}).get("cursor_score","")
        if not its: break
        ni += len(its)
        print(f"  pg{pg}: {len(its)} items (total={ni}) cursor={'ok' if cursor else 'end'}")
        if not cursor: break

    print(f"\n[ok] done: {ni} notes total")

if __name__ == "__main__":
    main()
