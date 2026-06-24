"""用 cloakbrowser 捕获真实浏览器发出的 API 请求头"""
from cloakbrowser import launch
import json

b = launch(headless=False)
page = b.new_page()

# CDP 跳过 debugger
cdp = b.new_browser_cdp_session()
cdp.send('Debugger.enable')
cdp.on('Debugger.paused', lambda p: cdp.send('Debugger.resume'))

# 拦截 API 请求
api_requests = []

def on_request(req):
    if 'channel/v1/news' in req.url:
        api_requests.append({
            'url': req.url,
            'method': req.method,
            'headers': req.headers,
        })
        print(f'\n>>> {req.method} {req.url}')
        for k, v in req.headers.items():
            print(f'    {k}: {v}')

page.on('request', on_request)

def on_response(resp):
    if 'channel/v1/news' in resp.url:
        print(f'\n<<< {resp.status} {resp.url}')
        print(f'    Body: {resp.text()[:500]}')

page.on('response', on_response)

# 导航到荔枝网首页
page.goto('https://www.gdtv.cn/', wait_until='networkidle')
page.wait_for_timeout(8000)

if api_requests:
    print('\n=== Captured API Headers ===')
    for api in api_requests:
        print(json.dumps(api, ensure_ascii=False, indent=2))
        break

input('\nPress Enter to close browser...')
b.close()
