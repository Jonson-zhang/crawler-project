"""
国家医保局 — iv8 加密引擎
==========================

使用 iv8 (C++ V8) 加载 app.js，从浏览器环境中提取 SM2/SM4 加密模块。

策略:
  1. iv8 提供 Web 环境 → 加载 nhsa_bridge.js (环境补丁 + 模块拦截)
  2. 加载 app.js → 拦截 sm2/sm3/sm4 模块 → 导出为 Python 可调用函数
  3. 如果 iv8 加载失败 → 降级到 Node.js + sm-crypto

用法:
    from nhsa_iv8 import NhsaCrypto
    with NhsaCrypto() as c:
        enc = c.encrypt({"keyword": "北京协和医院"})
        data = c.decrypt("encData_hex")
"""

import json
import sys
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
APP_JS = HERE / "config" / "app.js"
BRIDGE_JS = HERE / "nhsa_bridge.js"

APP_CODE = "T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ"


# ═══════════════════════════════════════════════════════════════
# Node.js 加密引擎 (sm-crypto + 已知密钥)
# ═══════════════════════════════════════════════════════════════

NODE_CRYPTO_JS = r"""
const sm2 = require('sm-crypto').sm2;
const sm3 = require('sm-crypto').sm3;
const sm4 = require('sm-crypto').sm4;
const crypto = require('crypto');

const APP_CODE = 'T98HPCGN5ZVVQBS8LZQNOAEXVI9GYHKQ';
const SM4_KEY = null;  // 待从 iv8 提取
const SM4_IV = '00000000000000000000000000000000';

let _keypair = null;

function init() {
    if (!_keypair) {
        _keypair = sm2.generateKeyPairHex();
    }
    return _keypair;
}

function encrypt(params) {
    // 使用标准 sm-crypto 实现
    const kp = init();
    const ts = Math.floor(Date.now() / 1000);
    const nonce = genNonce(8);
    const plainjson = JSON.stringify(params);

    // SM4 加密 (需要正确的 sm4_key)
    const encData = sm4.encrypt(plainjson, SM4_KEY, {
        mode: 'cbc', iv: SM4_IV
    });

    const inner = {
        data: { encData },
        appCode: APP_CODE, version: '1.0.0',
        encType: 'SM4', signType: 'SM2', timestamp: ts
    };
    const innerJson = JSON.stringify(inner);

    // SM2 签名
    const signData = sm2.doSignature(innerJson, kp.privateKey, { hash: true });

    const body = { data: { ...inner, signData } };
    const bodyJson = JSON.stringify(body);

    const xTifSig = crypto.createHash('sha256')
        .update(APP_CODE + ts + nonce + bodyJson).digest('hex');

    return {
        headers: {
            'Content-Type': 'application/json', channel: 'web',
            'x-tif-paasid': 'undefined',
            'x-tif-signature': xTifSig,
            'x-tif-timestamp': String(ts),
            'x-tif-nonce': nonce,
        },
        body,
    };
}

function decrypt(encDataHex) {
    const plain = sm4.decrypt(encDataHex, SM4_KEY, {
        mode: 'cbc', iv: SM4_IV
    });
    return JSON.parse(plain);
}

function genNonce(len) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let r = '';
    for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return r;
}

// CLI
const cmd = process.argv[2];
const input = process.argv[3] || '{}';
try {
    init();
    switch (cmd) {
        case 'encrypt':
            console.log(JSON.stringify(encrypt(JSON.parse(input))));
            break;
        case 'decrypt':
            console.log(JSON.stringify(decrypt(input)));
            break;
        case 'keys':
            console.log(JSON.stringify({
                publicKey: _keypair.publicKey,
                privateKey: _keypair.privateKey,
            }));
            break;
        default:
            console.log(JSON.stringify({error: 'unknown cmd: ' + cmd}));
    }
} catch(e) {
    console.log(JSON.stringify({error: e.message}));
}
"""


class NodeCryptoEngine:
    """Node.js 子进程加密引擎"""

    def _run_node(self, cmd, input_data=None):
        args = ["node", "-e", NODE_CRYPTO_JS, cmd]
        if input_data:
            args.append(input_data)
        r = subprocess.run(args, capture_output=True, text=True,
                           cwd=str(HERE), timeout=30)
        if r.returncode != 0:
            raise RuntimeError(f"Node error: {r.stderr}")
        return json.loads(r.stdout.strip())

    def encrypt(self, params: dict) -> dict:
        return self._run_node("encrypt", json.dumps(params, ensure_ascii=False))

    def decrypt(self, enc_hex: str) -> dict:
        return self._run_node("decrypt", enc_hex)

    def keys(self) -> dict:
        return self._run_node("keys")


