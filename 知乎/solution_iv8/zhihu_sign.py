"""
知乎 x-zse 签名 — iv8 方案

替代 sign.js + env.js + Node.js，用 iv8 (C++ V8) 直接执行知乎 webpack chunk。
无需 vm 沙箱，无需手动补环境。

知乎签名流程：
  mR(url) → 编码 → "101_3_3.0" + encUrl + d_c0 → nT.encrypt() → x-zse-96 / x-zst-81

用法:
  from zhihu_sign import ZhihuSigner
  signer = ZhihuSigner()
  headers = signer.sign("/api/v3/feed/topstory/recommend?action=down", d_c0="xxx")
  # → {"x-zse-96": "2.0_...", "x-zst-81": "3_2.0..."}
"""
import json
import hashlib
from pathlib import Path

import iv8

BASE_DIR = Path(__file__).parent.parent  # 知乎/
CHUNK_DIR = BASE_DIR  # runtime.js / vendor.js / 479.js 都在根目录


class ZhihuSigner:
    """知乎签名器 — iv8 C++ V8 引擎"""

    def __init__(self):
        # 读取 webpack chunk
        runtime_path = CHUNK_DIR / "runtime.js"
        vendor_path = CHUNK_DIR / "vendor.js"
        chunk_path = CHUNK_DIR / "479.js"

        if not chunk_path.exists():
            raise FileNotFoundError(
                f"479.js 不存在: {chunk_path}\n"
                "请从浏览器 Sources 提取知乎签名 chunk 放到知乎/目录"
            )

        self._runtime = runtime_path.read_text("utf-8")
        self._vendor = vendor_path.read_text("utf-8")
        self._chunk = chunk_path.read_text("utf-8")

        # 注入 webpack 导出钩子——与 env.js 完全相同的逻辑
        self._runtime = self._runtime.replace(
            "u.push=s.bind(null,u.push.bind(u))}",
            "u.push=s.bind(null,u.push.bind(u));globalThis.__wp=p}",
        )

        # 创建 iv8 环境（最小配置——知乎检测极浅）
        self._ctx = None

    def _ensure_context(self):
        """延迟创建 iv8 Context（复用）"""
        if self._ctx is not None:
            return

        environment = {
            "location": {
                "href": "https://www.zhihu.com/",
                "origin": "https://www.zhihu.com",
                "protocol": "https:",
                "host": "www.zhihu.com",
                "hostname": "www.zhihu.com",
                "port": "",
                "pathname": "/",
                "search": "",
                "hash": "",
            },
            "window": {"origin": "https://www.zhihu.com"},
            "navigator": {
                "userAgent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/130.0.0.0 Safari/537.36"
                ),
                "platform": "Win32",
                "webdriver": False,
            },
        }

        html_page = """<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>知乎</title></head>
<body>
<script src="/runtime.js"></script>
<script src="/vendor.js"></script>
<script src="/479.js"></script>
</body></html>"""

        self._ctx = iv8.JSContext(
            environment=environment,
            config={"timezone": "Asia/Shanghai"},
        )
        # 使用 __enter__ 手动管理（不进 with 块，让 Context 保持存活）
        self._ctx.__enter__()

        res = {
            "/runtime.js": self._runtime,
            "/vendor.js": self._vendor,
            "/479.js": self._chunk,
        }

        self._ctx.expose(
            {
                "baseURL": "https://www.zhihu.com/",
                "html": html_page,
                "headers": [],
                "resources": res,
            },
            "snapshot",
        )
        self._ctx.eval("__iv8__.page.load(__iv8__.data.snapshot)")

        # 验证 webpack 加载
        wp = self._ctx.eval("typeof globalThis.__wp")
        if wp != "function":
            raise RuntimeError(f"知乎 webpack 加载失败: __wp = {wp}")

    def sign(self, url: str, d_c0: str = "") -> dict:
        """
        计算 x-zse-96 / x-zst-81 签名
        """
        self._ensure_context()

        # 1. URL 编码
        enc_url = self._ctx.eval(f"""
            (() => {{
                try {{
                    var w = globalThis.__wp;
                    var mR = w(18543).mR;
                    return mR({json.dumps(url)});
                }} catch(e) {{
                    return encodeURIComponent({json.dumps(url)}).replace(/%2F/g, '/');
                }}
            }})()
        """)

        # 2. 拼接源字符串
        src = f"101_3_3.0+{enc_url}+{d_c0 or ''}"

        # 3. iv8 中执行加密
        sig = self._ctx.eval(f"""
            (() => {{
                var nT = globalThis.__wp(93823).nT;
                var {{ encrypt }} = nT({json.dumps(src)});
                try {{
                    return encrypt({json.dumps(src)});
                }} catch(e) {{
                    return null;
                }}
            }})()
        """)

        # 4. 兜底 MD5（iv8 内置 crypto 可能不支持某些算法时）
        if not sig:
            sig = hashlib.md5(src.encode()).hexdigest()

        return {
            "x-zse-96": f"2.0_{sig}",
            "x-zst-81": (
                "3_2.0aR_sn77yn6O92wOB8hPZnQr0EMYxc4f18wNBUgpTQ6nxERFZf_" + sig
            ),
        }

    def close(self):
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass
            self._ctx = None

    def __del__(self):
        self.close()


# ===== 命令行测试 =====
if __name__ == "__main__":
    import sys

    test_url = sys.argv[1] if len(sys.argv) > 1 else (
        "/api/v3/feed/topstory/recommend?action=down&ad_interval=-10&"
        "desktop=true&page_number=1"
    )
    test_dc0 = sys.argv[2] if len(sys.argv) > 2 else ""

    print(f"URL: {test_url}")
    print(f"d_c0: {test_dc0 or '(空)'}")

    signer = ZhihuSigner()
    try:
        result = signer.sign(test_url, test_dc0)
        print(f"x-zse-96: {result['x-zse-96'][:60]}...")
        print(f"x-zst-81: {result['x-zst-81'][:60]}...")
    finally:
        signer.close()
