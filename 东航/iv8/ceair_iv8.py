"""
东航 (ceair) WASM 白盒 AES 加解密 — iv8 方案 (纯 Python V8)
=============================================================

使用 iv8 (C++ V8 引擎) 替代 Node.js 子进程运行 WASM 加解密。

原理:
  - 东航的加密是 Emscripten wasm2js (C++ WASM → 纯 JavaScript)
  - iv8 提供 Web 环境 (window/document/navigator 等均在 C++ 层实现)
  - ENVIRONMENT_IS_WEB = true → Module 设到 window 上
  - wbsk_skb_orig.js 用 Module.cwrap 导出 AES 函数
  - encrypt/decrypt 是同步纯计算，不依赖 canvas/WebGL/事件循环

优势:
  - 无 Node.js 子进程开销 (每次省 ~50ms 启动)
  - Python 直接控制 V8 执行
  - 一次加载 WASM 模块，多次调用

依赖: pip install iv8

用法:
    from ceair_iv8 import CeairWasm

    with CeairWasm() as wasm:
        enc = wasm.encrypt({"routes": [...]})
        # → {"req": "base64..."}

        data = wasm.decrypt("base64...")
        # → dict (解密后的 JSON)
"""

import json
from pathlib import Path

import iv8

# ═══════════════════════════════════════════════════════════════
# 路径
# ═══════════════════════════════════════════════════════════════

HERE = Path(__file__).parent
CLOAK_DIR = HERE.parent / "cloak" / "v1.0"
WBOX_JS = CLOAK_DIR / "wbsk_Wbox.js"       # Emscripten wasm2js 运行时 (~1MB)
SKB_JS = CLOAK_DIR / "wbsk_skb_orig.js"    # AES CBC/ECB 高层包装

# ═══════════════════════════════════════════════════════════════
# 常量
# ═══════════════════════════════════════════════════════════════

# AES-CBC 固定 IV（硬编码在 wbsk_skb.js，来自白盒 AES 实现）
IV = [121, 96, 7, 103, 57, 95, 61, 124, 121, 96, 7, 103, 57, 95, 61, 124]

# 加密 payload 的固定字段
DEFAULT_META = {
    "salesChannel": "7701",
    "moduleX": "mShopping",
    "os": "M",
    "language": "zh",
    "appVersion": "99.0.0",
}

# ═══════════════════════════════════════════════════════════════
# JS 函数定义（在 iv8 中注册，供 Python 调用）
# ═══════════════════════════════════════════════════════════════

# genTxId: 生成 transactionId，格式: 05 + 时间戳 + 4位随机
GEN_TXID_JS = r"""
function genTxId() {
    var iso = new Date().toISOString();
    var ts = iso.replace(/[T\-:]/g, '').replace(/\.[\d]{3}Z/, '');
    return '05' + ts + String(Math.ceil(10000 * Math.random()));
}
"""

# encryptPayload: 构造完整 payload → AES-CBC 加密 → base64
ENCRYPT_PAYLOAD_JS = r"""
function encryptPayload(data, meta, iv) {
    var payload = {};
    var k;
    for (k in data) { payload[k] = data[k]; }
    for (k in meta) { payload[k] = meta[k]; }
    payload.transactionId = genTxId();
    return {
        req: wbsk_AES_cbc_encrypt_base64(JSON.stringify(payload), iv)
    };
}
"""

# decryptPayload: AES-CBC 解密 → base64 解码 → JSON 解析
DECRYPT_PAYLOAD_JS = r"""
function decryptPayload(b64, iv) {
    return JSON.parse(wbsk_AES_cbc_decrypt_base64(b64, iv));
}
"""

# ═══════════════════════════════════════════════════════════════
# 无需额外 stubs：wbsk_Wbox.js 自带 wasm2js WebAssembly polyfill
# （var WebAssembly = { Module: ..., Instance: ..., instantiate: ... }）
# 该 polyfill 将 ASM.js 闭包的 exports 同步注入 Module.asm，
# 完全绕开原生 WebAssembly / fetch / DOM 依赖。iv8 零补丁运行。
# ═══════════════════════════════════════════════════════════════


