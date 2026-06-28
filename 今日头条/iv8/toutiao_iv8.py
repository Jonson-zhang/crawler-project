"""
今日头条 a_bogus — iv8 方案 (纯 Python)
=========================================

iv8 (C++ V8 引擎) 解决 Node.js 中 JSVMP 的引擎层差异。
新版 4-Module CDN SDK 在 iv8 中成功加载并生成 a_bogus。

关键突破:
  - acrawler.js JSVMP: iv8 ✅ (Node.js ❌)
  - bdms.js core-js: MessageChannel + self + setImmediate stubs
  - sdk-glue.js: 跳过（webpack 冲突），直接手写 _SdkGlueInit
"""

import json
from pathlib import Path
from urllib.parse import urlencode

import iv8

BASE_DIR = Path(__file__).parent
SDK_DIR = BASE_DIR
SHARED_STUBS = Path(__file__).parent.parent.parent / ".claude" / "iv8" / "stubs.js"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/143.0.0.0 Safari/537.36"
)

# ═══════════════════════════════════════════════════════════════
# iv8 stubs: 加载共享 stubs.js + toutiao 特有覆盖
# ═══════════════════════════════════════════════════════════════

def _toutiao_stubs():
    """toutiao 特有覆盖 (在共享 stubs.js 之后执行)"""
    return """
    // document.currentScript — runtime_bundler 用它读 project-id
    Object.defineProperty(document, 'currentScript', {
        get: function() {
            return {
                src: 'https://lf-security.bytegoofy.com/obj/security-secsdk/runtime_bundler_52.js',
                getAttribute: function(n) { return n === 'project-id' ? '24' : null; }
            };
        },
        configurable: true
    });

    // toutiao 特有全局
    window.onwheelx = { _Ax: '0X21' };
    window._sdkGlueVersionMap = {
        sdkGlueVersion: '1.0.0.55', bdmsVersion: '1.0.1.7', captchaVersion: '4.0.2'
    };
    window.devicePixelRatio = 1.75;
    window.innerWidth = 1920; window.innerHeight = 1080;
    window.outerWidth = 1936; window.outerHeight = 1112;
    window.screenX = 0; window.screenY = 0;

    // fetch — capture a_bogus (toutiao-specific pattern)
    window._capturedABogus = null;
    window._fetchCalls = 0;
    window.fetch = function(url, init) {
        window._fetchCalls++;
        if (typeof url === 'string') {
            var m = url.match(/a_bogus=([^&]+)/);
            if (m) window._capturedABogus = decodeURIComponent(m[1]);
        }
        return Promise.resolve({ status: 200, ok: true,
            text: function() { return Promise.resolve('{}'); },
            json: function() { return Promise.resolve({}); },
            headers: { get: function() { return ''; } } });
    };
    """


