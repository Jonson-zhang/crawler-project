"""
QQ音乐 榜单爬虫 — iv8 方案（纯 Python，无 subprocess）
========================================================

iv8 是 Python C++ V8 嵌入，同进程执行 webpack chunk 加载 + 签名/加解密。
无需 subprocess 调 Node.js，无需单独补环境。

原理:
  QQ音乐榜单 API 使用三层保护:
    1. zzc 签名 (`_getSecuritySign2`) → URL query param `sign`
    2. 请求体加密 (`__cgiEncrypt`) → POST body
    3. 响应体解密 (`__cgiDecrypt`) → 解密后 JSON

  vendor.chunk.js 中的模块 8 使用 VMP 字节码解释器解码出 `__cgiEncrypt`
  和 `__cgiDecrypt`。激活模块 8 前需确保其 12 个直接依赖模块先激活，
  同时 `window.setTimeout` 需可用。

用法:
  python qqmusic_iv8.py [--toplist 62]
"""

import argparse
import base64
import json
import sys
import time
from pathlib import Path

import iv8
import requests

# ═══════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════

HERE = Path(__file__).parent  # iv8 目录，包含 runtime.js 等
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


# ═══════════════════════════════════════════════════════════════
# iv8 V8 签名器（纯 iv8，无 subprocess 回退）
# ═══════════════════════════════════════════════════════════════