class CeairWasm:
    """东航 WASM 白盒 AES 加解密上下文

    生命周期:
        with CeairWasm() as wasm:
            enc = wasm.encrypt({"routes": [...]})
            data = wasm.decrypt(enc["req"])

    一次加载，多次调用。整个 with 块内 V8 保持运行。
    """

    def __init__(self, wbox_path=None, skb_path=None):
        """
        Args:
            wbox_path: wbsk_Wbox.js 路径（默认 ../cloak/v1.0/wbsk_Wbox.js）
            skb_path:  wbsk_skb_orig.js 路径（默认 ../cloak/v1.0/wbsk_skb_orig.js）
        """
        self._wbox = Path(wbox_path) if wbox_path else WBOX_JS
        self._skb = Path(skb_path) if skb_path else SKB_JS
        self._ctx = None

    # ── 上下文管理 ──────────────────────────────────────────

    def __enter__(self):
        self._ctx = iv8.JSContext(
            environment={
                "navigator": {
                    "userAgent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/148.0.0.0 Safari/537.36"
                    ),
                    "platform": "Win32",
                },
            },
            mode="prod",
        )
        self._ctx.__enter__()

        # Step 1: Emscripten wasm2js 运行时 (~1MB)
        # wbsk_Wbox.js 自带 wasm2js WebAssembly polyfill（闭包注入 ASM.js exports），
        # ENVIRONMENT_IS_WEB 自动检测：window 存在 → document.currentScript 读 scriptDirectory
        # → 所有同步完成，runtimeInitialized 在 eval 结束时即为 true。
        wbox_src = self._wbox.read_text("utf-8")
        self._ctx.eval(wbox_src, name="wbsk_Wbox.js")

        # wasm2js polyfill: Promise.then 链需要事件循环推进才能完成
        # removeRunDependency → runDependencies==0 → run() → runtimeInitialized=true
        # 否则后续 cwrap/malloc 会 assert fail
        self._ctx.eval("__iv8__.eventLoop.drain()")

        # Step 2: AES CBC/ECB 包装器
        # Module._malloc / _free / cwrap / HEAP8 / HEAP32 此时已可用
        skb_src = self._skb.read_text("utf-8")
        self._ctx.eval(skb_src, name="wbsk_skb_orig.js")

        # Step 3: 注册 Python 可调用的 JS 辅助函数
        self._ctx.eval(GEN_TXID_JS)
        self._ctx.eval(ENCRYPT_PAYLOAD_JS)
        self._ctx.eval(DECRYPT_PAYLOAD_JS)

        return self

    def __exit__(self, *args):
        if self._ctx:
            self._ctx.__exit__(*args)
            self._ctx = None

    # ── 核心 API ────────────────────────────────────────────

    def encrypt(self, data: dict, meta: dict = None) -> dict:
        """加密 payload → {"req": "base64..."}

        Args:
            data: 业务 payload，如 {"routes": [...], "tripType": "OW", ...}
            meta: 固定元数据，默认使用 DEFAULT_META (salesChannel, os 等)

        Returns:
            {"req": "base64 编码的加密字符串"}
        """
        meta = meta if meta is not None else DEFAULT_META
        args = json.dumps([
            data,
            meta,
            IV,
        ], ensure_ascii=False, separators=(",", ":"))
        result = self._ctx.eval(f"JSON.stringify(encryptPayload.apply(null, {args}))")
        return json.loads(result)

    def decrypt(self, b64: str) -> dict:
        """解密 base64 加密响应 → dict

        Args:
            b64: base64 编码的加密字符串

        Returns:
            解密后的 Python dict
        """
        result = self._ctx.eval(
            f"JSON.stringify(decryptPayload({json.dumps(b64)}, {json.dumps(IV)}))"
        )
        return json.loads(result)

    def encrypt_raw(self, data: dict, meta: dict = None) -> str:
        """只返回加密后的 base64 字符串（不含 {"req": ...} 包装）

        Args:
            data: 业务 payload
            meta: 固定元数据

        Returns:
            base64 字符串
        """
        return self.encrypt(data, meta)["req"]

    def decrypt_raw(self, b64: str) -> dict:
        """与 decrypt 相同，为 API 一致性提供"""
        return self.decrypt(b64)


# ═══════════════════════════════════════════════════════════════
# 便捷函数（快速一次性调用，无上下文管理）
# ═══════════════════════════════════════════════════════════════

def encrypt(data: dict) -> dict:
    """快速加密（一次性，每次创建/销毁 V8 上下文）"""
    with CeairWasm() as w:
        return w.encrypt(data)


def decrypt(b64: str) -> dict:
    """快速解密（一次性）"""
    with CeairWasm() as w:
        return w.decrypt(b64)


# ═══════════════════════════════════════════════════════════════
# CLI 测试入口
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ceair_iv8.py encrypt|decrypt [input]")
        print("  python ceair_iv8.py encrypt '{\"routes\":[{\"depCode\":\"SHA\",\"arrCode\":\"BJS\",\"flightDate\":\"20260629\"}]}'")
        print("  python ceair_iv8.py decrypt 'base64_string'")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "encrypt":
        payload_str = sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read().strip()
        payload = json.loads(payload_str)
        result = encrypt(payload)
        print(json.dumps(result, ensure_ascii=False))

    elif cmd == "decrypt":
        b64 = sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read().strip()
        result = decrypt(b64)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        sys.exit(1)
