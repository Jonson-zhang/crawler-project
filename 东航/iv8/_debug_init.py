"""调试 iv8 中 wbsk_Wbox.js 的初始化流程"""
import json
from pathlib import Path
import iv8

HERE = Path(__file__).parent
WBOX_JS = HERE.parent / "cloak" / "v1.0" / "wbsk_Wbox.js"
SKB_JS = HERE.parent / "cloak" / "v1.0" / "wbsk_skb_orig.js"

ctx = iv8.JSContext(
    environment={
        "navigator": {
            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            "platform": "Win32",
        },
    },
    mode="prod",
)
ctx.__enter__()

try:
    # Step 1: Check pre-load state
    print("=== Before loading ===")
    r = ctx.eval("JSON.stringify({WebAssembly: typeof WebAssembly, window: typeof window})")
    print(json.loads(r))

    # Step 2: Load wbsk_Wbox.js
    print("\n=== Loading wbsk_Wbox.js ===")
    wbox_src = WBOX_JS.read_text("utf-8")
    ctx.eval(wbox_src, name="wbsk_Wbox.js")

    # Step 3: Check post-load state
    print("\n=== After loading ===")
    r = ctx.eval("""
    JSON.stringify({
        runtimeInitialized: typeof Module !== 'undefined' ? Module.runtimeInitialized : 'no Module',
        asmKeys: typeof Module !== 'undefined' && Module.asm ? Object.keys(Module.asm).slice(0, 5) : 'no asm',
        cwrap: typeof Module !== 'undefined' ? typeof Module.cwrap : 'no Module',
        malloc: typeof Module !== 'undefined' ? typeof Module._malloc : 'no Module',
        runtimeExited: typeof Module !== 'undefined' ? Module.runtimeExited : 'no Module',
        WebAssemblyNative: typeof WebAssembly !== 'undefined' ? WebAssembly.Memory.toString().substring(0, 50) : 'undefined',
    })
    """)
    print(json.dumps(json.loads(r), indent=2))

    # Step 4: Try to drain event loop
    print("\n=== Draining event loop ===")
    try:
        ctx.eval("__eventLoop__.drain()")
        print("event loop drained")
    except Exception as e:
        print(f"event loop drain failed: {e}")
        try:
            ctx.eval("__iv8__.eventLoop.drain()")
            print("event loop drained (via __iv8__)")
        except Exception as e2:
            print(f"__iv8__ drain also failed: {e2}")

    # Step 5: Check after drain
    print("\n=== After event loop drain ===")
    r = ctx.eval("""
    JSON.stringify({
        runtimeInitialized: Module.runtimeInitialized,
        asmKeys: Module.asm ? Object.keys(Module.asm).slice(0, 5) : 'no asm',
    })
    """)
    print(json.dumps(json.loads(r), indent=2))

    # Step 6: Try to load wbsk_skb_orig.js
    print("\n=== Loading wbsk_skb_orig.js ===")
    skb_src = SKB_JS.read_text("utf-8")
    try:
        ctx.eval(skb_src, name="wbsk_skb_orig.js")
        print("wbsk_skb_orig.js loaded")
    except Exception as e:
        print(f"Failed: {e}")

    # Step 7: Try encrypt
    print("\n=== Trying encrypt ===")
    IV = [121, 96, 7, 103, 57, 95, 61, 124, 121, 96, 7, 103, 57, 95, 61, 124]
    try:
        result = ctx.eval(f"""
        (function() {{
            var data = JSON.stringify({{test: "hello"}});
            var iv = {json.dumps(IV)};
            return wbsk_AES_cbc_encrypt_base64(data, iv).substring(0, 40);
        }})()
        """)
        print(f"encrypt result: {result}")
    except Exception as e:
        print(f"encrypt failed: {e}")

finally:
    ctx.__exit__()