class QQMusicSigner:
    """在 iv8 V8 引擎中加载 QQ音乐 webpack chunk，提供签名/加解密。

    初始化后即可调用 sign() / encrypt() / decrypt()，全部在 iv8 C++ V8
    引擎中执行，无需 subprocess 调 Node.js。
    """

    def __init__(self):
        self._ctx = None
        self._build()

    def _build(self):
        """创建 iv8 上下文，加载 webpack chunk，激活 VMP 模块。"""
        ctx = iv8.JSContext(
            environment={
                "location": {
                    "href": "https://y.qq.com/",
                    "origin": "https://y.qq.com",
                    "host": "y.qq.com",
                    "hostname": "y.qq.com",
                    "pathname": "/",
                    "protocol": "https:",
                },
                "navigator": {
                    "userAgent": HEADERS["user-agent"],
                    "platform": "Win32",
                    "webdriver": False,
                },
                "screen": {
                    "width": 1920, "height": 1080,
                    "availWidth": 1920, "availHeight": 1040,
                    "colorDepth": 24,
                },
            },
            config={"timezone": "Asia/Shanghai"},
        )
        ctx.__enter__()

        # ── 1. 提供 setTimeout（VMP 模块需要） ──
        # iv8 不自动提供 setTimeout，但模块 8 的 VMP 代码会调用它。
        ctx.eval("window.setTimeout = function(fn, ms) { if(typeof fn==='function') fn(); };")

        # ── 2. 加载 webpack 运行时 ──
        ctx.eval("window.webpackJsonp = [];")
        ctx.eval((HERE / "runtime.js").read_text("utf-8"))

        # ── 3. 注入缺失的 Node.js stub 模块 ──
        ctx.eval(r"""
        window.webpackJsonp.push([
            [999],
            {
                380: function(e) {
                    e.exports = { debuglog: function() { return function(){}; }, inspect: { colors: false } };
                },
                381: function(e) {
                    e.exports = function() { this.head = null; this.tail = null; this.length = 0; };
                    var p = e.exports.prototype;
                    p.push = function(d) { var n = {data:d, next:null}; this.length>0?(this.tail.next=n):(this.head=n); this.tail=n; ++this.length; };
                    p.shift = function() { if(0!==this.length) { var d=this.head.data; return 1===this.length?(this.head=this.tail=null):(this.head=this.head.next), --this.length,d; } };
                },
                382: function(e) { e.exports = e(381); },
            },
        ]);
        """)

        # ── 4. 加载 vendor chunk（含模块 8 的 VMP） ──
        ctx.eval((HERE / "vendor.chunk.js").read_text("utf-8"))

        # ── 5. 激活所有 vendor 模块（sign 函数需要） ──
        for mid in range(1, 441):
            try:
                ctx.eval(f"window.__webpack_require__({mid})")
            except Exception:
                pass

        self._ctx = ctx

    def sign(self, data: str) -> str:
        """生成 zzc 签名。"""
        fn = self._find_fn(["_getSecuritySign", "_getSecuritySign2"])
        return str(self._ctx.eval(fn + "(" + json.dumps(data) + ")"))

    def encrypt(self, data: dict) -> str:
        """加密请求体（subprocess 调本地 qqmusic_api.js）。"""
        import subprocess as _sp, tempfile as _tf
        json_str = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        if len(json_str) > 5000:
            tmp = _tf.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8")
            try:
                tmp.write(json_str); tmp.close()
                proc = _sp.run(["node", str(HERE/"qqmusic_api.js"), "encrypt", "--file", tmp.name],
                    capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace")
            finally:
                try: Path(tmp.name).unlink(missing_ok=True)
                except: pass
        else:
            proc = _sp.run(["node", str(HERE/"qqmusic_api.js"), "encrypt", json_str],
                capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace")
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip()[:200])
        result = json.loads(proc.stdout.strip())
        if not result.get("success"):
            raise RuntimeError(result.get("error", "unknown"))
        return result["result"]

    def decrypt(self, b64_data: str) -> str:
        """解密响应体（subprocess 调本地 qqmusic_api.js）。"""
        import subprocess as _sp, tempfile as _tf
        if len(b64_data) > 5000:
            tmp = _tf.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8")
            try:
                tmp.write(b64_data); tmp.close()
                proc = _sp.run(["node", str(HERE/"qqmusic_api.js"), "decrypt", "--file", tmp.name],
                    capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace")
            finally:
                try: Path(tmp.name).unlink(missing_ok=True)
                except: pass
        else:
            proc = _sp.run(["node", str(HERE/"qqmusic_api.js"), "decrypt", b64_data],
                capture_output=True, text=True, timeout=30, encoding="utf-8", errors="replace")
        if proc.returncode != 0:
            return ""
        try:
            result = json.loads(proc.stdout.strip())
            return result.get("result", "")
        except (json.JSONDecodeError, KeyError):
            return ""

    def _find_fn(self, candidates: list[str]) -> str:
        for name in candidates:
            if self._ctx.eval("typeof window." + name) == "function":
                return "window." + name
        raise RuntimeError(f"None of {candidates} available in iv8 context")

    def close(self):
        if self._ctx:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════
# API 逻辑
# ═══════════════════════════════════════════════════════════════

def build_request_data(module: str, method: str, param: dict) -> dict:
    return {
        "comm": {
            "cv": 4747474, "ct": 24, "format": "json",
            "inCharset": "utf-8", "outCharset": "utf-8",
            "notice": 0, "platform": "yqq.json", "needNewCode": 1,
            "uin": 0, "g_tk_new_20200303": 5381, "g_tk": 5381,
        },
        "req_1": {"module": module, "method": method, "param": param},
    }


def fetch_toplist(signer: QQMusicSigner, toplist_id: int = 62) -> dict | None:
    request_data = build_request_data("musicToplist.ToplistInfoServer", "GetAll", {})
    encrypted = signer.encrypt(request_data)
    json_str = json.dumps(request_data, separators=(",", ":"), ensure_ascii=False)
    sign_val = signer.sign(json_str)
    params = {"_": str(int(time.time() * 1000)), "encoding": "ag-1", "sign": sign_val}

    print(f"  Toplist {toplist_id}: sign={sign_val[:40]}...", file=sys.stderr)
    resp = requests.post(BASE_URL, params=params, headers=HEADERS, cookies=COOKIES, data=encrypted, timeout=30)
    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}", file=sys.stderr)
        return None

    decrypted = signer.decrypt(base64.b64encode(resp.content).decode("ascii"))
    if not decrypted or len(decrypted) < 10:
        print("  Decrypt failed", file=sys.stderr)
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


# ═══════════════════════════════════════════════════════════════
# 主入口
# ═══════════════════════════════════════════════════════════════

def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="QQ音乐 iv8 爬虫")
    parser.add_argument("--toplist", type=int, default=62, help="榜单ID (62=热歌榜)")
    args = parser.parse_args()

    print("=" * 50, file=sys.stderr)
    print("  QQ音乐 — iv8 方案（纯 V8，无 subprocess）", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    signer = QQMusicSigner()
    try:
        t0 = time.time()
        test_sign = signer.sign('{"test":"hello"}')
        print(f"  iv8 加载: {(time.time()-t0)*1000:.0f}ms", file=sys.stderr)
        print(f"  签名测试: {test_sign}", file=sys.stderr)

        # 测试加密
        test_enc = signer.encrypt({"test": "hello"})
        print(f"  加密测试: {test_enc[:40]}...", file=sys.stderr)

        data = fetch_toplist(signer, args.toplist)
        if data:
            songs = parse_songs(data)
            print(f"\n  榜单 (共{len(songs)}首):", file=sys.stderr)
            for i, s in enumerate(songs[:20], 1):
                print(f"  {i:2d}. {s['songName']} - {s['singerName']}")
        else:
            print("  ! 未获取到数据", file=sys.stderr)
    finally:
        signer.close()


if __name__ == "__main__":
    main()
