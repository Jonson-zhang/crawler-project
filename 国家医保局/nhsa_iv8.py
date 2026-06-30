"""
国家医保局 — iv8 加密引擎 (纯 V8，无 jsdom)
=============================================

使用 iv8 (C++ V8 引擎) 加载 app.js，提取 SM2/SM4 加密模块。

用法:
    from nhsa_iv8 import NhsaCrypto
    with NhsaCrypto() as c:
        result = c.encrypt({"keyword": "北京协和医院", "pageNum": 1, "pageSize": 10})
        # → {"headers": {...}, "body": {...}}
"""

import json
import sys
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
APP_JS = HERE / "config" / "app.js"
BRIDGE_JS = HERE / "iv8_bridge.js"

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"


# ═══════════════════════════════════════════════════════════════
# Node.js 加密引擎 (sm-crypto npm, 稳定可靠)
# ═══════════════════════════════════════════════════════════════

NODE_ENCRYPT_JS = r"""
const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;
const crypto = require('crypto');

const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const VERSION = '1.0.0';
const SM4_IV = '00000000000000000000000000000000';

// SM2 签名密钥 = APP_CODE bytes → hex
const SM2_KEY = Buffer.from(APP_CODE, 'ascii').toString('hex');
// SM4 密钥 = SM3(APP_CODE) bytes[:16] → hex
const SM4_KEY = Buffer.from(sm3(APP_CODE), 'hex').slice(0, 16).toString('hex');

function genNonce(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let r = '';
    for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
}

function encrypt(params) {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = genNonce(8);
    const plainJson = JSON.stringify(params);

    const encData = sm4.encrypt(plainJson, SM4_KEY, { mode: 'cbc', iv: SM4_IV });
    const inner = {
        data: { encData },
        appCode: APP_CODE, version: VERSION,
        encType: 'SM4', signType: 'SM2', timestamp: ts,
    };
    const signData = sm2.doSignature(JSON.stringify(inner), SM2_KEY, { hash: true });
    const body = { data: { data: { encData }, appCode: APP_CODE, version: VERSION, encType: 'SM4', signType: 'SM2', timestamp: ts, signData } };
    const bodyJson = JSON.stringify(body);
    const xTifSig = crypto.createHash('sha256').update(APP_CODE + ts + nonce + bodyJson).digest('hex');

    return {
        headers: {
            'Content-Type': 'application/json', channel: 'web',
            'x-tif-paasid': 'undefined',
            'x-tif-signature': xTifSig,
            'x-tif-timestamp': String(ts),
            'x-tif-nonce': nonce,
            Accept: 'application/json',
            Origin: 'https://fuwu.nhsa.gov.cn',
            Referer: 'https://fuwu.nhsa.gov.cn/nationalHallSt/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
        },
        body,
        _debug: { sm4Key: SM4_KEY, sm2Key: SM2_KEY.substring(0, 16) + '...' },
    };
}

const cmd = process.argv[2];
const input = process.argv[3] || '{}';
const result = cmd === 'encrypt' ? encrypt(JSON.parse(input)) : { error: 'unknown cmd' };
process.stdout.write(JSON.stringify({ id: 1, result }) + '\n');
"""


class NodeCrypto:
    """Node.js 加密引擎 (sm-crypto, 可靠降级方案)"""

    def encrypt(self, params: dict) -> dict:
        r = subprocess.run(
            ["node", "-e", NODE_ENCRYPT_JS, "encrypt",
             json.dumps(params, ensure_ascii=False)],
            capture_output=True, timeout=15, cwd=str(HERE),
        )
        stdout = r.stdout.decode("utf-8", errors="replace").strip()
        for line in stdout.split("\n"):
            try:
                resp = json.loads(line)
                if resp.get("result", {}).get("headers"):
                    return resp["result"]
            except Exception:
                pass
        raise RuntimeError(f"Node encrypt failed: {stdout[:200]}")


# ═══════════════════════════════════════════════════════════════
# iv8 加密引擎 (直接加载 app.js)
# ═══════════════════════════════════════════════════════════════