class ToutiaoSigner:
    """今日头条 a_bogus 签名器 — iv8"""

    def __init__(self):
        self._ctx = None
        self._build_context()

    def _build_context(self):
        """构建 V8 Context, 注入 stubs, 加载 SDK, 生成 a_bogus 入口。"""
        ctx = iv8.JSContext(
            environment={
                "location": {"href": "https://www.toutiao.com/"},
                "navigator": {
                    "userAgent": UA, "platform": "Win32",
                    "webdriver": False, "vendor": "Google Inc.",
                    "hardwareConcurrency": 32, "maxTouchPoints": 0,
                    "deviceMemory": 32, "product": "Gecko",
                    "productSub": "20030107", "vendorSub": "",
                    "appVersion": UA, "appCodeName": "Mozilla",
                    "cookieEnabled": True, "onLine": True,
                    "doNotTrack": None, "pdfViewerEnabled": True,
                },
                "screen": {
                    "width": 1920, "height": 1080,
                    "availWidth": 1920, "availHeight": 1040,
                    "colorDepth": 32, "pixelDepth": 32,
                },
            },
            config={"timezone": "Asia/Shanghai"},
        )
        ctx.__enter__()

        # ① Shared iv8 stubs
        ctx.eval(SHARED_STUBS.read_text("utf-8"))

        # ①b Toutiao-specific overrides
        ctx.eval(_toutiao_stubs())

        # ② Load acrawler FIRST, init immediately
        for filename in ["acrawler.js"]:
            path = SDK_DIR / filename
            print(f"  Loading {filename} ({path.stat().st_size // 1024}KB)...", end=" ", flush=True)
            ctx.eval(path.read_text("utf-8"))
            print("OK")
        bt = ctx.eval("typeof window.byted_acrawler")
        print(f"  Init acrawler (byted_acrawler={bt})...", end=" ", flush=True)
        ctx.eval("window.byted_acrawler.init({aid:24, dfp:true})")
        print("OK")

        # module/exports AFTER acrawler init (breaks JSVMP otherwise)
        ctx.eval("window.module = { exports: {} }; window.exports = {};")

        # ③ Register remote modules
        for name in ["config_24.js", "project_24.js", "strategy_24.js"]:
            path = SDK_DIR / name
            if path.exists():
                code = path.read_text("utf-8")
                ctx.eval(
                    f"window._remoteModules[{json.dumps(name)}] = {json.dumps(code)};"
                )

        # After acrawler init, safe to set module/exports
        ctx.eval("window.module = { exports: {} }; window.exports = {};")

        # ③ Load remaining SDK in browser order (with sdk-glue for _SdkGlueInit)
        sdk_files = [
            ("sdk-glue", "sdk-glue.js"),
            ("bdms", "bdms.js"),
            ("runtime_bundler", "runtime_bundler.js"),
        ]
        for label, filename in sdk_files:
            path = SDK_DIR / filename
            if not path.exists():
                raise FileNotFoundError(f"Missing SDK file: {path}")
            print(f"  Loading {label} ({path.stat().st_size // 1024}KB)...",
                  end=" ", flush=True)
            code = path.read_text("utf-8")
            try:
                ctx.eval(code)
                print("OK")
            except Exception as e:
                print(f"ERR: {str(e)[:120]}")
                raise

        # ④ Init pipeline via _SdkGlueInit
        print("  Calling _SdkGlueInit...", end=" ", flush=True)
        has_init = ctx.eval("typeof window._SdkGlueInit")
        print(f"(_SdkGlueInit={has_init})", end=" ")

        if has_init == "function":
            try:
                ctx.eval("""
                window._SdkGlueInit({
                    self: {aid: 24, pageId: 6457},
                    bdms: {aid: 24, pageId: 6457, paths: ['/api/pc/list/feed', '/api/pc/list/user/feed']}
                });
                """)
                print("OK")
            except Exception as e:
                print(f"ERR: {str(e)[:120]}")
        else:
            print("SKIP")

        # ⑤ Check SDK state
        bogus_type = ctx.eval("typeof window.bogus")
        bdms_type = ctx.eval("typeof window.bdms")
        print(f"  State: bogus={bogus_type} bdms={bdms_type}")

        if bogus_type == "function":
            has_u = ctx.eval("typeof window.bogus._u")
            has_v = ctx.eval("typeof window.bogus._v")
            print(f"  bogus._u: {has_u}  bogus._v: {has_v}")
            if has_u == "function":
                print("  ✓ SIGNING READY")
            else:
                print("  ⚠ bogus present but no _u — trying fetch interception path")

        self._ctx = ctx

    def sign(self, params_dict: dict) -> str:
        """Generate a_bogus via bdms fetch interception."""
        ctx = self._ctx
        query_str = urlencode(params_dict)

        # Inner mock already captures a_bogus into window._capturedABogus.
        # Just call fetch (bdms-wrapped) and read it.
        result = ctx.eval(f"""
        (function() {{
            window._capturedABogus = null;
            var url = {json.dumps('https://www.toutiao.com/api/pc/list/feed?' + query_str)};
            window.fetch(url, {{ method: 'GET' }});
            return window._capturedABogus;
        }})()
        """)

        return result or ""

    def close(self):
        if self._ctx is not None:
            try:
                self._ctx.__exit__(None, None, None)
            except Exception:
                pass
            self._ctx = None

    def __del__(self):
        self.close()


# ═══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("今日头条 a_bogus — iv8")
    print("=" * 60)

    signer = ToutiaoSigner()
    try:
        params = {
            "channel_id": "3189398972",
            "max_behot_time": "0",
            "category": "pc_profile_channel",
            "aid": "24",
            "app_name": "toutiao_web",
            "msToken": "test_token",
        }
        ab = signer.sign(params)
        if ab and len(ab) > 100:
            print(f"\na_bogus: {ab[:60]}...")
            print(f"  length: {len(ab)}")
        else:
            print(f"\nFAILED: {ab}")
    finally:
        signer.close()
