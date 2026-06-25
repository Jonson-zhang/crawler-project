"""Test homefeed API with curl_cffi TLS impersonation + full guest cookies"""
import json
import time
import random
from curl_cffi import requests as cffi_requests

# --- Current browser cookies (WITH web_session!) ---
COOKIE_DICT = {
    'a1': '19eff49e79ans8y7nue0afhmfs83xwb7j82uc3bdt50000222786',
    'webId': '98bd281a796b631dd9a81b6d8ff0064c',
    'webBuild': '6.25.1',
    'xsecappid': 'xhs-pc-web',
    'loadts': '1782399644688',
    'abRequestId': '3e1bf5c3-4c20-5c61-bdb2-745cf744f6d5',
    'websectiga': 'f47eda31ec99545da40c2f731f0630efd2b0959e1dd10d5fedac3dce0bd1e04d',
    'sec_poison_id': '63cdb208-0bd9-440a-9243-5f77829d11f3',
    'gid': 'yjdii4jdSqVfyjdii4jdWYqDj0IMYvWI7d80Jf9ix6iMY728qCEDWS888JJJWYK8Jj04J4Sd',
    'web_session': '030037ad0e16ef578177d704452d4abdf7c471',
    'acw_tc': '0a8f06d817823994917181885ea60487646852eafd7d0b797893aa35f11e64',
}

def make_cookie_header():
    return '; '.join(f'{k}={v}' for k, v in COOKIE_DICT.items())

def homefeed(cursor_score='', note_index=0):
    url = 'https://edith.xiaohongshu.com/api/sns/web/v1/homefeed'

    ts_ms = int(time.time() * 1000)
    x_b3 = ''.join(random.choices('0123456789abcdef', k=16))
    x_xray = format((ts_ms << 23) | random.randint(0, 0x7FFFFF), 'x')
    x_t = str(ts_ms)

    body = {
        'cursor_score': cursor_score,
        'num': 20,
        'refresh_type': 1,
        'note_index': note_index,
        'unread_begin_note_id': '',
        'unread_end_note_id': '',
        'unread_note_count': 0,
        'category': 'homefeed_recommend',
        'search_key': '',
        'need_num': 20,
        'image_formats': ['jpg', 'webp', 'avif'],
        'need_filter_image': False,
    }

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.8',
        'Content-Type': 'application/json;charset=UTF-8',
        'Referer': 'https://www.xiaohongshu.com/',
        'Origin': 'https://www.xiaohongshu.com',
        'Cookie': make_cookie_header(),
        'x-t': x_t,
        'x-b3-traceid': x_b3,
        'x-xray-traceid': x_xray,
    }

    # Try with Firefox TLS impersonation
    resp = cffi_requests.post(
        url,
        json=body,
        headers=headers,
        impersonate='firefox116',
        timeout=30,
    )
    return resp


print("=== Test 1: curl_cffi + Firefox110 impersonation + full cookies (no x-s) ===")
r = homefeed()
print(f'Status: {r.status_code}')
print(f'Response: {r.text[:500]}')
if r.status_code == 200:
    try:
        data = r.json()
        items = data.get('data', {}).get('items', [])
        print(f'Items count: {len(items)}')
        for i, item in enumerate(items[:5]):
            nc = item.get('note_card', item)
            print(f'  [{i+1}] {nc.get("display_title", nc.get("title", "?"))[:60]}')
    except:
        pass
