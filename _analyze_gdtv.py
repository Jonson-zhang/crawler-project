import urllib.request, gzip, re
from pathlib import Path

# Get page
req = urllib.request.Request('https://www.gdtv.cn/', headers={
    'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html'
})
resp = urllib.request.urlopen(req, timeout=15)
data = resp.read()
if resp.headers.get('Content-Encoding') == 'gzip':
    data = gzip.decompress(data)
html = data.decode('utf-8', errors='ignore')

# Extract JS URLs
scripts = re.findall(r'src="(https?://[^"]*?platforms/gdtv/js/[^"]*?\.js)"', html)
print("=== JS Bundles ===")
for s in sorted(set(scripts)):
    print(s)

# Download and analyze each bundle for API patterns
API_KEYWORDS = [
    b'channel/v1/news', b'gdtv-api', b'Authorization',
    b'x-app-id', b'appKey', b'sign', b'token', b'headers',
]

for url in set(scripts):
    name = url.split('/')[-1]
    print(f"\n=== {name} ===")
    try:
        req2 = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        resp2 = urllib.request.urlopen(req2, timeout=15)
        js = resp2.read()
        if resp2.headers.get('Content-Encoding') == 'gzip':
            js = gzip.decompress(js)

        # Check size
        kb = len(js) / 1024
        print(f"  Size: {kb:.1f}KB")

        # Search for keywords
        for kw in API_KEYWORDS:
            if kw in js:
                # Find context around first match
                idx = js.find(kw)
                start = max(0, idx - 100)
                end = min(len(js), idx + 200)
                ctx = js[start:end].decode('utf-8', errors='ignore')
                print(f"  -> found '{kw.decode()}' at {idx}: ...{ctx}...")

    except Exception as e:
        print(f"  Error: {e}")

# Also check HTML for meta config
metas = re.findall(r'<meta[^>]*>', html)
for m in metas:
    if 'api' in m.lower() or 'token' in m.lower() or 'config' in m.lower():
        print(f"\nMeta: {m}")

# Search for any inline JS config
inlines = re.findall(r'<script[^>]*>([^<]+)</script>', html)
for il in inlines:
    if 'api' in il or 'token' in il or 'config' in il or 'channel' in il:
        print(f"\nInline: {il[:300]}")
