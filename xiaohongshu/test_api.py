"""Test homefeed API with real browser guest cookies"""
import requests
import time
import random
import string

# Real browser cookies
COOKIES = {
    'a1': '19eff49e79ans8y7nue0afhmfs83xwb7j82uc3bdt50000222786',
    'webId': '98bd281a796b631dd9a81b6d8ff0064c',
    'webBuild': '6.25.1',
    'xsecappid': 'xhs-pc-web',
    'loadts': '1782399494038',
    'abRequestId': '3e1bf5c3-4c20-5c61-bdb2-745cf744f6d5',
    'websectiga': 'f47eda31ec99545da40c2f731f0630efd2b0959e1dd10d5fedac3dce0bd1e04d',
    'sec_poison_id': '63cdb208-0bd9-440a-9243-5f77829d11f3',
    'gid': 'yjdii4jdSqVfyjdii4jdWYqDj0IMYvWI7d80Jf9ix6iMY728qCEDWS888JJJWYK8Jj04J4Sd',
    'unread': '{%22ub%22:%2264b67ec500000000120103ab%22%2C%22ue%22:%226415daa50000000013004bc7%22%2C%22uc%22:11}',
    'acw_tc': '0a8f06d817823994917181885ea60487646852eafd7d0b797893aa35f11e64',
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.8',
    'Content-Type': 'application/json;charset=UTF-8',
    'Referer': 'https://www.xiaohongshu.com/',
    'Origin': 'https://www.xiaohongshu.com',
}

# Minimal x-t (timestamp)
x_t = str(int(time.time() * 1000))

# Simple x-b3-traceid
x_b3 = ''.join(random.choices('0123456789abcdef', k=16))

# Simple x-xray-traceid
ts = int(time.time() * 1000)
x_xray = format((ts << 23) | random.randint(0, 0x7FFFFF), 'x')

def test_homefeed():
    url = 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed'

    body = {
        'cursor_score': '',
        'num': 20,
        'refresh_type': 1,
        'note_index': 0,
        'unread_begin_note_id': '',
        'unread_end_note_id': '',
        'unread_note_count': 0,
        'category': 'homefeed_recommend',
        'search_key': '',
        'need_num': 20,
        'image_formats': ['jpg', 'webp', 'avif'],
        'need_filter_image': False,
    }

    h = dict(HEADERS)
    # Try without x-s first (just timestamp + trace IDs)
    h['x-t'] = x_t
    h['x-b3-traceid'] = x_b3
    h['x-xray-traceid'] = x_xray

    s = requests.Session()
    for k, v in COOKIES.items():
        s.cookies.set(k, v, domain='.xiaohongshu.com')

    print(f'x-t: {x_t}')
    print(f'Cookies: {len(COOKIES)} items')

    resp = s.post(url, json=body, headers=h, timeout=30)
    print(f'Status: {resp.status_code}')
    print(f'Response length: {len(resp.text)}')
    print(f'Response: {resp.text[:500]}')

    return resp.json() if resp.text else {}

# Test 1: no x-s
print('=== Test: no x-s ===')
r = test_homefeed()
print()

# Test 2: try with empty x-s
print('=== Test: empty x-s ===')
HEADERS['x-s'] = ''
HEADERS['x-s-common'] = ''
r2 = test_homefeed()
