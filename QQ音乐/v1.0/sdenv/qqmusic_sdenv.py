"""
QQ音乐 榜单爬虫 — sdenv 方案（Node.js C++ V8 Addon + jsdom）
===============================================================

sdenv = C++ V8 Addon + 魔改 jsdom，提供完整浏览器 API。
sign 在 sdenv V8 中直接执行，encrypt/decrypt 回退 qqmusic_api.js。

用法:
  python qqmusic_sdenv.py [--toplist 62]
"""

import argparse
import base64
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

HERE = Path(__file__).parent
RUNNER_JS = HERE / "runner.js"
BASE_URL = "https://u6.y.qq.com/cgi-bin/musics.fcg"

HEADERS = {
    "accept": "application/octet-stream",
    "content-type": "text/plain",
    "origin": "https://y.qq.com",
    "referer": "https://y.qq.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
}

COOKIES = {
    "pgv_pvid": "6498002570",
    "pgv_info": "ssid=s4139352576",
    "ts_uid": "7833505689",
    "ts_last": "y.qq.com/n/ryqq_v2/toplist/4",
}


def sdenv_invoke(action: str, data: str) -> str:
    """通过 subprocess 调用 sdenv runner.js。"""
    if len(data) > 5000:
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8", dir=str(HERE))
        try:
            tmp.write(data); tmp.close()
            proc = subprocess.run(
                ["node", str(RUNNER_JS), action, "--file", tmp.name],
                capture_output=True, text=True, timeout=60,
                encoding="utf-8", errors="replace",
            )
        finally:
            try: Path(tmp.name).unlink(missing_ok=True)
            except: pass
    else:
        proc = subprocess.run(
            ["node", str(RUNNER_JS), action, data],
            capture_output=True, text=True, timeout=60,
            encoding="utf-8", errors="replace",
        )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip()[:200] or f"exit={proc.returncode}")
    result = json.loads(proc.stdout.strip())
    if not result.get("success"):
        raise RuntimeError(result.get("error", "unknown"))
    return result["result"]


def sign(data: str) -> str:
    return sdenv_invoke("sign", data)


def encrypt(data: dict) -> str:
    json_str = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return sdenv_invoke("encrypt", json_str)


def decrypt(b64_data: str) -> str:
    return sdenv_invoke("decrypt", b64_data)


def build_request_data(module: str, method: str, param: dict) -> dict:
    return {
        "comm": {"cv": 4747474, "ct": 24, "format": "json",
                 "inCharset": "utf-8", "outCharset": "utf-8",
                 "notice": 0, "platform": "yqq.json", "needNewCode": 1,
                 "uin": 0, "g_tk_new_20200303": 5381, "g_tk": 5381},
        "req_1": {"module": module, "method": method, "param": param},
    }


def combined_sign_encrypt(data: dict) -> tuple[str, str]:
    """一次 subprocess 完成 sign + encrypt（sdenv 启动开销大，合并调用）。"""
    json_str = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    result = json.loads(sdenv_invoke("combined", json_str))
    return result["sign"], result["encrypted"]


def fetch_toplist(toplist_id: int = 62) -> dict | None:
    request_data = build_request_data("musicToplist.ToplistInfoServer", "GetAll", {})
    sign_val, encrypted = combined_sign_encrypt(request_data)
    params = {"_": str(int(time.time() * 1000)), "encoding": "ag-1", "sign": sign_val}

    print(f"  Toplist {toplist_id}: sign={sign_val[:40]}...", file=sys.stderr)
    resp = requests.post(BASE_URL, params=params, headers=HEADERS, cookies=COOKIES, data=encrypted, timeout=60)
    if resp.status_code != 200:
        return None
    decrypted = decrypt(base64.b64encode(resp.content).decode("ascii"))
    if not decrypted or len(decrypted) < 10:
        return None
    return json.loads(decrypted)


def parse_songs(data: dict) -> list[dict]:
    songs = []
    try:
        for group in data.get("req_1", {}).get("data", {}).get("group", []):
            for toplist in group.get("toplist", []):
                for song in toplist.get("song", []):
                    songs.append({
                        "songId": song.get("songId"),
                        "songName": song.get("title", ""),
                        "singerName": song.get("singerName", ""),
                        "rank": song.get("rank", 0),
                    })
    except Exception as e:
        print(f"  Parse error: {e}", file=sys.stderr)
    return songs


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="QQ音乐 sdenv 爬虫")
    parser.add_argument("--toplist", type=int, default=62)
    args = parser.parse_args()

    print("=" * 50, file=sys.stderr)
    print("  QQ音乐 — sdenv 方案", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    try:
        t0 = time.time()
        test_sign = sign('{"test":"hello"}')
        print(f"  sdenv 加载: {(time.time()-t0)*1000:.0f}ms", file=sys.stderr)
        print(f"  签名测试: {test_sign}", file=sys.stderr)

        data = fetch_toplist(args.toplist)
        if data:
            songs = parse_songs(data)
            print(f"\n  榜单 (共{len(songs)}首):", file=sys.stderr)
            for i, s in enumerate(songs[:20], 1):
                print(f"  {i:2d}. {s['songName']} - {s['singerName']}")
        else:
            print("  ! 未获取到数据", file=sys.stderr)
    except RuntimeError as e:
        print(f"  Error: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
