#!/usr/bin/env python3
"""
小红书首页推荐流 — iv8 方案（纯 Python，无需 Node.js）

用法:
  python main_iv8.py            获取推荐流
  python main_iv8.py --pages 5  获取 5 页
  python main_iv8.py --detail   显示每条笔记正文

签名头:
  x-s         → xhs_sign.py (iv8 C++ V8, 替代 sign.js + env.js)
  x-t         → int(time.time() * 1000)
  x-b3        → random 16 hex
  x-xray      → (ts << 23) | random
  x-s-common  → 指纹 + RC4 + CRC32 + 自定义 Base64

Cookie 引导（全自动 4 步）:
  a1/webId → scripting → shield/webprofile → activate

依赖:
  pip install iv8 curl-cffi pycryptodome
  # 无需 Node.js、无需 npm install
"""

import hashlib
import json
import random
import re
import sys
import time
import urllib.parse
import uuid
import zlib
from base64 import b64encode as std_b64
from pathlib import Path

from Crypto.Cipher import ARC4, DES
from curl_cffi import requests

from xhs_sign import XhsSigner, _b64e, _json_to_bytes, B64_CHARS

# ===== 配置 =====
PAGES = 3
SHOW_DETAIL = False
INTERVAL = 1.5

BASE_DIR = Path(__file__).parent
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
API_PATH = "/api/sns/web/v1/homefeed"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# ═══════════════════════════════════════════════════════════════
#  全局 iv8 签名器（复用 V8 Isolate）
# ═══════════════════════════════════════════════════════════════

_signer: XhsSigner | None = None


def _get_signer() -> XhsSigner:
    global _signer
    if _signer is None:
        _signer = XhsSigner()
    return _signer


# ═══════════════════════════════════════════════════════════════
#  x-s — 调 iv8（替代原 sign.js 子进程）
# ═══════════════════════════════════════════════════════════════


def _xs(path: str, body: dict | None = None) -> str:
    """x-s: iv8 V8 引擎直接返回签名字符串"""
    return _get_signer().sign(path, body)


def _xt() -> int:
    return int(time.time() * 1000)


def _xb3() -> str:
    return "".join(random.choices("abcdef0123456789", k=16))


def _xxray() -> str:
    return hex(int(time.time() * 1000) << 23)[2:].zfill(16) + hex(
        random.getrandbits(64)
    )[2:].zfill(16)


# ═══════════════════════════════════════════════════════════════
#  x-s-common — Python 纯算（与原 main.py 完全相同）
# ═══════════════════════════════════════════════════════════════


def _make_fp(ts: int | None = None) -> dict:
    ts = ts or int(time.time() * 1000)
    return {
        "x33": "0",
        "x34": "0",
        "x35": "0",
        "x36": str(random.randint(1, 20)),
        "x37": "0|0|0|0|0|0|0|0|0|1|0|0|0|0|0|0|0|0|1|0|0|0|0|0",
        "x38": "0|0|1|0|1|0|0|0|0|0|1|0|1|0|1|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0",
        "x39": 0,
        "x42": "3.5.4",
        "x43": "Canvas not supported",
        "x44": str(ts),
        "x45": "__SEC_CAV__1-1-1-1-1|__SEC_WSA__|",
        "x46": "false",
        "x48": "",
        "x49": "{list:[],type:}",
        "x50": "",
        "x51": "",
        "x52": "",
        "x82": "_0x17a2|_0x1954",
    }


def _make_b1(fp: dict) -> str:
    keys = [
        "x33", "x34", "x35", "x36", "x37", "x38", "x39",
        "x42", "x43", "x44", "x45", "x46", "x48", "x49",
        "x50", "x51", "x52", "x82",
    ]
    s = json.dumps({k: fp[k] for k in keys}, separators=(",", ":"), ensure_ascii=False)
    ct = ARC4.new(b"xhswebmplfbt").encrypt(s.encode("utf-8"))
    u = urllib.parse.quote(ct.decode("latin1"), safe="!*'()~_-")
    r = bytearray()
    for p in u.split("%"):
        if not p:
            continue
        ch = list(p)
        r.append(int("".join(ch[:2]), 16))
        for c in ch[2:]:
            r.append(ord(c))
    return _b64e(bytes(r))


