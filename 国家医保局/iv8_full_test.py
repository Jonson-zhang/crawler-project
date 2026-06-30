"""
iv8 完整测试 — patch app.js (4处) → iv8加载 → 验证所有加密模块
"""
import sys, json, iv8
from pathlib import Path

HERE = Path(__file__).parent
src = (HERE / "config" / "app.js").read_text("utf-8")

# Patch helper: 用原始偏移追踪
def patched_source(src, patches):
    """patches = [(pattern, insert), ...] 按位置排序后应用"""
    items = [(src.index(p), len(p), ins) for p, ins in patches]
    items.sort()
    result = src
    off = 0
    for pos, plen, ins in items:
        ap = pos + off
        result = result[:ap + plen] + ins + result[ap + plen:]
        off += len(ins)
    return result

patched = patched_source(src, [
    ('_0x393c82[_0x7e206d(0x254e)] = { sm2: _0x48bced, sm3: _0x35d99f, sm4: _0x1c05ff };',
     ';window.__c={sm2:_0x48bced,sm3:_0x35d99f,sm4:_0x1c05ff};window.__c_mod="68b2";'),

    ('(_0x1210ab["l"] = !0x0),',
     '(window["_m"+_0x518e77]=_0x1210ab["exports"]),'),

    ('function _0x32a5f1(_0x2e1290, _0x1a6c05, _0xc6a789) {',
     'window.__k=_0x1a6c05;window.__kp=_0x2e1290;'),

    ('function _0x379870(_0x114d61, _0x2fdcf9) {',
     'window.__ds_key=_0x2fdcf9;window.__ds_msg=_0x114d61;'),
])

print(f"[iv8] Patched: {(len(patched)/1024/1024):.1f}MB", file=sys.stderr)

# Load existing bridge (same as iv8_test.py uses, but read from file)
bridge_path = HERE / "iv8_bridge.js"
if bridge_path.exists():
    BRIDGE = bridge_path.read_text("utf-8")
    # Add module export + createEvent patches if not already there
    if 'document.createEvent' not in BRIDGE:
        BRIDGE += '\ndocument.createEvent = function(type) { return { initEvent: function(){} }; };\n'
    if 'document.createComment' not in BRIDGE:
        BRIDGE += '\ndocument.createComment = function(){ return {}; };\n'
    print(f"[iv8] Loaded bridge ({len(BRIDGE)} bytes)", file=sys.stderr)
else:
    print("[iv8] bridge not found, using minimal", file=sys.stderr)
    BRIDGE = "(function(){window.__nhsa_ready=true;})();"

# Load in iv8
print("[iv8] Loading...", file=sys.stderr)
with iv8.JSContext(mode="prod") as ctx:
    ctx.eval(BRIDGE, name="bridge.js")
    print("[iv8] Bridge loaded", file=sys.stderr)

    wrapped = "try {\n" + patched + "\n} catch(e) { window.__iv8_err = String(e); }"
    try:
        ctx.eval(wrapped, name="app.js")
    except Exception as e:
        print(f"[iv8] FATAL: {e}", file=sys.stderr)

    # Drain
    try: ctx.eval("__iv8__.eventLoop.drain()")
    except: pass

    # Check results
    err = ctx.eval("window.__iv8_err || 'none'")
    has_c = ctx.eval("window.__c ? true : false")
    mod_count = ctx.eval("Object.keys(window).filter(function(k){return k.startsWith('_m')}).length")
    has_sha = ctx.eval("window._m21bf && window._m21bf.SHA256 ? true : false")
    sm4_key = ctx.eval("window.__k ? Array.from(window.__k).join(',') : 'null'")
    ds_key = ctx.eval("window.__ds_key || 'null'")

    print(f"[iv8] Error: {err[:100]}", file=sys.stderr)
    print(f"[iv8] Crypto exported: {has_c}", file=sys.stderr)
    print(f"[iv8] Modules exported: {mod_count}", file=sys.stderr)
    print(f"[iv8] SHA256 available: {has_sha}", file=sys.stderr)
    print(f"[iv8] SM4 key: {sm4_key}", file=sys.stderr)
    print(f"[iv8] DS key: {ds_key[:60]}", file=sys.stderr)

    # Verify SM4
    result = ctx.eval("""
        (function(){
            var k = window.__k;
            var enc = window.__c.sm4.encrypt;
            var pt = [123,34,107,101,121,115,34,58,34,34,125,5,5,5,5,5];
            var hex = Array.from(enc(pt, k)).map(function(b){return ('0'+(b&0xFF).toString(16)).slice(-2)}).join('');
            return hex;
        })()
    """)
    print(f"[iv8] SM4 selectByKeys: {result} {'✅' if result.upper() == '4A8E4673BB18D86FE780DACC31C49FE3' else '❌'}", file=sys.stderr)

    # Test SHA256
    if has_sha:
        sha_test = ctx.eval("""
            (function(){
                var result = window._m21bf.SHA256('test');
                var w = result.words, s = result.sigBytes, h = '';
                for (var i = 0; i < s; i++) h += ('0' + ((w[i>>>2]>>>(24-(i%4)*8))&0xff).toString(16)).slice(-2);
                return h;
            })()
        """)
        import hashlib
        expected = hashlib.sha256(b"test").hexdigest()
        print(f"[iv8] SHA256('test'): {sha_test} {'✅' if sha_test == expected else '❌'} (expected: {expected})", file=sys.stderr)

    # Test doSignature
    if ctx.eval("window.__c.sm2.doSignature ? true : false"):
        try:
            sig_test = ctx.eval("""
                (function(){
                    var msg = JSON.stringify({test:'hello'});
                    var key = '009c4a35d9aca4c68f1a3fa89c93684347205a4d84dc260558a049869709ac0b42';
                    var hex = window._m4d09 ? window._m4d09.doSignature(msg, key, {hash:true}) : 'no m4d09';
                    return hex.length + ' hex chars';
                })()
            """)
            print(f"[iv8] SM2 doSignature: {sig_test}", file=sys.stderr)
        except Exception as e:
            print(f"[iv8] SM2 error: {e}", file=sys.stderr)

print("\n✅ iv8 full test complete", file=sys.stderr)
