"""
小红书 x-s 签名 — iv8 方案

替代 sign.js + env.js + Node.js，用 iv8 (C++ V8) 直接执行 VMP 字节码。
无需手动补环境（省掉 env.js 全部 400+ 行）。

核心原理:
  1. IIFE 隔离 ds_script.js（模拟 Node.js require 模块作用域）
  2. DOM 方法 stub（VMP 会调 removeChild/appendChild 等，iv8 真实 DOM 校验参数）
  3. .forEach() 闭包隔离 VMP setter 拦截
  4. ctx.eval() 执行 mnsv2 → Python 端组装 X-s

签名流程:
  mnsv2(c, MD5(c), MD5(url)) → VMP 输出
  → "XYS_" + custom_b64(JSON_payload)

用法:
  from xhs_sign import XhsSigner
  signer = XhsSigner()
  x_s = signer.sign("/api/sns/web/v1/homefeed", {"cursor_score": "", "num": 20})
  # → "XYS_..."
"""
import hashlib
import json
import urllib.parse
from pathlib import Path

import iv8

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/139.0.0.0 Safari/537.36"
)


# ═══════════════════════════════════════════════════════════════
#  Python 端：自定义 Base64 + URL 编码（与 JS 端 b64Encode + encodeUtf8 对齐）
# ═══════════════════════════════════════════════════════════════

B64_CHARS = "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"


def _b64e(data: bytes) -> str:
    """自定义 Base64 编码，与 sign.js 中 b64Encode 同款实现"""
    n, m, r = len(data), len(data) % 3, []
    for i in range(0, n - m, 16383):
        limit = min(i + 16383, n - m)
        for j in range(i, limit, 3):
            t = (data[j] << 16) + (data[j + 1] << 8) + data[j + 2]
            r.append(
                B64_CHARS[(t >> 18) & 63]
                + B64_CHARS[(t >> 12) & 63]
                + B64_CHARS[(t >> 6) & 63]
                + B64_CHARS[t & 63]
            )
    if m == 1:
        b = data[n - 1]
        r.append(B64_CHARS[b >> 2] + B64_CHARS[(b << 4) & 63] + "==")
    elif m == 2:
        p = (data[n - 2] << 8) + data[n - 1]
        r.append(
            B64_CHARS[p >> 10]
            + B64_CHARS[(p >> 4) & 63]
            + B64_CHARS[(p << 2) & 63]
            + "="
        )
    return "".join(r)


def _json_to_bytes(obj: dict) -> bytes:
    """JSON → URL 编码 → 字节数组（与 JS encodeUtf8(JSON.stringify()) 对齐）"""
    s = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    e = urllib.parse.quote(s, safe="~()*!./:?=&-_")
    result, i = bytearray(), 0
    while i < len(e):
        if e[i] == "%":
            result.append(int(e[i + 1 : i + 3], 16))
            i += 3
        else:
            result.append(ord(e[i]))
            i += 1
    return bytes(result)


# ═══════════════════════════════════════════════════════════════
#  DOM stubs（VMP 会在初始化时调用 DOM API）
# ═══════════════════════════════════════════════════════════════

_DOM_STUBS_JS = """\
// VMP 字节码解释器会调用 DOM 方法（removeChild/appendChild 等）。
// iv8 的真实 DOM 会校验参数类型（TypeError），必须 stub 为 noop，
// 与 Node.js env.js 行为对齐。
(function() {
    var noop = function() {};
    var stubElement = function(tag) {
        return {
            tagName: (tag || '').toUpperCase(), style: {}, className: '',
            id: '', innerHTML: '', textContent: '',
            appendChild: noop, removeChild: noop, setAttribute: noop,
            getAttribute: function() { return null; },
            insertAdjacentElement: noop, addEventListener: noop,
            parentNode: null, children: [], childNodes: [],
            firstChild: null, lastChild: null,
            offsetWidth: 1920, offsetHeight: 1080,
            clientWidth: 1920, clientHeight: 1080,
            getBoundingClientRect: function() {
                return {top:0,left:0,width:1920,height:1080,right:1920,bottom:1080};
            },
        };
    };
    document.createElement = function(tag) { return stubElement(tag); };
    document.getElementsByTagName = function() { return []; };
    document.querySelector = function() { return null; };
    document.querySelectorAll = function() { return []; };
    document.getElementById = function() { return null; };
    document.getElementsByClassName = function() { return []; };
    document.addEventListener = noop;
    document.removeEventListener = noop;

    try { Object.defineProperty(document, 'body', { get: function() { return stubElement('body'); }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'documentElement', { get: function() { return stubElement('html'); }, configurable: true }); } catch(e) {}
    try { Object.defineProperty(document, 'head', { get: function() { return stubElement('head'); }, configurable: true }); } catch(e) {}
})();\
"""