def _js_crc32(s: str) -> int:
    tbl = [0] * 256
    for i in range(256):
        c = i
        for _ in range(8):
            c = 0xEDB88320 ^ (c >> 1) if c & 1 else c >> 1
        tbl[i] = c
    c = 0xFFFFFFFF
    for b in s.encode("utf-8"):
        c = tbl[(c ^ b) & 0xFF] ^ (c >> 8)
    r = 0xFFFFFFFF ^ c
    return r - 0x100000000 if r >= 0x80000000 else r


def make_xsc(a1: str, fp: dict | None = None) -> str:
    fp = fp or _make_fp()
    b1 = _make_b1(fp)
    x9 = _js_crc32("" + "" + b1)
    obj = {
        "s0": 5, "s1": "",
        "x0": "1", "x1": "4.3.5", "x2": "Windows", "x3": "xhs-pc-web",
        "x4": "6.12.3", "x5": a1, "x6": "", "x7": "",
        "x8": b1, "x9": x9, "x10": fp["x39"], "x11": "normal",
    }
    return _b64e(_json_to_bytes(obj))


def sign_headers(url: str, cookies: dict, body: dict | None = None) -> dict:
    path = "/" + url.split("/", 3)[-1]
    a1 = cookies.get("a1", "")
    return {
        "content-type": "application/json;charset=UTF-8",
        "x-s": _xs(path, body),           # ← iv8 直接调用，不再 subprocess
        "x-t": str(_xt()),
        "x-s-common": make_xsc(a1),
        "x-b3-traceid": _xb3(),
        "x-xray-traceid": _xxray(),
    }


# ═══════════════════════════════════════════════════════════════
#  Cookie 引导（与原 main.py 完全相同，全自研 Python）
# ═══════════════════════════════════════════════════════════════

A1_CHARS = "abcdefghijklmnopqrstuvwxyz1234567890"


def _gen_a1() -> tuple[str, str]:
    ts = hex(int(time.time() * 1000))[2:]
    base = ts + "".join(random.choices(A1_CHARS, k=30)) + "5" + "0" + "000"
    crc = zlib.crc32(base.encode())
    a1 = (base + str(crc))[:52]
    return a1, hashlib.md5(a1.encode()).hexdigest()


def _gen_websectiga(js_text: str) -> str:
    b_m = re.search(r'"b":"(.*?)",', js_text)
    d_m = re.search(r'"d":(.*?)\}\)', js_text)
    b, d = b_m.group(1), json.loads(d_m.group(1))
    if len(b) % 4:
        b += "=" * (4 - len(b) % 4)
    decoded = __import__("base64").b64decode(b).decode("utf-8")
    logic, chunk = [], []
    for c in decoded:
        if len(chunk) == 5:
            logic.append(chunk)
            chunk = []
        chunk.append(ord(c) - 1)
    if chunk:
        logic.append(chunk)
    target = logic[d[92] : d[93] + 1]
    kb = [d[target[675 + i][2]] for i in range(0, 128, 2)]
    return "".join(chr(kb[i + j]) for i in range(56, -1, -8) for j in range(8))


def _get_gid(session: "requests.Session") -> None:
    fp_json = json.dumps(
        {"uuid": "joiamkprgeyi238i",
         "requestId": hashlib.md5(str(time.time()).encode()).hexdigest()[:16]},
        separators=(",", ":"),
    )
    fp_b64 = std_b64(fp_json.encode()).decode()
    raw = fp_b64.encode()
    pad = 8 - len(raw) % 8
    padded = raw if pad == 8 else raw + b"\x00" * pad
    pf = DES.new(b"zbp30y86", DES.MODE_ECB).encrypt(padded).hex()

    url = "https://as.xiaohongshu.com/api/sec/v1/shield/webprofile"
    data = {"platform": "Windows", "profileData": pf, "sdkVersion": "4.2.6", "svn": "2"}
    cookies = session.cookies.get_dict()
    session.post(
        url, json=data,
        headers=sign_headers(url, cookies, data),
        timeout=15, impersonate="chrome131",
    )


