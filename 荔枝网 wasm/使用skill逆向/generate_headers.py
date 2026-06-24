#!/usr/bin/env python3
"""
荔枝网 API 数据获取（cloakbrowser 版）

直接利用浏览器内已初始化的 React app + WASM 签名器：
  1. 在页面内发 fetch/XHR 请求
  2. 用 page.route 拦截签名头
  3. Python 侧重放签名头获取数据

或者更直接：在 page 内用 fetch() 发请求（走完整签名链），
用 page.route 转发响应给 Python。

用法：python generate_headers.py
"""

import json
from cloakbrowser import launch

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"


def fetch_api(page, path, query=""):
    """
    在浏览器页面内调用 fetch() 发 API 请求。
    由于页面已加载了 app 代码（含 axios 拦截器 + WASM 签名器），
    页面内的 fetch() 调用会自动经过签名拦截器附加 ca 头。

    我们用 page.route 拦截响应，不实际发送到外网。

    如果直接让浏览器发真实请求，page.route 可以捕获响应。
    """
    full_url = f"https://gdtv-api.gdtv.cn{path}"
    if query:
        full_url += "?" + query

    response_data = {}
    done = False

    def handle_route(route):
        nonlocal response_data, done
        if path in route.request.url:
            # 捕获请求头（用于后续 Python 重放）
            response_data["request_headers"] = dict(route.request.headers)
            # 让请求继续发送，获取真实响应
            route.continue_()

    page.route(f"**{path}**", handle_route)

    # 在页面中通过 window.fetch 发请求
    # 注意：这会经过浏览器的完整网络栈
    try:
        page.evaluate(f"""
            fetch('{full_url}', {{
                method: 'GET',
                headers: {{ 'Accept': 'application/json, text/plain, */*' }}
            }}).then(r => r.json()).then(d => {{
                window.__api_response = d;
            }}).catch(e => {{
                window.__api_error = e.message;
            }});
        """)
    except:
        pass

    # 等待响应
    page.wait_for_timeout(5000)
    page.unroute(f"**{path}**")

    api_response = page.evaluate("window.__api_response")
    api_error = page.evaluate("window.__api_error")

    return {
        "headers": response_data.get("request_headers", {}),
        "data": api_response,
        "error": api_error,
    }


def main():
    print("Launching browser...")
    b = launch(headless=True)
    page = b.new_page()

    print("Navigating to gdtv.cn...")
    page.goto("https://www.gdtv.cn/", wait_until="networkidle")
    page.wait_for_timeout(6000)  # 等 WASM 初始化

    # Test API fetch
    print("\nTesting fetch...")
    result = fetch_api(page, "/api/channel/v1/news", "beginScore=0&pageSize=3&channelId=117")

    print(f"\nStatus: {'ok' if result['data'] else 'failed'}")
    print(f"Error: {result['error']}")

    sign_headers = {k: v for k, v in result.get('headers', {}).items() if k.lower().startswith('x-itouchtv')}
    if sign_headers:
        print("Sign headers captured:")
        for k, v in sign_headers.items():
            print(f"  {k}: {v}")

    if result.get('data'):
        print(f"\nResponse preview:")
        print(json.dumps(result['data'], ensure_ascii=False, indent=2)[:500])

    page.wait_for_timeout(1000)
    b.close()


if __name__ == "__main__":
    main()