# ═══════════════════════════════════════════════════════════════
#  签名器
# ═══════════════════════════════════════════════════════════════


class XhsSigner:
    """小红书 X-s 签名器 — iv8 C++ V8 引擎"""

    def __init__(self, cookie_str: str = ""):
        ds_script_path = BASE_DIR / "ds_script.js"
        if not ds_script_path.exists():
            raise FileNotFoundError(
                f"ds_script.js 不存在: {ds_script_path}\n"
                "请从 v2.0/ 目录复制 VMP 解释器文件"
            )

        self._ds_script = ds_script_path.read_text("utf-8")
        self._ds_api = (DATA_DIR / "ds_api.js").read_text("utf-8")
        self._ds_v2 = (DATA_DIR / "ds_v2.js").read_text("utf-8")
        self._cookie_str = cookie_str or (
            "a1=197c660cf2d0j0l1bdwbkv2cyce6csd6n3v6nths750000683082; "
            "webId=c09b78e6b3cb4b550c9d51b97c057cd0; "
            "gid=yjWSKK8f0jIdyjWSKK8Siq9xJf8V81yDfEDThMWhJSvSdK28KSMfKI888KYq8YJ88SyyYWqJ; "
            "webBuild=6.12.3; xsecappid=xhs-pc-web; "
            "websectiga=7750c37de43b7be9de8ed9ff8ea0e576519e8cd2157322eb972ecb429a7735d4; "
            "sec_poison_id=4e4a9eab-d586-4ce8-ab46-4095b5cf9e04"
        )
        self._ctx = None

    # ── iv8 生命周期 ──────────────────────────────────────────

    def _ensure_context(self):
        """延迟创建 + 复用 V8 Isolate"""
        if self._ctx is not None:
            return

        environment = {
            "location": {
                "href": "https://www.xiaohongshu.com/",
                "origin": "https://www.xiaohongshu.com",
                "protocol": "https:",
                "host": "www.xiaohongshu.com",
                "hostname": "www.xiaohongshu.com",
                "port": "",
                "pathname": "/",
                "search": "",
                "hash": "",
            },
            "window": {"origin": "https://www.xiaohongshu.com"},
            "navigator": {
                "userAgent": UA,
                "platform": "Win32",
                "webdriver": False,
                "plugins": [],      # VMP 检测 plugins.length
                "mimeTypes": [],    # VMP 检测 mimeTypes.length
            },
            "screen": {"width": 1920, "height": 1080},
        }

        self._ctx = iv8.JSContext(
            environment=environment,
            config={"timezone": "Asia/Shanghai"},
        )
        self._ctx.__enter__()

        # ── ① DOM stubs（必须在 VMP 之前）──
        self._ctx.eval(_DOM_STUBS_JS)

        # ── ② ds_script.js → IIFE 隔离作用域（模拟 Node.js require）──
        self._ctx.eval("(function(){" + self._ds_script + "})();")
        au_type = self._ctx.eval("typeof window._AUuXfEG27Xa3x")
        if au_type != "function":
            raise RuntimeError(
                f"ds_script.js 加载失败: _AUuXfEG27Xa3x = {au_type}"
            )

        # ── ③ MutationObserver stub ──
        self._ctx.eval(
            "window.MutationObserver = function() {"
            "  this.observe = function() {};"
            "  this.disconnect = function() {};"
            "};"
        )

        # ── ④ ds_api.js → eval（全局作用域，匹配 Node.js 行为）──
        self._ctx.eval(self._ds_api)

        # ── ⑤ VMP setter 拦截 → .forEach() 闭包隔离 ──
        self._ctx.eval(
            """(function() {
            Object.getOwnPropertyNames(window).forEach(function(name) {
                try {
                    var val = window[name];
                    if (typeof val !== 'function' || val.toString().length <= 100000) return;
                    var _ra, _oa = val;
                    Object.defineProperty(window, name, {
                        get: function() { return _ra || _oa; },
                        set: function(fn) {
                            if (typeof fn === 'function' && fn.toString().length > 100000) {
                                _ra = function(bc, env) {
                                    for (var j = 0; j < 200; j++) {
                                        if (env[j] === undefined) {
                                            var s = function() {};
                                            s.prototype = {};
                                            env[j] = s;
                                        }
                                    }
                                    return fn.call(window, bc, env);
                                };
                            } else {
                                _oa = fn;
                            }
                        },
                        configurable: true, enumerable: true,
                    });
                } catch(e) {}
            });
        })();"""
        )

        # ── ⑥ ds_v2.js → eval（触发 setter，升级 mns0201 → mns0301）──
        self._ctx.eval(self._ds_v2)

        # ── ⑦ 验证 ──
        mnsv2_type = self._ctx.eval("typeof window.mnsv2")
        if mnsv2_type != "function":
            raise RuntimeError(
                f"mnsv2 加载失败: typeof = {mnsv2_type}\n"
                "可能原因: ds_script.js / ds_v2.js 版本不匹配"
            )

        # ── ⑧ 设置 document.cookie（VMP 会读）──
        self._ctx.eval(
            f"try {{ Object.defineProperty(document, 'cookie', {{"
            f"  get: function() {{ return {json.dumps(self._cookie_str)}; }},"
            f"  configurable: true"
            f"}}); }} catch(e) {{}}"
        )

    # ── 签名 ──────────────────────────────────────────────────

    def sign(self, url: str, body: dict | None = None) -> str:
        """计算 X-s 签名值

        Args:
            url: API 路径，如 "/api/sns/web/v1/homefeed"
            body: POST body dict，GET 请求传 None

        Returns:
            X-s 签名，如 "XYS_..."
        """
        self._ensure_context()

        # 1. 拼接源串 + 计算 MD5
        body_str = (
            json.dumps(body, separators=(",", ":"), ensure_ascii=False)
            if body
            else ""
        )
        c = url + body_str
        md5_c = hashlib.md5(c.encode()).hexdigest()
        md5_url = hashlib.md5(url.encode()).hexdigest()

        # 2. V8 执行 mnsv2 VMP 字节码
        h = str(
            self._ctx.eval(
                f"window.mnsv2({json.dumps(c)}, {json.dumps(md5_c)}, {json.dumps(md5_url)})"
            )
        )

        # 3. Python 端组装 x-s（与 sign.js seccore_signv2 完全对齐）
        x4 = "object" if body else ""
        payload = json.dumps(
            {"x0": "4.3.5", "x1": "xhs-pc-web", "x2": "Windows", "x3": h, "x4": x4},
            separators=(",", ":"),
            ensure_ascii=False,
        )
        return "XYS_" + _b64e(_json_to_bytes(payload))

    # ── 清理 ──────────────────────────────────────────────────

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

    test_url = sys.argv[1] if len(sys.argv) > 1 else "/api/sns/web/v1/homefeed"
    test_body = None
    if len(sys.argv) > 2:
        try:
            test_body = json.loads(sys.argv[2])
        except json.JSONDecodeError:
            print(f"body 不是有效 JSON: {sys.argv[2][:80]}")
            sys.exit(1)

    print(f"URL:  {test_url}")
    print(f"body: {json.dumps(test_body, ensure_ascii=False) if test_body else '(空)'}")

    signer = XhsSigner()
    try:
        x_s = signer.sign(test_url, test_body)
        print(f"x-s:  {x_s[:80]}...")
        print(f"len:  {len(x_s)}")
    finally:
        signer.close()