def _activate(session: "requests.Session") -> str | None:
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/login/activate"
    cookies = session.cookies.get_dict()
    session.post(
        url, json={},
        headers=sign_headers(url, cookies, {}),
        timeout=15, impersonate="chrome131",
    )
    return session.cookies.get("web_session")


def boot_guest_cookies() -> dict:
    s = requests.Session()
    s.headers.update({
        "user-agent": UA,
        "accept": "application/json, text/plain, */*",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    })

    a1, webId = _gen_a1()
    s.cookies.update({
        "a1": a1, "webId": webId, "webBuild": "6.12.3",
        "xsecappid": "xhs-pc-web", "loadts": str(int(time.time() * 1000)),
        "abRequestId": str(uuid.uuid4()),
    })
    print(f"[1/4] a1={a1[:20]}... webId={webId[:16]}...")

    try:
        r = s.post(
            "https://as.xiaohongshu.com/api/sec/v1/scripting",
            json={"callFrom": "web", "callback": "seccallback"},
            headers={"content-type": "application/json"},
            timeout=15, impersonate="chrome131",
        )
        resp = r.json()
        js_text = resp["data"]["data"]
        sec_pid = resp["data"].get("secPoisonId", str(uuid.uuid4()))
        s.cookies.update({
            "websectiga": _gen_websectiga(js_text),
            "sec_poison_id": sec_pid,
        })
        print(f"[2/4] websectiga={s.cookies['websectiga'][:20]}...")
    except Exception as e:
        print(f"[2/4] websectiga 失败: {e}")

    try:
        _get_gid(s)
        gid = "ok" if s.cookies.get("gid") else "no"
        print(f"[3/4] gid={gid} acw_tc={'ok' if s.cookies.get('acw_tc') else '?'}")
    except Exception as e:
        print(f"[3/4] gid 失败: {e}")

    ws = _activate(s)
    print(f"[4/4] web_session={'ok' if ws else 'no'}")
    if not ws:
        raise RuntimeError("游客 web_session 引导失败")

    cookies = s.cookies.get_dict()
    COOKIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    COOKIES_FILE.write_text(json.dumps(cookies, ensure_ascii=False, indent=2))
    print(f"[ok] {len(cookies)} cookies 已保存 -> {COOKIES_FILE}")
    return cookies


# ═══════════════════════════════════════════════════════════════
#  API 请求
# ═══════════════════════════════════════════════════════════════


def load_cookies() -> dict:
    return json.loads(COOKIES_FILE.read_text()) if COOKIES_FILE.exists() else {}


def fetch_homefeed(cursor: str = "", note_index: int = 0,
                   cookies: dict | None = None) -> dict:
    body = {
        "cursor_score": cursor, "num": 20, "refresh_type": 1,
        "note_index": note_index, "unread_begin_note_id": "",
        "unread_end_note_id": "", "unread_note_count": 0,
        "category": "homefeed_recommend", "search_key": "",
        "need_num": 14, "image_formats": ["jpg", "webp", "avif"],
        "need_filter_image": False,
    }
    s = requests.Session()
    s.headers.update({
        "user-agent": UA,
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/explore",
        "accept": "application/json, text/plain, */*",
    })
    if cookies:
        s.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})
    resp = s.post(
        API_URL, json=body,
        headers=sign_headers(API_URL, cookies, body),
        timeout=30, impersonate="chrome131",
    )
    return resp.json()


