#!/usr/bin/env python3
"""
main.py — 小红书首页推荐流抓取 (API 翻页 + 笔记正文)

用法: python main.py
修改下方 PAGES / SHOW_DETAIL 控制行为
"""

import hashlib
import json
import random
import subprocess
import sys
import time
import zlib
from pathlib import Path
from urllib.parse import quote

from curl_cffi import requests

# Windows GBK 终端兼容
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ===== 配置 =====
PAGES = 3            # 翻页数
SHOW_DETAIL = False  # True=显示笔记正文(需找到详情API端点后可用)
INTERVAL = 1.5       # 页间间隔秒数

# ===== 路径 =====
BASE_DIR = Path(__file__).parent
SIGN_JS = BASE_DIR / "sign.js"
COOKIES_FILE = BASE_DIR / "data" / "cookies.json"
API_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/homefeed"
API_PATH = "/api/sns/web/v1/homefeed"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36"
B64 = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"


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


# ===== 游客 Cookie 自动生成 =====

A1_CHARS = "abcdefghijklmnopqrstuvwxyz1234567890"


def _generate_a1() -> tuple[str, str]:
    """生成 a1 和 webId（纯 Python，零依赖）

    a1 结构: hex(毫秒时间戳) + 随机30字符 + 平台码 + "0" + "000" + CRC32
    截取前 52 位；webId = MD5(a1)
    """
    ts_hex = hex(int(time.time() * 1000))[2:]
    rand_str = "".join(random.choices(A1_CHARS, k=30))
    base = ts_hex + rand_str + "5" + "0" + "000"  # 5 = Windows 平台码
    crc = zlib.crc32(base.encode())
    a1 = (base + str(crc))[:52]
    web_id = hashlib.md5(a1.encode()).hexdigest()
    return a1, web_id


def _gen_websectiga(session: "requests.Session") -> str:
    """从 /api/sec/v1/scripting 获取并解密 websectiga

    对标 RedCrack websectiga.py JSVMP 解密逻辑：
    1. POST https://as.xiaohongshu.com/api/sec/v1/scripting 获取 b/d 字段
    2. Base64 解码 b → 减 1 → 按 5 分组
    3. 用 d 的 [92:94] 切片定位 → 每 2 个取 1 个 → 倒序 7 组拼出 64 位 key
    """
    import re

    resp = session.post(
        "https://as.xiaohongshu.com/api/sec/v1/scripting",
        json={"callFrom": "web", "callback": "seccallback"},
        headers={"content-type": "application/json"},
        timeout=15,
    )
    data = resp.json().get("data", {})
    js_text = data.get("data", "")

    # 提取 b 和 d
    b_match = re.search(r'"b":"(.*?)",', js_text)
    d_match = re.search(r'"d":(.*?)\}\)', js_text)
    if not b_match or not d_match:
        raise RuntimeError(f"websectiga 解析失败: b={bool(b_match)} d={bool(d_match)}")

    b = b_match.group(1)
    d = json.loads(d_match.group(1))

    # Base64 解码 b → 每个 char 减 1 → 按 5 个一组
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

    # d[92]:d[93] 切片定位 → 每 2 个取 1 个 key byte → 倒序拼出 64 位
    target = logic_list[d[92] : d[93] + 1]
    key_bytes = [d[target[675 + i][2]] for i in range(0, 128, 2)]
    decode_key = "".join(chr(key_bytes[i + j]) for i in range(56, -1, -8) for j in range(8))

    return decode_key


def _get_gid_and_acw_tc(session: "requests.Session") -> None:
    """获取 gid 并写入 accesstc cookie（DES 加密指纹 → /api/sec/v1/shield/webprofile）

    这是一个请求副作用：响应会 Set-Cookie acw_tc 和 gid
    """
    from base64 import b64encode

    # 最小指纹（只需 uuid + requestId 即可过）
    fp = json.dumps(
        {"uuid": "joiamkprgeyi238i", "requestId": hashlib.md5(str(time.time()).encode()).hexdigest()[:16]},
        separators=(",", ":"),
    )
    fp_b64 = b64encode(fp.encode()).decode()

    # DES ECB 加密
    from Crypto.Cipher import DES

    key = b"zbp30y86"
    raw = fp_b64.encode()
    pad_len = 8 - len(raw) % 8
    padded = raw if pad_len == 8 else raw + b"\x00" * pad_len
    cipher = DES.new(key, DES.MODE_ECB)
    profile_data = cipher.encrypt(padded).hex()

    session.post(
        "https://as.xiaohongshu.com/api/sec/v1/shield/webprofile",
        json={
            "platform": "Windows",
            "profileData": profile_data,
            "sdkVersion": "4.2.6",
            "svn": "2",
        },
        headers={"content-type": "application/json;charset=UTF-8"},
        timeout=15,
    )


