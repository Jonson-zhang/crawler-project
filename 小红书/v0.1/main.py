#!/usr/bin/env python3
"""
main.py — 小红书首页推荐流抓取 (API 翻页 + 笔记正文)

用法: python main.py
修改下方 PAGES / SHOW_DETAIL 控制行为

游客 Cookie 自动引导:
  - 签名: RedCrack xhs_encrypt 纯算（x-s/x-s-common/x-b3/x-xray/x-rap-param）
  - 引导: scripting → shield/webprofile → activate（全程完整签名头）
  - 结果: 11 项 cookie，homefeed API 可用
"""

import hashlib
import json
import random
import re
import subprocess
import sys
import time
import urllib.parse
import uuid
import zlib
from pathlib import Path
from urllib.parse import quote

from curl_cffi import requests

# RedCrack 纯算模块（需先 git clone https://github.com/Cialle/RedCrack /tmp/RedCrack）
_REDCRACK_DIR = Path("/tmp/RedCrack")
if str(_REDCRACK_DIR) not in sys.path:
    sys.path.insert(0, str(_REDCRACK_DIR))

# Windows GBK 终端兼容
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ===== 配置 =====
PAGES = 3            # 翻页数
SHOW_DETAIL = False  # True=显示笔记正文
INTERVAL = 1.5       # 页间间隔秒数

# ===== 路径 =====
BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"               # 保留：Node.js 签名（备用）
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
API_PATH = "/api/sns/web/v1/homefeed"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"

A1_CHARS = "abcdefghijklmnopqrstuvwxyz1234567890"


def b64e(data: bytes) -> str:
    n, m, r = len(data), len(data) % 3, []
    for i in range(0, n - m, 16383):
        limit = min(i + 16383, n - m)
        for j in range(i, limit, 3):
            t = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            r.append(B64[(t >> 18) & 63] + B64[(t >> 12) & 63] + B64[(t >> 6) & 63] + B64[t & 63])
    if m == 1:
        b = data[n - 1]
        r.append(B64[b >> 2] + B64[(b << 4) & 63] + "==")
    elif m == 2:
        p = (data[n - 2] << 8) + data[n - 1]
        r.append(B64[p >> 10] + B64[(p >> 4) & 63] + B64[(p << 2) & 63] + "=")
    return "".join(r)


def utf8b(s: str) -> bytes:
    e = quote(s, safe="~()*!./:?=&-_")
    result, i = bytearray(), 0
    while i < len(e):
        if e[i] == "%":
            result.append(int(e[i + 1: i + 3], 16))
            i += 3
        else:
            result.append(ord(e[i]))
            i += 1
    return bytes(result)


def load_cookies() -> dict:
    return json.loads(COOKIES_FILE.read_text()) if COOKIES_FILE.exists() else {}


def save_cookies(cookies: dict) -> None:
    COOKIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    COOKIES_FILE.write_text(json.dumps(cookies, ensure_ascii=False, indent=2))


# ===== RedCrack 纯算集成 =====

def _get_rc_encrypt():
    """惰性加载 RedCrack xhs_encrypt（首次调用时导入）"""
    from request.web.encrypt.xhs_encrypt import xhs_encrypt
    return xhs_encrypt


def _rc_sign_headers(session: "requests.Session", url: str, data: dict | None = None) -> dict:
    """用 RedCrack xhs_encrypt 生成完整请求头（对标 XHS_Session.__request_encrypt）

    生成: x-s, x-t, x-s-common, x-b3-traceid, x-xray-traceid, x-rap-param
    """
    xhs = _get_rc_encrypt()
    cookies = session.cookies.get_dict()
    a1 = cookies.get("a1", "")
    url_path = urllib.parse.urlparse(url).path

    fp = xhs.get_fingerprint(cookies, UA)

    loadts = str(int(time.time() * 1000))
    session.cookies.update({"loadts": loadts})

    xray = xhs.encrypt_headers_xray()
    xb3 = xhs.encrypt_header_xb3()
    xs = xhs.encrypt_headers_xs(a1, int(loadts), url_path, None, data)
    xhs.update_fingerprint(fp, cookies, url)
    xsc = xhs.encrypt_headers_xsc(a1, fp)
    xrap = xhs.encrypt_headers_xrap_param(url, data)
    xt = int(time.time() * 1000)

    headers = {
        "x-s": xs,
        "x-t": str(xt),
        "x-s-common": xsc,
        "x-b3-traceid": xb3,
        "x-xray-traceid": xray,
    }
    if xrap:
        headers["x-rap-param"] = xrap
    return headers


def _generate_a1() -> tuple[str, str]:
    """纯 Python 生成 a1 + webId"""
    ts_hex = hex(int(time.time() * 1000))[2:]
    rand_str = "".join(random.choices(A1_CHARS, k=30))
    base = ts_hex + rand_str + "5" + "0" + "000"
    crc = zlib.crc32(base.encode())
    a1 = (base + str(crc))[:52]
    web_id = hashlib.md5(a1.encode()).hexdigest()
    return a1, web_id