def fetch_note_detail(note_id: str, xsec_token: str,
                      session: "requests.Session") -> dict | None:
    try:
        url = (f"https://www.xiaohongshu.com/explore/{note_id}"
               f"?xsec_token={xsec_token}&xsec_source=pc_feed")
        resp = session.get(url, headers={
            "accept": "text/html", "user-agent": UA,
        }, timeout=20, impersonate="chrome131")
        html = resp.text
        idx = html.find("window.__INITIAL_STATE__=")
        if idx < 0:
            return None
        start = html.index("{", idx)
        depth, end = 0, start
        for i in range(start, len(html)):
            if html[i] == "{": depth += 1
            elif html[i] == "}":
                depth -= 1
                if depth == 0: end = i + 1; break
        data = json.loads(html[start:end].replace("undefined", "null"))
        note = (data.get("note", {}).get("noteDetailMap", {})
                .get(note_id, {}).get("note", {}))
        if note:
            return {
                "desc": note.get("desc", ""),
                "title": note.get("title", ""),
                "type": note.get("type", ""),
                "tags": [t.get("name", "") for t in (note.get("tagList") or [])],
            }
    except Exception:
        pass
    return None


# ═══════════════════════════════════════════════════════════════
#  主流程
# ═══════════════════════════════════════════════════════════════


def main():
    cookies = load_cookies()
    if not cookies.get("web_session"):
        print("[*] 缺少 web_session，开始自动引导...\n")
        try:
            cookies = boot_guest_cookies()
        except Exception as e:
            print(f"[!] 引导失败: {e}", file=sys.stderr)
            sys.exit(1)
        print()

    print(f"web_session: {cookies['web_session'][:20]}...")
    print(f"页数: {PAGES}, 正文: {'显示' if SHOW_DETAIL else '不显示'}\n")

    detail_http = requests.Session()
    detail_http.headers.update({
        "user-agent": UA, "origin": "https://www.xiaohongshu.com",
    })
    detail_http.cookies.update({
        k: str(v) for k, v in cookies.items() if isinstance(v, str)
    })

    total, cursor, note_index = 0, "", 0
    for pg in range(1, PAGES + 1):
        print(f"── 第 {pg}/{PAGES} 页 " + "─" * 50)
        data = fetch_homefeed(cursor, note_index, cookies)
        code = data.get("code")

        if not data.get("success") and code != 0:
            print(f"  [!] API 错误 code={code} msg={data.get('msg', '')}")
            break

        items = data.get("data", {}).get("items") or []
        if not items:
            print("  (无数据)")
            break

        total += len(items)
        for i, it in enumerate(items, 1):
            idx = (pg - 1) * 20 + i
            nc = it.get("note_card") or it
            ntype = nc.get("type", "?")
            icon = {"video": "[V]", "normal": "[N]"}.get(ntype, "[?]")
            title = (nc.get("display_title") or nc.get("title") or "").strip() or "(无标题)"
            author = (nc.get("user") or {}).get("nickname") or "?"
            likes = (nc.get("interact_info") or {}).get("liked_count", "0")
            print(f"  {idx:2d}. {icon} {title[:70]}")
            print(f"      @{author}  likes:{likes}")

            if SHOW_DETAIL:
                note_id = it.get("id", "")
                xsec = it.get("xsec_token", "")
                if note_id and xsec:
                    detail = fetch_note_detail(note_id, xsec, detail_http)
                    if detail and detail.get("desc"):
                        desc = detail["desc"]
                        for j in range(0, min(len(desc), 500), 80):
                            print(f"      │ {desc[j:j+80]}")
                        if len(desc) > 500:
                            print(f"      │ ...(共 {len(desc)} 字)")
                    time.sleep(0.3)

        cursor = data.get("data", {}).get("cursor_score") or ""
        note_index += len(items)
        if not cursor:
            print("\n  (已到最后一页)")
            break
        time.sleep(INTERVAL)

    print(f"\n{'=' * 60}")
    print(f"  共 {total} 条笔记")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="小红书 — iv8 签名 + 爬取")
    p.add_argument("--pages", type=int, default=PAGES, help=f"页数（默认 {PAGES}）")
    p.add_argument("--detail", action="store_true", help="显示每条笔记正文")
    args = p.parse_args()
    if args.detail:
        SHOW_DETAIL = True
    if args.pages:
        PAGES = args.pages
    main()
