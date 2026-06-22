"""调试：检查访问首页后 WAF 是否下发 acw_sc__v3"""
import asyncio, sys, io, time
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

async def main():
    from camoufox.async_api import AsyncCamoufox

    print("[1] 启动 Camoufox（无头）...")
    cam = AsyncCamoufox(headless=True, os="windows", locale="zh-CN")
    browser = await cam.__aenter__()

    try:
        ctx = browser.contexts[0] if browser.contexts else await browser.new_context()
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()

        # 访问首页
        print("[2] 访问 m.ceair.com ...")
        await page.goto("https://m.ceair.com/", wait_until="domcontentloaded", timeout=30_000)

        # 每 2 秒打印一次 cookie，持续 20 秒
        for i in range(10):
            await asyncio.sleep(2)
            cookies = await ctx.cookies()
            names = sorted(set(c["name"] for c in cookies))
            waf = [c["name"] for c in cookies if "acw" in c["name"] or "waf" in c["name"].lower()]
            print(f"  t={2*(i+1)}s  cookies: {names}")
            if waf:
                print(f"    WAF related: {waf}")

        # 再访问 flightList
        print("[3] 访问 flightList ...")
        await page.goto("https://m.ceair.com/mapp/reserve/flightList",
                        wait_until="domcontentloaded", timeout=30_000)
        await asyncio.sleep(5)
        cookies = await ctx.cookies()
        names = sorted(set(c["name"] for c in cookies))
        print(f"  after flightList: {names}")

    finally:
        await browser.close()
        print("\nDone")

asyncio.run(main())
