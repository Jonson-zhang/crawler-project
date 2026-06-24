"""
Phase 2: 在浏览器中定位并提取签名函数 seccore_signv2
"""
import json, time
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUT_DIR = BASE_DIR / "data"


def extract_signer():
    from cloakbrowser import launch

    b = launch(headless=False)
    p = b.new_page()

    p.goto("https://www.xiaohongshu.com/explore", timeout=30000)
    time.sleep(5)

    # 关闭登录弹窗
    try:
        p.evaluate("""
        (() => {
            const btn = document.querySelector('.close-button, [class*="close"]');
            if (btn) btn.click();
        })()
        """)
    except Exception:
        pass
    time.sleep(3)

    # 滚动触发 homefeed 请求（让签名 SDK 初始化）
    print("[*] 触发页面加载...")
    for i in range(5):
        p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)

    # 尝试全局搜索 seccore_signv2
    print("\n[*] 搜索 seccore_signv2...")
    result = p.evaluate("""
    (() => {
        // 搜索全局对象上的签名相关函数
        const keys = Object.keys(window).filter(k =>
            k.includes('sign') || k.includes('sec') || k.includes('core') || k.includes('_BHj')
        );
        // 也检查 webpack 模块
        let wpKeys = [];
        if (window.webpackJsonp) wpKeys.push('has webpackJsonp');

        return {
            globalKeys: keys.slice(0, 20),
            wpKeys: wpKeys,
            hasSeccore: typeof window.seccore !== 'undefined',
            hasSeccoreSignv2: typeof window.seccore_signv2 !== 'undefined',
            hasSignV2: typeof window.sign_v2 !== 'undefined',
        };
    })()
    """)
    print(f"   结果: {json.dumps(result, ensure_ascii=False)}")

    # 搜索 _BHjFmfUMEtxhI（VM 解释器）
    print("\n[*] 搜索 VM 解释器...")
    result2 = p.evaluate("""
    (() => {
        const r = {};
        if (typeof window._BHjFmfUMEtxhI !== 'undefined') r.interpreter = 'found on window';

        // 搜索所有全局键中的 _BHj 模式
        const matching = Object.keys(window).filter(k => k.startsWith('_BHj') || k.startsWith('_A'));
        r.matchingKeys = matching.slice(0, 10);

        return r;
    })()
    """)
    print(f"   结果: {json.dumps(result2, ensure_ascii=False)}")

    # 尝试用 toString 搜索所有全局函数中调用 seccore_signv2 的
    print("\n[*] 搜索所有已加载脚本中的签名代码...")
    result3 = p.evaluate("""
    (() => {
        const scripts = [...document.scripts];
        const found = [];
        for (const s of scripts) {
            try {
                const txt = s.text || '';
                if (txt.includes('seccore_signv2')) {
                    found.push({url: s.src?.slice(0, 100) || '(inline)', len: txt.length});
                }
                if (txt.includes('x-s-common')) {
                    found.push({url: s.src?.slice(0, 100) || '(inline)', len: txt.length, tag: 'x-s-common'});
                }
                if (txt.includes('xhsSign')) {
                    found.push({url: s.src?.slice(0, 100) || '(inline)', len: txt.length, tag: 'xhsSign'});
                }
            } catch(e) {}
        }
        return found;
    })()
    """)
    print(f"   找到 {len(result3)} 个匹配:")
    for r in result3:
        print(f"     {r}")

    # 也尝试搜索 x-s-common 的生成代码
    print("\n[*] 搜索 x-s-common 生成代码...")
    result4 = p.evaluate("""
    (() => {
        // 搜索 base64 相关函数
        const scripts = [...document.scripts];
        const found = [];
        for (const s of scripts) {
            try {
                const txt = s.text || '';
                if (txt.includes('x-s-common') && txt.length < 100000) {
                    const idx = txt.indexOf('x-s-common');
                    found.push({
                        url: s.src?.slice(0, 80) || '(inline)',
                        context: txt.slice(Math.max(0, idx - 100), idx + 200)
                    });
                }
            } catch(e) {}
        }
        return found.slice(0, 3);
    })()
    """)
    for r in result4:
        print(f"   {r['url']}")
        print(f"   context: ...{r['context'][:200]}...")

    # 保存当前页面所有内联脚本
    print("\n[*] 保存所有内联脚本...")
    inline_scripts = p.evaluate("""
    (() => {
        const scripts = [...document.scripts];
        const result = [];
        for (let i = 0; i < scripts.length; i++) {
            const s = scripts[i];
            if (!s.src && s.text && s.text.includes('sign')) {
                result.push({index: i, len: s.text.length, preview: s.text.slice(0, 200)});
            }
        }
        return result;
    })()
    """)
    for s in inline_scripts:
        print(f"   inline[{s['index']}]: {s['len']} 字节, preview: {s['preview'][:100]}")

    input("\n>>> 按 Enter 关闭浏览器...")
    b.close()


if __name__ == "__main__":
    extract_signer()
