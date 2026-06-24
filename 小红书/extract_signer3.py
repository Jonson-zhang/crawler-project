"""
Phase 2c: 在浏览器内通过 XHR 触发请求，从 JS 层截获签名参数
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

    try:
        p.evaluate("document.querySelector('.close-button')?.click()")
    except Exception:
        pass
    time.sleep(3)

    # 滚动让 SDK 初始化
    for i in range(3):
        p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)

    # 方法1: 拦截 fetch（可能比 XHR 先）
    print("[*] 拦截 fetch 请求头...")
    r = p.evaluate("""
    (async () => {
        const origFetch = window.fetch;
        window.__captured_headers = null;

        window.fetch = async function(url, options = {}) {
            options.headers = options.headers || {};
            // 先在内部设置 hook，让 SDK 签名后再读取
            const origSetHeader = new Headers(options.headers).set;
            // 延迟执行让 SDK 有机会添加签名
            return origFetch.call(this, url, options);
        };

        // 直接通过原生 XHR 发起请求，在 send 之后读取
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed', true);
            xhr.setRequestHeader('content-type', 'application/json;charset=UTF-8');

            // 在 send 之前 hook setRequestHeader
            const origSetRH = xhr.setRequestHeader;
            const capturedHeaders = {};
            xhr.setRequestHeader = function(key, value) {
                capturedHeaders[key] = value;
                return origSetRH.call(this, key, value);
            };

            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    resolve({
                        status: xhr.status,
                        headers: capturedHeaders,
                        responseLen: xhr.responseText.length
                    });
                }
            };

            xhr.send(JSON.stringify({cursor_score: '', num: 20, refresh_type: 1, note_index: 0}));
        });
    })()
    """)
    print(f"   结果: {json.dumps(r, ensure_ascii=False)[:800]}")

    # 方法2: 通过 performance API 查看请求头
    print("\n[*] 搜索 window 上导出的签名函数...")
    r2 = p.evaluate("""
    (() => {
        // 深搜 _BHjFmfUMEtxhI 的实例
        const fn = window._BHjFmfUMEtxhI;
        const result = {};

        // 检查 webpack chunk
        const wp = window.webpackChunkxhs_pc_web;
        if (wp) {
            result.webpackChunkType = typeof wp;
            result.webpackChunkLen = wp.length;
        }

        // 搜索 window 上有 'sabo' 或 'sec' 前缀的对象
        const saboKeys = Object.getOwnPropertyNames(window).filter(k =>
            k.includes('sabo') || k.includes('_sabo')
        );
        result.saboKeys = saboKeys;

        // 搜索所有的函数/对象可能包含签名入口
        const funcKeys = [];
        for (let key of Object.getOwnPropertyNames(window)) {
            try {
                const val = window[key];
                if (typeof val === 'function' && val.length <= 4 && val.length >= 1) {
                    const str = val.toString();
                    if (str.includes('sign') || str.includes('encrypt')) {
                        funcKeys.push(key);
                    }
                }
            } catch(e) {}
        }
        result.potentialSignFuncs = funcKeys.slice(0, 10);

        return result;
    })()
    """)
    print(f"   {json.dumps(r2, ensure_ascii=False, indent=2)[:800]}")

    # 方法3: 读取 anti_hp_sign_config 完整配置
    print("\n[*] 完整 anti_hp_sign_config...")
    r3 = p.evaluate("window.anti_hp_sign_config")
    (OUT_DIR / "anti_hp_sign_config.json").write_text(
        json.dumps(r3, ensure_ascii=False, indent=2), "utf-8",
    )
    print(f"   已保存，signIncludesUrl: {len(r3.get('signIncludesUrl', []))} 条规则")

    # 方法4: 尝试追踪 x-s 生成时调用栈
    print("\n[*] 用 PerformanceObserver 监控请求...")
    r4 = p.evaluate("""
    (() => {
        // 读取已缓存的请求数据
        const entries = performance.getEntriesByType('resource');
        const homefeeds = entries.filter(e => e.name.includes('homefeed'));
        return homefeeds.map(e => ({
            url: e.name,
            transferSize: e.transferSize,
            initiatorType: e.initiatorType
        }));
    })()
    """)
    for e in r4:
        print(f"   {e['url'][:100]} | {e['initiatorType']}")

    # 方法5: 直接拿 response intercept
    print("\n[*] 用服务 worker 或直接拦截 setRequestHeader...")
    r5 = p.evaluate("""
    (() => {
        // 重写 setRequestHeader 让它在 SDK 之后还能被看到
        // 使用 Object.defineProperty 在 XMLHttpRequest.prototype 上实现
        const results = [];

        // 简单方法：直接用 XHR 发请求，但在此之前获取 SDK 的签名
        // 思路：先获取 SDK 可能已经生成的一个签名（如果有的话）
        return {
            xsecappid: window.xsecappid,
            xsecappvers: window.xsecappvers,
            xsecplatform: window.xsecplatform
        };
    })()
    """)
    print(f"   {json.dumps(r5, ensure_ascii=False)}")

    # 6. 最终方案：创建请求然后用 Service Worker 或 response body 拿签名
    print("\n[*] 最终尝试：捕获完成的请求...")
    r6 = p.evaluate("""
    (() => {
        // 方案：遍历 performance.getEntriesByType('navigation')
        // 但 navigation 不包含请求头
        // 所以我们需要实际捕获请求

        // 使用 PerformanceObserver 无法捕获请求头
        // 最后的办法：hook XMLHttpRequest.prototype.setRequestHeader
        // 但要确保我们的 hook 在 SDK 的 hook 之后执行

        // 删除之前的 hook，重新按正确顺序安装
        return { method: 'need_browser_network_capture' };
    })()
    """)

    # 7. 用 browser context 的 CDP 来捕获完整请求
    print("\n[*] 通过 browser page CDP 捕获...")
    try:
        # 尝试使用 CDP
        cdp = b.contexts[0].new_cdp_session() if hasattr(b, 'contexts') else None
    except Exception:
        cdp = None
    print(f"   CDP: {cdp}")

    # 8. 回退：直接用 page 的网络事件
    print("\n[*] 回退方案：监听 page 的网络请求事件...")
    captured = []

    def on_request(request):
        if "homefeed" in request.url:
            captured.append({
                "url": request.url,
                "headers": dict(request.headers),
                "method": request.method,
                "postData": request.post_data if hasattr(request, 'post_data') else None
            })
            print(f"   [CAPTURED] {len(captured)} homefeed requests")

    try:
        p.on("request", on_request)
    except Exception as e:
        print(f"   page.on failed: {e}")

    # 再次滚动触发
    time.sleep(3)
    for i in range(5):
        p.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(2)

    if captured:
        h = captured[0]["headers"]
        print(f"\n[+] 捕获到 {len(captured)} 个请求!")
        for k in ["x-s", "x-t", "x-s-common", "x-b3-traceid"]:
            if k in h:
                print(f"    {k}: {h[k][:120]}")
        (OUT_DIR / "homefeed_full_headers.json").write_text(
            json.dumps(captured[0], ensure_ascii=False, indent=2), "utf-8",
        )
    else:
        print("   未捕获到请求")

    # 9. 保存所有 cookie 和 localStorage
    cookies = p.context.cookies()
    print(f"\n[*] Cookie: {len(cookies)} 个")
    ls_keys = p.evaluate("Object.keys(localStorage)")
    print(f"[*] localStorage: {len(ls_keys)} 个键")

    # 保存 ds_api.js 的完整动态内容（它每次都可能是新的）
    ds_content = p.evaluate("""
    (() => {
        for (const s of document.scripts) {
            if (s.src && s.src.includes('/ds?appId=')) {
                return {url: s.src, len: s.text?.length || 0};
            }
        }
        return null;
    })()
    """)
    print(f"\n[*] DS API script: {ds_content}")

    input("\n>>> 按 Enter 关闭...")
    b.close()


if __name__ == "__main__":
    extract()
