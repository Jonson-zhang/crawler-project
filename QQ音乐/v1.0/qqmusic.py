"""
QQ音乐 榜单歌曲爬虫
==================
通过 Node.js 补环境调用签名/加解密函数，纯 Python 发起 HTTP 请求。

用法: python qqmusic.py
"""

import json
import os
import subprocess
import time
from typing import Optional

import requests

# ── 配置 ────────────────────────────────────────────────
NODE_SCRIPT = os.path.join(os.path.dirname(__file__), "qqmusic_api.js")
BASE_URL = "https://u6.y.qq.com/cgi-bin/musics.fcg"

HEADERS = {
    "accept": "application/octet-stream",
    "accept-language": "zh-CN,zh;q=0.9",
    "content-type": "text/plain",
    "origin": "https://y.qq.com",
    "priority": "u=1, i",
    "referer": "https://y.qq.com/",
    "sec-ch-ua": '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
}

COOKIES = {
    "pgv_pvid": "6498002570",
    "fqm_pvqid": "ded3603f-de8d-4c5f-874a-d08c8a32afdf",
    "fqm_sessionid": "864862b3-07bd-4589-90c1-7b269487e0bf",
    "pgv_info": "ssid=s4139352576",
    "ts_uid": "7833505689",
    "ts_last": "y.qq.com/n/ryqq_v2/toplist/4",
}


def call_node(action: str, data: str) -> str:
    """调用 Node.js 脚本执行签名/加解密。

    大数据(decrypt)通过临时文件传递，避免命令行/stdin 限制。
    """
    if len(data) > 10000:
        # 大数据：写入临时文件，Node.js 读文件
        import tempfile
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False,
            encoding="utf-8", dir=os.path.dirname(__file__)
        )
        try:
            tmp.write(data)
            tmp.close()
            proc = subprocess.run(
                ["node", NODE_SCRIPT, action, "--file", tmp.name],
                capture_output=True, timeout=60,
                cwd=os.path.dirname(__file__),
            )
        finally:
            try: os.unlink(tmp.name)
            except OSError: pass
    else:
        proc = subprocess.run(
            ["node", NODE_SCRIPT, action, data],
            capture_output=True, timeout=30,
            cwd=os.path.dirname(__file__),
        )

    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(stderr or f"Node.js exit={proc.returncode}")

    stdout = proc.stdout.decode("utf-8", errors="replace").strip()
    if not stdout:
        raise RuntimeError("Node.js returned empty output")
    result = json.loads(stdout)
    if not result.get("success"):
        raise RuntimeError(result.get("error", "unknown"))
    return result["result"]


def get_sign(data: str) -> str:
    """生成 zzc 签名"""
    return call_node("sign", data)


def encrypt_payload(data: dict) -> str:
    """加密请求载荷"""
    json_str = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return call_node("encrypt", json_str)


def decrypt_response(data: str) -> str:
    """解密响应数据 (暂未完全调试通过)"""
    return call_node("decrypt", data)


def build_request_data(module: str, method: str, param: dict) -> dict:
    """构建请求 comm + req 结构"""
    return {
        "comm": {
            "cv": 4747474,
            "ct": 24,
            "format": "json",
            "inCharset": "utf-8",
            "outCharset": "utf-8",
            "notice": 0,
            "platform": "yqq.json",
            "needNewCode": 1,
            "uin": 0,
            "g_tk_new_20200303": 5381,
            "g_tk": 5381,
        },
        "req_1": {
            "module": module,
            "method": method,
            "param": param,
        },
    }