def _activate_guest_web_session(session: "requests.Session") -> str | None:
    """调 /login/activate 获取游客 web_session

    对标 RedCrack：该接口也走完整的签名加密流程（x-s / x-s-common / x-t / x-b3 / x-xray）。
    """
    api_path = "/api/sns/web/v1/login/activate"
    body: dict = {}

    # 签名（调 Node sign.js）
    try:
        signed = node_sign(api_path, body)
    except Exception:
        signed = None

    # 构建请求头
    extra_headers: dict = {
        "content-type": "application/json;charset=UTF-8",
    }
    if signed:
        extra_headers.update({
            "x-s": signed["X-s"],
            "x-t": signed["X-t"],
            "x-s-common": signed.get("X-s-common", ""),
        })
    # x-b3-traceid: 随机 16 hex
    extra_headers["x-b3-traceid"] = "".join(random.choices("abcdef0123456789", k=16))
    # x-xray-traceid: 时间戳左移 23 + 递增 seq + 随机 64 位
    extra_headers["x-xray-traceid"] = (
        hex(int(time.time() * 1000) << 23)[2:].zfill(16)
        + hex(random.getrandbits(64))[2:].zfill(16)
    )

    resp = session.post(
        "https://edith.xiaohongshu.com/api/sns/web/v1/login/activate",
        json=body,
        headers=extra_headers,
        timeout=15,
    )
    # 调试：查看响应状态
    data = resp.json() if resp.text else {}
    code = data.get("code", resp.status_code)
    msg = data.get("msg", "")
    print(f"    activate 响应: code={code} msg={msg}")

    web_session = session.cookies.get("web_session")
    if not web_session:
        web_session = resp.cookies.get("web_session")
    return web_session or None


def boot_guest_cookies() -> dict:
    """完整的游客 Cookie 引导流程（对标 RedCrack XHS_Session.__init_cookies）

    步骤：
      1. 生成 a1 + webId，写入 cookie jar
      2. 获取 websectiga + sec_poison_id
      3. 获取 gid + acw_tc
      4. 调 /login/activate 获取 web_session

    Returns:
        完整的 cookies dict，自动保存到 data/cookies.json
    """
    s = requests.Session()
    s.headers.update({
        "user-agent": UA,
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        "origin": "https://www.xiaohongshu.com",
        "referer": "https://www.xiaohongshu.com/",
    })

    # Step 1: 生成 a1 + webId
    a1, web_id = _generate_a1()
    s.cookies.set("a1", a1, domain=".xiaohongshu.com")
    s.cookies.set("webId", web_id, domain=".xiaohongshu.com")
    s.cookies.set("webBuild", "6.12.3", domain=".xiaohongshu.com")
    s.cookies.set("xsecappid", "xhs-pc-web", domain=".xiaohongshu.com")
    s.cookies.set("loadts", str(int(time.time() * 1000)), domain=".xiaohongshu.com")
    print(f"[1/4] a1={a1[:20]}... webId={web_id[:16]}...")

    # Step 2: websectiga
    try:
        websectiga = _gen_websectiga(s)
        s.cookies.set("websectiga", websectiga, domain=".xiaohongshu.com")
        print(f"[2/4] websectiga={websectiga[:20]}...")
    except Exception as e:
        print(f"[2/4] websectiga 失败（继续）: {e}")

    # Step 3: gid + acw_tc
    try:
        _get_gid_and_acw_tc(s)
        gid = s.cookies.get("gid") or "?"
        print(f"[3/4] gid={gid[:20] if gid != '?' else '?'}")
    except Exception as e:
        print(f"[3/4] gid 失败（继续）: {e}")

    # Step 4: 激活 web_session
    web_session = _activate_guest_web_session(s)
    if not web_session:
        print("[4/4] web_session 获取失败（接口可能已变化）")
        raise RuntimeError("游客 web_session 引导失败")

    print(f"[4/4] web_session={web_session[:20]}...")

    # 收集结果
    cookies = s.cookies.get_dict() if hasattr(s.cookies, "get_dict") else {c.name: c.value for c in s.cookies}
    if cookies.get("web_session"):
        save_cookies(cookies)
        print(f"[✓] cookies 已保存到 {COOKIES_FILE}")
    return cookies


def node_sign(api_path: str, body: dict | None = None) -> dict:
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


def make_xs_headers(api_path: str, body: dict | None = None) -> dict:
    signed = node_sign(api_path, body)
    md5_url = hashlib.md5(api_path.encode()).hexdigest()
    cp = {"a1": "", "x1": "4.3.5", "x2": api_path, "x3": "xhs-pc-web", "x4": md5_url}
    return {
        "x-s": signed["X-s"],
        "x-t": signed["X-t"],
        "x-s-common": b64e(utf8b(json.dumps(cp, separators=(",", ":")))),
    }


def fetch_homefeed(cursor: str = "", note_index: int = 0, cookies: dict | None = None) -> dict:
    body = {
        "cursor_score": cursor, "num": 20, "refresh_type": 1,
        "note_index": note_index, "unread_begin_note_id": "",
        "unread_end_note_id": "", "unread_note_count": 0,
        "category": "homefeed_recommend", "search_key": "",
        "need_num": 14, "image_formats": ["jpg", "webp", "avif"],
        "need_filter_image": False,
    }
    s = requests.Session()
    s.headers.update({"user-agent": UA, "origin": "https://www.xiaohongshu.com"})
    if cookies:
        s.cookies.update({k: str(v) for k, v in cookies.items() if isinstance(v, str)})
    resp = s.post(API_URL, json=body, headers={
        "content-type": "application/json;charset=UTF-8",
        **make_xs_headers(API_PATH, body),
    }, timeout=30, impersonate="chrome131")
    return resp.json()


def fetch_note_detail(note_id: str, xsec_token: str, session: requests.Session) -> dict | None:
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

    # 签名预检
    try:
        node_sign(API_PATH, {"cursor_score": "", "num": 1, "refresh_type": 1, "note_index": 0})
    except Exception as e:
        print(f"[!] 签名失败: {e}", file=sys.stderr)
        sys.exit(1)

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
            if pg == 1 and code == 0:
                print("  (推荐流为空：游客账号无浏览历史，可尝试搜索 API 或使用登录账号)")
            else:
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
