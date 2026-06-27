"""
Boss直聘 — 固定指纹浏览器方案

用 Playwright + 标准 Chromium（指纹每次一致），同会话完成：
  访问页面 → 安全检查自动通过 → 调用 API → 返回数据

关键：标准 Chromium 指纹一致（同一机器的 GPU/屏幕/字体），
不会像 Camoufox 那样每次随机化。
"""
import asyncio
import json
import time
from pathlib import Path
from playwright.async_api import async_playwright

BASE = Path(__file__).parent


async def search_jobs(city="101010100", query="python", page_num=1,
                      headless=True):
    """
    搜索 Boss直聘职位

    流程：浏览器访问 zhipin.com → JS 自动完成安全检查 → 直接调 API
    """

    async with async_playwright() as p:
        # 启动固定指纹 Chromium
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",  # 隐藏自动化标记
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        # 创建上下文 — 固定视口 + 常见 User-Agent
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/148.0.0.0 Safari/537.36"
            ),
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )

        # ===== 注入强 stealth 补丁 =====
        await context.add_init_script("""
            // === 1. Remove webdriver ===
            const navProto = Object.getPrototypeOf(navigator);
            Object.defineProperty(navProto, 'webdriver', {
                get: () => undefined, configurable: true, enumerable: true
            });

            // === 2. Override UA ===
            Object.defineProperty(navProto, 'userAgent', {
                get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
                configurable: true, enumerable: true
            });

            // === 3. Mock plugins ===
            const names = ['PDF Viewer','Chrome PDF Viewer','Chromium PDF Viewer','Microsoft Edge PDF Viewer','WebKit built-in PDF'];
            const pls = [];
            for (let i = 0; i < 5; i++) pls.push({
                name: names[i], filename: 'internal-pdf-viewer',
                description: 'Portable Document Format', length: 1,
                item: function(){ return null }, namedItem: function(){ return null }
            });
            pls.item = function(i) { return this[i] || null; };
            pls.namedItem = function(n) { return null; };
            pls.refresh = function() {};
            Object.defineProperty(pls, 'length', {value: 5, configurable: true, enumerable: true});
            Object.defineProperty(navProto, 'plugins', {
                get: () => pls, configurable: true, enumerable: true
            });

            // === 4. Mock mimeTypes ===
            const mts = [{type:'application/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]},
                        {type:'text/pdf',suffixes:'pdf',description:'',enabledPlugin:pls[0]}];
            mts.item = function(i) { return this[i] || null; };
            mts.namedItem = function(n) { return null; };
            Object.defineProperty(mts, 'length', {value: 2, configurable: true, enumerable: true});
            Object.defineProperty(navProto, 'mimeTypes', {
                get: () => mts, configurable: true, enumerable: true
            });

            // === 5. Fix languages ===
            Object.defineProperty(navProto, 'languages', {
                get: () => ['zh-CN','zh'], configurable: true, enumerable: true
            });

            // === 6. chrome object ===
            window.chrome = {runtime:{}, loadTimes:function(){}, csi:function(){}, app:{}};

            // === 7. Cleanup PW marks ===
            delete window.__playwright;
        """)

        page = await context.new_page()

        # ===== Step 1: 访问 Boss直聘 =====
        url = f"https://www.zhipin.com/web/geek/jobs?city={city}&query={query}"
        print(f"访问: {url}")
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # ===== Step 2: 等待安全检查完成 =====
        print("等待安全检查...")
        await asyncio.sleep(8)  # 给 JS 加载+执行时间

        # 等待 __zp_stoken__ cookie
        has_token = False
        for i in range(20):
            cookies = await context.cookies()
            has_token = any(
                c["name"] == "__zp_stoken__" for c in cookies
            )
            if has_token:
                print(f"[OK] Token Cookie 已设置 (等待 {5+i}s)")
                break
            await asyncio.sleep(1)
        if not has_token:
            print("[WARN] Token Cookie 未在 25s 内生成")

        # ===== Step 3: 用浏览器 context 的 request API（TLS 指纹一致）=====
        print("调用 API...")
        api_url = "https://www.zhipin.com/wapi/zpgeek/search/joblist.json"
        params = {"city": city, "query": query, "page": str(page_num)}
        api_resp = await context.request.get(api_url, params=params, headers={
            "Accept": "application/json",
            "referer": url,
        })
        result = await api_resp.json()

        code = result.get("code")
        message = result.get("message", "")
        print(f"API: code={code} msg={message[:60]}")

        if code == 0:
            jobs = result.get("zpData", {}).get("jobList", [])
            total = result.get("zpData", {}).get("totalCount", 0)
            print(f"[OK] 成功! 共 {total} 个职位，当前页 {len(jobs)} 个")
            for j in jobs[:10]:
                print(f"  [{j.get('jobName', '?')}] @ {j.get('brandName', '?')} "
                      f" - {j.get('salaryDesc', '?')} ({j.get('cityName', '?')})")
            return jobs

        elif code == 37:
            # 需要 seed 生成 token
            zp = result.get("zpData", {})
            seed = zp.get("seed", "")
            api_ts = zp.get("ts", 0)
            print(f"code=37, seed={seed[:20]}... ts={api_ts}")
            print("浏览器路径应该自动生成 token，不需要手动处理 seed")

        await browser.close()
        return result


async def extract_env_from_browser():
    """从固定指纹浏览器提取环境值（一次提取，后续可复用）"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("about:blank")

        env = await page.evaluate("""() => ({
            ua: navigator.userAgent,
            platform: navigator.platform,
            vendor: navigator.vendor,
            languages: navigator.languages,
            hwConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            maxTouchPoints: navigator.maxTouchPoints,
            webdriver: navigator.webdriver,
            plugins_len: navigator.plugins?.length,
            mimeTypes_len: navigator.mimeTypes?.length,
            screenW: screen.width,
            screenH: screen.height,
            screenAW: screen.availWidth,
            screenAH: screen.availHeight,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            innerW: window.innerWidth,
            innerH: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })""")

        await browser.close()
        return env


async def main():
    import sys

    city = sys.argv[1] if len(sys.argv) > 1 else "101010100"
    query = sys.argv[2] if len(sys.argv) > 2 else "python"
    headless = "--no-headless" not in sys.argv

    print("=" * 60)
    print("Boss直聘 — 固定指纹浏览器方案")
    print(f"city={city}, query={query}, headless={headless}")
    print("=" * 60)

    # 可选：先提取环境指纹
    if "--extract-env" in sys.argv:
        env = await extract_env_from_browser()
        print(json.dumps(env, ensure_ascii=False, indent=2))
        return

    result = await search_jobs(city, query, headless=headless)

    if isinstance(result, list):
        print(f"\n共 {len(result)} 个结果")
    else:
        print(f"\n结果: code={result.get('code')}")
        print(json.dumps(result, ensure_ascii=False, indent=2)[:1000])


if __name__ == "__main__":
    asyncio.run(main())