def fetch_toplist(toplist_id: int = 62) -> Optional[dict]:
    """
    获取榜单歌曲列表

    Args:
        toplist_id: 榜单ID (62=热歌榜, 4=流行榜, 等)

    Returns:
        解析后的歌曲列表字典
    """
    request_data = build_request_data(
        module="musicToplist.ToplistInfoServer",
        method="GetAll",
        param={},
    )

    # 1. Encrypt payload (returns base64 string - send as-is)
    json_str = json.dumps(request_data, separators=(",", ":"), ensure_ascii=False)
    encrypted_body = encrypt_payload(request_data)
    # The body is sent as base64-encoded text (content-type: text/plain)

    # 2. 生成签名
    sign = get_sign(json_str)

    # 3. 构建URL参数
    timestamp = int(time.time() * 1000)
    params = {
        "_": str(timestamp),
        "encoding": "ag-1",
        "sign": sign,
    }

    # 4. 发起请求
    print(f"[*] Requesting toplist {toplist_id}...")
    print(f"    URL: {BASE_URL}")
    print(f"    Sign: {sign}")
    print(f"    Payload size: {len(encrypted_body)} bytes")

    resp = requests.post(
        BASE_URL,
        params=params,
        headers=HEADERS,
        cookies=COOKIES,
        data=encrypted_body,
        timeout=30,
    )

    print(f"    Status: {resp.status_code}")
    print(f"    Response size: {len(resp.content)} bytes")
    print(f"    Content-Type: {resp.headers.get('content-type', 'unknown')}")

    if resp.status_code != 200:
        print(f"[!] HTTP error: {resp.status_code}")
        print(f"    Response: {resp.text[:500]}")
        return None

    # 5. Decrypt response
    import base64
    raw_data = resp.content
    content_encoding = resp.headers.get("content-encoding", "")
    print(f"    Content-Encoding: {content_encoding}")

    # requests already handles brotli/gzip decompression automatically
    # raw_data is the decompressed (but encrypted) binary

    # Decrypt: pass as base64, Node.js converts to Uint8Array
    b64_data = base64.b64encode(raw_data).decode("ascii")
    try:
        decrypted = decrypt_response(b64_data)
        if decrypted and len(decrypted) > 10:
            print(f"    Decrypted: {len(decrypted)} chars")
            return json.loads(decrypted)
    except Exception as e:
        print(f"    [DEBUG] Decrypt failed: {e}")

    return None


def parse_songs(data: dict) -> list[dict]:
    """从榜单响应中解析歌曲列表。

    响应结构: req_1.data.group[].toplist[].song[]
    """
    songs = []
    try:
        groups = data.get("req_1", {}).get("data", {}).get("group", [])
        for group in groups:
            group_name = group.get("groupName", "")
            for toplist in group.get("toplist", []):
                top_name = toplist.get("title", "")
                for song in toplist.get("song", []):
                    songs.append({
                        "songId": song.get("songId"),
                        "songName": song.get("title", ""),
                        "singerName": song.get("singerName", ""),
                        "singerMid": song.get("singerMid", ""),
                        "albumMid": song.get("albumMid", ""),
                        "rank": song.get("rank", 0),
                        "topName": top_name,
                        "groupName": group_name,
                    })
    except Exception as e:
        print(f"[!] Parse error: {e}")
    return songs


def main():
    # Windows GBK workaround
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 60)
    print("  QQ Music Toplist Crawler")
    print("=" * 60)

    # Test sign
    test_sign = get_sign('{"test":"hello"}')
    print(f"\n[OK] Sign OK: {test_sign}")

    # Test encrypt
    test_enc = encrypt_payload({"test": "hello"})
    print(f"[OK] Encrypt OK: {test_enc[:60]}...")

    # Fetch toplist
    print("\n--- Fetching Toplist (ID=62) ---")
    data = fetch_toplist(62)

    if data:
        songs = parse_songs(data)
        print(f"\n[OK] Got {len(songs)} songs:")
        for i, song in enumerate(songs[:20], 1):
            print(f"  {i:2d}. {song['songName']} - {song['singerName']}")
        if len(songs) > 20:
            print(f"  ... and {len(songs) - 20} more")
    else:
        print("\n[!] Failed to get toplist data")
        print("    May need: 1) Valid cookies 2) Response decryption handling")


if __name__ == "__main__":
    main()