# ═══════════════════════════════════════════════════════════════
# iv8 方案: 直接加载完整 app.js
# ═══════════════════════════════════════════════════════════════

def _load_app_in_iv8():
    """在 iv8 中加载 app.js, 尝试提取加密模块

    返回 sm2/sm3/sm4 的导出函数的 Python 包装。
    """
    import iv8

    ctx = iv8.JSContext(
        environment={
            "navigator": {
                "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "platform": "Win32", "language": "zh-CN",
            },
        },
        mode="prod",
    )
    ctx.__enter__()

    try:
        # 1. 加载环境补丁
        bridge_src = BRIDGE_JS.read_text("utf-8")
        ctx.eval(bridge_src, name="nhsa_bridge.js")

        # 2. 加载 app.js
        print("[iv8] Loading app.js (3.7MB)...", file=sys.stderr)
        app_src = APP_JS.read_text("utf-8")
        try:
            ctx.eval(app_src, name="app.js")
        except Exception as e:
            print(f"[iv8] app.js eval error: {e}", file=sys.stderr)
            # Even if app.js throws, the crypto module may have been captured
            pass

        # 3. 尝试 drain 事件循环（处理任何 pending promises）
        try:
            ctx.eval("__iv8__.eventLoop.drain()")
        except Exception:
            pass

        # 4. 检查是否捕获到加密模块
        captured = ctx.eval(
            "window.__nhsa_sm_crypto ? "
            "JSON.stringify(Object.keys(window.__nhsa_sm_crypto)) : "
            "'null'"
        )
        print(f"[iv8] Captured crypto: {captured}", file=sys.stderr)

        # 5. 查看 window 上的全局变量
        global_keys = ctx.eval(
            "JSON.stringify(Object.keys(window).filter(k => "
            "typeof window[k] === 'function' && "
            "(k.includes('sm') || k.includes('encrypt') || k.includes('sign'))"
            ").slice(0, 20))"
        )
        print(f"[iv8] Global crypto fns: {global_keys}", file=sys.stderr)

        return ctx

    except Exception as e:
        ctx.__exit__(None, None, None)
        raise


class Iv8CryptoEngine:
    """iv8 加密引擎 (实验性)"""

    def __init__(self):
        self._ctx = None

    def __enter__(self):
        self._ctx = _load_app_in_iv8()
        return self

    def __exit__(self, *args):
        if self._ctx:
            self._ctx.__exit__(*args)
            self._ctx = None


# ═══════════════════════════════════════════════════════════════
# 统一接口
# ═══════════════════════════════════════════════════════════════

class NhsaCrypto:
    """国家医保局加密引擎"""

    def __init__(self, mode="auto"):
        self._mode = mode
        self._engine = None

    def __enter__(self):
        if self._mode == "auto":
            # 先尝试 iv8（提取真正的密钥），降级到 Node
            try:
                print("[NhsaCrypto] Trying iv8...", file=sys.stderr)
                self._engine = Iv8CryptoEngine()
                self._engine.__enter__()
                self._mode = "iv8"
                return self
            except Exception as e:
                print(f"[NhsaCrypto] iv8 failed: {e}", file=sys.stderr)
                print("[NhsaCrypto] Falling back to Node.js", file=sys.stderr)

            self._engine = NodeCryptoEngine()
            self._mode = "node"
        return self

    def __exit__(self, *args):
        if self._engine and hasattr(self._engine, '__exit__'):
            self._engine.__exit__(*args)

    def encrypt(self, params: dict) -> dict:
        return self._engine.encrypt(params)

    def decrypt(self, enc_hex: str) -> dict:
        return self._engine.decrypt(enc_hex)

    def keys(self) -> dict:
        return self._engine.keys() if hasattr(self._engine, 'keys') else {}


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"

    if cmd == "test":
        print("=== Testing iv8 load ===")
        try:
            with NhsaCrypto(mode="auto") as c:
                print("Keys:", json.dumps(c.keys(), indent=2))
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

    elif cmd == "encrypt":
        params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {
            "keyword": "北京协和医院", "pageNum": 1, "pageSize": 10
        }
        engine = NodeCryptoEngine()
        print(json.dumps(engine.encrypt(params), ensure_ascii=False, indent=2))

    elif cmd == "decrypt":
        enc = sys.argv[2] if len(sys.argv) > 2 else ""
        engine = NodeCryptoEngine()
        print(json.dumps(engine.decrypt(enc), ensure_ascii=False, indent=2))

    else:
        print("Usage: python nhsa_iv8.py test|encrypt|decrypt [input]")