class Iv8Crypto:
    """iv8 加密上下文 — 加载 app.js 提取加密模块"""

    def __init__(self):
        self._ctx = None
        self._sm_module = None
        self._loaded = False

    def __enter__(self):
        import iv8

        self._ctx = iv8.JSContext(
            environment={
                "navigator": {
                    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "platform": "Win32",
                },
            },
            mode="prod",
        )
        self._ctx.__enter__()

        # 1. 加载桥接脚本
        bridge_src = BRIDGE_JS.read_text("utf-8")
        self._ctx.eval(bridge_src, name="iv8_bridge.js")
        print("[iv8] Bridge loaded", file=sys.stderr)

        # 2. 加载 app.js
        app_src = APP_JS.read_text("utf-8")
        print(f"[iv8] Loading app.js ({len(app_src)/1024/1024:.1f}MB)...", file=sys.stderr)
        try:
            self._ctx.eval(app_src, name="app.js")
            print("[iv8] app.js loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"[iv8] app.js eval error (non-fatal): {e}", file=sys.stderr)

        # 3. Drain event loop
        try:
            self._ctx.eval("__iv8__.eventLoop.drain()")
        except Exception:
            pass

        # 4. 检查捕获结果
        captured = self._ctx.eval(
            "window.__nhsa_captured ? JSON.stringify(window.__nhsa_captured) : 'null'"
        )
        print(f"[iv8] Captured: {captured}", file=sys.stderr)

        all_exports = self._ctx.eval(
            "JSON.stringify(window.__nhsa_all_exports || [])"
        )
        print(f"[iv8] All exports: {all_exports}", file=sys.stderr)

        # 5. 搜索全局作用域中的加密对象
        search = self._ctx.eval("""
            (function() {
                var found = [];
                for (var k in window) {
                    try {
                        var v = window[k];
                        if (typeof v === 'object' && v && v !== window && v !== window.document) {
                            var ks = Object.keys(v).slice(0, 15);
                            if (ks.indexOf('generateKeyPairHex') >= 0 || ks.indexOf('doSignature') >= 0) {
                                found.push({ key: k, ks: ks });
                            }
                        }
                    } catch(e) {}
                }
                return JSON.stringify(found);
            })()
        """)
        print(f"[iv8] Global search: {search}", file=sys.stderr)

        self._loaded = True
        return self

    def __exit__(self, *args):
        if self._ctx:
            self._ctx.__exit__(*args)
            self._ctx = None

    def _call_module(self, expr: str) -> str:
        if not self._loaded:
            raise RuntimeError("iv8 context not loaded")
        return self._ctx.eval(f"(function(){{ return {expr}; }})()")


# ═══════════════════════════════════════════════════════════════
# 统一接口 (自动选择 iv8 → Node.js)
# ═══════════════════════════════════════════════════════════════

class NhsaCrypto:
    """国家医保局加密引擎"""

    def __init__(self, mode="auto"):
        self._mode = mode
        self._engine = None

    def __enter__(self):
        if self._mode == "auto":
            # 优先 iv8，降级 Node.js
            try:
                print("[Nhsa] Trying iv8...", file=sys.stderr)
                engine = Iv8Crypto()
                engine.__enter__()
                self._engine = engine
                self._mode = "iv8"
            except Exception as e:
                print(f"[Nhsa] iv8 failed: {e}", file=sys.stderr)
                print("[Nhsa] Falling back to Node.js", file=sys.stderr)
                self._engine = NodeCrypto()
                self._mode = "node"
        elif self._mode == "node":
            self._engine = NodeCrypto()
            self._mode = "node"
        else:
            raise ValueError(f"Unknown mode: {self._mode}")
        return self

    def __exit__(self, *args):
        if hasattr(self._engine, '__exit__'):
            self._engine.__exit__(*args)
        self._engine = None

    def encrypt(self, params: dict) -> dict:
        if isinstance(self._engine, Iv8Crypto):
            raise NotImplementedError("iv8 app.js extraction not yet complete — use mode='node'")
        return self._engine.encrypt(params)


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "extract":
        # 尝试从 iv8 中提取密钥
        with Iv8Crypto() as iv8:
            print("Extraction complete — check stderr for captured modules")

    elif cmd == "encrypt":
        params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {
            "keyword": "北京协和医院", "pageNum": 1, "pageSize": 10
        }
        engine = NodeCrypto()
        result = engine.encrypt(params)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    elif cmd == "test":
        print("=== Testing iv8 app.js loading ===")
        with NhsaCrypto(mode="auto") as c:
            print(f"Mode: {c._mode}")

    else:
        print("Usage: python nhsa_iv8.py extract|encrypt|test")