def _gen_websectiga_from_text(js_text: str) -> str:
    """从 /api/sec/v1/scripting 返回的 JS 文本解密 websectiga（对标 RedCrack）"""
    b_match = re.search(r'"b":"(.*?)",', js_text)
    d_match = re.search(r'"d":(.*?)\}\)', js_text)
    if not b_match or not d_match:
        raise RuntimeError(f"websectiga 解析失败")

    b = b_match.group(1)
    d = json.loads(d_match.group(1))

    padding = len(b) % 4
    if padding:
        b += "=" * (4 - padding)
    decoded = __import__("base64").b64decode(b).decode("utf-8")

    logic_list: list[list[int]] = []
    chunk: list[int] = []
    for char in decoded:
        if len(chunk) == 5:
            logic_list.append(chunk)
            chunk = []
        chunk.append(ord(char) - 1)
    if chunk:
        logic_list.append(chunk)

    target = logic_list[d[92] : d[93] + 1]
    key_bytes = [d[target[675 + i][2]] for i in range(0, 128, 2)]
    decode_key = "".join(chr(key_bytes[i + j]) for i in range(56, -1, -8) for j in range(8))
    return decode_key


# ===== 游客 Cookie 自动引导 =====

def boot_guest_cookies() -> dict:
    """完整的游客 Cookie 引导流程

    步骤：
      1. 生成 a1 + webId + abRequestId
      2. /api/sec/v1/scripting → websectiga + sec_poison_id
      3. /api/sec/v1/shield/webprofile → gid + acw_tc（带完整签名）
      4. /login/activate → web_session（带完整签名）

    Returns:
        完整的 cookies dict（11 项），自动保存到 data/cookies.json
    """
    s = requests.Session()
    s.headers.update({
        "user-agent": UA,
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    })

    # Step 1: 基础 cookies
    a1, web_id = _generate_a1()
    s.cookies.update({
        "a1": a1, "webId": web_id, "webBuild": "6.12.3",
        "xsecappid": "xhs-pc-web", "loadts": str(int(time.time() * 1000)),
        "abRequestId": str(uuid.uuid4()),
    })
    print(f"[1/4] a1={a1[:20]}... webId={web_id[:16]}...")

    # Step 2: scripting → websectiga + sec_poison_id
    try:
        url = "https://as.xiaohongshu.com/api/sec/v1/scripting"
        r = s.post(url, json={"callFrom": "web", "callback": "seccallback"},
                   headers={"content-type": "application/json"},
                   timeout=15, impersonate="chrome131")
        resp_json = r.json()
        js_text = resp_json.get("data", {}).get("data", "")
        websectiga = _gen_websectiga_from_text(js_text)
        sec_pid = resp_json.get("data", {}).get("secPoisonId", str(uuid.uuid4()))
        s.cookies.update({"websectiga": websectiga, "sec_poison_id": sec_pid})
        print(f"[2/4] websectiga={websectiga[:20]}... sec_poison_id={sec_pid[:12]}...")
    except Exception as e:
        print(f"[2/4] websectiga 失败（继续）: {e}")

    # Step 3: shield/webprofile → gid + acw_tc（必须带完整签名！）
    try:
        xhs = _get_rc_encrypt()
        cookies = s.cookies.get_dict()
        fp = xhs.get_fingerprint(cookies, UA)
        url, data = xhs.gen_gid_webprofile_data(fp)
        r = s.post(url, json=data, headers={
            "content-type": "application/json;charset=UTF-8",
            **_rc_sign_headers(s, url, data),
        }, timeout=15, impersonate="chrome131")
        gid = s.cookies.get("gid") or "?"
        acw = s.cookies.get("acw_tc") or "?"
        print(f"[3/4] gid={'✓' if gid != '?' else '✗'} acw_tc={'✓' if acw != '?' else '✗'}")
    except Exception as e:
        print(f"[3/4] gid 失败（继续）: {e}")

    # Step 4: activate → web_session（必须带完整签名！）
    url = "https://edith.xiaohongshu.com/api/sns/web/v1/login/activate"
    r = s.post(url, json={}, headers={
        "content-type": "application/json;charset=UTF-8",
        **_rc_sign_headers(s, url, {}),
    }, timeout=15, impersonate="chrome131")
    data = r.json() if r.text else {}
    ws = s.cookies.get("web_session")
    print(f"[4/4] activate: code={data.get('code')} web_session={'✓' if ws else '✗'}")

    if not ws:
        raise RuntimeError("游客 web_session 引导失败")

    # 收集结果
    cookies = s.cookies.get_dict()
    print(f"[✓] cookies: {len(cookies)} 项 ({', '.join(sorted(cookies.keys()))})")
    save_cookies(cookies)
    print(f"[✓] 已保存到 {COOKIES_FILE}")
    return cookies


