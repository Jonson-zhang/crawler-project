"""
Boss直聘浏览器桥接 — Python 通过 Camoufox 调用 Boss API

工作原理：
  1. Python 控制 Camoufox 浏览器访问 zhipin.com
  2. 浏览器自动通过安全检查（生成 __zp_stoken__）
  3. Python 通过 evaluate_js 在浏览器中调用 API
  4. 浏览器返回 JSON 数据给 Python

依赖：
  - Camoufox 浏览器（由 Claude MCP 启动）
  - 或 Playwright + Camoufox 插件

用法1（通过 MCP — Claude 会话中）：
  由 Claude 调用 MCP 工具完成

用法2（独立 Python 脚本）：
  pip install playwright camoufox
  python boss_bridge.py --city 101010100 --query python
"""

import json
import time
import asyncio
from pathlib import Path
from typing import Optional

BASE = Path(__file__).parent


# ============================================================
# 方案 A: 通过 Playwright 直接控制 Camoufox
# ============================================================

async def search_jobs_playwright(city="101010100", query="python", page_num=1):
    """
    通过 Playwright + Camoufox 搜索职位

    注意：需要先安装 playwright + camoufox：
      pip install playwright camoufox
      python -m camoufox init
    """
    try:
        from camoufox import Camoufox
        from camoufox.playwright import AsyncNewContext
    except ImportError:
        raise ImportError(
            "请安装 Camoufox: pip install playwright camoufox && python -m camoufox init"
        )

    async with Camoufox(
        headless=True,
        os_type="windows",
        locale="zh-CN",
        block_webrtc=True,
    ) as browser:
        page = await browser.new_page()

        # Step 1: 访问 Boss直聘（触发安全检查）
        url = f"https://www.zhipin.com/web/geek/jobs?city={city}&query={query}"
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Step 2: 等待安全检查完成（页面加载后 JS 自动处理）
        await asyncio.sleep(5)

        # Step 3: 在浏览器中直接调用 API
        api_url = f"/wapi/zpgeek/search/joblist.json?city={city}&query={query}&page={page_num}"
        result = await page.evaluate(f"""
            async () => {{
                const resp = await fetch('{api_url}', {{
                    headers: {{ 'Accept': 'application/json' }}
                }});
                return await resp.json();
            }}
        """)

        return result


# ============================================================
# 方案 B: 通过 CDP 协议控制浏览器
# ============================================================

async def search_jobs_cdp(city="101010100", query="python", page_num=1,
                           browser_url="http://127.0.0.1:9222"):
    """
    通过 CDP 协议连接已有浏览器实例

    启动 Camoufox 带调试端口:
      python -m camoufox --remote-debugging-port 9222
    """
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise ImportError("请安装 Playwright: pip install playwright")

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp(browser_url)
        pages = browser.contexts[0].pages
        page = pages[0] if pages else await browser.contexts[0].new_page()

        url = f"https://www.zhipin.com/web/geek/jobs?city={city}&query={query}"
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        await asyncio.sleep(5)

        api_url = f"/wapi/zpgeek/search/joblist.json?city={city}&query={query}&page={page_num}"
        result = await page.evaluate(f"""
            async () => {{
                const resp = await fetch('{api_url}', {{
                    headers: {{ 'Accept': 'application/json' }}
                }});
                return await resp.json();
            }}
        """)

        return result


# ============================================================
# 方案 C: 通过 MCP evaluate_js 快捷函数
# ============================================================

BROWSER_JS_SEARCH = """
(async () => {
    const params = new URLSearchParams({city: __CITY__, query: __QUERY__, page: __PAGE__});
    const resp = await fetch('/wapi/zpgeek/search/joblist.json?' + params, {
        headers: { 'Accept': 'application/json', 'referer': location.href }
    });
    const data = await resp.json();
    if (data.code !== 0) return { error: true, code: data.code, message: data.message };
    const jobs = (data.zpData?.jobList || []).map(j => ({
        name: j.jobName, company: j.brandName, salary: j.salaryDesc,
        location: j.cityName, exp: j.jobExperience, edu: j.jobDegree,
        lid: j.lid, securityId: j.securityId
    }));
    return { code: 0, total: data.zpData?.totalCount || 0, jobs: jobs };
})()
"""


def get_mcp_search_js(city="101010100", query="python", page="1"):
    """生成 MCP evaluate_js 调用"""
    return (
        BROWSER_JS_SEARCH
        .replace("__CITY__", f'"{city}"')
        .replace("__QUERY__", f'"{query}"')
        .replace("__PAGE__", f'"{page}"')
    )


# ============================================================
# 方案 D: 提取浏览器 token 到 Python 使用
# ============================================================

async def get_token_from_browser(page) -> dict:
    """从浏览器获取 cookies（用于 curl_cffi）"""
    cookies = await page.context.cookies()
    result = {}
    for c in cookies:
        if c["domain"].endswith("zhipin.com"):
            result[c["name"]] = c["value"]
    return result


# ============================================================
# 测试入口
# ============================================================

async def main():
    """演示：通过浏览器搜索 Boss直聘职位"""
    import sys

    city = sys.argv[1] if len(sys.argv) > 1 else "101010100"
    query = sys.argv[2] if len(sys.argv) > 2 else "python"

    print(f"搜索: city={city}, query={query}")
    print("=" * 60)

    try:
        result = await search_jobs_playwright(city, query)

        if result.get("code") == 0:
            jobs = result.get("zpData", {}).get("jobList", [])
            print(f"✅ 成功! 找到 {len(jobs)} 个职位：")
            for j in jobs[:10]:
                print(f"  [{j.get('jobName', '?')}] @ {j.get('brandName', '?')} - {j.get('salaryDesc', '?')}")
        else:
            print(f"❌ 失败: code={result.get('code')}, msg={result.get('message')}")
            print(json.dumps(result, ensure_ascii=False, indent=2)[:500])

    except ImportError as e:
        print(f"缺少依赖: {e}")
        print()
        print("安装方法：")
        print("  pip install playwright camoufox")
        print("  python -m camoufox init")
        print()
        print("或使用 MCP 方式（在 Claude 中）：")
        print("  mcp__camoufox-reverse__evaluate_js 调用 ")


if __name__ == "__main__":
    asyncio.run(main())
