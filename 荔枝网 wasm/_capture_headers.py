"""用 cloakbrowser 捕获真实浏览器发出的 API 请求头"""
from cloakbrowser import launch

b = launch(headless=False)
page = b.new_page()

api_headers = []

def on_route(route):
    req = route.request
    if 'channel/v1/news' in req.url:
        print(f'\n=== {req.method} {req.url} ===')
        for k, v in req.headers.items():
            print(f'  {k}: {v}')
        api_headers.append(dict(req.headers))
    route.continue_()

page.route('**/channel/v1/news**', on_route)

page.goto('https://www.gdtv.cn/', wait_until='networkidle')
page.wait_for_timeout(10000)

if api_headers:
    print(f'\n>>> Captured {len(api_headers)} request(s)')
else:
    print('\n!!! No API call captured. Try scrolling...')
    page.evaluate('window.scrollTo(0, 3000)')
    page.wait_for_timeout(5000)

input('\nPress Enter to close...')
b.close()