# ===== 签名 & API 请求 =====

def node_sign(api_path: str, body: dict | None = None) -> dict:
    """Node.js sign.js 签名（备用，引导流程不依赖此项）"""
    body_json = json.dumps(body or {}, separators=(",", ":"))
    result = subprocess.run(
        ["node", str(SIGN_JS), api_path, body_json],
        capture_output=True, text=True, timeout=30, cwd=str(BASE_DIR),
    )
    if result.returncode != 0:
        raise RuntimeError(f"sign.js 失败 (exit={result.returncode}): {(result.stderr or '').strip()}")
    stdout = (result.stdout or "").strip()
    if not stdout:
        raise RuntimeError("sign.js 无输出")
    return json.loads(stdout)


def make_api_headers(cookies: dict, url: str, data: dict | None = None, use_rc: bool = True) -> dict:
    """生成 API 请求头

    use_rc=True:  用 RedCrack 纯算（x-s/x-s-common/x-b3/x-xray/x-rap-param）
    use_rc=False: 用 Node.js sign.js（仅 x-s/x-t/x-s-common，兼容旧方案）
    """
    if use_rc:
        # 用 RedCrack 完整签名
        s = requests.Session()
        s.headers.update({
            "user-agent": UA, "origin": "https://www.xiaohongshu.com",
            "accept": "application/json, text/plain, */*",
        })
        for k, v in cookies.items():
            if isinstance(v, str):
                s.cookies.update({k: v})
        return _rc_sign_headers(s, url, data)
    else:
        # 用 Node.js sign.js（仅 x-s/x-t/x-s-common）
        path = urllib.parse.urlparse(url).path
        signed = node_sign(path, data)
        md5_url = hashlib.md5(path.encode()).hexdigest()
        cp = {"a1": "", "x1": "4.3.5", "x2": path, "x3": "xhs-pc-web", "x4": md5_url}
        return {
            "x-s": signed["X-s"],
            "x-t": signed["X-t"],
            "x-s-common": b64e(utf8b(json.dumps(cp, separators=(",", ":")))),
        }


def fetch_homefeed(cursor: str = "", note_index: int = 0, cookies: dict | None = None) -> dict:
    """调用 homefeed API（带完整 RedCrack 签名）"""
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
        "user-agent": UA, "origin": "https://www.xiaohongshu.com",
        "accept": "application/json, text/plain, */*",
        "referer": "https://www.xiaohongshu.com/explore",
    })
    if cookies:
        s.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})

    resp = s.post(API_URL, json=body, headers={
        "content-type": "application/json;charset=UTF-8",
        **make_api_headers(cookies, API_URL, body, use_rc=True),
    }, timeout=30, impersonate="chrome131")
    return resp.json()


def fetch_note_detail(note_id: str, xsec_token: str, session: "requests.Session") -> dict | None:
    """GET 笔记 SSR 页面, 从 __INITIAL_STATE__ 提取正文"""
    try:
        url = f"https://www.xiaohongshu.com/explore/{note_id}?xsec_token={xsec_token}&xsec_source=pc_feed"
        resp = session.get(url, headers={"accept": "text/html", "user-agent": UA},
                           timeout=20, impersonate="chrome131")
        html = resp.text
        idx = html.find("window.__INITIAL_STATE__=")
        if idx < 0:
            return None

        start = html.index("{", idx)
        depth, end = 0, start
        for i in range(start, len(html)):
            if html[i] == "{":
                depth += 1
            elif html[i] == "}":
                depth -= 1
            if depth == 0:
                end = i + 1
                break

        data = json.loads(html[start:end].replace("undefined", "null"))
        note = data.get("note", {}).get("noteDetailMap", {}).get(note_id, {}).get("note", {})
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


# ===== 主流程 =====

def main():
    cookies = load_cookies()
    if not cookies.get("web_session"):
        print("[*] cookies.json 缺少 web_session，开始自动引导游客 Cookie...\n")
        try:
            cookies = boot_guest_cookies()
        except Exception as e:
            print(f"[!] 游客 Cookie 引导失败: {e}", file=sys.stderr)
            sys.exit(1)
        print()

    print(f"web_session: {cookies['web_session'][:20]}...")
    print(f"页数: {PAGES}, 正文: {'显示' if SHOW_DETAIL else '不显示'}\n")

    detail_http = requests.Session()
    detail_http.headers.update({"user-agent": UA, "origin": "https://www.xiaohongshu.com"})
    detail_http.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})

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
            icon = {"video": "🎬", "normal": "📝"}.get(ntype, "📌")
            title = (nc.get("display_title") or nc.get("title") or "").strip() or "(无标题)"
            author = (nc.get("user") or {}).get("nickname") or "?"
            likes = (nc.get("interact_info") or {}).get("liked_count", "0")

            print(f"  {idx:2d}. {icon} {title[:70]}")
            print(f"      @{author}  ❤{likes}")

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
    main()
