"""
Phase 2b: 深度搜索签名入口 + Hook XHR 拦截器
"""
import json, time
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUT_DIR = BASE_DIR / "data"


def extract():
    from cloakbrowser import launch

    b = launch(headless=False)
    p = b.new_page()

    p.goto("https://www.xiaohongshu.com/explore", timeout=30000)
    time.sleep(5)

    # 关闭登录弹窗
    try:
        p.evaluate("document.querySelector('.close-button')?.click()")
    except Exception:
        pass
    time.sleep(3)

    # 滚动触发请求
    for i in range(3):
        p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)

    # 1. 搜索 window 上所有有 sign/encrypt 的函数
    print("[*] 搜索全局签名相关...")
    r = p.evaluate("""
    (() => {
        const result = {};
        // 试试 window.xsec* 相关
        result.xsecappid = window.xsecappid;
        result.xsecappvers = window.xsecappvers;
        result.xsecplatform = window.xsecplatform;

        // 检查 anti_hp_sign_config
        const ac = window.anti_hp_sign_config;
        result.antiConfig = ac;

        // 检查 __webpack 模块
        const wpKeys = Object.keys(window).filter(k => k.startsWith('__') || k.startsWith('webpack'));
        result.wpLike = wpKeys.slice(0, 10);

        // 检查 XMLHttpRequest 原型是否被劫持
        result.xhrOpenNative = XMLHttpRequest.prototype.open.toString().slice(0, 100);
        result.xhrSendNative = XMLHttpRequest.prototype.send.toString().slice(0, 100);

        return result;
    })()
    """)
    print(f"   xsec: appId={r.get('xsecappid')}, vers={r.get('xsecappvers')}")
    print(f"   antiConfig: {json.dumps(r.get('antiConfig'), ensure_ascii=False)[:300]}")
    print(f"   wpLike: {r.get('wpLike')}")
    print(f"   xhrOpen: {r.get('xhrOpenNative')}")
    print(f"   xhrSend: {r.get('xhrSendNative')}")

    # 2. 通过 _BHjFmfUMEtxhI 查找签名相关
    print("\n[*] 探索 VM 解释器的 sign 相关...")
    r2 = p.evaluate("""
    (() => {
        const result = {};
        // 尝试直接在 window 对象链上找 sign 相关属性
        for (let key of Object.getOwnPropertyNames(window)) {
            if (key.toLowerCase().includes('sign')) {
                result[key] = typeof window[key];
            }
        }

        // 检查 local/session storage 中的 sign 相关
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.includes('sign')) {
                result['ls_' + k] = localStorage.getItem(k).slice(0, 200);
            }
        }
        return result;
    })()
    """)
    print(f"   {json.dumps(r2, ensure_ascii=False, indent=2)}")

    # 3. 注入 XHR Hook 来捕获签名添加过程
    print("\n[*] 注入 XHR Hook...")
    p.evaluate("""
    (() => {
        const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function(key, value) {
            if (key === 'x-s' || key === 'x-s-common' || key === 'x-t') {
                window.__captured_sign = window.__captured_sign || {};
                window.__captured_sign[key] = value;
                window.__captured_sign._url = this._url || '(unknown)';
                window.__captured_sign._ts = Date.now();
                console.log('[HOOK]', key, '=', value);
            }
            return origSetRequestHeader.call(this, key, value);
        };
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
            this._url = url;
            return origOpen.apply(this, arguments);
        };
        console.log('[HOOK] XHR interceptor installed');
    })()
    """)

    # 再次滚动触发请求
    time.sleep(1)
    for i in range(5):
        p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)

    # 读取捕获的签名
    r3 = p.evaluate("""
    (() => {
        return window.__captured_sign || {none: true};
    })()
    """)
    print(f"   捕获签名: {json.dumps(r3, ensure_ascii=False)[:500]}")

    # 同时捕获所有请求的 headers
    print("\n[*] 当前页面的完整 network 请求...")
    r4 = p.evaluate("""
    (() => {
        // 获取 performance entries
        const entries = performance.getEntriesByType('resource');
        const homefeed = entries.filter(e => e.name.includes('homefeed'));
        return homefeed.map(e => ({url: e.name.slice(0, 100)}));
    })()
    """)
    for e in r4:
        print(f"   {e['url']}")

    # 5. 检查有没有暴露的签名 API
    print("\n[*] 尝试调用签名 API...")
    r5 = p.evaluate("""
    (() => {
        const result = {};
        // 检查 xsec 对象
        const xsecModule = window._BHjFmfUMEtxhI;
        if (typeof xsecModule === 'function') {
            result.interpreterType = 'function';
            // 检查它导出的属性
            const props = Object.getOwnPropertyNames(xsecModule).slice(0, 30);
            result.interpreterProps = props;
        }

        // 查找任何暴露的签名入口
        const allSignKeys = Object.keys(window).filter(k =>
            k.toLowerCase().includes('sign') || k.toLowerCase().includes('sec')
        );
        result.allSignKeys = allSignKeys;

        // 尝试检查 __webpack_require__ 模块
        if (window.__webpack_require__) {
            result.hasWebpackRequire = true;
        }

        return result;
    })()
    """)
    print(f"   {json.dumps(r5, ensure_ascii=False, indent=2)[:800]}")

    input("\n>>> 按 Enter 关闭...")
    b.close()


if __name__ == "__main__":
    extract()
